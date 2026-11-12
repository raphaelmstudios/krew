// Loads server/.env (if there is one) before any other module reads process.env.
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate } from './db.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { adminRouter } from './routes/admin.js';
import { jobsRouter } from './routes/jobs.js';
import { listingsRouter } from './routes/listings.js';
import { usersRouter } from './routes/users.js';
import { notificationsRouter } from './routes/notifications.js';
import { startReminderScheduler } from './reminders.js';
import { runStartupTasks } from './bootstrap.js';
import { sendPageWithMeta } from './pageMeta.js';
import { securityHeaders, requireHttps, sameOriginOnly, cleanBody, errorHandler } from './security.js';
import { UPLOAD_ROOT } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Security pass (see security.js for what each of these does):
// - No CORS middleware: the API is only ever called by KREW's own pages, which are served
//   from this same server (and through Vite's proxy in development), so no other site needs
//   to be allowed in. The old wide-open cors() let any website call the API.
// - On Render, requests arrive through Render's proxy; trusting it gives the real visitor IP
//   (for rate limiting) and the real protocol (for the HTTPS redirect and secure cookies).
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by'); // don't advertise that this is Express
app.use(requireHttps);
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(cleanBody);
app.use('/api', sameOriginOnly);

migrate();
// Creates the first admin and/or loads demo data on an empty database, when the environment
// variables ask for it (bootstrap.js - mainly for hosts without a shell, like Render's free plan).
runStartupTasks();

// Health check endpoint that confirms the server is functioning and the database is well connected.
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', db: row.ok === 1 ? 'connected' : 'error' });
});

// Mounts the routers for authentication, user document management, admin operations, job
// agreements, job listings, and crew directory lookups.
// The authRouter handles login, logout, and registration endpoints.
// The documentsRouter handles endpoints related to user document uploads and retrievals.
// The adminRouter handles endpoints for admin-specific operations, such as approving users and managing the system.
// The jobsRouter handles an organizer hiring a known crew member directly, listing the confirmed jobs either side is part of, either side manually confirming a payment on one of them (auto-confirming once both sides agree).
// The listingsRouter handles the job board: posting an open listing, crew applying to it, and the organizer accepting one applicant.
// The usersRouter handles the crew directory, a crew member's own availability status, and computing each side's reciprocal record: an organizer's on-time payment stats and a crew member's completed jobs count.
// The notificationsRouter handles a logged-in person's own notification feed - the rows in it are written by the other routers above (see notifications.js), this one only reads and dismisses them.
app.use('/api/auth', authRouter);
app.use('/api/users', documentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/job-listings', listingsRouter);
app.use('/api/notifications', notificationsRouter);

// Any other /api address is a mistake - answer with a JSON 404 rather than falling through
// to the page catch-all below and sending back the React app's HTML.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Profile photos (routes/users.js) are the one upload meant to be seen by anyone, so
// they get their own public static route - unlike the id_document/selfie uploads from
// signup, which stay private and have no route serving them at all. Portfolio photos
// (also routes/users.js, redesign moodboard's Crew Profile page) are the same deal -
// meant to be seen by anyone who visits that crew member's public profile.
// Uploaded photos are only ever served as files - no directory listings, no hidden files -
// and the security headers above (nosniff + CSP) apply to them too.
const uploadStaticOptions = { dotfiles: 'deny', index: false, maxAge: '7d' };
const profilePhotosPath = path.join(UPLOAD_ROOT, 'profile-photos');
app.use('/uploads/profile-photos', express.static(profilePhotosPath, uploadStaticOptions));
const portfolioPhotosPath = path.join(UPLOAD_ROOT, 'portfolio-photos');
app.use('/uploads/portfolio-photos', express.static(portfolioPhotosPath, uploadStaticOptions));
// Listing photos (routes/listings.js) - shown on the public Find Work page, so public too.
const listingPhotosPath = path.join(UPLOAD_ROOT, 'listing-photos');
app.use('/uploads/listing-photos', express.static(listingPhotosPath, uploadStaticOptions));
// Anything else under /uploads (ID documents, selfies) is private: a plain 404 here, never the app's HTML.
app.use('/uploads', (req, res) => {
  res.status(404).send('Not found');
});

const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
// index: false - the homepage also goes through the page-meta route below rather than being
// served as a plain file.
app.use(express.static(clientDistPath, { index: false }));

// This route is a catch-all route that serves the index.html file for any request that doesn't match an existing API route or static file.
// Each page gets its own title, description and share tags written in (pageMeta.js), and an
// address that isn't a real page gets a 404 status (the app still loads and shows its 404 page).
app.get('/{*splat}', (req, res) => {
  sendPageWithMeta(path.join(clientDistPath, 'index.html'), req, res);
});

// Last in line: turns any unhandled error into a plain message (security.js).
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`KREW API listening on http://localhost:${PORT}`);
  // Payment due-date reminder (FR7.1, see reminders.js) - started here rather than at
  // import time so it only ever runs against a server that's actually up and serving.
  startReminderScheduler();
});