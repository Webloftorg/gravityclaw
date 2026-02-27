/**
 * voice/tts.ts — Text-to-Speech via ElevenLabs API.
 *
 * Converts text to speech and returns an OGG audio buffer
 * that can be sent as a Telegram voice message.
 */
import { ELEVENLABS_API_KEY } from "../config.js";

// Default voice — change to any ElevenLabs voice ID.
// "Daniel" is a clear, natural German-capable male voice.
// Browse voices: https://elevenlabs.io/voice-library
const DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel

/**
 * Convert text to speech via ElevenLabs.
 * @param text   The text to speak.
 * @returns      Buffer containing OGG/Opus audio data.
 */
export async function textToSpeech(text: string): Promise<Buffer> {
    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2",
                output_format: "ogg_opus",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.0,
                },
            }),
        }
    );

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`[tts] ElevenLabs error (${response.status}):`, errBody);
        throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
}
