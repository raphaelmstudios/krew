//Admin approval route
// For the new accounts created by the users, the admin can approve or reject the accounts.
// The admin can also view the list of all the users and their details.
// Task d1-7 locked this down - every route below requires a logged-in admin session now.

import express from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { createNotification } from '../notifications.js';
import { logChange } from '../audit.js';
import bcrypt from 'bcrypt';
import { text, LIMITS } from '../security.js';
import crypto from 'node:crypto';
import { hashResetCode, RESET_CODE_MINUTES } from './auth.js';
import { UPLOAD_ROOT } from '../paths.js';


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
        logChange(req.user.id, newStatus === 'approved' ? 'account_approved' : 'account_rejected', 'user', userId);

        createNotification(
            userId,
            newStatus === 'approved' ? 'account_approved' : 'account_rejected',
            newStatus === 'approved'
                ? "Your KREW account has been approved. You're all set to get started."
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
    const cleanNotes = text(resolution_notes, LIMITS.resolutionNotes);
    if (cleanNotes === null) {
        return res.status(400).json({ error: `Keep the resolution note to ${LIMITS.resolutionNotes} characters or fewer.` });
    }
    const trimmedNotes = cleanNotes || null;
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
        if (finalAmountNumber > LIMITS.maxAmount) {
            return res.status(400).json({ error: `The amount can't be more than KES ${LIMITS.maxAmount.toLocaleString()}.` });
        }
    }

    // The dispute row and the transaction's status change have to land together, same
    // reasoning as raising the dispute in the first place (routes/jobs.js) - an admin
    // decision that only partly made it into the database would misrepresent what was
    // actually decided.
    const resolveDispute = db.transaction(() => {
        const before = db
            .prepare(`SELECT status, organizer_confirmed_amount, crew_confirmed_amount FROM transactions WHERE id = ?`)
            .get(dispute.transaction_id);
        logChange(req.user.id, 'dispute_resolved', 'job', dispute.transaction_id, {
            outcome,
            ...(outcome === 'confirm' ? { final_amount: finalAmountNumber } : {}),
            organizer_amount_before: before.organizer_confirmed_amount,
            crew_amount_before: before.crew_confirmed_amount,
            note: trimmedNotes,
        });
        db.prepare(
            `UPDATE disputes SET status = 'resolved', resolution_notes = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`
        ).run(trimmedNotes, req.user.id, disputeId);

        if (outcome === 'confirm') {
            db.prepare(
                `UPDATE transactions
                 SET status = 'confirmed', completed_at = datetime('now'),
                     organizer_confirmed_at = datetime('now'), organizer_confirmed_amount = ?,
                     crew_confirmed_at = datetime('now'), crew_confirmed_amount = ?
                 WHERE id = ?`
            ).run(finalAmountNumber, finalAmountNumber, dispute.transaction_id);
        } else {
            db.prepare(
                `UPDATE transactions
                 SET status = 'pending', completed_at = NULL,
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
            ? `Your dispute was resolved. The job is now confirmed for KES ${finalAmountNumber.toLocaleString()}.`
            : 'Your dispute was reviewed. Please confirm your payment for this job again.';
    createNotification(resolvedTransaction.organizer_id, 'dispute_resolved', resolutionMessage, '/dashboard?section=payments');
    createNotification(resolvedTransaction.crew_member_id, 'dispute_resolved', resolutionMessage, '/dashboard?section=jobs');

    res.json({ id: disputeId, status: 'resolved', outcome });
});

// Lets an admin actually look at the ID document and selfie a pending account uploaded,
// so an approval is a real check rather than a guess. Admin-only (requireAdmin above) and
// never cached - these files stay off the public /uploads routes on purpose (see index.js).
// Paths are stored relative to server/uploads; on Windows they're saved with backslashes,
// so they're normalised first, and anything that would resolve outside the uploads folder
// is refused.
// UPLOAD_ROOT comes from paths.js (UPLOADS_DIR environment variable, or server/uploads).

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
            rejected: count(`SELECT COUNT(*) AS n FROM users WHERE verification_status = 'rejected' AND deleted_at IS NULL`),
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

// --- Password resets (see the password_resets table in db.js and routes/auth.js) ---------
// Open requests, oldest first, with what the admin needs to confirm it's really the account
// owner on the phone: their name, number and role.
adminRouter.get('/password-resets', (req, res) => {
    const resets = db
        .prepare(
            `SELECT r.id, r.status, r.requested_at, r.issued_at, r.expires_at,
                    u.id AS user_id, u.name, u.phone, u.role, u.verification_status
             FROM password_resets r
             JOIN users u ON u.id = r.user_id
             WHERE r.status IN ('requested', 'code_issued')
             ORDER BY r.requested_at ASC`
        )
        .all();
    res.json(resets);
});

// Makes a one-time code for a request, after the admin has called the owner and confirmed
// who they are. The code is shown to the admin once, to read out; only its hash is kept.
// Issuing again replaces the old code. Letters and digits that look alike (0/O, 1/I/L) are
// left out so it's easy to read over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

adminRouter.post('/password-resets/:id/issue', (req, res) => {
    const resetId = Number(req.params.id);
    const reset = db
        .prepare(`SELECT id, user_id FROM password_resets WHERE id = ? AND status IN ('requested', 'code_issued')`)
        .get(resetId);
    if (!reset) {
        return res.status(404).json({ error: 'That reset request is no longer open.' });
    }

    const raw = Array.from(crypto.randomBytes(8), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    const expiresAt = new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000).toISOString();

    db.prepare(
        `UPDATE password_resets
         SET status = 'code_issued', code_hash = ?, issued_by = ?, issued_at = datetime('now'),
             expires_at = ?, failed_attempts = 0
         WHERE id = ?`
    ).run(hashResetCode(code), req.user.id, expiresAt, resetId);
    logChange(req.user.id, 'password_reset_code_issued', 'user', reset.user_id);

    res.json({ id: resetId, code, expires_at: expiresAt });
});

// Closes a request without issuing a code (e.g. the caller couldn't confirm who they are).
adminRouter.post('/password-resets/:id/cancel', (req, res) => {
    const resetId = Number(req.params.id);
    const result = db
        .prepare(`UPDATE password_resets SET status = 'cancelled' WHERE id = ? AND status IN ('requested', 'code_issued')`)
        .run(resetId);
    if (result.changes === 0) {
        return res.status(404).json({ error: 'That reset request is no longer open.' });
    }
    res.json({ id: resetId, status: 'cancelled' });
});

// --- Account deletion requests (NFR6, see the data_requests table in db.js) ---------------
// Open requests first, then the 30 most recently handled. Each comes with how many of the
// person's jobs are still in progress, since deleting mid-job leaves the other side waiting.
adminRouter.get('/data-requests', (req, res) => {
    const requests = db
        .prepare(
            `SELECT r.id, r.reason, r.status, r.response_note, r.handled_at, r.created_at,
                    r.user_id, u.name, u.phone, u.role, u.deleted_at,
                    (SELECT COUNT(*) FROM transactions t
                     WHERE (t.organizer_id = r.user_id OR t.crew_member_id = r.user_id)
                       AND t.status IN ('pending', 'disputed')) AS open_jobs
             FROM data_requests r
             JOIN users u ON u.id = r.user_id
             WHERE r.status = 'open'
                OR r.id IN (SELECT id FROM data_requests WHERE status != 'open' ORDER BY handled_at DESC LIMIT 30)
             ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at ASC`
        )
        .all();
    res.json(requests);
});

// Removes a file kept under the uploads folder, if it's there. Paths outside it are ignored.
function removeUpload(relativePath) {
    if (!relativePath) return;
    const fullPath = path.resolve(UPLOAD_ROOT, relativePath.replace(/\\/g, '/'));
    if (!fullPath.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) return;
    fs.rmSync(fullPath, { force: true });
}

// Deletes the account. Everything personal goes: name, phone number, password, photos, ID
// document, selfie, bio, skills, notifications and logins. What stays is the record of jobs
// and payments, because the other person on each job relies on it for their own history -
// there the account now shows as "Deleted account". Open gigs are closed and applications
// still waiting are withdrawn.
adminRouter.post('/data-requests/:id/complete', (req, res) => {
    const requestId = Number(req.params.id);
    const request = db.prepare(`SELECT * FROM data_requests WHERE id = ? AND status = 'open'`).get(requestId);
    if (!request) {
        return res.status(404).json({ error: 'That request is no longer open.' });
    }
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(request.user_id);
    if (!user || user.role === 'admin') {
        return res.status(400).json({ error: 'This account cannot be deleted here.' });
    }
    const cleanNote = text(req.body?.response_note, LIMITS.resolutionNotes);
    if (cleanNote === null) {
        return res.status(400).json({ error: `Keep the note to ${LIMITS.resolutionNotes} characters or fewer.` });
    }

    const portfolio = db.prepare(`SELECT image_path FROM portfolio_images WHERE user_id = ?`).all(user.id);
    const unusablePassword = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

    const deleteAccount = db.transaction(() => {
        db.prepare(
            `UPDATE users
             SET name = 'Deleted account', phone = ?, password_hash = ?, id_document_path = NULL, selfie_path = NULL,
                 profile_photo_path = NULL, cover_photo_path = NULL, bio = NULL, skills = NULL,
                 professional_role = NULL, years_experience = NULL, company_name = NULL,
                 verification_status = 'rejected', deleted_at = datetime('now')
             WHERE id = ?`
        ).run(`deleted-${user.id}`, unusablePassword, user.id);
        db.prepare(`DELETE FROM portfolio_images WHERE user_id = ?`).run(user.id);
        db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
        db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(user.id);
        db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(user.id);
        db.prepare(`DELETE FROM job_applications WHERE crew_member_id = ? AND status = 'pending'`).run(user.id);
        db.prepare(`UPDATE job_listings SET status = 'cancelled' WHERE organizer_id = ? AND status = 'open'`).run(user.id);
        db.prepare(
            `UPDATE data_requests SET status = 'done', response_note = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?`
        ).run(cleanNote || null, req.user.id, requestId);
        logChange(req.user.id, 'deletion_completed', 'user', user.id, { role: user.role });
    });
    deleteAccount();

    // The files go once the database no longer points to them.
    for (const filePath of [user.id_document_path, user.selfie_path, user.profile_photo_path, user.cover_photo_path]) {
        removeUpload(filePath);
    }
    for (const image of portfolio) removeUpload(image.image_path);

    res.json({ id: requestId, status: 'done' });
});

// Says no, with a reason the person sees (for example: finish your open job first).
adminRouter.post('/data-requests/:id/decline', (req, res) => {
    const requestId = Number(req.params.id);
    const cleanNote = text(req.body?.response_note, LIMITS.resolutionNotes);
    if (cleanNote === null) {
        return res.status(400).json({ error: `Keep the note to ${LIMITS.resolutionNotes} characters or fewer.` });
    }
    if (!cleanNote) {
        return res.status(400).json({ error: 'Explain why, so the person knows what to do next.' });
    }
    const request = db.prepare(`SELECT user_id FROM data_requests WHERE id = ? AND status = 'open'`).get(requestId);
    if (!request) {
        return res.status(404).json({ error: 'That request is no longer open.' });
    }
    db.transaction(() => {
        db.prepare(
            `UPDATE data_requests SET status = 'declined', response_note = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?`
        ).run(cleanNote, req.user.id, requestId);
        logChange(req.user.id, 'deletion_declined', 'user', request.user_id, { note: cleanNote });
    })();
    createNotification(
        request.user_id,
        'deletion_declined',
        `Your request to delete your account was not completed: ${cleanNote}`,
        '/dashboard'
    );
    res.json({ id: requestId, status: 'declined' });
});

// --- Change log (NFR9, see audit.js) -------------------------------------------------------
// The latest entries, newest first, 50 at a time (?before=<id> for older ones), optionally
// only one kind of change (?group=jobs|disputes|accounts|data).
const ACTIVITY_GROUPS = {
    jobs: ['gig_posted', 'gig_cancelled', 'job_created', 'payment_confirmed', 'job_completed'],
    disputes: ['dispute_raised', 'dispute_resolved'],
    accounts: [
        'account_created',
        'account_approved',
        'account_rejected',
        'password_changed',
        'password_reset_code_issued',
        'password_reset_used',
    ],
    data: ['data_copy_downloaded', 'deletion_requested', 'deletion_cancelled', 'deletion_completed', 'deletion_declined'],
};
const ACTIVITY_PAGE_SIZE = 50;

adminRouter.get('/activity', (req, res) => {
    const conditions = [];
    const params = [];
    const group = ACTIVITY_GROUPS[req.query.group];
    if (group) {
        conditions.push(`a.action IN (${group.map(() => '?').join(', ')})`);
        params.push(...group);
    }
    const before = Number(req.query.before);
    if (Number.isInteger(before) && before > 0) {
        conditions.push('a.id < ?');
        params.push(before);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const entries = db
        .prepare(
            `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
                    a.actor_id, actor.name AS actor_name, actor.role AS actor_role,
                    CASE a.target_type WHEN 'user' THEN target_user.name END AS target_name
             FROM audit_log a
             LEFT JOIN users actor ON actor.id = a.actor_id
             LEFT JOIN users target_user ON a.target_type = 'user' AND target_user.id = a.target_id
             ${where}
             ORDER BY a.id DESC
             LIMIT ${ACTIVITY_PAGE_SIZE + 1}`
        )
        .all(...params);
    const hasMore = entries.length > ACTIVITY_PAGE_SIZE;
    res.json({
        entries: entries.slice(0, ACTIVITY_PAGE_SIZE).map((entry) => ({ ...entry, details: entry.details ? JSON.parse(entry.details) : null })),
        has_more: hasMore,
    });
});

