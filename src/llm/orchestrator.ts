/**
 * llm/orchestrator.ts — Orchestrates model selection for cost-efficiency and quality.
 */
import { MODEL as DEFAULT_MODEL } from "./openrouter.js";

export type TaskCategory = "chat" | "coding" | "vision" | "review";

/**
 * Determine the best model for the given task.
 */
export function selectModel(userMessage: string, history: any[]): string {
    const content = userMessage.toLowerCase();

    // 1. Creative Writing / Reframing
    if (content.match(/(schreibe|umschreiben|gedicht|geschichte|witz|kreativ)/i) && !content.includes("code")) {
        console.log("[orchestrator] Routing to CREATIVE model (Claude 3 Haiku via OpenRouter)");
        return "openrouter/anthropic/claude-3-haiku:beta";
    }

    // 2. High Complexity Coding / Architecture 
    const codingKeywords = ["refactor", "umstrukturieren", "komplexe logik", "fix deep bug", "implementiere feature", "architektur", "api", "backend", "crud", "komplex"];
    const isComplexCoding = codingKeywords.some(kw => content.includes(kw)) || history.length > 10;

    if (isComplexCoding || content.includes("code-analyse") || content.includes("debugging")) {
        console.log("[orchestrator] Routing to EXPERT CODING model (Gemini 2.5 Pro)");
        return "gemini-2.5-pro";
    }

    // 3. Vision / Analysis tasks
    if (content.match(/(analyse|prüfe|schau dir an|bild|screenshot|generiere|erstelle bild|zeichne)/i)) {
        console.log("[orchestrator] Routing to EXPERT VISION/IMAGE model (Gemini 2.5 Pro)");
        return "gemini-2.5-pro";
    }

    // 4. Default / Standard (Low cost)
    console.log("[orchestrator] Routing to STANDARD model (Gemini 2.5 Flash Native)");
    return "gemini-2.5-flash";
}
