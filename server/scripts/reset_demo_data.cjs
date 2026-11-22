// This script is intended to be run from the command line to reset the demo database to a clean state.
// It deletes all rows from every table in krew.db, effectively wiping out all user data, job listings, disputes, notifications, transactions, and crew portfolio photo records. The schema remains intact, but all data is removed.
// It also deletes the demo pictures the demo data script copied into the uploads folder (files named "demo-..."), so seeding again doesn't pile up copies. Photos that people uploaded themselves are not touched.

// Safety: refuses to run on the live server. Wiping every row is a demo/testing tool - never something to run against the live site.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: NODE_ENV is production.');
  process.exit(1);
}

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CONFIRM_FLAG = '--yes-really-reset';

if (!process.argv.includes(CONFIRM_FLAG)) {
  console.log(
    `This permanently deletes EVERY row in krew.db - every user, job, listing, dispute, and notification. The schema stays; the data doesn't. This cannot be undone.\n\nRe-run with the confirmation flag to actually do it:\n  node scripts/reset_demo_data.cjs ${CONFIRM_FLAG}`
  );
  process.exit(0);
}

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, '..', 'krew.db'));

// Deletes all rows from every table in the database.
// The schema remains intact, but all data is removed.
// This is useful for resetting the demo environment to a clean state.
// portfolio_images has to be in this list - it references users, so leaving it out makes the delete fail with a foreign key error as soon as any crew member has uploaded a portfolio photo.
// audit_log and data_requests are newer, so they're skipped on a database that doesn't have them yet.
const tables = ['audit_log', 'data_requests', 'notifications', 'disputes', 'job_applications', 'transactions', 'job_listings', 'portfolio_images', 'password_resets', 'sessions', 'users'];
const hasTable = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`);
for (const table of tables) {
  if (hasTable.get(table)) db.prepare(`DELETE FROM ${table}`).run();
}

// Resets the auto-incrementing primary key counters for all tables.
// This ensures that new rows inserted after the reset will start with ID 1 again, maintaining a clean and predictable state for the demo environment.
try {
  db.prepare(`DELETE FROM sqlite_sequence`).run();
} catch (err) {
  if (!err.message.includes('no such table')) throw err;
}

// Remove the demo pictures copied in by seed_demo_data.cjs.
const uploadRoot = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
let removed = 0;
for (const folder of ['profile-photos', 'cover-photos', 'portfolio-photos', 'listing-photos']) {
  const dir = path.join(uploadRoot, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith('demo-')) {
      fs.rmSync(path.join(dir, file));
      removed += 1;
    }
  }
}

console.log(`krew.db reset: every table is now empty${removed ? `, and ${removed} demo pictures were removed` : ''}.`);