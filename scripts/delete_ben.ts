import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'dashboard_users.db');
const db = new Database(DB_PATH);

const info = db.prepare('DELETE FROM users WHERE username = ?').run('Ben');
console.log(`Deleted ${info.changes} user(s) named "Ben"`);
