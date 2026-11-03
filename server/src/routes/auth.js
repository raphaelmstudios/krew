// This is the Sign-up, login, and session routes. We now have registration, login,
// and logging out, with password reset still to come.
import express from 'express';
import bycrypt from 'bcrypt';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth.js';

export const authRouter = express.Router();

// The number of rounds to use for bcrypt hashing. Higher numbers are more secure but take longer to compute. 10 is a reasonable default.
const BYCRYPT_ROUNDS = 10;

// A regex pattern to validate Kenyan phone numbers. It matches numbers that start with +254 or 0, followed by 7 or 1, and then 8 more digits.
const PHONE_PATTERN = /^(?:\+?254|0)(7|1)\d{8}$/;

// How long a login stays valid before the person has to sign in again, in milliseconds. 7 days.
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

authRouter.post('/register', (req, res) => {
    const { name, phone, password, role } = req.body;
    // Checks that the forms are filled correctly before touching the database. 

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }  

    if (!phone || !PHONE_PATTERN.test(phone.trim())) {
        return res.status(400).json({ error: 'Enter a valid Kenyan phone number, e.g. 0712345678.' });
    }

    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    if (role !== 'organizer' && role !== 'crew_member') {
        return res.status(400).json({ error: 'Role must be either "organizer" or "crew_member".' });
    }

    const passwordHash = bycrypt.hashSync(password, BYCRYPT_ROUNDS);

    try {
        const result = db
      .prepare('INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name.trim(), phone.trim(), passwordHash, role);

        // Returns only what the app needs to show know that the registration was successful. The password hash is never sent back to the client.
        res.status(201).json({
            id: result.lastInsertRowid,
            name: name.trim(),
            role,
            verification_status: 'pending',
            });
    } catch (err) {

        // If the error is a unique constraint violation, it means the phone number is already registered. We return a 400 status with a specific error message.
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Phone number already registered.' });
        }

        // For any other errors, we log the error and return a 500 status with a generic error message. 
        // This prevents leaking sensitive information to the client.
        console.error('Registration failed:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

authRouter.post('/login', (req, res) => {
    const { phone, password } = req.body;
    // Checks that both fields were actually sent before touching the database.

    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone.trim());

    // We give the same error whether the phone number doesn't exist or the password is wrong,
    // so this endpoint can't be used to check which phone numbers are registered.
    if (!user || !bycrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Incorrect phone number or password.' });
    }

    // Creates a new session: a long random token saved in the sessions table and handed
    // to the browser as an httpOnly cookie, so JavaScript on the page can never read it,
    // only the browser sends it back automatically on later requests.
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production', // only require HTTPS once this is actually deployed
        maxAge: SESSION_DURATION_MS,
    });

    // Returns only what the app needs to know who's logged in. The password hash is never sent back to the client.
    res.json({
        id: user.id,
        name: user.name,
        role: user.role,
        verification_status: user.verification_status,
    });
});

authRouter.post('/logout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];

    // Deletes the session row so that token can never be used again, then clears the
    // cookie so the browser stops sending it.
    if (token) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ loggedOut: true });
});

// Tells the frontend who (if anyone) is currently logged in. The frontend calls this on
// page load to decide whether to show a screen or send the person to log in first.
authRouter.get('/me', requireAuth, (req, res) => {
    res.json(req.user);
});