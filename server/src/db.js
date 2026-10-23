// KREW — SQLite connection
//
// Single file-based database, good enough for a pilot. Opened once here and
// imported wherever a route needs it.
//
// Day 1 / Task d1-2 (next task) builds the actual schema straight off the
// SRS Class Diagram (Appendix B.2): User (abstract) -> Organizer / CrewMember,
// Transaction, Dispute. That goes in a migrate() function below this comment.

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'krew.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema goes here (Task d1-2) ---
// db.exec(`CREATE TABLE IF NOT EXISTS users (...)`);

export function migrate() {
  // Placeholder — filled in by Task d1-2.
}
