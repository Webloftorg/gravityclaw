import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function testImagenV1Beta() {
    // Note: The SDK doesn't easily allow setting v1beta for generateContent via the main class
    // in older versions, but we can try to pass it in the model name or use a different client.
    // However, the error message specifically mentioned v1beta.

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "imagen-3.0-generate-001" }, { apiVersion: 'v1beta' });

    try {
        console.log("Trying imagen-3.0-generate-001 with v1beta...");
        const res = await model.generateContent("A simple red circle");
        console.log("Success!");
        console.log(JSON.stringify(res.response, null, 2).substring(0, 500));
    } catch (err) {
        console.error("Failed:", err.message);
    }
}
testImagenV1Beta();
