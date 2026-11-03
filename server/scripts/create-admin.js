// Creates an admin account directly in the database.
// There is no sign-up form for admins, so this script is the only way to create one.
// the endpoint /api/admin/users/:id/approve is used to approve the admin account after it is created.
// Usage
//   node scripts/create-admin.js "Full Name" "0712345678" "a-strong-password"

import bcrypt from 'bcrypt';
import { db, migrate } from '../src/db.js';

const BCRYPT_ROUNDS = 10;
const PHONE_PATTERN = /^(?:\+?254|0)(7|1)\d{8}$/;

const [name, phone, password] = process.argv.slice(2);

if (!name || !phone || !password) {
  console.error('Usage: node scripts/create-admin.js "Full Name" "0712345678" "a-strong-password"');
  process.exit(1);
}
if (!PHONE_PATTERN.test(phone)) {
  console.error('That phone number doesn\'t look like a valid Kenyan number, e.g. 0712345678.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

migrate();

const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

try {
  const result = db
    .prepare(
      `INSERT INTO users (name, phone, password_hash, role, verification_status)
       VALUES (?, ?, ?, 'admin', 'approved')`
    )
    .run(name, phone, passwordHash);
  console.log(`Admin account created: ${name} (id ${result.lastInsertRowid}). You can now log in at /admin.`);
} catch (err) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.error('That phone number is already registered.');
    process.exit(1);
  }
  throw err;
}