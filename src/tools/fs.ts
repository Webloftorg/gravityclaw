import * as fs from "fs/promises";
import * as path from "path";
import type OpenAI from "openai";

export const readFileTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "read_file",
        description: "Read the full contents of a file at the specified absolute path.",
        parameters: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Absolute path to the file" }
            },
            required: ["filePath"]
        }
    }
};

export const writeFileTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "write_file",
        description: "Write content to a file at the specified absolute path. Will completely overwrite the file if it exists, and create necessary parent directories.",
        parameters: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Absolute path to the file" },
                content: { type: "string", description: "The complete new content of the file" }
            },
            required: ["filePath", "content"]
        }
    }
};

export const listDirectoryTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "list_directory",
        description: "List contents of a directory at the specified absolute path.",
        parameters: {
            type: "object",
            properties: {
                dirPath: { type: "string", description: "Absolute path to the directory" }
            },
            required: ["dirPath"]
        }
    }
};

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_ROOT = process.cwd();

/** Helper to ensure path is within allowed root */
function validatePath(targetPath: string) {
    const absolutePath = path.resolve(targetPath);
    if (!absolutePath.startsWith(path.resolve(ALLOWED_ROOT))) {
        throw new Error(`Security Error: Access to path "${targetPath}" is denylisted. You can only access files within ${ALLOWED_ROOT}`);
    }
    return absolutePath;
}

export async function executeFsTool(name: string, args: Record<string, any>): Promise<string> {
    try {
        if (name === "read_file") {
            const safePath = validatePath(args.filePath);
            const stats = await fs.stat(safePath);
            if (stats.size > MAX_FILE_SIZE) {
                return `❌ Error: File is too large (${(stats.size / 1024).toFixed(1)} KB). Limit is 1MB.`;
            }
            const content = await fs.readFile(safePath, "utf-8");
            return content;
        } else if (name === "write_file") {
            const safePath = validatePath(args.filePath);
            if (args.content.length > MAX_FILE_SIZE) {
                return `❌ Error: Content is too large (${(args.content.length / 1024).toFixed(1)} KB). Limit is 1MB.`;
            }
            await fs.mkdir(path.dirname(safePath), { recursive: true });
            await fs.writeFile(safePath, args.content, "utf-8");
            return `✅ Successfully wrote ${args.content.length} bytes to ${safePath}`;
        } else if (name === "list_directory") {
            const safePath = validatePath(args.dirPath);
            const files = await fs.readdir(safePath, { withFileTypes: true });
            const output = files.map(f => `${f.isDirectory() ? "[DIR]" : "[FILE]"} ${f.name}`).join("\n");
            return output || "Directory is empty.";
        }
        return `Error: Unknown fs tool ${name}`;
    } catch (err: any) {
        return `❌ Error executing fs tool: ${err.message}`;
    }
}
