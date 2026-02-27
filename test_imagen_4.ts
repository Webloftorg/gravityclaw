import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function testImagen4() {
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = ai.getGenerativeModel({ model: "imagen-4.0-generate-001" });
    try {
        console.log("Trying imagen-4.0-generate-001...");
        const res = await model.generateContent("A simple red circle");
        console.log("Success!");
        console.log(JSON.stringify(res.response, null, 2).substring(0, 500));
    } catch (err) {
        console.error("Failed:", err.message);
    }
}
testImagen4();
