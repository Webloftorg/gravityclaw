/**
 * tools/memory.ts — Tools for Core Memory management.
 *
 * Exposes the abilities for the agent to save and delete explicit facts
 * about the user in the SQLite core_facts table.
 */
import type OpenAI from "openai";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { saveFact, deleteFact } from "../memory/db.js";

// ── Save Fact Tool ────────────────────────────────────────────────────────────

export const saveCoreMemoryTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "core_memory_save",
        description: "Save a permanent, explicit core fact about the user. Use this for preferences, identity, rules, or important context that MUST ALWAYS be retrieved. Do NOT use this for conversational history.",
        parameters: {
            type: "object",
            properties: {
                key: {
                    type: "string",
                    description: "A short, descriptive, snake_case key (e.g. 'user_name', 'favorite_language', 'works_as')."
                },
                value: {
                    type: "string",
                    description: "The explicit fact to store."
                }
            },
            required: ["key", "value"],
        },
    },
};

export async function executeSaveCoreMemory(input: unknown): Promise<string> {
    const { key, value } = input as { key: string; value: string };
    await saveFact(key, value);
    return `Successfully saved core fact: ${key} = ${value}`;
}

// ── Delete Fact Tool ──────────────────────────────────────────────────────────

export const deleteCoreMemoryTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "core_memory_delete",
        description: "Delete a core fact that is no longer accurate.",
        parameters: {
            type: "object",
            properties: {
                key: {
                    type: "string",
                    description: "The snake_case key to delete."
                }
            },
            required: ["key"],
        },
    },
};

export async function executeDeleteCoreMemory(input: unknown): Promise<string> {
    const { key } = input as { key: string };
    await deleteFact(key);
    return `Successfully deleted core fact: ${key}`;
}

// ── Update Soul Tool ──────────────────────────────────────────────────────────

export const updateSoulTool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "update_soul",
        description: "Rewrite the soul.md file completely to change your core personality, tone, and formatting behavior. Use this only when the user explicitly asks to update your behavior or at the end of an interactive personality onboarding.",
        parameters: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "The full markdown content to save into your soul.md file. This defines who you are."
                }
            },
            required: ["content"],
        },
    },
};

export function executeUpdateSoul(input: unknown): string {
    const { content } = input as { content: string };
    const soulPath = resolve(process.cwd(), "soul.md");
    writeFileSync(soulPath, content, "utf-8");
    return "Successfully updated your soul.md identity. The new personality is now active.";
}
