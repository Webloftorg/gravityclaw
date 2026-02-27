import { bot } from "../bot.js";
import { ALLOWED_USER_IDS } from "../config.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { runAgentLoop, type AgentContext } from "../agent/loop.js";

const HEARTBEAT_LOG_INTERVAL = 60 * 60 * 1000; // Log every hour
const HEARTBEAT_NOTIFY_INTERVAL = 12 * 60 * 60 * 1000; // Notify every 12 hours
const NOTEPAD_POLL_INTERVAL = 5000; // Poll notepad every 5 seconds

let lastNotepadTs: string | null = null;
const ROOT_DIR = process.cwd();
const NOTEPAD_PATH = join(ROOT_DIR, "notepad.json");

export function startHeartbeat() {
    console.log("[proactive] Heartbeat system started (including Notepad polling).");

    // Console logging loop
    setInterval(() => {
        console.log("[proactive] Heartbeat: Gravity Claw is alive and monitoring.");
    }, HEARTBEAT_LOG_INTERVAL);

    // User notification loop
    setInterval(async () => {
        for (const userId of ALLOWED_USER_IDS) {
            try {
                await bot.api.sendMessage(userId, "💓 *System Check:* Gravity Claw-Hintergrundprozesse laufen einwandfrei.", { parse_mode: "Markdown" });
            } catch (err) {
                console.error(`[proactive] Heartbeat notification failed for ${userId}:`, err);
            }
        }
    }, HEARTBEAT_NOTIFY_INTERVAL);

    // Notepad Background Polling Loop
    setInterval(async () => {
        try {
            if (!existsSync(NOTEPAD_PATH)) return;
            const data = JSON.parse(readFileSync(NOTEPAD_PATH, "utf-8"));

            // If the dashboard updated the notepad and the timestamp is new
            if (data.ts && data.ts !== lastNotepadTs) {
                // Initialize lastNotepadTs on first run without triggering
                if (lastNotepadTs === null) {
                    lastNotepadTs = data.ts;
                    return;
                }

                lastNotepadTs = data.ts;
                const taskText = data.text;
                console.log(`[proactive] New directive received from dashboard: "${taskText.substring(0, 50)}..."`);

                // Trigger the agent loop for the primary user
                const primaryUserId = Array.from(ALLOWED_USER_IDS)[0];
                if (!primaryUserId) return;

                const agentContext: AgentContext = {
                    userId: primaryUserId,
                    sendMessage: async (msg: string) => {
                        // Optionally send to TG, or just log to memory
                        try {
                            await bot.api.sendMessage(primaryUserId, `🖥️ *Dashboard Task Output:*\n${msg}`, { parse_mode: "Markdown" });
                        } catch (e) { /* ignore markdown errors */ }
                    },
                    sendPhoto: async (buffer: Buffer, caption?: string) => {
                        const { InputFile } = await import("grammy");
                        await bot.api.sendPhoto(primaryUserId, new InputFile(buffer), { caption });
                    }
                };

                const { getHistory } = await import("../agentHistory.js");
                const history = getHistory(primaryUserId);

                // Add the task to history and run loop
                await runAgentLoop(`Das Dashboard hat folgende neue Aufgabe (Active Directive) für dich: ${taskText}\n\nHinweis: Behalte deinen aktuellen Kontext.`, history, agentContext);
            }
        } catch (err) {
            console.error("[proactive] Notepad poll error:", err);
        }
    }, NOTEPAD_POLL_INTERVAL);
}
