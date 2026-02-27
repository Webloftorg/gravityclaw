import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { supabase } from './memory/db.js';

const ROOT_DIR = process.cwd();
const NOTEPAD_PATH = join(ROOT_DIR, 'notepad.json');

const app = express();
const PORT = 4001;

import { agentState } from './agentState.js';
import { loginUser, registerUser, getAllUsers } from './memory/auth.js';

app.use(cors());
app.use(express.json());

// ── Agent Status Endpoint ──────────────────────────────────────

app.get('/api/agent-status', async (req, res) => {
    try {
        let activeTask = null;
        const { data: task, error } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('status', 'In Bearbeitung')
            .order('createdAt', { ascending: false })
            .limit(1)
            .single();

        if (task && !error) {
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

app.get('/api/memories', async (req, res) => {
    try {
        const { data: memories, error } = await supabase
            .from('episodic_memories')
            .select('id, summary, createdAt, "userId"')
            .order('createdAt', { ascending: false })
            .limit(100);

        if (error) {
            console.error("[ui-api] Supabase error reading memories:", error);
            return res.status(500).json({ error: "Could not read memories." });
        }

        // Return memories directly as vector is excluded via the .select
        res.json(memories);
    } catch (err) {
        console.error("[ui-api] Error reading memories:", err);
        res.status(500).json({ error: "Could not read memories." });
    }
});

app.get('/api/facts', async (req, res) => {
    try {
        const { data: facts, error } = await supabase
            .from('core_facts')
            .select('key, value');

        if (error) {
            console.error("[ui-api] Supabase error reading facts:", error);
            return res.status(500).json({ error: "Could not read facts." });
        }
        res.json(facts);
    } catch (err) {
        console.error("[ui-api] Error reading facts:", err);
        res.status(500).json({ error: "Could not read facts." });
    }
});

// ── Kanban Tasks Endpoints ────────────────────────────────────────

app.get('/api/tasks', async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) {
            console.error("[ui-api] Supabase error reading tasks:", error);
            return res.status(500).json({ error: "Could not read tasks." });
        }
        res.json(tasks);
    } catch (err) {
        console.error("[ui-api] Error reading tasks:", err);
        res.status(500).json({ error: "Could not read tasks." });
    }
});

import { randomUUID } from 'crypto';

app.post('/api/tasks', async (req, res) => {
    try {
        let { id, title, description, status, priority, scheduledAt, assignee } = req.body;
        if (!title) return res.status(400).json({ error: "Missing required field: title" });

        if (!id) id = randomUUID();

        const { error } = await supabase
            .from('tasks')
            .insert({
                id,
                title,
                description: description || '',
                status: status || 'Geplant',
                priority: priority || 'Mittel',
                assignee: assignee || 'Unassigned',
                scheduledAt: scheduledAt || null
            });

        if (error) {
            console.error("[ui-api] Supabase error creating task:", error);
            return res.status(500).json({ error: "Could not create task." });
        }
        res.json({ success: true, id });
    } catch (err) {
        console.error("[ui-api] Error creating task:", err);
        res.status(500).json({ error: "Could not create task." });
    }
});

import { bot } from './bot.js';
import { ALLOWED_USER_IDS } from './config.js';

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, scheduledAt, assignee } = req.body;

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (assignee !== undefined) updateData.assignee = assignee;
        if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt || null;

        const { error } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error("[ui-api] Supabase error updating task:", error);
            return res.status(500).json({ error: "Could not update task." });
        }

        if (status === 'Review') {
            const { data: getTask, error: getError } = await supabase
                .from('tasks')
                .select('title')
                .eq('id', id)
                .single();

            const taskTitle = getError ? id : (getTask as any)?.title || id;
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

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("[ui-api] Supabase error deleting task:", error);
            return res.status(500).json({ error: "Could not delete task." });
        }
        res.json({ success: true, id });
    } catch (err) {
        console.error("[ui-api] Error deleting task:", err);
        res.status(500).json({ error: "Could not delete task." });
    }
});

// ── Auth & Users Endpoints ─────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = registerUser(username, password);
        if (!user) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.json({ success: true, user });
    } catch (err) {
        console.error('[ui-api] Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = loginUser(username, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ success: true, user });
    } catch (err) {
        console.error('[ui-api] Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const users = getAllUsers();
        res.json(users);
    } catch (err) {
        console.error('[ui-api] Fetch users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export function startUIAPI() {
    app.listen(PORT, () => {
        console.log(`[ui-api] Klaus UI API running on http://localhost:${PORT}`);
    });
}
