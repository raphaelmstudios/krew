// The server's real starting point (npm start). Before anything opens the database, it puts
// back the latest off-site backup when the disk is empty (restore.js) - on hosts like Render's
// free plan, every restart and redeploy starts from an empty disk. Then it starts KREW as usual.
import { restoreIfNeeded } from './restore.js';

const result = await restoreIfNeeded();
if (result === 'failed') {
  // Stopping lets the host restart the server, which tries the restore again, rather than
  // running with an empty database while the real data sits in the backup.
  process.exit(1);
}

await import('./index.js');
