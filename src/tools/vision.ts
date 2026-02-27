/**
 * tools/vision.ts — Vision capabilities for Gravity Claw.
 */
import { readFileSync, existsSync } from "fs";
import { executeBrowserTool } from "./browser.js";
import { callLLM } from "../llm/openrouter.js";
import type OpenAI from "openai";

export const analyzeVisionTool = {
    type: "function",
    function: {
        name: "analyze_vision",
        description: "Analysiert einen Screenshot des Browsers oder ein Bild, um UI-Elemente zu prüfen oder Fehler zu finden.",
        parameters: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "Was soll im Bild analysiert werden? (z.B. 'Ist der Login-Button sichtbar?')" },
                filename: { type: "string", description: "Optional: Ein spezifischer Screenshot-Dateiname. Falls nicht angegeben, wird ein neuer erstellt.", default: "vision_temp.png" }
            },
            required: ["prompt"],
        },
    },
} as const;

/**
 * analyze_vision: Takes a screenshot and asks a vision model to interpret it.
 */
export async function analyze_vision({ prompt, filename = "vision_temp.png" }: { prompt: string, filename?: string }): Promise<string> {
    try {
        // 1. Take a screenshot via existing browser tool
        console.log(`[vision] Taking screenshot: ${filename}`);
        const screenshotResult = await executeBrowserTool("browser_screenshot", { filename });

        if (screenshotResult.includes("❌")) {
            return screenshotResult;
        }

        // 2. Read and encode image to base64
        if (!existsSync(filename)) {
            return "❌ Error: Screenshot file not found.";
        }
        const imageBuffer = readFileSync(filename);
        const base64Image = imageBuffer.toString("base64");
        const dataUrl = `data:image/png;base64,${base64Image}`;

        // 3. Call LLM with Vision model
        // We use a vision-capable model. Gemini 2.0 Flash is excellent and cheap.
        const visionModel = "google/gemini-2.0-flash-001";
        console.log(`[vision] Analyzing with ${visionModel}...`);

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: { url: dataUrl }
                    }
                ]
            }
        ];

        const response = await callLLM(messages, [], "You are a visual QA assistant for a web developer.", visionModel);
        const resultText = response.choices[0].message.content || "No analysis result.";

        return `👁️ Vision Analyse Ergebnis:\n\n${resultText}`;
    } catch (err: any) {
        console.error("[vision] Error in analyze_vision:", err);
        return `❌ Vision Error: ${err.message}`;
    }
}
