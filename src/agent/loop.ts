/**
 * agent/loop.ts — The agentic tool loop (OpenAI/OpenRouter message format).
 *
 * Reasoning cycle:
 *   User message → LLM → [tool_calls → execute → tool messages] × N → final reply
 *
 * Safety: hard cap of MAX_ITERATIONS.
 */
import type OpenAI from "openai";
import { callLLM } from "../llm/openrouter.js";
import { toolDefinition, executeTimeTool } from "../tools/time.js";
import {
    saveCoreMemoryTool, deleteCoreMemoryTool, updateSoulTool,
    executeSaveCoreMemory, executeDeleteCoreMemory, executeUpdateSoul
} from "../tools/memory.js";
import { getFacts } from "../memory/db.js";
import { searchEpisodes, saveEpisode } from "../memory/semantic.js";
import { readFileTool, writeFileTool, listDirectoryTool, executeFsTool } from "../tools/fs.js";
import { executeTerminalTool, executeTerminalCommand } from "../tools/terminal.js";
import { browserTools, executeBrowserTool } from "../tools/browser.js";
import { webSearchTools, executeWebSearchTool } from "../tools/web_search.js";
import { schedulerTools, executeSchedulerTool } from "../tools/scheduler.js";
import { recommendationTools, executeRecommendationTool } from "../proactive/recommendations.js";
import { liveCanvasTools, executeLiveCanvasTool } from "../ux/live_canvas.js";
import { getMCPTools, executeMCPTool } from "../mcp/client.js";
import {
    readNotepadTool, writeNotepadTool, read_notepad, write_notepad,
    getBoardTasksTool, updateTaskStatusTool, get_board_tasks, update_task_status,
    createBoardTaskTool, create_board_task
} from "../tools/dashboard.js";
import { analyzeVisionTool, analyze_vision } from "../tools/vision.js";
import { imageGenerationTools, executeImageGenTool } from "../tools/image_gen.js";
import { selectModel } from "../llm/orchestrator.js";
import { agentState } from "../agentState.js";

export interface AgentContext {
    userId: number;
    sendMessage: (msg: string) => Promise<void>;
    sendPhoto: (buffer: Buffer, caption?: string) => Promise<void>;
}

const MAX_ITERATIONS = 10;

// All registered tools
export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
    toolDefinition,
    saveCoreMemoryTool,
    deleteCoreMemoryTool,
    updateSoulTool,
    executeTerminalTool,
    readFileTool,
    writeFileTool,
    listDirectoryTool,
    ...browserTools,
    ...webSearchTools,
    ...schedulerTools,
    ...recommendationTools,
    ...liveCanvasTools,
    readNotepadTool,
    writeNotepadTool,
    getBoardTasksTool,
    updateTaskStatusTool,
    createBoardTaskTool,
    analyzeVisionTool,
    ...imageGenerationTools
];

