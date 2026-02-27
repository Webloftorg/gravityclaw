import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function testGeminiImageGen() {
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    try {
        console.log("Testing gemini-2.0-flash for image generation...");
        // In Gemini 2.0, you might be able to just ask for an image if it's integrated,
        // but usually it's a tool call to Imagen.
        // However, some versions allow "generate an image of a cat" and it returns it in parts.
        const res = await model.generateContent("Generiere ein Bild von einer kleinen roten Kugel.");
        console.log("Response received.");
        const parts = res.response.candidates?.[0]?.content?.parts;
        console.log("Parts:", JSON.stringify(parts, null, 2));
    } catch (err) {
        console.error("Failed:", err.message);
    }
}
testGeminiImageGen();
