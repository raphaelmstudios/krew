// This is  the job listings and applications system for KREW.
// It allows organizers to post open job listings, crew members to apply to those listings, and organizers to accept one applicant to create a formal job agreement.
// It also allows organizers to hire approved crew members directly without going through the open job board.

import express from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { computeOrganizerRecord, computeCrewRecord } from './users.js';

export const listingsRouter = express.Router();

// A small fixed list rather than free text, so Find Work's category filter has
// something consistent to filter on. Mirrored in client/src/pages/PostListingForm.jsx -
// if this list changes, that file's <select> options need to match.
export const LISTING_CATEGORIES = [
  'Bar Service',
  'Catering',
  'Security',
  'Event Setup & Teardown',
  'Ushering & Guest Services',
  'Photography & Videography',
  'Sound & AV',
  'Other',
];

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

// --- organizer: post an open listing ---
listingsRouter.post('/', requireRole('organizer'), (req, res) => {
  const organizer = req.user;
  const { amount, due_date, job_description, title, category, location } = req.body;

  // An unapproved organizer shouldn't be able to post paid work yet - that's
  // the whole point of the ID verification step from Task d1-6.
  if (organizer.verification_status !== 'approved') {
    return res.status(403).json({ error: 'Your account needs to be approved before you can post a job.' });
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

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Give the job a short title.' });
  }
  if (!category || !LISTING_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${LISTING_CATEGORIES.join(', ')}.` });
  }
  if (!location || !location.trim()) {
    return res.status(400).json({ error: 'Enter where the job is located.' });
  }

  const description = job_description && job_description.trim() ? job_description.trim() : null;

  const result = db
    .prepare(
      `INSERT INTO job_listings (organizer_id, amount, due_date, job_description, title, category, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
    )
    .run(organizer.id, amountNumber, due_date, description, title.trim(), category, location.trim());

  res.status(201).json({
    id: result.lastInsertRowid,
    organizer_id: organizer.id,
    amount: amountNumber,
    due_date,
    job_description: description,
    title: title.trim(),
    category,
    location: location.trim(),
    status: 'open',
  });
});

// --- organizer: their own listings, with how many people are waiting on each ---
listingsRouter.get('/mine', requireRole('organizer'), (req, res) => {
  const listings = db
    .prepare(
      `SELECT l.id, l.amount, l.due_date, l.job_description, l.title, l.category, l.location, l.status, l.created_at,
              (SELECT COUNT(*) FROM job_applications a WHERE a.listing_id = l.id AND a.status = 'pending') AS pending_applicant_count
       FROM job_listings l
       WHERE l.organizer_id = ?
       ORDER BY l.created_at DESC`
    )
    .all(req.user.id);
  res.json(listings);
});

// --- organizer: close a listing they no longer want open ---
listingsRouter.post('/:id/cancel', requireRole('organizer'), (req, res) => {
  const listingId = Number(req.params.id);
  const result = db
    .prepare(`UPDATE job_listings SET status = 'cancelled' WHERE id = ? AND organizer_id = ? AND status = 'open'`)
    .run(listingId, req.user.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'No open listing of yours found with that id.' });
  }
  res.json({ id: listingId, status: 'cancelled' });
});

// --- organizer: who has applied to one of their listings ---
// Each applicant also comes with their completed jobs count, giving the organizer
// something to go on before deciding who to accept.
listingsRouter.get('/:id/applicants', requireRole('organizer'), (req, res) => {
  const listingId = Number(req.params.id);
  const listing = db.prepare(`SELECT id FROM job_listings WHERE id = ? AND organizer_id = ?`).get(listingId, req.user.id);
  if (!listing) {
    return res.status(404).json({ error: 'No listing of yours found with that id.' });
  }

  const applicants = db
    .prepare(
      `SELECT a.id AS application_id, a.status, a.created_at,
              u.id AS crew_member_id, u.name AS crew_member_name
       FROM job_applications a
       JOIN users u ON u.id = a.crew_member_id
       WHERE a.listing_id = ?
       ORDER BY a.created_at ASC`
    )
    .all(listingId);
  res.json(applicants.map((applicant) => ({ ...applicant, ...computeCrewRecord(applicant.crew_member_id) })));
});

// --- organizer: accept one applicant - creates the real job agreement ---
listingsRouter.post('/:id/accept', requireRole('organizer'), (req, res) => {
  const listingId = Number(req.params.id);
  const crewMemberId = Number(req.body.crew_member_id);

  if (!Number.isInteger(crewMemberId) || crewMemberId <= 0) {
    return res.status(400).json({ error: 'Pick which applicant to accept.' });
  }

  const listing = db.prepare(`SELECT * FROM job_listings WHERE id = ? AND organizer_id = ?`).get(listingId, req.user.id);
  if (!listing) {
    return res.status(404).json({ error: 'No listing of yours found with that id.' });
  }
  if (listing.status !== 'open') {
    return res.status(409).json({ error: `This listing is already ${listing.status}.` });
  }
  if (startOfDay(listing.due_date) < startOfDay(new Date())) {
    return res.status(400).json({ error: "This listing's due date has already passed. Cancel it and post a new one." });
  }

  const application = db
    .prepare(`SELECT * FROM job_applications WHERE listing_id = ? AND crew_member_id = ? AND status = 'pending'`)
    .get(listingId, crewMemberId);
  if (!application) {
    return res.status(400).json({ error: 'That person has not applied to this listing.' });
  }

  // We wrap the following three database operations in a transaction to ensure that either all of them succeed or none of them do. This prevents the system from ending up in an inconsistent state if, for example, the listing is marked as filled but the transaction record is not created.
  const acceptApplicant = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO transactions (organizer_id, crew_member_id, amount, due_date, job_description, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(listing.organizer_id, crewMemberId, listing.amount, listing.due_date, listing.job_description);

    db.prepare(`UPDATE job_listings SET status = 'filled' WHERE id = ?`).run(listingId);
    db.prepare(`UPDATE job_applications SET status = 'accepted' WHERE id = ?`).run(application.id);
    db.prepare(
      `UPDATE job_applications SET status = 'declined' WHERE listing_id = ? AND id != ? AND status = 'pending'`
    ).run(listingId, application.id);

    return result.lastInsertRowid;
  });

  const transactionId = acceptApplicant();

  res.status(201).json({
    transaction_id: transactionId,
    listing_id: listingId,
    crew_member_id: crewMemberId,
    status: 'filled',
  });
});

