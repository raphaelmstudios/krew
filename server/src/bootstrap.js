// Start-up jobs that make a fresh deployment usable without a shell (Render's free plan has
// no shell, and wipes the database on every restart - see the README's "Deploying" section).
// Both run once, right after the tables are created (index.js), and only when asked to by
// environment variables:
//
// 1. ADMIN_NAME + ADMIN_PHONE + ADMIN_PASSWORD - creates that admin account if it doesn't
//    exist yet. The same thing scripts/create-admin.js does by hand.
// 2. SEED_DEMO_DATA=true - fills an EMPTY database with the demo accounts and jobs from
//    scripts/seed_demo_data.cjs, using DEMO_PASSWORD as every demo account's password.
//    A database that already has users is never touched.

import bcrypt from 'bcrypt';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { normalizePhone } from './security.js';

const scriptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

// Creates an approved admin account. Returns a short message saying what happened.
export function createAdmin(name, phone, password) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanPhone = normalizePhone(phone);
  if (!cleanName) throw new Error('Admin name is required.');
  if (!cleanPhone) throw new Error("That phone number doesn't look like a valid Kenyan number, e.g. 0712345678.");
  if (typeof password !== 'string' || password.length < 8) throw new Error('Admin password must be at least 8 characters.');

  const existing = db.prepare('SELECT id, role FROM users WHERE phone = ?').get(cleanPhone);
  if (existing) {
    return existing.role === 'admin'
      ? `Admin ${cleanPhone} already exists - left as it is.`
      : `${cleanPhone} is already registered as a non-admin account - no admin created.`;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, phone, password_hash, role, verification_status)
       VALUES (?, ?, ?, 'admin', 'approved')`
    )
    .run(cleanName, cleanPhone, passwordHash);
  return `Admin account created: ${cleanName} (id ${result.lastInsertRowid}). Log in at /admin.`;
}

export function runStartupTasks() {
  const { ADMIN_NAME, ADMIN_PHONE, ADMIN_PASSWORD, SEED_DEMO_DATA } = process.env;

  if (SEED_DEMO_DATA === 'true') {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    if (count === 0) {
      try {
        execFileSync(process.execPath, [path.join(scriptsDir, 'seed_demo_data.cjs')], {
          env: { ...process.env, KREW_STARTUP_SEED: '1' },
          stdio: 'inherit',
        });
      } catch {
        console.error('Demo data was not loaded (see the message above).');
      }
    }
  }

  if (ADMIN_NAME && ADMIN_PHONE && ADMIN_PASSWORD) {
    try {
      console.log(createAdmin(ADMIN_NAME, ADMIN_PHONE, ADMIN_PASSWORD));
    } catch (err) {
      console.error(`Admin account not created: ${err.message}`);
    }
  }
}
