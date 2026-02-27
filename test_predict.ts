import { config } from 'dotenv';
config();

async function testPredict() {
    const apiKey = process.env.GOOGLE_API_KEY;
    // Prediction endpoint for imagen-4.0
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

    const body = {
        instances: [{ prompt: "A simple red circle" }],
        parameters: { sampleCount: 1 }
    };

    try {
        console.log("Calling :predict for imagen-4.0-generate-001...");
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch failed:", err.message);
    }
}
testPredict();
