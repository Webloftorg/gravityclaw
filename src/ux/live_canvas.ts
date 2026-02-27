import { WebSocketServer, WebSocket } from "ws";
import type OpenAI from "openai";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initLiveCanvas(port: number = 3001) {
    wss = new WebSocketServer({ port });
    console.log(`[ux] Live Canvas WebSocket server started on port ${port}`);

    wss.on("connection", (ws) => {
        clients.add(ws);
        console.log("[ux] Live Canvas client connected.");

        ws.on("close", () => {
            clients.delete(ws);
            console.log("[ux] Live Canvas client disconnected.");
        });
    });
}

export const liveCanvasTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "push_widget",
            description: "Push an interactive HTML/JS widget to the user's Live Canvas.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Title of the widget" },
                    html: { type: "string", description: "The HTML content of the widget" },
                    css: { type: "string", description: "Optional CSS for the widget" },
                    js: { type: "string", description: "Optional JS for the widget" }
                },
                required: ["title", "html"]
            }
        }
    }
];

export async function executeLiveCanvasTool(name: string, args: Record<string, any>): Promise<string> {
    if (name === "push_widget") {
        if (clients.size === 0) {
            return "⚠️ Warning: No Live Canvas clients connected. Open canvas.html to see it.";
        }

        const payload = JSON.stringify({
            type: "widget",
            ...args
        });

        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });

        return `✅ Pushed widget: ${args.title}`;
    }
    return `Error: Unknown Live Canvas tool ${name}`;
}