// --- crew: browse open listings ---
// Each listing also comes with the organizer's payment record, giving crew members
// something to go on before deciding whether to apply.
listingsRouter.get('/open', requireRole('crew_member'), (req, res) => {
  const listings = db
    .prepare(
      `SELECT l.id, l.amount, l.due_date, l.job_description, l.title, l.category, l.location, l.created_at,
              org.id AS organizer_id, org.name AS organizer_name,
              EXISTS(
                SELECT 1 FROM job_applications a WHERE a.listing_id = l.id AND a.crew_member_id = ?
              ) AS already_applied
       FROM job_listings l
       JOIN users org ON org.id = l.organizer_id
       WHERE l.status = 'open'
       ORDER BY l.created_at DESC`
    )
    .all(req.user.id);
  // SQLite returns 0/1 for EXISTS(...) - send real booleans to the frontend.
  res.json(
    listings.map((listing) => ({
      ...listing,
      already_applied: Boolean(listing.already_applied),
      organizer_record: computeOrganizerRecord(listing.organizer_id),
    }))
  );
});

// --- anyone: a public preview of open listings, for the "Find Work" marketplace page ---
// Same idea as GET /open above, but for a visitor who isn't logged in (or isn't crew)
// yet. Includes organizer_name - the redesign brief's own Find Work card spec (section
// 7.3) lists "Organizer" as a field to show, and crew members' names are already shown
// publicly on the Hire Crew directory (routes/users.js), so withholding only organizer
// names here would be an inconsistent, not more protective, rule. Still never includes
// phone numbers or any other contact/account detail - that line hasn't moved. Actually
// applying still needs a real, approved crew account, same requireRole('crew_member')
// gate as /:id/apply below.
listingsRouter.get('/public', (req, res) => {
  const listings = db
    .prepare(
      `SELECT l.id, l.amount, l.due_date, l.job_description, l.title, l.category, l.location, l.created_at,
              l.organizer_id, org.name AS organizer_name
       FROM job_listings l
       JOIN users org ON org.id = l.organizer_id
       WHERE l.status = 'open'
       ORDER BY l.created_at DESC`
    )
    .all();
  res.json(
    listings.map(({ organizer_id, ...listing }) => ({
      ...listing,
      organizer_record: computeOrganizerRecord(organizer_id),
    }))
  );
});

// --- anyone: a single open listing's public detail, for the gig-detail page ---
// Same shape as GET /public above (organizer_name included, nothing else about the
// organizer's account), just for one listing instead of the whole list. A cancelled,
// filled, or non-existent listing id all come back as a 404 rather than leaking which
// one it is.
listingsRouter.get('/public/:id', (req, res) => {
  const listingId = Number(req.params.id);
  const listing = db
    .prepare(
      `SELECT l.id, l.amount, l.due_date, l.job_description, l.title, l.category, l.location, l.created_at,
              l.organizer_id, org.name AS organizer_name
       FROM job_listings l
       JOIN users org ON org.id = l.organizer_id
       WHERE l.id = ? AND l.status = 'open'`
    )
    .get(listingId);

  if (!listing) {
    return res.status(404).json({ error: 'No open listing found with that id.' });
  }

  const { organizer_id, ...rest } = listing;
  res.json({ ...rest, organizer_record: computeOrganizerRecord(organizer_id) });
});

// --- crew: apply to an open listing ---
listingsRouter.post('/:id/apply', requireRole('crew_member'), (req, res) => {
  const crewMember = req.user;
  const listingId = Number(req.params.id);

  if (crewMember.verification_status !== 'approved') {
    return res.status(403).json({ error: 'Your account needs to be approved before you can apply for jobs.' });
  }

  const listing = db.prepare(`SELECT id, status FROM job_listings WHERE id = ?`).get(listingId);
  if (!listing) {
    return res.status(404).json({ error: 'That listing no longer exists.' });
  }
  if (listing.status !== 'open') {
    return res.status(409).json({ error: 'This listing is no longer open.' });
  }

  try {
    db.prepare(`INSERT INTO job_applications (listing_id, crew_member_id, status) VALUES (?, ?, 'pending')`).run(
      listingId,
      crewMember.id
    );
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: "You've already applied to this listing." });
    }
    throw err;
  }

  res.status(201).json({ listing_id: listingId, status: 'pending' });
});

// --- crew: their own applications, with the listing details ---
listingsRouter.get('/mine-applications', requireRole('crew_member'), (req, res) => {
  const applications = db
    .prepare(
      `SELECT a.id, a.status, a.created_at,
              l.id AS listing_id, l.amount, l.due_date, l.job_description, l.title, l.category, l.location, l.status AS listing_status,
              org.name AS organizer_name
       FROM job_applications a
       JOIN job_listings l ON l.id = a.listing_id
       JOIN users org ON org.id = l.organizer_id
       WHERE a.crew_member_id = ?
       ORDER BY a.created_at DESC`
    )
    .all(req.user.id);
  res.json(applications);
});