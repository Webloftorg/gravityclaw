/**
 * tools/time.ts — get_current_time tool (OpenAI function-calling format).
 */
import type OpenAI from "openai";

// ── Tool definition (passed to the LLM) ──────────────────────────────────────

export const toolDefinition: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "get_current_time",
        description:
            "Returns the current local date and time. Use this whenever the user asks about the time, date, day of the week, or anything time-related.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
};

// ── Tool executor ─────────────────────────────────────────────────────────────

export function executeTimeTool(): string {
    const now = new Date();
    return JSON.stringify({
        iso: now.toISOString(),
        local: now.toLocaleString("de-DE", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
        }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
}