/** Dispatch tool by name, return result string. */
async function executeTool(name: string, args: Record<string, unknown>, agentContext: AgentContext): Promise<string> {
    switch (name) {
        case "get_current_time":
            return executeTimeTool();
        case "core_memory_save":
            return executeSaveCoreMemory(args);
        case "core_memory_delete":
            return executeDeleteCoreMemory(args);
        case "update_soul":
            return executeUpdateSoul(args);
        case "execute_terminal":
            return await executeTerminalCommand(args, agentContext);
        case "read_file":
        case "write_file":
        case "list_directory":
            return await executeFsTool(name, args);
        case "browser_navigate":
        case "browser_click":
        case "browser_type":
        case "browser_extract":
        case "browser_screenshot":
            return await executeBrowserTool(name, args);
        case "web_search":
            return await executeWebSearchTool(name, args);
        case "schedule_task":
        case "list_scheduled_tasks":
        case "delete_scheduled_task":
            return await executeSchedulerTool(name, args, agentContext);
        case "recommend_next_step":
            return await executeRecommendationTool(name, args);
        case "push_widget":
            return await executeLiveCanvasTool(name, args);
        case "read_notepad":
            return read_notepad();
        case "write_notepad":
            return write_notepad(args as { text: string });
        case "get_board_tasks":
            return get_board_tasks();
        case "update_task_status":
            return await update_task_status(args as { taskId: string, status: string, message?: string });
        case "create_board_task":
            return create_board_task(args as { title: string, description?: string, priority?: string, scheduledAt?: string });
        case "analyze_vision":
            return await analyze_vision(args as { prompt: string, filename?: string });
        case "generate_image":
            return await executeImageGenTool(name, args, agentContext);
        default:
            if (name.startsWith("mcp_")) {
                return await executeMCPTool(name, args);
            }
            return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
}

/**
 * Run the full agentic loop for one user turn.
 *
 * @param userMessage  The raw text from the user.
 * @param history      Conversation history — mutated in place, caller owns it.
 * @returns            The final assistant text reply.
 */
export async function runAgentLoop(
    userMessage: string,
    history: OpenAI.Chat.ChatCompletionMessageParam[],
    agentContext: AgentContext
): Promise<string> {
    const userId = agentContext.userId;
    history.push({ role: "user", content: userMessage });

    // Set status to working
    agentState.status = 'working';

    try {
        // ── Pre-Turn: Gather State (Facts & Semantics) ───────────────────────────
        const facts = getFacts();

        let onboardingPrompt = "";
        if (facts === "No core facts known yet.") {
            onboardingPrompt = `

--- 🚨 MANDATORY ONBOARDING & SOUL CREATION 🚨 ---
Your CORE USER FACTS are currently empty. You MUST conduct an interactive onboarding interview to establish the user's profile AND your own personality.

🛠️ Phase 1: The User
Ask the user about their person/name, work environment, and primary goals. Keep it conversational. As soon as they answer a point, save it via the \`core_memory_save\` tool. Do this one by one.

🎭 Phase 2: Your Soul
Ask the user how they want YOU to behave (your tone, persona, communication style). Discuss it with them interactively. 

💾 Phase 3: Finalizing
Once a personality is agreed upon, generate a comprehensive markdown profile summarizing these behavioral rules and use the \`update_soul\` tool to save it to your soul.md.

Do NOT fulfill regular requests until these phases are complete. Start by warmly greeting the user and initiating Phase 1.`;
        }

        // RAG Search against episodic memory
        let episodicContext = "";
        if (userId) {
            const episodes = await searchEpisodes(userId, userMessage);
            if (episodes) {
                episodicContext = `\n--- RELEVANT PAST CONTEXT ---\n${episodes}`;
            }
        }

        let boardPrompt = "";
        if (userMessage.includes("Das Dashboard hat folgende neue Aufgabe")) {
            // Explicte Notepad directive handling
            boardPrompt = `\n--- KANBAN BOARD ---\nDer Nutzer hat dir gerade eine direkte Anweisung über das Notepad gegeben. Erfülle diese priorisiert. Wenn du den Status eines Kanban-Tasks ändern musst, nutze das tool update_task_status.`;
        } else {
            // Autonomous mode
            boardPrompt = `\n--- KANBAN BOARD ---\nWenn der Nutzer direkt mit dir chattet, antworte ihm normal. Du kannst mit create_board_task eigene Tasks auf dem Board anlegen (z.B. wenn der User bittet, etwas zur Liste hinzuzufügen oder 'erstelle eine webseite für kunden xy' sagt). Bist du im Leerlauf oder fragt der Nutzer nach Aufgaben, nutze get_board_tasks(), um das Kanban-Board zu prüfen. WÄHLE DANN AUTONOM den wichtigsten Task aus (Fälligkeit > 'Hoch' > 'Mittel') und bearbeite ihn. Verschiebe ihn mit update_task_status auf 'In Bearbeitung' und später auf 'Review'.`;
        }

        const dynamicSystemContext = `--- CORE USER FACTS ---\n${facts}${onboardingPrompt}\n${boardPrompt}\n${episodicContext}`;

        const selectedModel = selectModel(userMessage, history);
        console.log(`[agent] Selected model for this turn: ${selectedModel}`);

        let iterations = 0;

        let finalResponse = "";

        const activeTools = [...TOOLS, ...getMCPTools()];

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await callLLM(history, activeTools, dynamicSystemContext, selectedModel);
            const choice = response.choices[0];
            const message = choice.message;

            // Add assistant turn to history (includes tool_calls if any)
            history.push(message);

            // ── Terminal: no tool calls → done ───────────────────────────────────
            if (choice.finish_reason !== "tool_calls" || !message.tool_calls?.length) {
                finalResponse = message.content?.trim() || "Done.";

                // Background: Save to episodic memory periodically or after every turn
                if (userId) {
                    // In a real prod environment, you'd batch this and summarize.
                    // For level 2, we just store the direct Q&A interaction snippet.
                    saveEpisode(userId, `User: ${userMessage}\nClaw: ${finalResponse}`).catch(err => {
                        console.error("[agent] Failed to save episodic memory:", err);
                    });
                }

                return finalResponse;
            }

            // ── Execute all requested tool calls ──────────────────────────────────
            for (const toolCall of message.tool_calls) {
                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;

                console.log(`[agent] tool_call → ${name}`, args);
                const result = await executeTool(name, args, agentContext);
                console.log(`[agent] tool_result ← ${name}:`, result);

                // Feed each result back as a "tool" role message
                history.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result,
                });
            }
        }

    } finally {
        // Always reset status when the agent finishes its turn or crashes
        agentState.status = 'online';
    }

    throw new Error(`Agent loop exceeded MAX_ITERATIONS (${MAX_ITERATIONS}). Aborting.`);
}
