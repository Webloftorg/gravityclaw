import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from './memory/db.js';
import { DB_PATH } from './config.js';

const ROOT_DIR = process.cwd();
const NOTEPAD_PATH = join(ROOT_DIR, 'notepad.json');

const app = express();
const PORT = 4001;

import { agentState } from './agentState.js';

app.use(cors());
app.use(express.json());

// ── Agent Status Endpoint ──────────────────────────────────────

app.get('/api/agent-status', (req, res) => {
    try {
        let activeTask = null;
        // Always return the active task being worked on (In Bearbeitung) if it exists
        const stmt = db.prepare("SELECT id, title FROM tasks WHERE status = 'In Bearbeitung' ORDER BY createdAt DESC LIMIT 1");
        const task = stmt.get() as { id: string, title: string } | undefined;
        if (task) {
            activeTask = { id: task.id, title: task.title };
        }
        res.json({
            status: agentState.status,
            activeTask: activeTask
        });
    } catch (err) {
        console.error("[ui-api] Error reading agent status:", err);
        res.status(500).json({ error: "Could not read status." });
    }
});

// ── Notepad Endpoints ──────────────────────────────────────────

app.get('/api/notepad', (req, res) => {
    try {
        if (!existsSync(NOTEPAD_PATH)) {
            return res.json({ text: "Notepad is empty.", ts: null });
        }
        const data = JSON.parse(readFileSync(NOTEPAD_PATH, "utf-8"));
        res.json(data);
    } catch (err) {
        console.error("[ui-api] Error reading notepad:", err);
        res.status(500).json({ error: "Could not read notepad." });
    }
});

app.post('/api/notepad', (req, res) => {
    try {
        const { text } = req.body;
        if (text === undefined) {
            return res.status(400).json({ error: "Missing 'text' field in body." });
        }
        const data = {
            text,
            ts: new Date().toISOString()
        };
        writeFileSync(NOTEPAD_PATH, JSON.stringify(data, null, 2));
        res.json({ success: true, data });
    } catch (err) {
        console.error("[ui-api] Error writing notepad:", err);
        res.status(500).json({ error: "Could not update notepad." });
    }
});

// ── SQLite Endpoints ──────────────────────────────────────────

app.get('/api/memories', (req, res) => {
    try {
        const stmt = db.prepare("SELECT * FROM episodic_memories ORDER BY createdAt DESC LIMIT 100");
        const memories = stmt.all();
        // Don't send the entire raw vectors to the UI to save bandwidth
        const safeMemories = memories.map((m: any) => ({
            id: m.id,
            summary: m.summary,
            createdAt: m.createdAt,
            userId: m.userId
        }));
        res.json(safeMemories);
    } catch (err) {
        console.error("[ui-api] Error reading memories:", err);
        res.status(500).json({ error: "Could not read memories." });
    }
});

app.get('/api/facts', (req, res) => {
    try {
        const stmt = db.prepare("SELECT key, value FROM core_facts");
        const facts = stmt.all();
        res.json(facts);
    } catch (err) {
        console.error("[ui-api] Error reading facts:", err);
        res.status(500).json({ error: "Could not read facts." });
    }
});

// ── Kanban Tasks Endpoints ────────────────────────────────────────

app.get('/api/tasks', (req, res) => {
    try {
        const stmt = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC");
        const tasks = stmt.all();
        res.json(tasks);
    } catch (err) {
        console.error("[ui-api] Error reading tasks:", err);
        res.status(500).json({ error: "Could not read tasks." });
    }
});

import { randomUUID } from 'crypto';

app.post('/api/tasks', (req, res) => {
    try {
        let { id, title, description, status, priority, scheduledAt } = req.body;
        if (!title) return res.status(400).json({ error: "Missing required field: title" });

        if (!id) id = randomUUID();

        const stmt = db.prepare(`
            INSERT INTO tasks (id, title, description, status, priority, scheduledAt)
            VALUES (@id, @title, @description, @status, @priority, @scheduledAt)
        `);
        stmt.run({ id, title, description: description || '', status: status || 'Geplant', priority: priority || 'Mittel', scheduledAt: scheduledAt || null });
        res.json({ success: true, id });
    } catch (err) {
        console.error("[ui-api] Error creating task:", err);
        res.status(500).json({ error: "Could not create task." });
    }
});

import { bot } from './bot.js';
import { ALLOWED_USER_IDS } from './config.js';

app.put('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, scheduledAt } = req.body;

        const stmt = db.prepare(`
            UPDATE tasks 
            SET title = COALESCE(@title, title),
                description = COALESCE(@description, description),
                status = COALESCE(@status, status),
                priority = COALESCE(@priority, priority),
                scheduledAt = COALESCE(@scheduledAt, scheduledAt)
            WHERE id = @id
        `);
        stmt.run({ id, title, description, status, priority, scheduledAt: scheduledAt || null });

        if (status === 'Review') {
            const getTask = db.prepare("SELECT title FROM tasks WHERE id = ?").get(id) as any;
            const taskTitle = getTask?.title || id;
            for (const userId of ALLOWED_USER_IDS) {
                bot.api.sendMessage(userId, `🚀 *Task Review Ready (via Dashboard):*\n${taskTitle}\n\nBitte werfe einen Blick darauf!`, { parse_mode: "Markdown" }).catch(() => { });
            }
        }

        res.json({ success: true, id });
    } catch (err) {
        console.error("[ui-api] Error updating task:", err);
        res.status(500).json({ error: "Could not update task." });
    }
});

app.delete('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare("DELETE FROM tasks WHERE id = @id");
        stmt.run({ id });
        res.json({ success: true, id });
    } catch (err) {
        console.error("[ui-api] Error deleting task:", err);
        res.status(500).json({ error: "Could not delete task." });
    }
});

export function startUIAPI() {
    app.listen(PORT, () => {
        console.log(`[ui-api] Klaus UI API running on http://localhost:${PORT}`);
    });
}
