/**
 * config.ts — Environment loading & validation.
 * Fails fast at startup if required env vars are missing.
 * Secrets never touch logs or memory files.
 */
import { config } from "dotenv";

config(); // load .env

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const TELEGRAM_BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN");
export const OPENROUTER_API_KEY = requireEnv("OPENROUTER_API_KEY");
export const GOOGLE_API_KEY = requireEnv("GOOGLE_API_KEY");
export const GROQ_API_KEY = requireEnv("GROQ_API_KEY");
export const ELEVENLABS_API_KEY = requireEnv("ELEVENLABS_API_KEY");
export const TAVILY_API_KEY = process.env.TAVILY_API_KEY; // Optional
export const SUPABASE_URL = requireEnv("SUPABASE_URL");
export const SUPABASE_KEY = requireEnv("SUPABASE_KEY");

// Parse comma-separated user IDs into a Set<number>
const rawIds = requireEnv("ALLOWED_USER_IDS");
export const ALLOWED_USER_IDS: Set<number> = new Set(
    rawIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => {
            const n = parseInt(id, 10);
            if (isNaN(n)) throw new Error(`Invalid user ID in ALLOWED_USER_IDS: "${id}"`);
            return n;
        })
);
