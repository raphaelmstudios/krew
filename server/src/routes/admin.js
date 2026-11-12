//Admin approval route
// For the new accounts created by the users, the admin can approve or reject the accounts.
// The admin can also view the list of all the users and their details.
// Task d1-7 locked this down - every route below requires a logged-in admin session now.

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { createNotification } from '../notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

// THis is everything an admin needs to see about a pending user account
// not password_hash which should never leave the server

const PENDING_USER_COLUMNS = `
  id, name, phone, role, id_document_path, selfie_path, created_at
`;

adminRouter.get('/users/pending', (req, res) => {
    const pendingUsers = db
    .prepare(`SELECT ${PENDING_USER_COLUMNS} FROM users WHERE verification_status = 'pending' ORDER BY created_at ASC`)
    .all();
    res.json(pendingUsers);
});

function setVerificationStatus(newStatus) {
    return (req, res) => {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status (400).json({ error: 'Invalid user ID' });
        }

        const result = db
        .prepare("UPDATE users SET verification_status = ? WHERE id = ? AND verification_status = 'pending'")
        .run(newStatus, userId);

        // If nothing gets updated, it means the user either doesn't exist or is not pending (it was already approved or rejected)
        if (result.changes === 0) {
            return res.status(404).json({ error: `No pending account found for user ID: ${userId}` });
        }

        createNotification(
            userId,
            newStatus === 'approved' ? 'account_approved' : 'account_rejected',
            newStatus === 'approved'
                ? "Your KREW account has been approved - you're all set to get started."
                : 'Your KREW account application was not approved.'
        );

        res.json({ id: userId, verification_status: newStatus });
    };
}

adminRouter.post('/users/:id/approve', setVerificationStatus('approved'));
adminRouter.post('/users/:id/reject', setVerificationStatus('rejected'));

// Everything an admin needs to see to judge a dispute: the dispute's own reason and
// details, plus the underlying job's amount, due date, and whatever either side already
// confirmed (if anything) before it was flagged - deciding what actually happened needs
// that context, not just the dispute's own text. Resolved disputes are included too (ordered
// after the open ones) so there's a record of past decisions, not just an open queue.
adminRouter.get('/disputes', (req, res) => {
    const disputes = db
    .prepare(
        `SELECT d.id, d.reason, d.details, d.status, d.resolution_notes, d.resolved_at, d.created_at,
                d.transaction_id, d.raised_by, raiser.name AS raised_by_name, raiser.role AS raised_by_role,
                t.amount, t.due_date, t.job_description, l.title, l.category,
                t.organizer_id, org.name AS organizer_name,
                t.crew_member_id, crew.name AS crew_member_name,
                t.organizer_confirmed_at, t.organizer_confirmed_amount,
                t.crew_confirmed_at, t.crew_confirmed_amount
         FROM disputes d
         JOIN transactions t ON t.id = d.transaction_id
         JOIN users raiser ON raiser.id = d.raised_by
         JOIN users org ON org.id = t.organizer_id
         JOIN users crew ON crew.id = t.crew_member_id
         LEFT JOIN job_listings l ON l.id = t.listing_id
         ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.created_at ASC`
    )
    .all();
    res.json(disputes);
});

// Actually resolving a dispute - the one thing Task d2-9 deliberately left undone (see the
// comment on POST /:id/dispute in routes/jobs.js). The transactions table's own status
// column only allows 'pending', 'confirmed', or 'disputed' (schema from Task d1-2), so
// "resolved" lives on the disputes table only - the transaction itself has to land back on
// one of those three, which is why there are exactly two outcomes to choose from:
//
// 'confirm' - the admin has decided the job genuinely was paid, for the amount given in
// final_amount. That amount becomes both sides' confirmed amount, same as an ordinary
// agreed confirmation would look, and the transaction goes back to 'confirmed'.
//
// 'reopen' - the admin isn't in a position to declare a final amount. Both sides'
// confirmations are cleared and the transaction goes back to 'pending', so the organizer
// and crew member can each confirm again from scratch through the normal POST /:id/confirm
// flow, same as if neither had ever confirmed.
adminRouter.post('/disputes/:id/resolve', (req, res) => {
    const disputeId = Number(req.params.id);
    const { outcome, resolution_notes, final_amount } = req.body;

    if (!Number.isInteger(disputeId) || disputeId <= 0) {
        return res.status(400).json({ error: 'Invalid dispute ID' });
    }
    if (outcome !== 'confirm' && outcome !== 'reopen') {
        return res.status(400).json({ error: "Outcome must be 'confirm' or 'reopen'." });
    }
    const trimmedNotes = resolution_notes && resolution_notes.trim() ? resolution_notes.trim() : null;
    if (!trimmedNotes) {
        return res.status(400).json({ error: 'Enter a resolution note explaining the decision.' });
    }

    const dispute = db.prepare(`SELECT * FROM disputes WHERE id = ?`).get(disputeId);
    if (!dispute) {
        return res.status(404).json({ error: 'No dispute found with that ID.' });
    }
    if (dispute.status !== 'open') {
        return res.status(409).json({ error: 'This dispute has already been resolved.' });
    }

    let finalAmountNumber = null;
    if (outcome === 'confirm') {
        finalAmountNumber = Number(final_amount);
        if (!Number.isFinite(finalAmountNumber) || finalAmountNumber <= 0) {
            return res.status(400).json({ error: 'Enter a final amount greater than zero to confirm this job.' });
        }
    }

    // The dispute row and the transaction's status change have to land together, same
    // reasoning as raising the dispute in the first place (routes/jobs.js) - an admin
    // decision that only partly made it into the database would misrepresent what was
    // actually decided.
    const resolveDispute = db.transaction(() => {
        db.prepare(
            `UPDATE disputes SET status = 'resolved', resolution_notes = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`
        ).run(trimmedNotes, req.user.id, disputeId);

        if (outcome === 'confirm') {
            db.prepare(
                `UPDATE transactions
                 SET status = 'confirmed',
                     organizer_confirmed_at = datetime('now'), organizer_confirmed_amount = ?,
                     crew_confirmed_at = datetime('now'), crew_confirmed_amount = ?
                 WHERE id = ?`
            ).run(finalAmountNumber, finalAmountNumber, dispute.transaction_id);
        } else {
            db.prepare(
                `UPDATE transactions
                 SET status = 'pending',
                     organizer_confirmed_at = NULL, organizer_confirmed_amount = NULL,
                     crew_confirmed_at = NULL, crew_confirmed_amount = NULL
                 WHERE id = ?`
            ).run(dispute.transaction_id);
        }
    });
    resolveDispute();

    // Both sides get the same outcome notification - whichever one didn't open the admin
    // panel to see this happen still finds out their dispute was actually resolved. The
    // disputes table only has transaction_id, not organizer/crew member ids directly, so
    // those come from the transaction itself.
    const resolvedTransaction = db
        .prepare(`SELECT organizer_id, crew_member_id FROM transactions WHERE id = ?`)
        .get(dispute.transaction_id);
    const resolutionMessage =
        outcome === 'confirm'
            ? `Your dispute was resolved - the job is now confirmed for KES ${finalAmountNumber.toLocaleString()}.`
            : 'Your dispute was reviewed - please reconfirm your payment for this job.';
    createNotification(resolvedTransaction.organizer_id, 'dispute_resolved', resolutionMessage, '/dashboard');
    createNotification(resolvedTransaction.crew_member_id, 'dispute_resolved', resolutionMessage, '/dashboard');

    res.json({ id: disputeId, status: 'resolved', outcome });
});

