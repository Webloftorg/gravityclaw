import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ROOT_DIR = process.cwd();
const DB_PATH = join(ROOT_DIR, 'dashboard_users.db');

const db = new Database(DB_PATH);

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

// Create fixed Klaus identity if it doesn't exist
const stmt = db.prepare('SELECT id FROM users WHERE id = ?');
const klausExists = stmt.get('id1234567');

if (!klausExists) {
    // Klaus's password doesn't matter much as he authenticates via API internally, 
    // but we set a dummy one.
    const insert = db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)');
    insert.run('id1234567', 'Klaus (AI)', 'klaus_internal_pwd');
    console.log('[auth] Created static Klaus (AI) user');
}

export interface User {
    id: string;
    username: string;
}

export function registerUser(username: string, password: string): User | null {
    try {
        const id = randomUUID();
        const insert = db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)');
        insert.run(id, username, password);
        return { id, username };
    } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return null; // Username exists
        }
        throw err;
    }
}

export function loginUser(username: string, password: string): User | null {
    const query = db.prepare('SELECT id, username FROM users WHERE username = ? AND password = ?');
    const user = query.get(username, password) as User | undefined;
    return user || null;
}

export function getUserById(id: string): User | null {
    const query = db.prepare('SELECT id, username FROM users WHERE id = ?');
    const user = query.get(id) as User | undefined;
    return user || null;
}

export function getAllUsers(): User[] {
    const query = db.prepare('SELECT id, username FROM users');
    return query.all() as User[];
}
