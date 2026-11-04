// A means of looking up users and their availability status, so organizers can hire crew members directly without going through the open job board. 
// Crew members can also set their own availability status, which is self-reported and not tied to job status.

import express from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

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