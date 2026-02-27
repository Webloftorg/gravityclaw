import { config } from 'dotenv';
config();

async function testRest() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateContent?key=${apiKey}`;

    const body = {
        contents: [{
            parts: [{ text: "A simple red circle" }]
        }]
    };

    try {
        console.log("Calling REST API for imagen-3.0-generate-001 with key...");
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
testRest();
