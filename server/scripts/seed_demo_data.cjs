// This script seeds the database with demo data for the Krew platform. 
// It creates a set of users (admin, organizers, and crew members) with predefined phone numbers and roles, along with a sample job listing and transactions to demonstrate various features of the application. 
// All accounts use the same demo password for easy access during testing.

// Locally every demo account uses the password krewdemo2026.
// On the live site (NODE_ENV=production) the demo accounts would be public, so this only runs
// when the server starts it on an empty database (SEED_DEMO_DATA=true, see src/bootstrap.js),
// and only with a private password you set yourself in DEMO_PASSWORD - never the known one.
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && process.env.KREW_STARTUP_SEED !== '1') {
  console.error('Refusing to run by hand on the live server. Set SEED_DEMO_DATA=true instead - see the README.');
  process.exit(1);
}
if (isProduction && (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 8)) {
  console.error('Refusing to seed: set DEMO_PASSWORD (8+ characters) so the live demo accounts have a private password.');
  process.exit(1);
}

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, '..', 'krew.db'));
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'krewdemo2026';
const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

function insertUser({ name, phone, role, verification_status = 'approved' }) {
  return db
    .prepare(`INSERT INTO users (name, phone, password_hash, role, verification_status) VALUES (?, ?, ?, ?, ?)`)
    .run(name, phone, passwordHash, role, verification_status).lastInsertRowid;
}

insertUser({ name: 'Demo Admin', phone: '0711000001', role: 'admin' });

// Two organizers: one with a track record of completed jobs, one brand new.
const organizerEstablished = insertUser({ name: 'Wanjiru Kamau', phone: '0711000002', role: 'organizer' });
const organizerNew = insertUser({ name: 'Otieno Mwangi', phone: '0711000003', role: 'organizer' });

// Two crew members: one with a track record of completed jobs, one brand new, and one pending approval.
const crewEstablished = insertUser({ name: 'Achieng Odhiambo', phone: '0711000004', role: 'crew_member' });
insertUser({ name: 'Mutiso Kyalo', phone: '0711000005', role: 'crew_member' });
insertUser({ name: 'Nafula Wekesa', phone: '0711000006', role: 'crew_member', verification_status: 'pending' });

// An open listing from the new organizer, so Find Work / Hire Crew aren't empty either.
db.prepare(
  `INSERT INTO job_listings (organizer_id, amount, due_date, job_description, title, category, location, status)
   VALUES (?, 7500, date('now', '+10 days'), 'Lighting and sound setup for a corporate launch event', 'Event AV Technician', 'Sound & AV', 'Nairobi', 'open')`
).run(organizerNew);

// A completed job between the established organizer and crew member, so the dashboard stats aren't empty on a fresh demo.
db.prepare(
  `INSERT INTO transactions (organizer_id, crew_member_id, amount, due_date, job_description, status,
     organizer_confirmed_at, organizer_confirmed_amount, crew_confirmed_at, crew_confirmed_amount, completed_at)
   VALUES (?, ?, 9000, date('now', '-5 days'), 'Catering service for a wedding', 'confirmed',
     datetime('now', '-4 days'), 9000, datetime('now', '-4 days'), 9000, datetime('now', '-4 days'))`
).run(organizerEstablished, crewEstablished);

// A disputed job so the admin Disputes tab isn't empty on a fresh demo either.
const disputedTxId = db
  .prepare(
    `INSERT INTO transactions (organizer_id, crew_member_id, amount, due_date, job_description, status,
       organizer_confirmed_at, organizer_confirmed_amount, crew_confirmed_at, crew_confirmed_amount)
     VALUES (?, ?, 6000, date('now', '-1 day'), 'Security staffing for a concert', 'disputed',
       datetime('now'), 5500, datetime('now'), 6000)`
  )
  .run(organizerEstablished, crewEstablished).lastInsertRowid;
db.prepare(
  `INSERT INTO disputes (transaction_id, raised_by, reason, details) VALUES (?, ?, 'Amount mismatch', 'Organizer confirmed 5500, crew confirmed 6000 - checking the original agreement.')`
).run(disputedTxId, organizerEstablished);

console.log(`Demo data seeded. Every account's password is: ${isProduction ? 'the DEMO_PASSWORD you set' : DEMO_PASSWORD}

  Admin:                0711000001
  Organizer (track record): 0711000002 (Wanjiru Kamau)
  Organizer (New here):     0711000003 (Otieno Mwangi)
  Crew (track record):      0711000004 (Achieng Odhiambo)
  Crew (New here):          0711000005 (Mutiso Kyalo)
  Crew (pending approval):  0711000006 (Nafula Wekesa)
`);