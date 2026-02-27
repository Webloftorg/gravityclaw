import type OpenAI from "openai";

/**
 * Image Generation tool using Google's Imagen 4 model (via REST API).
 */
export const imageGenerationTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Generiert ein Bild basierend auf einer Textbeschreibung (Prompt).",
            parameters: {
                type: "object",
                properties: {
                    prompt: {
                        type: "string",
                        description: "Die Beschreibung des Bildes, das generiert werden soll."
                    }
                },
                required: ["prompt"]
            }
        }
    }
];

export async function executeImageGenTool(
    name: string,
    args: Record<string, any>,
    agentContext: { sendPhoto: (buffer: Buffer, caption?: string) => Promise<void> }
): Promise<string> {
    if (name === "generate_image") {
        const { prompt } = args;
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return "❌ Fehler: GOOGLE_API_KEY ist nicht konfiguriert.";
        }

        try {
            console.log(`[image_gen] Generiere Bild (Imagen 4) für Prompt: "${prompt}"...`);

            // Using the proven :predict endpoint for Imagen 4
            const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

            const body = {
                instances: [{ prompt }],
                parameters: { sampleCount: 1 }
            };

            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const prediction = data.predictions?.[0];

            if (prediction && prediction.bytesBase64Encoded) {
                const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
                await agentContext.sendPhoto(buffer, `🎨 Imagen 4: "${prompt}"`);
                return "✅ Bild erfolgreich generiert und gesendet.";
            } else if (prediction && prediction.inlineData) {
                // Alternative structure seen in some versions
                const buffer = Buffer.from(prediction.inlineData.data, 'base64');
                await agentContext.sendPhoto(buffer, `🎨 Imagen 4: "${prompt}"`);
                return "✅ Bild erfolgreich generiert und gesendet.";
            } else {
                console.log("[image_gen] Unerwartete Antwortstruktur:", JSON.stringify(data, null, 2));
                return "❌ Fehler: Das Modell hat keine Bilddaten zurückgegeben.";
            }

        } catch (err: any) {
            console.error("[image_gen] Fehler bei der Bildgenerierung:", err);
            return `❌ Fehler bei der Bildgenerierung: ${err.message}`;
        }
    }

    return `Error: Unknown tool ${name}`;
}
