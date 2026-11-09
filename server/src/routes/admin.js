//Admin approval route
// For the new accounts created by the users, the admin can approve or reject the accounts.
// The admin can also view the list of all the users and their details.
// Task d1-7 locked this down - every route below requires a logged-in admin session now.

import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

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
                t.amount, t.due_date, t.job_description,
                t.organizer_id, org.name AS organizer_name,
                t.crew_member_id, crew.name AS crew_member_name,
                t.organizer_confirmed_at, t.organizer_confirmed_amount,
                t.crew_confirmed_at, t.crew_confirmed_amount
         FROM disputes d
         JOIN transactions t ON t.id = d.transaction_id
         JOIN users raiser ON raiser.id = d.raised_by
         JOIN users org ON org.id = t.organizer_id
         JOIN users crew ON crew.id = t.crew_member_id
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

    res.json({ id: disputeId, status: 'resolved', outcome });
});