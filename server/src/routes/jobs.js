// Job-related routes for handling job postings and inquiries.
// Organizers can hire crew members directly, and both organizers and crew members can view their own jobs.
// The routes are protected by authentication and role-based access control, ensuring that only authorized users can perform certain actions.

import express from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const jobsRouter = express.Router();

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
// An organizer can hire a crew member directly, creating a job agreement between them.
jobsRouter.post('/', requireRole('organizer'), (req, res) => {
  const organizer = req.user;
  const { crew_member_id, amount, due_date, job_description } = req.body;

  // An unapproved organizer shouldn't be able to post paid work yet - that's
  // the whole point of the ID verification step from Task d1-6.
  if (organizer.verification_status !== 'approved') {
    return res.status(403).json({ error: 'Your account needs to be approved before you can hire someone.' });
  }

  const crewMemberId = Number(crew_member_id);
  if (!Number.isInteger(crewMemberId) || crewMemberId <= 0) {
    return res.status(400).json({ error: 'Pick a crew member to hire.' });
  }

// We only allow hiring crew members who are approved and verified, not organizers or unverified crew members.
// This is a security measure to prevent organizers from hiring unverified crew members, which could lead to potential issues or disputes.
  const crewMember = db
    .prepare(`SELECT id FROM users WHERE id = ? AND role = 'crew_member' AND verification_status = 'approved'`)
    .get(crewMemberId);
  if (!crewMember) {
    return res.status(400).json({ error: 'That crew member is not available to hire.' });
  }

  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return res.status(400).json({ error: 'Enter an amount greater than zero.' });
  }

  if (!due_date || Number.isNaN(Date.parse(due_date))) {
    return res.status(400).json({ error: 'Enter a valid due date.' });
  }
  if (startOfDay(due_date) < startOfDay(new Date())) {
    return res.status(400).json({ error: 'Due date cannot be in the past.' });
  }

  const description = job_description && job_description.trim() ? job_description.trim() : null;

  const result = db
    .prepare(
      `INSERT INTO transactions (organizer_id, crew_member_id, amount, due_date, job_description, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
    .run(organizer.id, crewMemberId, amountNumber, due_date, description);

  res.status(201).json({
    id: result.lastInsertRowid,
    organizer_id: organizer.id,
    crew_member_id: crewMemberId,
    amount: amountNumber,
    due_date,
    job_description: description,
    status: 'pending',
  });
});

// Both organizers and crew members can view their own jobs.
// Admins don't have jobs of their own, so they get an empty list.
// The jobs are returned in descending order of creation date, so the most recent jobs appear first.
// Each job also includes both sides' payment confirmation details (date confirmed and amount confirmed), if either side has submitted one yet.
jobsRouter.get('/mine', requireAuth, (req, res) => {
  const { id, role } = req.user;

  if (role === 'organizer') {
    const jobs = db
      .prepare(
        `SELECT t.id, t.amount, t.due_date, t.job_description, t.status, t.created_at,
                t.organizer_confirmed_at, t.organizer_confirmed_amount,
                t.crew_confirmed_at, t.crew_confirmed_amount,
                cm.id AS crew_member_id, cm.name AS crew_member_name
         FROM transactions t
         JOIN users cm ON cm.id = t.crew_member_id
         WHERE t.organizer_id = ?
         ORDER BY t.created_at DESC`
      )
      .all(id);
    return res.json(jobs);
  }

  if (role === 'crew_member') {
    const jobs = db
      .prepare(
        `SELECT t.id, t.amount, t.due_date, t.job_description, t.status, t.created_at,
                t.organizer_confirmed_at, t.organizer_confirmed_amount,
                t.crew_confirmed_at, t.crew_confirmed_amount,
                org.id AS organizer_id, org.name AS organizer_name
         FROM transactions t
         JOIN users org ON org.id = t.organizer_id
         WHERE t.crew_member_id = ?
         ORDER BY t.created_at DESC`
      )
      .all(id);
    return res.json(jobs);
  }

  res.json([]);
});

// Either the organizer or the crew member on a job can confirm that a payment happened, along with the amount they are confirming.
// This records that one side's confirmation (amount and the time it was confirmed) - the time is always set by the server's own
// clock, not something either person can send us, so nobody can backdate a confirmation.
// A single side's confirmation isn't enough to call a job paid on its own. Once BOTH sides have confirmed, we compare the two
// amounts: if they match, the job's status moves to 'confirmed' automatically; if they don't, the status stays 'pending' and
// whoever looks at the job can see both numbers side by side and sort it out (raising an actual dispute is a separate task).
jobsRouter.post('/:id/confirm', requireAuth, (req, res) => {
  const transactionId = Number(req.params.id);
  const { amount } = req.body;

  const transaction = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(transactionId);
  if (!transaction) {
    return res.status(404).json({ error: 'No job found with that id.' });
  }

  // Only the organizer or crew member who are actually part of this specific job are allowed to confirm it.
  const isOrganizer = transaction.organizer_id === req.user.id;
  const isCrewMember = transaction.crew_member_id === req.user.id;
  if (!isOrganizer && !isCrewMember) {
    return res.status(403).json({ error: "You're not part of this job." });
  }

  if (transaction.status !== 'pending') {
    return res.status(409).json({ error: `This job is already ${transaction.status} - it can't be confirmed again.` });
  }

  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return res.status(400).json({ error: 'Enter an amount greater than zero.' });
  }

  // Which pair of columns we write to depends on which side of the agreement the logged-in person is on, never on anything they send us.
  const side = isOrganizer ? 'organizer' : 'crew';
  db.prepare(
    `UPDATE transactions SET ${side}_confirmed_at = datetime('now'), ${side}_confirmed_amount = ? WHERE id = ?`
  ).run(amountNumber, transactionId);

  let updated = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(transactionId);

  // Match-and-confirm (Task d2-3): once both sides have an entry in, see if
  // they agree. Only a match moves the job to 'confirmed' - a mismatch
  // leaves it 'pending' rather than guessing which side is right.
  const bothConfirmed = updated.organizer_confirmed_at !== null && updated.crew_confirmed_at !== null;
  const amountsMatch = bothConfirmed && Number(updated.organizer_confirmed_amount) === Number(updated.crew_confirmed_amount);

  if (bothConfirmed && amountsMatch) {
    db.prepare(`UPDATE transactions SET status = 'confirmed' WHERE id = ?`).run(transactionId);
    updated = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(transactionId);
  }

  res.json({
    id: updated.id,
    status: updated.status,
    organizer_confirmed_at: updated.organizer_confirmed_at,
    organizer_confirmed_amount: updated.organizer_confirmed_amount,
    crew_confirmed_at: updated.crew_confirmed_at,
    crew_confirmed_amount: updated.crew_confirmed_amount,
    mismatch: bothConfirmed && !amountsMatch,
  });
});

// This route is a placeholder for future integration with Daraja, a mobile payment platform. 
// It currently returns a 501 Not Implemented status, indicating that the feature is not yet available. 
// When implemented, this route will handle payment confirmations through Daraja for jobs posted on the platform.
jobsRouter.post('/:id/daraja-confirm', (req, res) => {
  res.status(501).json({ error: 'Daraja integration is not implemented yet.' });
});