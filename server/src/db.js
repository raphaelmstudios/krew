// KREW Database Setup
// This file opens the database file and creates the tables KREW needs if they don't exist yet.


import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'krew.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


export function migrate() {
//users
// One row per user
// We are creating the tables for new users (organizers and crew members)
db.exec(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('organizer', 'crew_member' , 'admin')),
    id_document_path TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);

//transactions
// This table handles every job agreement between an organizer and a crew member 
// Each job agreement between an organizer and a crew member is presented in one row in this table.
db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL REFERENCES users(id),
      crew_member_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'disputed')),

      organizer_confirmed_at TEXT,
      organizer_confirmed_amount REAL,
      crew_confirmed_at TEXT,
      crew_confirmed_amount REAL,
    
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);

// This query makes looking up either the jobs an organizer has posted or the jobs a crew member has accepted faster
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_organizer_id ON transactions(organizer_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_crew_member_id ON transactions(crew_member_id);`);

//disputes
// This table handles disputes raised by either the organizer or the crew member regarding a specific transaction.
// Each dispute is linked to a specific transaction and contains details about the dispute, including the reason, status, and resolution notes.
 db.exec(`
    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
      raised_by INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      resolution_notes TEXT,
      resolved_by INTEGER REFERENCES users(id),
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);


 }