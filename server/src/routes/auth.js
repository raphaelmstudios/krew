// This is the Sign-up, login, and session routes. We now have registration, login,
// and logging out, with password reset still to come.
import express from 'express';
import bycrypt from 'bcrypt';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, findSessionUser, SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { rateLimit, normalizePhone, text, LIMITS } from '../security.js';
import { createNotification, notifyAdmins } from '../notifications.js';

export const authRouter = express.Router();

// The number of rounds to use for bcrypt hashing. Higher numbers are more secure but take longer to compute. 10 is a reasonable default.
const BYCRYPT_ROUNDS = 10;

// Kenyan phone numbers are checked and stored in one format (0712345678) by normalizePhone
// in security.js, so +254712345678 and 0712345678 are the same account.

// bcrypt only reads the first 72 bytes of a password, so anything longer is refused rather
// than silently cut short.
const MAX_PASSWORD_LENGTH = 72;

// Compared against when a phone number isn't registered, so a wrong number takes as long to
// answer as a wrong password - otherwise the response time would give away which numbers
// have accounts.
const DUMMY_PASSWORD_HASH = bycrypt.hashSync('not-a-real-password', BYCRYPT_ROUNDS);

// How long a login stays valid before the person has to sign in again, in milliseconds. 7 days.
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Brute-force protection. Only failed logins count, so people sharing one connection (campus
// Wi-Fi) are never blocked for logging in successfully:
// - 10 wrong attempts for one phone number in 15 minutes, from anywhere, locks that number;
// - 30 wrong attempts from one address in 15 minutes locks that address.
// Sign-ups: 30 new accounts per hour from one address - room for a whole class registering
// together during the pilot, while still stopping a script from mass-creating accounts.
const loginLimitByIp = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    failuresOnly: true,
    message: 'Too many failed login attempts from this connection. Please wait 15 minutes and try again.',
});
const loginLimitByPhone = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    failuresOnly: true,
    message: 'Too many failed login attempts for this number. Please wait 15 minutes and try again.',
    key: (req) => normalizePhone(req.body?.phone) || 'invalid',
});
const registerLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: 'Too many accounts created from this connection. Please try again later.',
});

// Creates a new session: a long random token saved in the sessions table and handed
// to the browser as an httpOnly cookie, so JavaScript on the page can never read it,
// only the browser sends it back automatically on later requests.
function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);

    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production', // only require HTTPS once this is actually deployed
        maxAge: SESSION_DURATION_MS,
        path: '/',
    });
}

