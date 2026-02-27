import Database from "better-sqlite3";
import { resolve } from "path";
import { DB_PATH } from "../config.js";

// Initialize SQLite core database
const dbPath = resolve(process.cwd(), DB_PATH);
export const db = new Database(dbPath);

console.log(`[memory] SQLite active at: ${dbPath}`);

// ── Schema Initialization ──────────────────────────────────────────

db.exec(`
    CREATE TABLE IF NOT EXISTS core_facts (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodic_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary TEXT NOT NULL,
        vector TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'Geplant',
        priority TEXT DEFAULT 'Mittel',
        scheduledAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// ── Migration: Add columns to episodic_memories if missing ──────────
const tableInfo = db.prepare("PRAGMA table_info(episodic_memories)").all() as any[];
const hasUserId = tableInfo.some(col => col.name === "userId");
if (!hasUserId) {
    console.log("[memory] Migration: Adding userId column to episodic_memories");
    db.exec("ALTER TABLE episodic_memories ADD COLUMN userId INTEGER DEFAULT 0");
}
const hasCreatedAt = tableInfo.some(col => col.name === "createdAt");
if (!hasCreatedAt) {
    console.log("[memory] Migration: Adding createdAt column to episodic_memories");
    db.exec("ALTER TABLE episodic_memories ADD COLUMN createdAt DATETIME DEFAULT ''");
}

// ── Core Facts Interface ───────────────────────────────────────────

/**
 * Returns a formatted string of all known facts for injection into the SYSTEM_PROMPT.
 */
export function getFacts(): string {
    const stmt = db.prepare("SELECT key, value FROM core_facts");
    const facts = stmt.all() as { key: string; value: string }[];

    if (facts.length === 0) return "No core facts known yet.";

    return facts.map(f => `- ${f.key}: ${f.value}`).join("\n");
}

/**
 * Saves or updates a core fact.
 */
export function saveFact(key: string, value: string): void {
    const stmt = db.prepare(`
        INSERT INTO core_facts (key, value)
        VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run({ key, value });
    console.log(`[memory] Core fact saved/updated: ${key} = ${value}`);
}

/**
 * Deletes a core fact.
 */
export function deleteFact(key: string): void {
    const stmt = db.prepare("DELETE FROM core_facts WHERE key = @key");
    const info = stmt.run({ key });
    if (info.changes > 0) {
        console.log(`[memory] Core fact deleted: ${key}`);
    } else {
        console.log(`[memory] Attempted to delete non-existent fact: ${key}`);
    }
}

// ── Episodic Memories Interface ────────────────────────────────────────

/**
 * Saves a new episodic memory.
 */
export function saveEpisodeDb(userId: number, summary: string, vector: string): void {
    const stmt = db.prepare(`
        INSERT INTO episodic_memories (userId, summary, vector)
        VALUES (@userId, @summary, @vector)
    `);
    stmt.run({ userId, summary, vector });
    console.log(`[memory] Saved episodic memory for user ${userId}`);
}

/**
 * Retrieves all episodic memories (for local vector search).
 */
export function getAllEpisodes(): { id: number; userId: number; summary: string; vector: string; createdAt: string }[] {
    const stmt = db.prepare("SELECT * FROM episodic_memories");
    return stmt.all() as { id: number; userId: number; summary: string; vector: string; createdAt: string }[];
}
