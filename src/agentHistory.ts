/**
 * agentHistory.ts — Centralized conversation history for Telegram and Dashboard (Notepad).
 */
import type OpenAI from "openai";

const histories = new Map<number, OpenAI.Chat.ChatCompletionMessageParam[]>();

export function getHistory(userId: number): OpenAI.Chat.ChatCompletionMessageParam[] {
    if (!histories.has(userId)) {
        histories.set(userId, []);
    }
    return histories.get(userId)!;
}

export function clearHistory(userId: number) {
    histories.set(userId, []);
}
