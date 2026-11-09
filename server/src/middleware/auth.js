// Checks who is logged in and whether they are an admin.
// If not, returns a 401 or 403 error.

// Both attach the logged-in user to req.user (without the password hash)
// so routes further down the chain can use it.

import { db } from '../db.js';

const SESSION_COOKIE_NAME = 'krew_session';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  if (new Date(session.expires_at) < new Date()) {
    // Clean up the expired row instead of leaving it to pile up.
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }

  const user = db
    .prepare(
      `SELECT id, name, phone, role, verification_status, availability_status,
              profile_photo_path, professional_role, skills
       FROM users WHERE id = ?`
    )
    .get(session.user_id);
  if (!user) {
    // The account was deleted after the session was created - treat it the
    // same as not being logged in at all.
    return res.status(401).json({ error: 'Please log in.' });
  }

  req.user = user;
  next();
}

// A general version of requireAdmin for any single role - e.g.
// requireRole('organizer') for routes only an organizer should reach.
export function requireRole(role) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.user.role !== role) {
        return res.status(403).json({ error: `Only ${role.replace('_', ' ')}s can do this.` });
      }
      next();
    });
  };
}

export const requireAdmin = requireRole('admin');

export { SESSION_COOKIE_NAME };