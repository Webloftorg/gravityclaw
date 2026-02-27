import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function listModels() {
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    try {
        const models = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }); // arbitrary model to get list?
        // Actually, there is a listModels method in the client
        // But the SDK might have it differently.
        // Let's just try gemini-2.0-flash-exp or similar if available for image gen?
        // Actually, let's try to find the Imagen 3 name.
        console.log("Listing models is not straight forward with this SDK. Let's try common names.");
    } catch (err) { }
}

async function tryModels() {
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const modelNames = [
        "imagen-3.0-generate-001",
        "imagen-3",
        "imagen-2",
        "gemini-1.5-pro",
        "gemini-1.5-flash"
    ];

    for (const name of modelNames) {
        console.log(`Trying model: ${name}`);
        const model = ai.getGenerativeModel({ model: name });
        try {
            const res = await model.generateContent("A simple red circle");
            console.log(`✅ Success with ${name}`);
            console.log(JSON.stringify(res.response).substring(0, 200));
            break;
        } catch (err) {
            console.log(`❌ Failed with ${name}: ${err.message}`);
        }
    }
}
tryModels();
