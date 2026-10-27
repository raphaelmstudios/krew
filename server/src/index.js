import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate } from './db.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

migrate();

// Health check endpoint that confirms the server is functioning and the database is well connected.
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', db: row.ok === 1 ? 'connected' : 'error' });
});

// Routes land here as each build task lands:
//   Task d1-4 -> POST /api/auth/register
//   Task d1-5 -> POST /api/users/:id/documents
//   Task d1-7 -> POST /api/auth/login
//   Task d2-1 -> POST /api/jobs
//   Task d2-2 -> POST /api/jobs/:id/confirm
//   ...and so on, one route group per checklist task.
//Each route is defined in its own file within the folder server/src/routes. The individual route files are imported and used in this file.
app.use('/api/auth', authRouter);
app.use('/api/users', documentsRouter);

const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// This route is a catch-all route that serves the index.html file for any request that doesn't match an existing API route or static file.
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KREW API listening on http://localhost:${PORT}`);
});