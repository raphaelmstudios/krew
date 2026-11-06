// A means of looking up users and their availability status, so organizers can hire crew members directly without going through the open job board.
// Crew members can also set their own availability status, which is self-reported and not tied to job status. This is also where an organizer's payment record and a crew member's completed jobs count live, so either side can check the other before working together.

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const usersRouter = express.Router();

const AVAILABILITY_VALUES = ['available', 'working'];

// Profile photos (shown publicly on the crew directory) are a separate, later upload
// from the private id_document_path/selfie_path pair collected at signup - those two
// are never shown to anyone but an admin, this one is meant to be seen. Same
// save-to-disk-not-the-database pattern as routes/documents.js: files live outside
// client/server so the web server never serves them directly by accident.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const PROFILE_PHOTOS_DIR = path.join(PHOTO_UPLOAD_ROOT, 'profile-photos');
fs.mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true });

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB, same limit as the ID/selfie upload

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PROFILE_PHOTOS_DIR),
  filename: (req, file, cb) => {
    // Never trust the filename the browser sends - build our own from the logged-in
    // user's id and the current time instead.
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `user-${req.user.id}-profile-photo-${Date.now()}${safeExt}`);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_PHOTO_SIZE },
}).single('profile_photo');

// Organizers can look up crew members and their availability status, so they can hire them directly without going through the open job board. Each crew member's completed jobs count comes along too, so the organizer has something to go on before picking who to hire.
usersRouter.get('/crew-directory', requireRole('organizer'), (req, res) => {
  const crewMembers = db
    .prepare(
      `SELECT id, name, availability_status
       FROM users
       WHERE role = 'crew_member' AND verification_status = 'approved'
       ORDER BY name ASC`
    )
    .all();
  res.json(crewMembers.map((crewMember) => ({ ...crewMember, ...computeCrewRecord(crewMember.id) })));
});

// The public "Hire Crew" marketplace page (anyone, logged in or not, can browse who's
// on KREW) - same idea as the organizer-only directory above, but deliberately returns
// less. No phone number, and this is the one place profile_photo_path goes out over the
// network unauthenticated, since it's the one upload meant to be public (see
// POST /me/photo). Actually hiring someone - which needs an approved organizer account
// and sends no money, but is still a real commitment - stays behind the existing
// requireRole('organizer') gate on /api/jobs, same as before.
usersRouter.get('/crew-directory/public', (req, res) => {
  const crewMembers = db
    .prepare(
      `SELECT id, name, profile_photo_path, availability_status
       FROM users
       WHERE role = 'crew_member' AND verification_status = 'approved'
       ORDER BY name ASC`
    )
    .all();
  res.json(crewMembers.map((crewMember) => ({ ...crewMember, ...computeCrewRecord(crewMember.id) })));
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

// Any logged-in user can upload their own profile photo - the thing shown publicly on
// the crew directory (see GET /crew-directory/public below), not the private
// id_document_path/selfie_path pair from signup. Unlike that upload, this one knows who
// the photo belongs to from the session rather than a URL param, so there's no need to
// check an :id against anyone.
usersRouter.post('/me/photo', requireAuth, (req, res) => {
  uploadPhoto(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.message === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(400).json({ error: 'Please upload a JPG or PNG file.' });
      }
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Your photo must be smaller than 5MB.' });
      }
      console.error('Profile photo upload failed:', uploadErr);
      return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Choose a photo to upload.' });
    }

    const relativePath = path.join('profile-photos', req.file.filename);

    // If they already had a photo, swap it out and delete the old file so we don't
    // leave orphaned uploads behind every time someone updates their photo.
    const previous = db.prepare(`SELECT profile_photo_path FROM users WHERE id = ?`).get(req.user.id);
    db.prepare(`UPDATE users SET profile_photo_path = ? WHERE id = ?`).run(relativePath, req.user.id);
    if (previous?.profile_photo_path) {
      fs.unlink(path.join(PHOTO_UPLOAD_ROOT, previous.profile_photo_path), () => {});
    }

    res.status(200).json({ profile_photo_path: relativePath });
  });
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

// The actual math behind an organizer's payment record, pulled out on its own so both the
// lookup route below and the job board (crew browsing open listings, see
// routes/listings.js) can show the same numbers without working them out twice. "On time"
// means the payment was confirmed on or before the job's due date. A job only has a real
// payment date once both sides have confirmed and the amounts matched, and at that point
// whichever of organizer_confirmed_at / crew_confirmed_at is later is treated as when the
// payment actually happened, since that's the moment the two sides actually agreed.
// Organizers with no confirmed jobs yet get null stats instead of a misleading 0%, since
// that's a different situation from an organizer with an actual bad record.
export function computeOrganizerRecord(organizerId) {
  const confirmedJobs = db
    .prepare(
      `SELECT due_date, organizer_confirmed_at, crew_confirmed_at
       FROM transactions
       WHERE organizer_id = ? AND status = 'confirmed'`
    )
    .all(organizerId);

  if (confirmedJobs.length === 0) {
    return { confirmed_job_count: 0, on_time_percentage: null, median_days_to_payment: null };
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

  return {
    confirmed_job_count: confirmedJobs.length,
    on_time_percentage: Math.round((onTimeCount / confirmedJobs.length) * 100),
    median_days_to_payment: Math.round(median(daysToPayment) * 10) / 10,
  };
}

// Anyone logged in can look up an organizer's payment record this way, so a crew member can check it before applying to a listing or accepting a direct hire.
usersRouter.get('/:id/organizer-record', requireAuth, (req, res) => {
  const organizerId = Number(req.params.id);

  const organizer = db
    .prepare(`SELECT id FROM users WHERE id = ? AND role = 'organizer'`)
    .get(organizerId);
  if (!organizer) {
    return res.status(404).json({ error: 'No organizer found with that id.' });
  }

  res.json(computeOrganizerRecord(organizerId));
});

// The actual math behind a crew member's completed jobs count, pulled out on its own so
// both the lookup route below and the crew directory and applicants list (an organizer
// browsing or deciding who to hire, see this file's crew-directory route and
// routes/listings.js) can show the same number without working it out twice. A completed
// job here means one that reached status = 'confirmed' - both sides confirmed the payment
// and the amounts matched - since anything short of that isn't a real completed job yet,
// just one still in progress.
export function computeCrewRecord(crewMemberId) {
  const { confirmed_job_count } = db
    .prepare(`SELECT COUNT(*) AS confirmed_job_count FROM transactions WHERE crew_member_id = ? AND status = 'confirmed'`)
    .get(crewMemberId);
  return { confirmed_job_count };
}

// Organizers can look up a crew member's record this way, so they can see how many jobs that crew member has actually completed and gotten paid for before hiring them.
usersRouter.get('/:id/crew-record', requireAuth, (req, res) => {
  const crewMemberId = Number(req.params.id);

  const crewMember = db
    .prepare(`SELECT id FROM users WHERE id = ? AND role = 'crew_member'`)
    .get(crewMemberId);
  if (!crewMember) {
    return res.status(404).json({ error: 'No crew member found with that id.' });
  }

  res.json(computeCrewRecord(crewMemberId));
});