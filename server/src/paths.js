// Where KREW keeps its data on disk. By default: server/krew.db and server/uploads/.
// On a host with a persistent disk (e.g. a paid Render instance with a disk mounted at
// /var/data), point both at the disk with environment variables so data survives restarts
// and redeploys:
//   DATABASE_PATH=/var/data/krew.db
//   UPLOADS_DIR=/var/data/uploads
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DB_PATH = process.env.DATABASE_PATH || path.join(serverRoot, 'krew.db');
export const UPLOAD_ROOT = process.env.UPLOADS_DIR || path.join(serverRoot, 'uploads');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
