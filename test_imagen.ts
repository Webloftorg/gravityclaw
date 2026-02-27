import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function test() {
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = ai.getGenerativeModel({ model: "imagen-3.0-generate-001" });
    try {
        const res = await model.generateContent("A futuristic city in the clouds");
        console.log("Success with generateContent:");
        console.log(JSON.stringify(res.response, null, 2).substring(0, 500));
    } catch (err) {
        console.error("generateContent failed:", err.message);
    }
}
test();