authRouter.post('/register', registerLimit, (req, res) => {
    const { password, role } = req.body;
    // Checks that the forms are filled correctly before touching the database. 

    const name = text(req.body.name, LIMITS.name);
    if (name === null) {
        return res.status(400).json({ error: `Name must be ${LIMITS.name} characters or fewer.` });
    }
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const phone = normalizePhone(req.body.phone);
    if (!phone) {
        return res.status(400).json({ error: 'Enter a valid Kenyan phone number, e.g. 0712345678.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.` });
    }

    if (role !== 'organizer' && role !== 'crew_member') {
        return res.status(400).json({ error: 'Role must be either "organizer" or "crew_member".' });
    }

    const passwordHash = bycrypt.hashSync(password, BYCRYPT_ROUNDS);

    try {
        const result = db
      .prepare('INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, phone, passwordHash, role);

        // Signs the new account straight in, so the ID upload that follows is made as this
        // person (POST /api/users/:id/documents only accepts uploads for your own account).
        startSession(res, result.lastInsertRowid);

        // Returns only what the app needs to show know that the registration was successful. The password hash is never sent back to the client.
        res.status(201).json({
            id: result.lastInsertRowid,
            name,
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

authRouter.post('/login', loginLimitByIp, loginLimitByPhone, (req, res) => {
    const { password } = req.body;
    // Checks that both fields were actually sent before touching the database.

    if (!req.body.phone || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const phone = normalizePhone(req.body.phone);
    const user = phone ? db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) : null;

    // We give the same error whether the phone number doesn't exist or the password is wrong,
    // so this endpoint can't be used to check which phone numbers are registered.
    const passwordMatches = bycrypt.compareSync(password, user ? user.password_hash : DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
        return res.status(401).json({ error: 'Incorrect phone number or password.' });
    }

    startSession(res, user.id);

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
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ loggedOut: true });
});

// Tells the frontend who (if anyone) is currently logged in. The frontend calls this on
// page load to decide whether to show a screen or send the person to log in first.
authRouter.get('/me', requireAuth, (req, res) => {
    res.json(req.user);
});

// --- Password reset ---------------------------------------------------------------------
// KREW has no email or SMS, so resets go through a person: you ask for one here, a KREW admin
// calls the number on your account to confirm it's you and reads you a one-time code
// (routes/admin.js), and you set a new password with that code below. See the
// password_resets table in db.js.

export const RESET_CODE_MINUTES = 30;
const MAX_RESET_ATTEMPTS = 5;

export function hashResetCode(code) {
    return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
}

function checkNewPassword(password) {
    if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
    return null;
}

const resetRequestLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many reset requests from this connection. Please try again later.',
});
const resetCodeLimitByPhone = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    failuresOnly: true,
    message: 'Too many wrong codes. Please wait 15 minutes and try again.',
    key: (req) => normalizePhone(req.body?.phone) || 'invalid',
});

// Ask for a reset. The answer is the same whether or not the number has an account, so this
// can't be used to find out who's registered. Admin accounts are left out on purpose - they
// are reset with server/scripts/create-admin.js, never over the phone.
authRouter.post('/forgot-password', resetRequestLimit, (req, res) => {
    const phone = normalizePhone(req.body.phone);
    if (!phone) {
        return res.status(400).json({ error: 'Enter a valid Kenyan phone number, e.g. 0712345678.' });
    }

    const user = db.prepare(`SELECT id, name FROM users WHERE phone = ? AND role != 'admin'`).get(phone);
    if (user) {
        const open = db
            .prepare(`SELECT id FROM password_resets WHERE user_id = ? AND status IN ('requested', 'code_issued')`)
            .get(user.id);
        if (!open) {
            db.prepare(`INSERT INTO password_resets (user_id) VALUES (?)`).run(user.id);
            notifyAdmins('password_reset_requested', `${user.name} asked for a password reset.`, '/admin?section=resets');
        }
    }

    res.json({ ok: true });
});

// Set a new password with the code an admin gave you. Every login on every device is ended
// afterwards, so anyone who knew the old password is logged out.
authRouter.post('/reset-password', resetCodeLimitByPhone, (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const code = typeof req.body.code === 'string' ? req.body.code : '';
    const passwordError = checkNewPassword(req.body.password);
    if (!phone || !code.trim()) {
        return res.status(400).json({ error: 'Enter your phone number and the reset code.' });
    }
    if (passwordError) {
        return res.status(400).json({ error: passwordError });
    }

    const wrong = () => res.status(400).json({ error: "That code isn't right, or it has expired. Ask for a new one if you need to." });

    const user = db.prepare(`SELECT id FROM users WHERE phone = ? AND role != 'admin'`).get(phone);
    if (!user) return wrong();

    const reset = db
        .prepare(`SELECT * FROM password_resets WHERE user_id = ? AND status = 'code_issued' ORDER BY id DESC LIMIT 1`)
        .get(user.id);
    if (!reset || new Date(reset.expires_at) < new Date()) return wrong();

    const given = Buffer.from(hashResetCode(code), 'hex');
    const stored = Buffer.from(reset.code_hash, 'hex');
    if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
        const attempts = reset.failed_attempts + 1;
        db.prepare(
            `UPDATE password_resets SET failed_attempts = ?, status = CASE WHEN ? >= ? THEN 'cancelled' ELSE status END WHERE id = ?`
        ).run(attempts, attempts, MAX_RESET_ATTEMPTS, reset.id);
        return wrong();
    }

    const passwordHash = bycrypt.hashSync(req.body.password, BYCRYPT_ROUNDS);
    const applyReset = db.transaction(() => {
        db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, user.id);
        db.prepare(`UPDATE password_resets SET status = 'used', used_at = datetime('now') WHERE id = ?`).run(reset.id);
        db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
    });
    applyReset();
    createNotification(user.id, 'password_changed', 'Your password was reset. If this wasn\'t you, contact a KREW admin straight away.');

    res.json({ ok: true });
});

// Change your password while logged in. Needs the current password, and logs out every
// other device (this one stays logged in).
authRouter.post('/change-password', requireAuth, (req, res) => {
    const { current_password, new_password } = req.body;
    const passwordError = checkNewPassword(new_password);
    if (typeof current_password !== 'string' || !current_password) {
        return res.status(400).json({ error: 'Enter your current password.' });
    }
    if (passwordError) {
        return res.status(400).json({ error: passwordError });
    }

    const { password_hash } = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.user.id);
    if (!bycrypt.compareSync(current_password, password_hash)) {
        return res.status(400).json({ error: 'Your current password is incorrect.' });
    }

    const newHash = bycrypt.hashSync(new_password, BYCRYPT_ROUNDS);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(newHash, req.user.id);
    db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token != ?`).run(req.user.id, req.cookies[SESSION_COOKIE_NAME]);
    createNotification(req.user.id, 'password_changed', 'Your password was changed.');

    res.json({ ok: true });
});

// The same question for public pages (navigation bar, gig and crew pages), where being logged
// out is normal: always answers 200, with user: null for a visitor. /me's 401 is right for
// pages that need a login, but on public pages the browser logged it as an error every time.
authRouter.get('/session', (req, res) => {
    const { user } = findSessionUser(req, res);
    res.json({ user: user || null });
});