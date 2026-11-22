// The change log (NFR9 in the SRS): records who changed what and when, for jobs, payments,
// disputes and accounts. See the audit_log table in db.js.
//
// logChange() is called right next to the change it describes, inside the same database
// transaction where there is one, so a change and its log entry always land together.

import { db } from './db.js';

// Prepared on first use, because this file is loaded before the tables are created.
let insertEntry = null;

// actorId: the user making the change (null for KREW itself).
// action: a short name such as 'payment_confirmed'.
// targetType and targetId: what changed, such as 'job' and the job's id.
// details: an optional object, stored as JSON.
export function logChange(actorId, action, targetType, targetId, details = null) {
  insertEntry ??= db.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)`
  );
  insertEntry.run(actorId ?? null, action, targetType, targetId ?? null, details ? JSON.stringify(details) : null);
}
