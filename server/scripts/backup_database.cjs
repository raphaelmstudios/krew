// Makes a safe copy of the database while the server keeps running, next to the original:
// krew.db -> krew-backup.db. On Fly.io (see the README) you then download that copy.
// A plain file copy could miss recent changes that SQLite hasn't merged into the main file
// yet; SQLite's own backup includes everything.
const Database = require('better-sqlite3');
const path = require('path');

const source = process.env.DATABASE_PATH || path.join(__dirname, '..', 'krew.db');
const target = path.join(path.dirname(source), 'krew-backup.db');

new Database(source, { readonly: true })
  .backup(target)
  .then(() => console.log(`Backup saved to ${target}`))
  .catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
  });
