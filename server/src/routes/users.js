// A means of looking up users and their availability status, so organizers can hire crew members directly without going through the open job board.
// Crew members can also set their own availability status, which is self-reported and not tied to job status. This is also where an organizer's payment record lives, so a crew member can check it before working with them.

import express from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const usersRouter = express.Router();

const AVAILABILITY_VALUES = ['available', 'working'];

// Organizers can look up crew members and their availability status, so they can hire them directly without going through the open job board.
usersRouter.get('/crew-directory', requireRole('organizer'), (req, res) => {
  const crewMembers = db
    .prepare(
      `SELECT id, name, availability_status
       FROM users
       WHERE role = 'crew_member' AND verification_status = 'approved'
       ORDER BY name ASC`
    )
    .all();
  res.json(crewMembers);
});

// Crew members can set their own availability status, which is self-reported and not tied to job status. This allows organizers to see whether a crew member is available for hire or currently working on a job.
usersRouter.post('/me/availability', requireRole('crew_member'), (req, res) => {
  const { status } = req.body;
  if (!AVAILABILITY_VALUES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${AVAILABILITY_VALUES.join(', ')}.` });
  }
  db.prepare(`UPDATE users SET availability_status = ? WHERE id = ?`).run(status, req.user.id);
  res.json({ availability_status: status });
});

// SQLite stores datetime('now') as "YYYY-MM-DD HH:MM:SS" with no timezone marker, even though it's actually UTC. Some JS engines will read that as local time instead, so this makes the UTC reading explicit rather than relying on parsing behaviour that can differ by platform.
function parseUtcTimestamp(value) {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

// A simple median helper, used below to find the middle value of how many days early or late a set of payments were.
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

// Anyone logged in can look up an organizer's payment record, so a crew member can check it before applying to a listing or accepting a direct hire. "On time" means the payment was confirmed on or before the job's due date. A job only has a real payment date once both sides have confirmed and the amounts matched, and at that point whichever of organizer_confirmed_at / crew_confirmed_at is later is treated as when the payment actually happened, since that's the moment the two sides actually agreed. Organizers with no confirmed jobs yet get null stats instead of a misleading 0%, since that's a different situation from an organizer with an actual bad record.
usersRouter.get('/:id/organizer-record', requireAuth, (req, res) => {
  const organizerId = Number(req.params.id);

  const organizer = db
    .prepare(`SELECT id FROM users WHERE id = ? AND role = 'organizer'`)
    .get(organizerId);
  if (!organizer) {
    return res.status(404).json({ error: 'No organizer found with that id.' });
  }

  const confirmedJobs = db
    .prepare(
      `SELECT due_date, organizer_confirmed_at, crew_confirmed_at
       FROM transactions
       WHERE organizer_id = ? AND status = 'confirmed'`
    )
    .all(organizerId);

  if (confirmedJobs.length === 0) {
    return res.json({ confirmed_job_count: 0, on_time_percentage: null, median_days_to_payment: null });
  }

  const daysToPayment = confirmedJobs.map((job) => {
    const paidAt =
      parseUtcTimestamp(job.organizer_confirmed_at) > parseUtcTimestamp(job.crew_confirmed_at)
        ? job.organizer_confirmed_at
        : job.crew_confirmed_at;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return (parseUtcTimestamp(paidAt) - new Date(job.due_date)) / millisecondsPerDay;
  });

  const onTimeCount = daysToPayment.filter((days) => days <= 0).length;

  res.json({
    confirmed_job_count: confirmedJobs.length,
    on_time_percentage: Math.round((onTimeCount / confirmedJobs.length) * 100),
    median_days_to_payment: Math.round(median(daysToPayment) * 10) / 10,
  });
});