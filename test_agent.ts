import { runAgentLoop, AgentContext } from './src/agent/loop.js';
import { db } from './src/memory/db.js';

async function test() {
    const context: AgentContext = {
        userId: 123,
        sendMessage: async (msg) => { console.log("AGENT SAYS:", msg); },
        sendPhoto: async () => { }
    };

    const history: any[] = [];

    console.log("Testing user message: erstelle einen task für wocheneinkauf");
    try {
        const reply = await runAgentLoop("erstelle einen task für wocheneinkauf", history, context);
        console.log("FINAL REPLY:", reply);
    } catch (err) {
        console.error("ERROR:", err);
    }
}

test();
