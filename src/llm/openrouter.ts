/**
 * llm/openrouter.ts — OpenRouter LLM client wrapper.
 *
 * OpenRouter provides an OpenAI-compatible API that routes to 200+ models.
 * We use the `openai` SDK with a custom baseURL — zero custom code needed.
 */
import OpenAI from "openai";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { OPENROUTER_API_KEY } from "../config.js";
import { loadSkills } from "../skills/loader.js";

export const client = new OpenAI({
    apiKey: OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/gravityclaw",
        "X-Title": "Gravity Claw",
    },
});

// Free models on OpenRouter — change to any model you like.
// See https://openrouter.ai/models?order=free for free options.
export const MODEL = "google/gemini-2.5-flash";

function getSoul(): string {
    const soulPath = resolve(process.cwd(), "soul.md");
    if (existsSync(soulPath)) {
        return readFileSync(soulPath, "utf-8");
    }
    return "You are Gravity Claw — a lean, secure personal AI agent.";
}

const TECHNICAL_PROMPT = `--- HARDCODED TECHNICAL INTRUCTIONS ---
You have access to tools that extend your capabilities. When a tool is useful, use it; otherwise answer directly.

CRITICAL BEHAVIORAL INSTRUCTION: Your answers MUST be exceedingly short and concise. No yapping, no fluff, no disclaimers. Give only the exact answer requested. Explain things in very few words.

CRITICAL VOICE INSTRUCTION: You have the ability to send voice messages via ElevenLabs. However, you should ONLY send a voice message if the user EXPLICITLY asks you to speak or reply with audio. To send a voice message, wrap the text you want to be spoken inside exactly <voice>...</voice> tags. Do NOT wrap code blocks or complex formatting inside voice tags.

- \`push_widget\`: display live UI elements on the dashboard
- \`read_notepad\`, \`write_notepad\`: read or update the user's dashboard notepad
- \`analyze_vision\`: analyze an image or screenshot to verify UI or find errors. **REQUIREMENT:** Use this when checking if a website looks correct or matches a design.

PREFERENCE: Always prefer native file tools (\`read_file\`, etc.) over terminal commands when managing files.
PROACTIVE: You are encouraged to use \`write_notepad\` to leave a "Closing Report" or "Next Steps" for the user after finishing a task.`;

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GOOGLE_API_KEY } from "../config.js";

/** Call the LLM with the current history and registered tools. 
 *  Routes dynamically to Google Generative AI (Gemini) or OpenRouter.
 */
