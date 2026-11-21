// Restores the latest off-site backup when the server starts on an empty disk (see
// backupStore.js). Runs before anything opens the database (start.js), because restoring
// means putting a whole database file in place.
//
// It only ever restores onto an EMPTY disk: if a database file is already there (your own
// computer, or a host with a permanent disk), it's left exactly as it is.
//
// If a backup exists but can't be restored (the storage service is down, say), start.js stops
// the server instead of starting it empty: people would find their accounts missing, and an
// empty database must never be backed up over the real one. The host then restarts the
// server, which tries again. restoreResult remembers what happened, for backup.js.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import { backupConfig, downloadFile, decryptFile } from './backupStore.js';
import { DB_PATH, UPLOAD_ROOT } from './paths.js';

// 'disabled' (no backup settings), 'skipped' (a database was already on disk),
// 'none' (no backup exists yet - a brand new setup), 'restored', or 'failed'.
export let restoreResult = 'disabled';

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Moves everything inside `from` into `to`, keeping anything already in `to`.
function moveContents(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      moveContents(source, target);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}

async function restoreOnce(config) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'krew-restore-'));
  try {
    const encrypted = path.join(work, 'latest.krewbackup');
    if (!(await downloadFile(config, config.latestKey, encrypted))) return 'none';

    const archive = path.join(work, 'latest.tar.gz');
    await decryptFile(encrypted, archive, config.passphrase);

    const unpacked = path.join(work, 'unpacked');
    fs.mkdirSync(unpacked);
    await tar.x({ file: archive, cwd: unpacked, strict: true });

    const restoredDb = path.join(unpacked, 'krew.db');
    if (!fs.existsSync(restoredDb)) throw new Error('The backup has no database in it.');

    // Everything checked out - now put it in place.
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.copyFileSync(restoredDb, DB_PATH);
    const restoredUploads = path.join(unpacked, 'uploads');
    if (fs.existsSync(restoredUploads)) moveContents(restoredUploads, UPLOAD_ROOT);
    return 'restored';
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

export async function restoreIfNeeded() {
  const config = backupConfig();
  if (!config) {
    restoreResult = 'disabled';
    return restoreResult;
  }
  if (fs.existsSync(DB_PATH)) {
    restoreResult = 'skipped';
    console.log('Backups: a database is already on disk, so nothing was restored.');
    return restoreResult;
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      restoreResult = await restoreOnce(config);
      console.log(
        restoreResult === 'restored'
          ? 'Backups: restored the latest backup (database and photos).'
          : 'Backups: no backup exists yet - starting with an empty database.'
      );
      return restoreResult;
    } catch (err) {
      console.error(`Backups: restore attempt ${attempt} of ${ATTEMPTS} failed: ${err.message}`);
      // A wrong key or damaged file won't fix itself by retrying.
      if (/decrypt|not a krew backup|too small|no database/i.test(err.message)) break;
      if (attempt < ATTEMPTS) await wait(RETRY_DELAY_MS);
    }
  }

  // Leave no half-restored database behind.
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  restoreResult = 'failed';
  console.error('Backups: COULD NOT RESTORE the latest backup. The server will not start empty - see the message above.');
  return restoreResult;
}
