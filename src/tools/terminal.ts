import { exec } from "child_process";
import { promisify } from "util";
import type OpenAI from "openai";

const execAsync = promisify(exec);

export const pendingApprovals = new Map<number, (approved: boolean) => void>();

export const executeTerminalTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "execute_terminal",
        description: "Execute a command in the host machine's terminal. Use this to install packages, run builds, start development servers, or manage the local file system. Important: The user will be asked via Telegram to approve this command before it actually runs. Do not assume it ran if they deny it.",
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", description: "The terminal command to run (e.g. 'npm install', 'mkdir foo')" },
                cwd: { type: "string", description: "The working directory (optional, defaults to project root)" }
            },
            required: ["command"]
        }
    }
};

const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Basic allowlist for safety. In a real scenario, this would be more granular.
const ALLOWED_COMMAND_PREFIXES = [
    "npm ", "ls", "dir", "mkdir ", "cd ", "pwd", "git ", "cat ", "type ", "echo ", "ps ", "node ", "tsx "
];

export async function executeTerminalCommand(
    args: Record<string, any>,
    agentContext: { userId: number; sendMessage: (msg: string) => Promise<void> }
): Promise<string> {
    const { command, cwd } = args;

    // 0. Pre-check Allowlist
    console.log(`[terminal] Checking command: "${command}"`);
    const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix => command.trim().toLowerCase().startsWith(prefix.trim().toLowerCase()));
    if (!isAllowed) {
        console.warn(`[terminal] Blocked disallowed command: "${command}"`);
        return `❌ Security Error: Command "${command}" is not in the allowlist. Only basic dev/fs commands are permitted.`;
    }

    // 1. Send approval request out-of-band
    console.log(`[terminal] Requesting approval for user ${agentContext.userId}`);
    await agentContext.sendMessage(
        `⚠️ *Terminal Execution Request*\n\nI want to run:\n\`${command}\`\n\nApprove?\nReply with **/yes** or **/no**.`
    );

    // 2. Wait for user input with a tool-level timeout (5 mins)
    const approved = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
            console.log(`[terminal] Approval timeout reached for user ${agentContext.userId}`);
            pendingApprovals.delete(agentContext.userId);
            resolve(false);
        }, 5 * 60 * 1000); // 5 minutes

        pendingApprovals.set(agentContext.userId, (result) => {
            clearTimeout(timeout);
            console.log(`[terminal] Approval received: ${result}`);
            resolve(result);
        });
    });

    if (!approved) {
        return `❌ User denied execution of command: ${command}`;
    }

    await agentContext.sendMessage(`⚙️ Executing:\n\`${command}\``);
    try {
        // Simple Windows path fix: resolve ~ to user profile
        let finalCommand = command;
        if (process.platform === "win32" && command.includes("~/")) {
            const userProfile = process.env.USERPROFILE || "";
            finalCommand = command.replace("~/", userProfile + "\\");
            console.log(`[terminal] Resolved Windows path: ${finalCommand}`);
        }

        console.log(`[terminal] Executing final command: ${finalCommand}`);
        const { stdout, stderr } = await execAsync(finalCommand, {
            cwd: cwd || process.cwd(),
            timeout: DEFAULT_TIMEOUT
        });
        const output = [];
        if (stdout) output.push(`STDOUT:\n${stdout.slice(0, 2000)}${stdout.length > 2000 ? '\n...[TRUNCATED]' : ''}`);
        if (stderr) output.push(`STDERR:\n${stderr.slice(0, 2000)}${stderr.length > 2000 ? '\n...[TRUNCATED]' : ''}`);
        return output.join("\n\n") || "✅ Command executed successfully (no output).";
    } catch (err: any) {
        if (err.killed) {
            return `❌ Command timed out after ${DEFAULT_TIMEOUT / 1000} seconds.`;
        }
        return `❌ Command failed with Error:\n${err.message}\nSTDOUT:\n${err.stdout}\nSTDERR:\n${err.stderr}`;
    }
}