export async function callLLM(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
    dynamicContext: string = "",
    modelOverride?: string
): Promise<OpenAI.Chat.ChatCompletion> {
    const selectedModel = modelOverride || MODEL;

    try {
        const skills = await loadSkills();

        // Dynamically inject tool awareness
        const { TOOLS } = await import("../agent/loop.js");
        const toolAwareness = `\n--- AVAILABLE TOOLS / DEINE FÄHIGKEITEN ---\nDu hast Zugriff auf folgende Werkzeuge, um Aufgaben für den User zu erledigen:\n` +
            TOOLS.map(t => `- **${t.function.name}**: ${t.function.description}`).join("\n") +
            `\nNutze diese Tools proaktiv. Wenn der User etwas bittet, was damit machbar ist, führe das Tool direkt aus.`;

        const fullSystemPrompt = [
            getSoul(),
            TECHNICAL_PROMPT,
            skills,
            toolAwareness,
            dynamicContext
        ].filter(Boolean).join("\n\n");

        if (selectedModel.startsWith("gemini")) {
            // Native Gemini Call via Google AI Studio
            if (!GOOGLE_API_KEY) {
                throw new Error("GOOGLE_API_KEY is missing for Gemini routing.");
            }

            const genai = new GoogleGenerativeAI(GOOGLE_API_KEY);
            const model = genai.getGenerativeModel({
                model: selectedModel,
                // Gemini system prompt configuration
                systemInstruction: fullSystemPrompt
            });

            // Convert OpenAI format messages to Gemini format
            const geminiHistory = messages.map(msg => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            }));

            // Map OpenAI Tools to Gemini format
            let geminiTools: any = undefined;
            if (tools && tools.length > 0) {
                // Recursively remove keys not supported by Gemini's strict OpenAPI schema
                const sanitizeGeminiSchema = (obj: any): any => {
                    if (Array.isArray(obj)) {
                        return obj.map(sanitizeGeminiSchema);
                    } else if (obj !== null && typeof obj === 'object') {
                        const newObj: any = {};
                        for (const key in obj) {
                            if (!["$schema", "$id", "additionalProperties", "prefill", "examples", "enumTitles", "default"].includes(key)) {
                                newObj[key] = sanitizeGeminiSchema(obj[key]);
                            }
                        }
                        return newObj;
                    }
                    return obj;
                };

                geminiTools = tools.map(t => {
                    return {
                        functionDeclarations: [{
                            name: t.function.name,
                            description: t.function.description,
                            parameters: t.function.parameters ? sanitizeGeminiSchema(t.function.parameters) : undefined
                        }]
                    }
                });
            }

            const chat = model.startChat({
                history: geminiHistory.slice(0, -1), // All except last
                tools: geminiTools
            });

            const lastMessage = geminiHistory[geminiHistory.length - 1];

            console.log(`[llm] Routing to Gemini API: ${selectedModel}`);
            const result = await chat.sendMessage(lastMessage.parts[0].text);
            const responseText = result.response.text();

            // Simulate OpenAI response format to maintain compatibility with `agent/loop.ts`
            const functionCalls = result.response.functionCalls();

            const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined = functionCalls ? functionCalls.map((fc, index) => ({
                id: `call_${index}`,
                type: 'function',
                function: {
                    name: fc.name,
                    arguments: JSON.stringify(fc.args)
                }
            })) : undefined;

            return {
                id: `gemini-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: selectedModel,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: responseText || null,
                        tool_calls: toolCalls
                    },
                    finish_reason: toolCalls ? 'tool_calls' : 'stop'
                }],
            } as OpenAI.Chat.ChatCompletion;

        } else {
            // OpenRouter Fallback / Client
            const orModel = selectedModel.replace("openrouter/", "");
            console.log(`[llm] Routing to OpenRouter API: ${orModel}`);

            return await client.chat.completions.create({
                model: orModel,
                max_tokens: 4096,
                messages: [{ role: "system", content: fullSystemPrompt }, ...messages],
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? "auto" : undefined,
            });
        }
    } catch (err: unknown) {
        const error = err as { status?: number; message?: string; error?: unknown };
        console.error(`[llm] Router error(${error.status}): `, error.message || error.error || err);
        throw err;
    }
}

/**
 * Sendet einen Prompt an ein spezifisches LLM-Modell und gibt die Textvervollständigung zurück.
 *
 * @param modelName - Der Name des zu verwendenden Modells (z.B. "gemini-2.5-pro", "openrouter/mistralai/mixtral-8x7b-instruct").
 * @param prompt - Der Text-Prompt für das LLM.
 * @param temperature - Die Kreativität des Modells (0.0 - 1.0). Niedriger für fokussierte, höher für kreative Antworten.
 * @param maxTokens - Die maximale Anzahl der zu generierenden Tokens.
 * @returns Die generierte Textantwort des Modells.
 */
export async function llmTextCompletion(modelName: string, prompt: string, temperature: number = 0.7, maxTokens: number = 1024): Promise<string> {
    if (modelName.startsWith("gemini")) {
        // Google Gemini Modelle über Google AI Studio (Native)
        if (!GOOGLE_API_KEY) {
            throw new Error("GOOGLE_API_KEY environment variable not set for Gemini models.");
        }

        const genai = new GoogleGenerativeAI(GOOGLE_API_KEY);
        try {
            const model = genai.getGenerativeModel({ model: modelName });
            const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: maxTokens,
                }
            });
            return response.response.text();
        } catch (error: any) {
            throw new Error(`Fehler bei Gemini API-Aufruf (${modelName}): ${error.message || error}`);
        }

    } else if (modelName.startsWith("openrouter/")) {
        // Modelle über OpenRouter.ai
        try {
            const response = await client.chat.completions.create({
                model: modelName.replace("openrouter/", ""), // OpenRouter doesn't need the prefix in the actual call
                messages: [{ role: "user", content: prompt }],
                temperature: temperature,
                max_tokens: maxTokens,
            });
            return response.choices[0]?.message?.content || "";
        } catch (error: any) {
            throw new Error(`Fehler bei OpenRouter API-Aufruf (${modelName}): ${error.message || error}`);
        }
    } else {
        throw new Error(`Unbekannter Modell-Präfix oder Modellname: ${modelName}. Unterstützt 'gemini...' und 'openrouter/...'.`);
    }
}

