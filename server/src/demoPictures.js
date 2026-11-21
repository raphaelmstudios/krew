// Brings the demo accounts' pictures up to date on a site that already has its demo data.
//
// The demo data is only seeded into an EMPTY database. On Render the data comes back from the
// latest backup after every restart, so the seed never runs again, and pictures added to
// scripts/demo_pictures.cjs later would never show. This runs at every start (with
// SEED_DEMO_DATA=true, see bootstrap.js) and fixes that:
//
// - an empty profile photo, cover or portfolio gets the picture listed for that account;
// - a picture the demo data put there before (a "demo-..." file) is swapped for the one listed
//   now, if it's different;
// - a picture someone uploaded in the app is never touched.
//
// The changes are picked up by the next backup like any other change.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { UPLOAD_ROOT } from './paths.js';

const require = createRequire(import.meta.url);
const { DEMO_PICTURES } = require('../scripts/demo_pictures.cjs');
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'seed-assets');

const FIELDS = [
  { kind: 'profile', column: 'profile_photo_path', folder: 'profile-photos' },
  { kind: 'cover', column: 'cover_photo_path', folder: 'cover-photos' },
];

// "profile-photos/demo-13-kevin-profile.jpg" -> "kevin-profile.jpg". null for anything that
// isn't a demo picture (a photo uploaded in the app).
function demoAssetName(storedPath) {
  const match = /^demo-[^-]+-(.+)$/.exec(path.basename(storedPath || ''));
  return match ? match[1] : null;
}

let copied = 0;
function copyIn(folder, asset) {
  copied += 1;
  const fileName = `demo-${Date.now().toString(36)}${copied}-${path.basename(asset)}`;
  fs.mkdirSync(path.join(UPLOAD_ROOT, folder), { recursive: true });
  fs.copyFileSync(path.join(ASSETS, asset), path.join(UPLOAD_ROOT, folder, fileName));
  return `${folder}/${fileName}`;
}

function removeFile(storedPath) {
  if (storedPath) fs.rmSync(path.join(UPLOAD_ROOT, storedPath), { force: true });
}

export function syncDemoPictures() {
  let changes = 0;
  const findUser = db.prepare('SELECT id, profile_photo_path, cover_photo_path FROM users WHERE phone = ?');
  const listPortfolio = db.prepare('SELECT id, image_path FROM portfolio_images WHERE user_id = ? ORDER BY id');
  const deletePortfolio = db.prepare('DELETE FROM portfolio_images WHERE id = ?');
  const insertPortfolio = db.prepare(
    "INSERT INTO portfolio_images (user_id, image_path, created_at) VALUES (?, ?, datetime('now', ?))"
  );

  for (const [phone, pictures] of Object.entries(DEMO_PICTURES)) {
    const user = findUser.get(phone);
    if (!user) continue;

    for (const { kind, column, folder } of FIELDS) {
      const asset = pictures[kind];
      if (!asset || !fs.existsSync(path.join(ASSETS, asset))) continue;
      const current = user[column];
      const currentDemo = demoAssetName(current);
      const upToDate = current && (currentDemo === null || currentDemo === path.basename(asset));
      if (upToDate) continue;
      const stored = copyIn(folder, asset);
      db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(stored, user.id);
      if (current) removeFile(current);
      changes += 1;
    }

    const wanted = (pictures.portfolio || []).filter((asset) => fs.existsSync(path.join(ASSETS, asset)));
    if (wanted.length === 0) continue;
    const rows = listPortfolio.all(user.id);
    const allDemo = rows.every((row) => demoAssetName(row.image_path) !== null);
    const sameList =
      rows.length === wanted.length && rows.every((row, index) => demoAssetName(row.image_path) === path.basename(wanted[index]));
    if (!allDemo || sameList) continue; // their own uploads, or already right
    db.transaction(() => {
      for (const row of rows) {
        deletePortfolio.run(row.id);
        removeFile(row.image_path);
      }
      wanted.forEach((asset, index) => {
        insertPortfolio.run(user.id, copyIn('portfolio-photos', asset), `-${(wanted.length - index) * 20} days`);
      });
    })();
    changes += 1;
  }

  if (changes > 0) console.log(`Demo pictures: ${changes} brought up to date on the demo accounts.`);
  return changes;
}
