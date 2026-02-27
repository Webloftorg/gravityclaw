import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function listModels() {
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    try {
        // The SDK doesn't have a direct listModels on the main class
        // It's usually on the generative AI client if using the REST API or Vertex AI.
        // For the Gemini API, we can use the listModels endpoint.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Failed to list models:", err.message);
    }
}
listModels();
