import fs from "fs/promises";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type OpenAI from "openai";

interface MCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

interface MCPConfig {
    mcpServers: Record<string, MCPServerConfig>;
}

// Global registry
const mcpClients = new Map<string, Client>();
const mcpToolsRegistry = new Map<string, { clientName: string, originalName: string }>();
let mcpOpenAITools: OpenAI.Chat.ChatCompletionTool[] = [];

/**
 * Initialize MCP clients based on mcp.json in the project root.
 */
export async function initMCP(): Promise<void> {
    const configPath = path.resolve(process.cwd(), "mcp.json");
    let config: MCPConfig;

    try {
        const fileContent = await fs.readFile(configPath, "utf-8");
        config = JSON.parse(fileContent);
    } catch (err) {
        console.log("[mcp] No mcp.json found or invalid. Skipping external MCPs.");
        return;
    }

    if (!config.mcpServers) return;

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        console.log(`[mcp] Connecting to server: ${serverName}...`);

        try {
            const transport = new StdioClientTransport({
                command: serverConfig.command,
                args: serverConfig.args,
                env: {
                    ...(process.env as Record<string, string>),
                    ...(serverConfig.env || {})
                }
            });

            const client = new Client(
                { name: "gravityclaw", version: "1.0.0" },
                { capabilities: {} }
            );

            await client.connect(transport);
            mcpClients.set(serverName, client);

            const toolsRes = await client.listTools();
            console.log(`[mcp] Connected to ${serverName}. Found ${toolsRes.tools.length} abstract tools.`);

            for (const t of toolsRes.tools) {
                // Prefix tools to avoid clashes e.g. "apify_search_web"
                const safeName = `mcp_${serverName}_${t.name}`.replace(/[^a-zA-Z0-9_-]/g, "_");

                mcpToolsRegistry.set(safeName, { clientName: serverName, originalName: t.name });

                mcpOpenAITools.push({
                    type: "function",
                    function: {
                        name: safeName,
                        description: `[MCP Server: ${serverName}] ${t.description || "No description"}`,
                        parameters: t.inputSchema as any
                    }
                });
            }
        } catch (err) {
            console.error(`[mcp] Failed to connect to ${serverName}:`, err);
        }
    }

    console.log(`[mcp] Finished loading. Exposing ${mcpOpenAITools.length} MCP tools to the agent.`);
}

export function getMCPTools(): OpenAI.Chat.ChatCompletionTool[] {
    return mcpOpenAITools;
}

export async function executeMCPTool(safeName: string, args: Record<string, any>): Promise<string> {
    const registryEntry = mcpToolsRegistry.get(safeName);
    if (!registryEntry) {
        return `Error: MCP tool ${safeName} not found in registry.`;
    }

    const client = mcpClients.get(registryEntry.clientName);
    if (!client) {
        return `Error: MCP client ${registryEntry.clientName} disconnected.`;
    }

    try {
        const result = (await client.callTool({
            name: registryEntry.originalName,
            arguments: args
        })) as any;

        // MCP results return an array of content objects (usually text)
        if (result.content && result.content.length > 0) {
            return result.content.map((c: any) => c.text || JSON.stringify(c)).join("\n");
        }
        return "✅ Tool executed successfully (no output).";
    } catch (err: any) {
        const msg = err.message.toLowerCase();
        if (msg.includes("limit") || msg.includes("usage") || msg.includes("exhausted") || msg.includes("quota")) {
            return `❌ MCP Usage Error: Your server (e.g. Apify) appears to have exhausted its usage limit or quota. Please check your account. Original error: ${err.message}`;
        }
        return `Error calling MCP tool ${safeName}: ${err.message}`;
    }
}
