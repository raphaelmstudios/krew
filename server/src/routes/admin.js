//Admin approval route
// For the new accounts created by the users, the admin can approve or reject the accounts. 
// The admin can also view the list of all the users and their details.

import express from 'express';
import { db } from '../db.js';

export const adminRouter = express.Router();

// THis is everything an admin needs to see about a pending user account
// not password_hash which should never leave the server

const PENDING_USER_COLUMNS = `
  id, name, phone, role, id_document_path, selfie_path, created_at
`;

adminRouter.get('/users/pending', (req, res) => {
    const pendingUsers = db
    .prepare(`SELECT ${PENDING_USER_COLUMNS} FROM users WHERE verification_status = 'pending' ORDER BY created_at ASC`)
    .all();
    res.json(pendingUsers);
});

function setVerificationStatus(newStatus) {
    return (req, res) => {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status (400).json({ error: 'Invalid user ID' });
        }

        const result = db
        .prepare("UPDATE users SET verification_status = ? WHERE id = ? AND verification_status = 'pending'")
        .run(newStatus, userId);

        // If nothing gets updated, it means the user either doesn't exist or is not pending (it was already approved or rejected)
        if (result.changes === 0) {
            return res.status(404).json({ error: `No pending account found for user ID: ${userId}` });
        }

        res.json({ id: userId, verification_status: newStatus });
    };
}

adminRouter.post('/users/:id/approve', setVerificationStatus('approved'));
adminRouter.post('/users/:id/reject', setVerificationStatus('rejected'));