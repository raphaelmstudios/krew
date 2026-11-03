import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate } from './db.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { adminRouter } from './routes/admin.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

migrate();

// Health check endpoint that confirms the server is functioning and the database is well connected.
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', db: row.ok === 1 ? 'connected' : 'error' });
});

// Mounts the routers for authentication, user document management, and admin operations.
app.use('/api/auth', authRouter);
app.use('/api/users', documentsRouter);
app.use('/api/admin', adminRouter);

const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// This route is a catch-all route that serves the index.html file for any request that doesn't match an existing API route or static file.
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KREW API listening on http://localhost:${PORT}`);
});