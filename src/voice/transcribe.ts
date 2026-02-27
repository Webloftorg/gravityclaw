/**
 * voice/transcribe.ts — Voice message transcription via Groq Whisper.
 *
 * Uses Groq's free whisper-large-v3-turbo endpoint.
 * Same OpenAI SDK, different baseURL — zero extra dependencies.
 */
import OpenAI from "openai";
import { GROQ_API_KEY } from "../config.js";

const groq = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Transcribe an audio buffer using Groq's Whisper.
 * @param audioBuffer  Raw OGG/OGA audio bytes from Telegram.
 * @param filename     Original filename (helps Whisper detect format).
 * @returns            The transcribed text.
 */
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    // Convert to Uint8Array for File constructor compatibility
    const uint8 = new Uint8Array(audioBuffer);
    // Telegram uses .oga extension — normalize to .ogg so Groq accepts it
    const normalizedName = filename.replace(/\.oga$/, ".ogg");
    const file = new File([uint8], normalizedName, { type: "audio/ogg" });

    const transcription = await groq.audio.transcriptions.create({
        model: "whisper-large-v3-turbo",
        file,
        language: "de", // German by default — Whisper auto-detects if wrong
    });

    return transcription.text;
}
