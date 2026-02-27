import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../');
const NOTEPAD_PATH = join(ROOT_DIR, 'notepad.json');
const DB_PATH = join(ROOT_DIR, 'mission-control.db');

const app = express();
const PORT = 4001;

app.use(cors());
app.use(express.json());

// Initialize SQLite core database
const db = new Database(DB_PATH, { readonly: true }); // readonly for safety except if we need to write from UI

// ── Notepad Endpoints ──────────────────────────────────────────

app.get('/api/notepad', (req, res) => {
    try {
        if (!existsSync(NOTEPAD_PATH)) {
            return res.json({ text: "Notepad is empty.", ts: null });
        }
        const data = JSON.parse(readFileSync(NOTEPAD_PATH, "utf-8"));
        res.json(data);
    } catch (err) {
        console.error("Error reading notepad:", err);
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
        console.error("Error writing notepad:", err);
        res.status(500).json({ error: "Could not update notepad." });
    }
});

// ── SQLite Endpoints ──────────────────────────────────────────

app.get('/api/memories', (req, res) => {
    try {
        const stmt = db.prepare("SELECT * FROM episodic_memories ORDER BY createdAt DESC LIMIT 100");
        const memories = stmt.all();
        res.json(memories);
    } catch (err) {
        console.error("Error reading memories:", err);
        res.status(500).json({ error: "Could not read memories." });
    }
});

app.get('/api/facts', (req, res) => {
    try {
        const stmt = db.prepare("SELECT key, value FROM core_facts");
        const facts = stmt.all();
        res.json(facts);
    } catch (err) {
        console.error("Error reading facts:", err);
        res.status(500).json({ error: "Could not read facts." });
    }
});

app.listen(PORT, () => {
    console.log(`Klaus API running on http://localhost:${PORT}`);
    console.log(`Notepad Path: ${NOTEPAD_PATH}`);
    console.log(`DB Path: ${DB_PATH}`);
});
