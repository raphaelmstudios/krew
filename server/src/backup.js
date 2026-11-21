// Saves KREW's database and uploaded photos off-site while the server runs (see
// backupStore.js for where, and restore.js for putting them back).
//
// - Every BACKUP_INTERVAL_MINUTES (15 by default) it checks for changes, and uploads a new
//   backup only if something changed - a quiet site makes no uploads at all.
// - When the host stops the server (a restart or redeploy), it makes one last backup first,
//   so the gap between the last save and the wipe is as small as possible.
// - The latest backup is always at one fixed name, which restore.js reads. A copy is also
//   kept per day, and the newest DAILY_COPIES of those are kept in case a bad change needs undoing.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import { db } from './db.js';
import { UPLOAD_ROOT } from './paths.js';
import { restoreResult } from './restore.js';
import { backupConfig, encryptFile, uploadFile, pruneDailyBackups } from './backupStore.js';

const DEFAULT_INTERVAL_MINUTES = 15;
const DAILY_COPIES = 7;
const SHUTDOWN_BACKUP_TIMEOUT_MS = 25_000;

let config = null;
let running = null; // the backup in progress, if any
let lastFingerprint = null;
let lastPrunedDay = null;
let lastSuccessAt = null;

// Every file in the uploads folder, with its size and time - so a new or replaced photo counts
// as a change without reading the photos themselves.
function listUploads(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listUploads(full, base);
    const { size, mtimeMs } = fs.statSync(full);
    return [`${path.relative(base, full)}:${size}:${Math.round(mtimeMs)}`];
  });
}

function fingerprint(dbCopyPath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(dbCopyPath));
  hash.update(listUploads(UPLOAD_ROOT).sort().join('\n'));
  return hash.digest('hex');
}

async function runBackup({ force = false } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'krew-backup-'));
  try {
    // A consistent copy of the database, taken while the server keeps running.
    const staging = path.join(work, 'staging');
    fs.mkdirSync(staging);
    const dbCopy = path.join(staging, 'krew.db');
    await db.backup(dbCopy);

    const print = fingerprint(dbCopy);
    if (!force && print === lastFingerprint) return 'unchanged';

    // The archive holds krew.db and the uploads folder (through a link, so photos aren't copied twice).
    if (fs.existsSync(UPLOAD_ROOT)) fs.symlinkSync(UPLOAD_ROOT, path.join(staging, 'uploads'), 'dir');
    const archive = path.join(work, 'backup.tar.gz');
    await tar.c({ gzip: true, file: archive, cwd: staging, follow: true, portable: true }, fs.readdirSync(staging));

    const encrypted = path.join(work, 'backup.krewbackup');
    await encryptFile(archive, encrypted, config.passphrase);

    const today = new Date().toISOString().slice(0, 10);
    await uploadFile(config, config.latestKey, encrypted);
    await uploadFile(config, `${config.dailyPrefix}${today}.krewbackup`, encrypted);
    if (lastPrunedDay !== today) {
      await pruneDailyBackups(config, DAILY_COPIES);
      lastPrunedDay = today;
    }

    lastFingerprint = print;
    lastSuccessAt = new Date();
    const sizeKb = Math.round(fs.statSync(encrypted).size / 1024);
    console.log(`Backups: saved (${sizeKb} KB) at ${lastSuccessAt.toISOString()}.`);
    return 'saved';
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Runs one backup at a time; a request while one is running waits for that one.
export function backupNow(options) {
  if (!config) return Promise.resolve('disabled');
  if (!running) {
    running = runBackup(options)
      .catch((err) => {
        console.error(`Backups: FAILED - ${err.message}`);
        return 'failed';
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}

export function backupStatus() {
  return { enabled: Boolean(config), lastSuccessAt };
}

export function startBackups() {
  config = backupConfig();
  if (!config) return;
  if (restoreResult === 'failed') {
    // start.js stops the server before this point; this is a second safety net.
    config = null;
    return;
  }

  const minutes = Number(process.env.BACKUP_INTERVAL_MINUTES) || DEFAULT_INTERVAL_MINUTES;
  console.log(`Backups: on - checking for changes every ${minutes} minutes.`);
  backupNow();
  setInterval(() => backupNow(), minutes * 60 * 1000).unref();

  // The host asks the server to stop before a restart or redeploy: save once more, then exit.
  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`Backups: ${signal} received - saving one last backup before stopping.`);
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timed out'), SHUTDOWN_BACKUP_TIMEOUT_MS));
    const result = await Promise.race([backupNow(), timeout]);
    console.log(`Backups: final backup ${result}.`);
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
