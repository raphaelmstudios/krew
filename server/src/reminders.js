// Reminder functionality for checking and sending due payment reminders
// This module checks for transactions that are due soon and sends notifications to organizers to remind them to confirm payments on time.
// It runs on a scheduled interval and updates the database to mark reminders as sent, preventing duplicate notifications.
// The reminder window is set to 1 day before the due date, and reminders are only sent for transactions that are still pending and have not already had a reminder sent.
// The module exports two functions: checkDueReminders, which performs the check and sends notifications, and startReminderScheduler, which sets up the interval to run the check periodically.

import { db } from './db.js';
import { createNotification } from './notifications.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour for transactions due within the next day

export function checkDueReminders() {
  const dueSoon = db
    .prepare(
      `SELECT t.id, t.organizer_id, t.amount, t.due_date, t.job_description, crew.name AS crew_member_name
       FROM transactions t
       JOIN users crew ON crew.id = t.crew_member_id
       WHERE t.status = 'pending'
         AND t.due_reminder_sent_at IS NULL
         AND date(t.due_date) BETWEEN date('now') AND date('now', '+1 day')`
    )
    .all();

  for (const transaction of dueSoon) {
    const sendReminder = db.transaction(() => {
      createNotification(
        transaction.organizer_id,
        'payment_due_reminder',
        `Payment of KES ${Number(transaction.amount).toLocaleString()} to ${transaction.crew_member_name} is due ${
          transaction.due_date
        } - confirm it on time to keep your on-time record.`,
        '/dashboard'
      );
      db.prepare(`UPDATE transactions SET due_reminder_sent_at = datetime('now') WHERE id = ?`).run(transaction.id);
    });
    sendReminder();
  }

  return dueSoon.length;
}

export function startReminderScheduler() {
  checkDueReminders(); // run once immediately, rather than making a freshly-started server wait a full interval before the first check
  setInterval(checkDueReminders, CHECK_INTERVAL_MS);
}