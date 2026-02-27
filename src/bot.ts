/**
 * bot.ts — grammy Telegram bot instance + message handling.
 *
 * Security model:
 *  - Whitelist guard runs on every update BEFORE any processing.
 *  - Unauthorized users are silently ignored (no error sent back,
 *    which would reveal the bot exists).
 *  - No web server. Long-polling only (started in index.ts).
 */
import { Bot, type Context } from "grammy";
import { TELEGRAM_BOT_TOKEN, ALLOWED_USER_IDS } from "./config.js";
import { runAgentLoop } from "./agent/loop.js";
import { transcribeAudio } from "./voice/transcribe.js";
import { textToSpeech } from "./voice/tts.js";
import { getFacts } from "./memory/db.js";
import { pendingApprovals } from "./tools/terminal.js";
import type OpenAI from "openai";

export const bot = new Bot(TELEGRAM_BOT_TOKEN);

import { getHistory, clearHistory } from "./agentHistory.js";

// ── Whitelist guard middleware ─────────────────────────────────────────────────
bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (!userId || !ALLOWED_USER_IDS.has(userId)) {
        // Silently drop — never reveal the bot's existence to strangers
        return;
    }
    await next();
});

// ── Helper: Safe Reply (Fallback for invalid Markdown & Chunking) ─────────────
const MAX_MSG_LENGTH = 4000;

async function safeReply(ctx: any, text: string) {
    if (!text) return;

    if (text.length <= MAX_MSG_LENGTH) {
        try {
            await ctx.reply(text, { parse_mode: "Markdown" });
        } catch (err) {
            console.warn("[bot] Markdown parsing failed, falling back to plain text.");
            try { await ctx.reply(text); } catch (e) { console.error("[bot] Plain text fallback failed:", e); }
        }
        return;
    }

    // Split long messages into smaller chunks
    let remaining = text;
    while (remaining.length > 0) {
        let chunk = remaining.slice(0, MAX_MSG_LENGTH);
        let splitIndex = MAX_MSG_LENGTH;

        if (remaining.length > MAX_MSG_LENGTH) {
            const lastNewline = chunk.lastIndexOf('\n');
            if (lastNewline > 0) {
                splitIndex = lastNewline;
            } else {
                const lastSpace = chunk.lastIndexOf(' ');
                if (lastSpace > 0) {
                    splitIndex = lastSpace;
                }
            }
            chunk = remaining.slice(0, splitIndex);
        } else {
            splitIndex = remaining.length;
        }

        try {
            await ctx.reply(chunk, { parse_mode: "Markdown" });
        } catch (err) {
            console.warn("[bot] Markdown parsing failed on chunk, falling back to plain text.");
            try { await ctx.reply(chunk); } catch (e) { console.error("[bot] Plain text chunk fallback failed:", e); }
        }
        remaining = remaining.slice(splitIndex).trimStart();
    }
}

// ── Helper: Send Agent Reply (Text + Conditional Voice) ───────────────────────
async function sendAgentReply(ctx: any, replyText: string) {
    const voiceMatch = replyText.match(/<voice>([\s\S]*?)<\/voice>/i);
    if (voiceMatch) {
        const spokenText = voiceMatch[1].trim();
        const cleanReply = replyText.replace(/<voice>[\s\S]*?<\/voice>/gi, "").trim();

        if (cleanReply) {
            await safeReply(ctx, cleanReply);
        }

        try {
            await ctx.replyWithChatAction("record_voice");
            console.log(`[tts] Generating voice reply (${spokenText.length} chars)...`);
            const ttsBuffer = await textToSpeech(spokenText);
            console.log(`[tts] Sending ${ttsBuffer.length} bytes audio...`);
            const { InputFile } = await import("grammy");
            await ctx.replyWithVoice(new InputFile(ttsBuffer, "reply.ogg"));
        } catch (err) {
            console.error("[tts] Failed to generate/send voice:", err);
            await ctx.reply("⚠️ Konnte Sprachnachricht nicht generieren.");
        }
    } else {
        if (replyText) {
            await safeReply(ctx, replyText);
        }
    }
}

// ── /start command ────────────────────────────────────────────────────────────
bot.command("start", async (ctx) => {
    await ctx.reply(
        "🦾 *Gravity Claw online.*\n\nI'm your personal AI agent. Talk to me naturally — text or voice. I'll use tools when needed.\n\nType or speak anything to begin.",
        { parse_mode: "Markdown" }
    );
});

// ── /clear command — reset conversation history ───────────────────────────────
bot.command("clear", async (ctx) => {
    const userId = ctx.from!.id;
    clearHistory(userId);
    await ctx.reply("🗑️ Conversation history cleared.");
});

// ── /context command — view current core profile ──────────────────────────────
bot.command("context", async (ctx) => {
    const facts = getFacts();
    await safeReply(ctx, `🧠 *Current Core Context:*\n\n${facts}`);
});

