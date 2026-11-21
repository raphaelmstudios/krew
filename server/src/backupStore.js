// Off-site backups: the shared part used by restore.js (on start-up) and backup.js (while
// running). KREW saves its database and uploaded photos to any S3-compatible storage service,
// such as Backblaze B2 or Supabase Storage, so a host that wipes its disk (Render's free plan)
// can put everything back when it starts again. See the README's "Backups" section.
//
// Every backup is encrypted here, before it leaves the server, with BACKUP_ENCRYPTION_KEY.
// It holds ID documents and selfies, so the storage service only ever sees scrambled bytes.
//
// Backups are switched on only when all six settings below are present. Without them KREW
// runs exactly as before.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const REQUIRED_SETTINGS = [
  'BACKUP_S3_ENDPOINT',
  'BACKUP_S3_REGION',
  'BACKUP_S3_BUCKET',
  'BACKUP_S3_ACCESS_KEY_ID',
  'BACKUP_S3_SECRET_ACCESS_KEY',
  'BACKUP_ENCRYPTION_KEY',
];

const MIN_KEY_LENGTH = 16;

// File layout: a short marker, the salt and IV used for this backup, the encrypted archive,
// then the 16-byte check value that proves it wasn't changed or corrupted.
const MAGIC = Buffer.from('KREWBK1');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export const HEADER_LENGTH = MAGIC.length + SALT_LENGTH + IV_LENGTH;

// Returns the settings, or null when backups aren't set up. A half-finished setup is reported
// once, so a missing setting doesn't silently mean "no backups".
let warned = false;
export function backupConfig() {
  const missing = REQUIRED_SETTINGS.filter((name) => !process.env[name]);
  if (missing.length === REQUIRED_SETTINGS.length) return null;
  if (missing.length > 0) {
    if (!warned) console.error(`Backups are OFF - missing settings: ${missing.join(', ')}.`);
    warned = true;
    return null;
  }
  if (process.env.BACKUP_ENCRYPTION_KEY.length < MIN_KEY_LENGTH) {
    if (!warned) console.error(`Backups are OFF - BACKUP_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters.`);
    warned = true;
    return null;
  }
  const prefix = (process.env.BACKUP_PREFIX || 'krew-backups').replace(/\/+$/, '');
  return {
    bucket: process.env.BACKUP_S3_BUCKET,
    passphrase: process.env.BACKUP_ENCRYPTION_KEY,
    latestKey: `${prefix}/latest.krewbackup`,
    dailyPrefix: `${prefix}/daily/`,
    client: new S3Client({
      endpoint: process.env.BACKUP_S3_ENDPOINT,
      region: process.env.BACKUP_S3_REGION,
      forcePathStyle: true, // bucket in the path, which every S3-compatible service accepts
      // Plain uploads without the newer extra checksums, which many S3-compatible services
      // (Backblaze B2 among them) don't support. Backups carry their own check (see MAGIC).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
      },
    }),
  };
}

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32);
}

// Encrypts plainPath into encryptedPath (AES-256-GCM). Streams, so large photo folders never
// have to fit in memory.
export async function encryptFile(plainPath, encryptedPath, passphrase) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const output = fs.createWriteStream(encryptedPath);
  output.write(Buffer.concat([MAGIC, salt, iv]));
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(plainPath);
    input.on('error', reject);
    cipher.on('error', reject);
    output.on('error', reject);
    input.pipe(cipher).pipe(output, { end: false });
    cipher.on('end', () => {
      output.end(cipher.getAuthTag(), resolve);
    });
  });
}

// Decrypts encryptedPath into plainPath. Throws if the key is wrong or the file was changed -
// in that case nothing is restored.
export async function decryptFile(encryptedPath, plainPath, passphrase) {
  const { size } = fs.statSync(encryptedPath);
  if (size < HEADER_LENGTH + TAG_LENGTH) throw new Error('Backup file is too small to be a KREW backup.');
  const fd = fs.openSync(encryptedPath, 'r');
  const header = Buffer.alloc(HEADER_LENGTH);
  const tag = Buffer.alloc(TAG_LENGTH);
  fs.readSync(fd, header, 0, HEADER_LENGTH, 0);
  fs.readSync(fd, tag, 0, TAG_LENGTH, size - TAG_LENGTH);
  fs.closeSync(fd);
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a KREW backup file.');
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_LENGTH);
  const iv = header.subarray(MAGIC.length + SALT_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(encryptedPath, { start: HEADER_LENGTH, end: size - TAG_LENGTH - 1 });
    const output = fs.createWriteStream(plainPath);
    input.on('error', reject);
    decipher.on('error', () => reject(new Error('Backup could not be decrypted - wrong BACKUP_ENCRYPTION_KEY, or the file is damaged.')));
    output.on('error', reject);
    output.on('finish', resolve);
    input.pipe(decipher).pipe(output);
  });
}

export async function uploadFile(config, key, filePath) {
  await config.client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentLength: fs.statSync(filePath).size,
      ContentType: 'application/octet-stream',
    })
  );
}

// Downloads key into filePath. Returns false when there's no such backup yet.
export async function downloadFile(config, key, filePath) {
  let response;
  try {
    response = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(filePath);
    response.Body.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
    response.Body.pipe(output);
  });
  return true;
}

// Keeps the newest `keep` daily backups and deletes older ones.
export async function pruneDailyBackups(config, keep) {
  const listed = await config.client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: config.dailyPrefix }));
  const keys = (listed.Contents || []).map((item) => item.Key).sort();
  const old = keys.slice(0, Math.max(0, keys.length - keep));
  if (old.length === 0) return 0;
  await config.client.send(
    new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: old.map((Key) => ({ Key })) } })
  );
  return old.length;
}
