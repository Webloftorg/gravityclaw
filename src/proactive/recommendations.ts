import type OpenAI from "openai";

export const recommendationTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "recommend_next_step",
            description: "Suggest a proactive action or next step to the user.",
            parameters: {
                type: "object",
                properties: {
                    recommendation: { type: "string", description: "The human readable suggestion" },
                    reasoning: { type: "string", description: "Why this is recommended now" }
                },
                required: ["recommendation"]
            }
        }
    }
];

export async function executeRecommendationTool(name: string, args: Record<string, any>): Promise<string> {
    if (name === "recommend_next_step") {
        return `💡 *Proactive Suggestion:*\n${args.recommendation}\n\n_Why? ${args.reasoning || "Based on your current activity."}_`;
    }
    return `Error: Unknown recommendation tool ${name}`;
}
