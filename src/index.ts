/**
 * index.ts — Entrypoint. Starts the bot via long-polling.
 *
 * No HTTP server is created. Telegram long-polling means:
 *  - No exposed ports
 *  - No public URL required
 *  - Works behind any NAT/firewall
 */
import { bot } from "./bot.js";
import { ALLOWED_USER_IDS } from "./config.js";
import { MODEL } from "./llm/openrouter.js";
import { initMCP } from "./mcp/client.js";
import { startHeartbeat } from "./proactive/heartbeat.js";
import { initLiveCanvas } from "./ux/live_canvas.js";
import { startUIAPI } from "./ui.js";

async function startup() {
    console.log("🦾 Gravity Claw starting...");
    console.log(`   Whitelisted users: ${ALLOWED_USER_IDS.size}`);
    console.log("   Transport: Telegram long-polling (no web server)");
    console.log(`   Model: ${MODEL}`);
    console.log("   Voice: Groq Whisper (de)");

    await initMCP();
    startHeartbeat();
    initLiveCanvas(3001);
    startUIAPI();

    console.log("");

    bot.start({
        onStart: (botInfo) => {
            console.log(`✅ Gravity Claw online — @${botInfo.username}`);
            console.log("   Waiting for messages...\n");
        },
    });
}

startup().catch(err => {
    console.error("Failed to start:", err);
    process.exit(1);
});