// Lets an admin actually look at the ID document and selfie a pending account uploaded,
// so an approval is a real check rather than a guess. Admin-only (requireAdmin above) and
// never cached - these files stay off the public /uploads routes on purpose (see index.js).
// Paths are stored relative to server/uploads; on Windows they're saved with backslashes,
// so they're normalised first, and anything that would resolve outside the uploads folder
// is refused.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

adminRouter.get('/users/:id/files/:kind', (req, res) => {
    const userId = Number(req.params.id);
    const column = req.params.kind === 'id' ? 'id_document_path' : req.params.kind === 'selfie' ? 'selfie_path' : null;
    if (!Number.isInteger(userId) || userId <= 0 || !column) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const user = db.prepare(`SELECT ${column} AS file_path FROM users WHERE id = ?`).get(userId);
    if (!user || !user.file_path) {
        return res.status(404).json({ error: 'No file uploaded for this account.' });
    }

    const fullPath = path.resolve(UPLOAD_ROOT, user.file_path.replace(/\\/g, '/'));
    if (!fullPath.startsWith(path.resolve(UPLOAD_ROOT) + path.sep) || !fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'That file could not be found.' });
    }

    res.set('Cache-Control', 'no-store');
    res.sendFile(fullPath);
});

// The numbers behind the admin Overview and Analytics screens. Every figure is a straight
// count (or sum) over the live tables - nothing estimated or projected. "Payment volume"
// only adds up jobs both sides confirmed (or an admin settled), using the agreed amount,
// since that's the only money KREW can actually vouch for.
adminRouter.get('/stats', (req, res) => {
    const count = (sql, ...params) => db.prepare(sql).get(...params).n;

    res.json({
        users: {
            pending: count(`SELECT COUNT(*) AS n FROM users WHERE verification_status = 'pending'`),
            crew: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'crew_member' AND verification_status = 'approved'`),
            organizers: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'organizer' AND verification_status = 'approved'`),
            rejected: count(`SELECT COUNT(*) AS n FROM users WHERE verification_status = 'rejected'`),
            joined_last_7_days: count(
                `SELECT COUNT(*) AS n FROM users WHERE role != 'admin' AND created_at >= datetime('now', '-7 days')`
            ),
        },
        listings: {
            open: count(`SELECT COUNT(*) AS n FROM job_listings WHERE status = 'open'`),
            filled: count(`SELECT COUNT(*) AS n FROM job_listings WHERE status = 'filled'`),
            cancelled: count(`SELECT COUNT(*) AS n FROM job_listings WHERE status = 'cancelled'`),
            applications: count(`SELECT COUNT(*) AS n FROM job_applications`),
        },
        jobs: {
            total: count(`SELECT COUNT(*) AS n FROM transactions`),
            pending: count(`SELECT COUNT(*) AS n FROM transactions WHERE status = 'pending'`),
            confirmed: count(`SELECT COUNT(*) AS n FROM transactions WHERE status = 'confirmed'`),
            disputed: count(`SELECT COUNT(*) AS n FROM transactions WHERE status = 'disputed'`),
            confirmed_volume: db
                .prepare(
                    `SELECT COALESCE(SUM(COALESCE(organizer_confirmed_amount, amount)), 0) AS total
                     FROM transactions WHERE status = 'confirmed'`
                )
                .get().total,
        },
        disputes: {
            open: count(`SELECT COUNT(*) AS n FROM disputes WHERE status = 'open'`),
            resolved: count(`SELECT COUNT(*) AS n FROM disputes WHERE status = 'resolved'`),
        },
    });
});
