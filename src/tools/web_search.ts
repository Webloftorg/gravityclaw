import { search as ddgSearch } from "duck-duck-scrape";
import { tavily } from "@tavily/core";
import { TAVILY_API_KEY } from "../config.js";
import type OpenAI from "openai";

export const webSearchTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for a query. Uses high-quality search services.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The search query" },
                    limit: { type: "number", description: "Number of results to return (default 5)" }
                },
                required: ["query"]
            }
        }
    }
];

export async function executeWebSearchTool(name: string, args: Record<string, any>): Promise<string> {
    if (name === "web_search") {
        const query = args.query;
        const limit = args.limit || 5;

        // 1. PRIMARY: Tavily
        if (TAVILY_API_KEY) {
            try {
                console.log(`[search] Using Tavily (Primary) for query: "${query}"`);
                const tvly = tavily({ apiKey: TAVILY_API_KEY });
                const response = await tvly.search(query, {
                    searchDepth: "basic",
                    maxResults: limit
                });

                if (response.results && response.results.length > 0) {
                    let output = `🔍 *Search Results (Tavily) for "${query}":*\n\n`;
                    response.results.forEach((r, i) => {
                        output += `${i + 1}. **${r.title}**\n   ${r.content}\n   [Link](${r.url})\n\n`;
                    });
                    return output;
                }
            } catch (err: any) {
                console.error("[search] Tavily error:", err.message);
                // Fallback to DDG if Tavily fails
            }
        }

        // 2. BACKUP: DuckDuckGo
        try {
            console.log(`[search] Fallback to DuckDuckGo for query: "${query}"`);
            const results = await ddgSearch(query);
            if (!results.results || results.results.length === 0) {
                return "No results found.";
            }

            const topResults = results.results.slice(0, limit);
            let output = `⚠️ *Note: Using DuckDuckGo fallback (Tavily key missing or failed).*\n\n` +
                `🔍 *Search Results for "${query}":*\n\n`;

            topResults.forEach((r, i) => {
                output += `${i + 1}. **${r.title}**\n   ${r.description}\n   [Link](${r.url})\n\n`;
            });

            return output;
        } catch (err: any) {
            console.error("[search] DDG error:", err.message);
            if (err.message.includes("anomaly")) {
                return "❌ Search Error: DuckDuckGo blocked the request. Please add a `TAVILY_API_KEY` to your .env for reliable search.";
            }
            return `❌ Search error: ${err.message}`;
        }
    }
    return `Error: Unknown search tool ${name}`;
}