// ── Terminal HitL Confirmation Handlers ───────────────────────────────────────
bot.command("yes", async (ctx) => {
    const resolve = pendingApprovals.get(ctx.from!.id);
    if (resolve) {
        pendingApprovals.delete(ctx.from!.id);
        resolve(true);
    } else {
        await ctx.reply("Hinweis: Es gibt keinen ausstehenden Befehl, den du bestätigen müsstest.");
    }
});

bot.command("no", async (ctx) => {
    const resolve = pendingApprovals.get(ctx.from!.id);
    if (resolve) {
        pendingApprovals.delete(ctx.from!.id);
        resolve(false);
    } else {
        await ctx.reply("Hinweis: Es gibt keinen ausstehenden Befehl, den du ablehnen müsstest.");
    }
});

// ── Text message handler ──────────────────────────────────────────────────────
bot.on("message:text", async (ctx) => {
    const userId = ctx.from!.id; // guaranteed by whitelist guard
    const userMessage = ctx.message.text;

    // Check for pending approvals first
    const resolve = pendingApprovals.get(userId);
    if (resolve) {
        const lower = userMessage.trim().toLowerCase();
        if (["/yes", "yes", "y", "ja", "j", "ok", "mach", "do it", "bestätigen", "passt"].includes(lower)) {
            pendingApprovals.delete(userId);
            resolve(true);
            await ctx.reply("✅ Befehl wird ausgeführt...");
            return;
        } else if (["/no", "no", "n", "nein", "stop", "abort", "abbrechen"].includes(lower)) {
            pendingApprovals.delete(userId);
            resolve(false);
            await ctx.reply("❌ Befehl abgebrochen.");
            return;
        } else {
            await ctx.reply("⚠️ Du hast eine ausstehende Befehlsausführung. Bitte antworte zuerst mit 'ja' (/yes) oder 'nein' (/no).");
            return;
        }
    }

    // Show typing indicator while processing
    await ctx.replyWithChatAction("typing");

    const history = getHistory(userId);

    try {
        const reply = await runAgentLoop(userMessage, history, {
            userId,
            sendMessage: async (msg: string) => { await safeReply(ctx, msg); },
            sendPhoto: async (buffer: Buffer, caption?: string) => {
                const { InputFile } = await import("grammy");
                await ctx.replyWithPhoto(new InputFile(buffer), { caption, parse_mode: "Markdown" });
            }
        });
        await sendAgentReply(ctx, reply);
    } catch (err) {
        console.error("[bot] Agent loop error:", err);
        await ctx.reply("⚠️ Something went wrong. Check the logs.");
        history.pop();
    }
});

// ── Voice message handler ─────────────────────────────────────────────────────
bot.on("message:voice", async (ctx) => {
    const userId = ctx.from!.id;

    // Step 1: Acknowledge receipt immediately
    await ctx.replyWithChatAction("typing");

    try {
        // Step 2: Download the voice file from Telegram
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        console.log(`[voice] Downloading voice message from user ${userId}...`);
        const response = await fetch(fileUrl);
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        // Step 3: Transcribe via Groq Whisper
        console.log(`[voice] Transcribing ${audioBuffer.length} bytes...`);
        const transcript = await transcribeAudio(audioBuffer, file.file_path || "voice.ogg");
        console.log(`[voice] Transcript: "${transcript}"`);

        // Step 4: Confirm what was heard
        await safeReply(ctx, `🎤 *Verstanden:*\n_"${transcript}"_`);

        // Intercept approvals in voice as well
        const resolve = pendingApprovals.get(userId);
        if (resolve) {
            const lower = transcript.trim().toLowerCase().replace(/[.!?]/g, "");
            if (["yes", "ja", "j", "ok", "mach", "do it", "bestätigen", "passt"].includes(lower)) {
                pendingApprovals.delete(userId);
                resolve(true);
                await ctx.reply("✅ Befehl wird ausgeführt...");
                return;
            } else if (["no", "nein", "n", "stop", "abort", "abbrechen"].includes(lower)) {
                pendingApprovals.delete(userId);
                resolve(false);
                await ctx.reply("❌ Befehl abgebrochen.");
                return;
            }
        }

        // Step 5: Feed transcript into agent loop
        await ctx.replyWithChatAction("typing");
        const history = getHistory(userId);
        const reply = await runAgentLoop(transcript, history, {
            userId,
            sendMessage: async (msg: string) => { await safeReply(ctx, msg); },
            sendPhoto: async (buffer: Buffer, caption?: string) => {
                const { InputFile } = await import("grammy");
                await ctx.replyWithPhoto(new InputFile(buffer), { caption, parse_mode: "Markdown" });
            }
        });

        // Step 6: Send conditional text/voice reply
        await sendAgentReply(ctx, reply);
    } catch (err) {
        console.error("[voice] Transcription/agent/TTS error:", err);
        await ctx.reply("⚠️ Konnte die Sprachnachricht nicht verarbeiten. Check die Logs.");
    }
});


