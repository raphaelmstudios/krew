// KREW Database Setup
// This file opens the database file and creates the tables KREW needs if they don't exist yet.


import Database from 'better-sqlite3';
import { DB_PATH } from './paths.js';

// DB_PATH comes from paths.js (DATABASE_PATH environment variable, or server/krew.db).

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

// Also self-reported by crew members (see POST /me/profile in routes/users.js), same
// as availability_status above - there's no vetted skills taxonomy, so this is
// whatever the crew member says about themselves, same as a real gig-work profile.
// skills is stored as a single comma-separated string rather than its own table,
// since it's just for display on the public Hire Crew directory, not for filtering
// against a fixed list the way job_listings.category is.
try {
  db.exec(`ALTER TABLE users ADD COLUMN professional_role TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN skills TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// Redesign: the moodboard's Crew Profile page shows an "Experience" stat (e.g.
// "3+ Years"). Same self-reported spirit as professional_role/skills above - no
// vetted way to verify how long someone's actually been doing this work, so this
// is just what the crew member says, stored as a plain integer and formatted on
// the frontend.
try {
  db.exec(`ALTER TABLE users ADD COLUMN years_experience INTEGER;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// Redesign: the moodboard's Crew Profile page also shows a short self-written bio
// ("I capture stories through a lens...") - same self-reported spirit as everything
// else here, just free text instead of a fixed field.
try {
  db.exec(`ALTER TABLE users ADD COLUMN bio TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// A wide cover photo for the top of a crew member's public profile - the banner behind
// their name. Optional: without one, the page uses their first portfolio photo, and
// without that, the plain plum brand banner.
try {
  db.exec(`ALTER TABLE users ADD COLUMN cover_photo_path TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// Organizers only: the events company or brand they hire under (e.g. "Bloomfield
// Celebrations"). Shown on their gigs instead of their personal name when it's set; the
// person's own name stays on the account for jobs, payments and admin. Organizers write
// their own short bio in the same bio column crew members use.
try {
  db.exec(`ALTER TABLE users ADD COLUMN company_name TEXT;`);
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
// daraja_confirmed_at is unused: it's reserved for a future M-Pesa (Daraja) integration and stays empty.
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

// Pilot readiness (FR7.1): the SRS calls for a reminder to the organizer when a payment's
// due date is within 24 hours. Without this column the reminder check (reminders.js) would
// re-notify the same organizer about the same job every time it runs, rather than once -
// it's set the moment a reminder is actually sent, and the check skips any row where it's
// already filled in.
// Which open listing a job came from (null for direct hires and for jobs created before
// this column existed) - lets a crew member's public work history show the listing's
// public title and category instead of the private job description.
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN listing_id INTEGER REFERENCES job_listings(id);`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

try {
  db.exec(`ALTER TABLE transactions ADD COLUMN due_reminder_sent_at TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// When a job became complete - set once, at the moment status moves to 'confirmed' (both
// sides' amounts matched, or an admin settled a dispute with a final amount). Before this,
// "when was it completed" had to be guessed from whichever confirmation came last.
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN completed_at TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// Repair: jobs where both sides confirmed the same amount but the status never moved past
// 'pending' (confirmations made before the match-and-confirm step existed). They're
// complete in every way that matters, so they're marked that way here - otherwise they sit
// on both dashboards as "awaiting confirmation" with nothing left for anyone to do.
db.exec(`
  UPDATE transactions
  SET status = 'confirmed',
      completed_at = MAX(organizer_confirmed_at, crew_confirmed_at)
  WHERE status = 'pending'
    AND organizer_confirmed_at IS NOT NULL
    AND crew_confirmed_at IS NOT NULL
    AND organizer_confirmed_amount = crew_confirmed_amount;
`);

// Backfill completed_at for jobs confirmed before the column existed.
db.exec(`
  UPDATE transactions
  SET completed_at = COALESCE(MAX(organizer_confirmed_at, crew_confirmed_at), organizer_confirmed_at, crew_confirmed_at, created_at)
  WHERE status = 'confirmed' AND completed_at IS NULL;
`);

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

// Added for the public Find Work / gig-detail pages (redesign brief section 7.3-7.5),
// which need more to show than just an amount and a free-text description. Nullable
// because existing rows from before this column existed don't have one - the frontend
// falls back to a short excerpt of job_description for those. category is a short
// label from a small fixed list (see PostListingForm.jsx) rather than free text, so
// Find Work's category filter has something consistent to filter on.
try {
  db.exec(`ALTER TABLE job_listings ADD COLUMN title TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}
try {
  db.exec(`ALTER TABLE job_listings ADD COLUMN category TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}
try {
  db.exec(`ALTER TABLE job_listings ADD COLUMN location TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

// Redesign: one photo per listing, uploaded by the organizer who posted it (shown on
// Find Work's cards and the gig page). Same save-to-disk pattern as profile photos -
// this column only stores the file's path under uploads/, never the image itself.
try {
  db.exec(`ALTER TABLE job_listings ADD COLUMN photo_path TEXT;`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

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

//notifications
// One row per notification. Every type here is created only by server code (never from
// anything a user submits directly - type and message are always written by whichever
// route triggered it, in createNotification()/notifyAdmins(), see notifications.js), so
// unlike job_listings.category there's no need for a CHECK constraint against a fixed
// list - it's just a tag the frontend could use to pick an icon by, not something that
// changes what's allowed to happen. link is an optional client-side path (e.g.
// '/dashboard') for where clicking the notification should take you; read_at stays NULL
// until the person opens/dismisses it.
db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);

//portfolio_images
// Work-sample photos a crew member uploads to show off on their public profile
// (redesign moodboard's Crew Profile page, panel 5) - unlike profile_photo_path
// above, which is a single photo, a crew member can have any number of these.
// Only crew members ever get rows here; nothing in the UI lets an organizer or
// admin add one. image_path follows the same save-to-disk-not-the-database
// pattern as profile_photo_path and the id_document/selfie uploads.
db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_portfolio_images_user_id ON portfolio_images(user_id);`);

//password_resets
// KREW has no email or SMS, so a forgotten password is reset with a person in the loop:
// the account owner asks for a reset (status 'requested'), a KREW admin calls the phone
// number on the account to confirm it's really them, then issues a one-time code
// ('code_issued') that the owner types in with a new password ('used'). Only a hash of the
// code is stored, it expires after 30 minutes, and 5 wrong tries cancel it.
db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'code_issued', 'used', 'cancelled')),
      code_hash TEXT,
      issued_by INTEGER REFERENCES users(id),
      issued_at TEXT,
      expires_at TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      used_at TEXT,
      requested_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);`);

 // Housekeeping on every start: expired logins are deleted rather than left in the table
// (they're refused anyway - see middleware/auth.js - this just keeps the table small).
db.exec(`DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`);

// Phone numbers are stored in one format, 0712345678 (see normalizePhone in security.js),
// so 0712345678 and +254712345678 can't be two different accounts. Older rows typed as
// +254... or 254... are converted, unless that would clash with an existing account.
db.exec(`
  UPDATE users
  SET phone = '0' || substr(phone, length(phone) - 8)
  WHERE phone NOT LIKE '0%'
    AND length(phone) >= 12
    AND NOT EXISTS (
      SELECT 1 FROM users other WHERE other.phone = '0' || substr(users.phone, length(users.phone) - 8)
    );
`);

}
