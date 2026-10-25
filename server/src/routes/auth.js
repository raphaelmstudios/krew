// This is the Sign-up and login routes. Right now  we only have registration, but we will add login and password reset later. 
import express from 'express';
import bycrypt from 'bcrypt';
import { db } from '../db.js';

export const authRouter = express.Router();

// The number of rounds to use for bcrypt hashing. Higher numbers are more secure but take longer to compute. 10 is a reasonable default.
const BYCRYPT_ROUNDS = 10;

// A regex pattern to validate Kenyan phone numbers. It matches numbers that start with +254 or 0, followed by 7 or 1, and then 8 more digits.
const PHONE_PATTERN = /^(?:\+?254|0)(7|1)\d{8}$/;

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