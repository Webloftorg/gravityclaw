import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log(`[memory] Supabase active at: ${SUPABASE_URL}`);

// ── Core Facts Interface ───────────────────────────────────────────

/**
 * Returns a formatted string of all known facts for injection into the SYSTEM_PROMPT.
 */
export async function getFacts(): Promise<string> {
    const { data: facts, error } = await supabase.from("core_facts").select("key, value");

    if (error) {
        console.error("[memory] Failed to get core facts:", error);
        return "No core facts known yet.";
    }

    if (!facts || facts.length === 0) return "No core facts known yet.";

    return facts.map((f: any) => `- ${f.key}: ${f.value}`).join("\n");
}

/**
 * Saves or updates a core fact.
 */
export async function saveFact(key: string, value: string): Promise<void> {
    const { error } = await supabase
        .from("core_facts")
        .upsert({ key, value }, { onConflict: "key" });

    if (error) {
        console.error(`[memory] Failed to save core fact:`, error);
    } else {
        console.log(`[memory] Core fact saved/updated: ${key} = ${value}`);
    }
}

/**
 * Deletes a core fact.
 */
export async function deleteFact(key: string): Promise<void> {
    const { error } = await supabase
        .from("core_facts")
        .delete()
        .eq("key", key);

    if (error) {
        console.error(`[memory] Failed to delete core fact:`, error);
    } else {
        console.log(`[memory] Core fact deleted: ${key}`);
    }
}

// ── Episodic Memories Interface ────────────────────────────────────────

/**
 * Saves a new episodic memory.
 */
export async function saveEpisodeDb(userId: number, summary: string, vector: string): Promise<void> {
    const { error } = await supabase
        .from("episodic_memories")
        .insert({ userId, summary, vector });

    if (error) {
        console.error(`[memory] Failed to save episodic memory:`, error);
    } else {
        console.log(`[memory] Saved episodic memory for user ${userId}`);
    }
}

/**
 * Retrieves all episodic memories (for local vector search).
 */
export async function getAllEpisodes(): Promise<{ id: number; userId: number; summary: string; vector: string; createdAt: string }[]> {
    const { data: episodes, error } = await supabase
        .from("episodic_memories")
        .select("*");

    if (error) {
        console.error("[memory] Failed to get all episodes:", error);
        return [];
    }

    return episodes || [];
}
