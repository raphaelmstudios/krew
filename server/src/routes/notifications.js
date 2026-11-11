// This file contains functions for creating notifications for users and admins. 

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = express.Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/mine', (req, res) => {
  const notifications = db
    .prepare(
      `SELECT id, type, message, link, read_at, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(req.user.id);
  res.json(notifications);
});

// Mark a specific notification as read. 
// This endpoint updates the read_at timestamp for the notification with the given id, but only if it belongs to the authenticated user and hasn't already been marked as read.
notificationsRouter.post('/:id/read', (req, res) => {
  const notificationId = Number(req.params.id);
  const result = db
    .prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL`)
    .run(notificationId, req.user.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'No unread notification found with that id.' });
  }
  res.json({ id: notificationId });
});

notificationsRouter.post('/read-all', (req, res) => {
  db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`).run(
    req.user.id
  );
  res.json({ ok: true });
});