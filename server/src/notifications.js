// notifications.js
// This file contains functions for creating notifications for users and admins. 
// Notifications are stored in the database and can be retrieved by the client to display to the user.

import { db } from './db.js';

export function createNotification(userId, type, message, link = null) {
  db.prepare(`INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`).run(
    userId,
    type,
    message,
    link
  );
}

// This function sends a notification to all admins. 
// It takes a type, message, and optional link as parameters. 
// It retrieves all users with the role 'admin' from the database and creates a notification for each of them.
export function notifyAdmins(type, message, link = null) {
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  for (const admin of admins) {
    createNotification(admin.id, type, message, link);
  }
}