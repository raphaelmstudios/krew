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
jobsRouter.get('/mine', requireAuth, (req, res) => {
  const { id, role } = req.user;

  if (role === 'organizer') {
    const jobs = db
      .prepare(
        `SELECT t.id, t.amount, t.due_date, t.job_description, t.status, t.created_at,
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