// This script is intended to be run from the command line to reset the demo database to a clean state.
// It deletes all rows from every table in krew.db, effectively wiping out all user data, job listings, disputes, notifications, transactions, and crew portfolio photo records. The schema remains intact, but all data is removed. Photo files already uploaded to the server's uploads folder are not touched, only their database records go.

const Database = require('better-sqlite3');
const path = require('path');

const CONFIRM_FLAG = '--yes-really-reset';

if (!process.argv.includes(CONFIRM_FLAG)) {
  console.log(
    `This permanently deletes EVERY row in krew.db - every user, job, listing, dispute, and notification. The schema stays; the data doesn't. This cannot be undone.\n\nRe-run with the confirmation flag to actually do it:\n  node scripts/reset_demo_data.cjs ${CONFIRM_FLAG}`
  );
  process.exit(0);
}

const db = new Database(path.join(__dirname, '..', 'krew.db'));

// Deletes all rows from every table in the database.
// The schema remains intact, but all data is removed.
// This is useful for resetting the demo environment to a clean state.
// portfolio_images has to be in this list - it references users, so leaving it out makes the delete fail with a foreign key error as soon as any crew member has uploaded a portfolio photo.
const tables = ['notifications', 'disputes', 'job_applications', 'transactions', 'job_listings', 'portfolio_images', 'sessions', 'users'];
for (const table of tables) {
  db.prepare(`DELETE FROM ${table}`).run();
}

// Resets the auto-incrementing primary key counters for all tables.
// This ensures that new rows inserted after the reset will start with ID 1 again, maintaining a clean and predictable state for the demo environment.
try {
  db.prepare(`DELETE FROM sqlite_sequence`).run();
} catch (err) {
  if (!err.message.includes('no such table')) throw err;
}

console.log('krew.db reset: every table is now empty, ready for a real pilot.');