import { pipeline } from "@xenova/transformers";
import { saveEpisodeDb, getAllEpisodes } from "./db.js";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
let extractorPipeline: any = null;

export async function initSemanticMemory() {
    try {
        console.log(`[semantic] Loading embedding model ${MODEL_NAME}...`);
        extractorPipeline = await pipeline("feature-extraction", MODEL_NAME, {
            quantized: true,
        });
        console.log(`[semantic] Model loaded successfully.`);
    } catch (err) {
        console.error("[semantic] Failed to load model:", err);
    }
}

export async function embedText(text: string): Promise<number[]> {
    if (!extractorPipeline) {
        await initSemanticMemory();
    }
    const output = await extractorPipeline(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
}

export async function saveEpisode(userId: number, summary: string): Promise<void> {
    try {
        const vector = await embedText(summary);
        saveEpisodeDb(userId, summary, JSON.stringify(vector));
        console.log(`[semantic] Saved episode summary for user ${userId} (Shared Brain)`);
    } catch (err) {
        console.error(`[semantic] Could not save episode:`, err);
    }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchEpisodes(userId: number, queryText: string, topK: number = 3): Promise<string> {
    try {
        const queryVector = await embedText(queryText);
        // We fetch ALL episodes to create a shared brain between the user and the business partner!
        const allEpisodes = getAllEpisodes();

        const scoredEpisodes = allEpisodes.map((ep: { summary: string, vector: string }) => {
            const epVector = JSON.parse(ep.vector) as number[];
            const score = cosineSimilarity(queryVector, epVector);
            return { summary: ep.summary, score };
        });

        scoredEpisodes.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

        const relevantEpisodes = scoredEpisodes
            .slice(0, topK)
            .filter((ep: { score: number }) => ep.score > 0.3); // Threshold for relevance

        if (relevantEpisodes.length === 0) return "";

        return relevantEpisodes.map((ep: { summary: string }) => `- ${ep.summary}`).join("\n");

    } catch (err) {
        console.error("[semantic] Episodic search failed:", err);
        return "";
    }
}
