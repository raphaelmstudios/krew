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

// The users table already exists on most machines by this point, so the line above
// won't add a new column to it. We add the selfie column separately here instead,
// and just ignore the error on any machine where it's already been added.
try {
  db.exec(`ALTER TABLE users ADD COLUMN selfie_path TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// Self-reported by crew members (see routes/users.js) so an organizer can check
// whether someone they want to hire directly is free before reaching out, rather
// than only finding out through applicants on an open listing. Meaningless for
// organizer/admin accounts - they just keep the default.
try {
  db.exec(
    `ALTER TABLE users ADD COLUMN availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'working'));`
  );
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// A profile photo a crew member uploads themselves once they're already logged in -
// different from id_document_path/selfie_path above, which are the private KYC files
// from signup and are never shown to anyone but an admin. This one is meant to be
// shown publicly on the crew directory, so it's stored and served separately from
// those two.
try {
  db.exec(`ALTER TABLE users ADD COLUMN profile_photo_path TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

//sessions
// One row per logged-in device. The token is a long random string, stored in an
// httpOnly cookie so JavaScript on the page can never read it, only the browser
// sends it back automatically. Sessions expire after 7 days (see server/src/routes/auth.js).
db.exec(
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
    );`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);

//transactions
// This table handles every job agreement between an organizer and a crew member
// Each job agreement between an organizer and a crew member is presented in one row in this table.
// due_date and job_description are the terms the organizer sets when creating the job.
// daraja_confirmed_at stays empty for now, it gets filled in once M-Pesa Daraja is wired up.
db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL REFERENCES users(id),
      crew_member_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      job_description TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'disputed')),

      organizer_confirmed_at TEXT,
      organizer_confirmed_amount REAL,
      crew_confirmed_at TEXT,
      crew_confirmed_amount REAL,
      daraja_confirmed_at TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);

// This query makes looking up either the jobs an organizer has posted or the jobs a crew member has accepted faster
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_organizer_id ON transactions(organizer_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_crew_member_id ON transactions(crew_member_id);`);

//job_listings
// An open job posting, before it's matched to anyone - the marketplace side of KREW.
// An organizer posts one without naming a crew member yet; crew members browse open
// listings and apply. Once the organizer accepts one applicant, this listing is marked
// 'filled' and a row is added to `transactions` above for the actual agreement - that's
// the paper trail the rest of the app (payment confirmation, disputes, reciprocal
// records) is built around.
db.exec(`
    CREATE TABLE IF NOT EXISTS job_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      job_description TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_listings_organizer_id ON job_listings(organizer_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_listings_status ON job_listings(status);`);

//job_applications
// One row per crew member who expresses interest in one open listing. A crew member
// can only apply once to the same listing (the UNIQUE constraint below enforces that).
// When the organizer accepts one, that row's status becomes 'accepted' and every other
// applicant on the same listing is automatically marked 'declined'.
db.exec(`
    CREATE TABLE IF NOT EXISTS job_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES job_listings(id),
      crew_member_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(listing_id, crew_member_id)
    );`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_applications_listing_id ON job_applications(listing_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_applications_crew_member_id ON job_applications(crew_member_id);`);

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