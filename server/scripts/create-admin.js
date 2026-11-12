// Creates an admin account directly in the database.
// There is no sign-up form for admins, so this script (or the ADMIN_* environment variables
// read at start-up - see src/bootstrap.js) is the only way to create one.
// Usage
//   node scripts/create-admin.js "Full Name" "0712345678" "a-strong-password"

import { migrate } from '../src/db.js';
import { createAdmin } from '../src/bootstrap.js';

const [name, phone, password] = process.argv.slice(2);

if (!name || !phone || !password) {
  console.error('Usage: node scripts/create-admin.js "Full Name" "0712345678" "a-strong-password"');
  process.exit(1);
}

migrate();

try {
  console.log(createAdmin(name, phone, password));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
