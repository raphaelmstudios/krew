import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, migrate } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

migrate();

// Health check — confirms the API is up and the database file opened.
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', db: row.ok === 1 ? 'connected' : 'error' });
});

// Routes land here as each build task lands:
//   Task d1-4 -> POST /api/auth/register
//   Task d1-7 -> POST /api/auth/login
//   Task d2-1 -> POST /api/jobs
//   Task d2-2 -> POST /api/jobs/:id/confirm
//   ...and so on, one route group per checklist task.

app.listen(PORT, () => {
  console.log(`KREW API listening on http://localhost:${PORT}`);
});
