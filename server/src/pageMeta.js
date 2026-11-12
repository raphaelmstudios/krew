// Writes each page's real title, description and share-image tags into the HTML before it's
// sent. Search engines and link previews (WhatsApp, Facebook, X) read this HTML without
// running the app's JavaScript, so without it every page would look like the homepage.
// The titles and descriptions themselves live in client/src/pageMeta.js, shared with the
// browser so the two never drift apart.

import fs from 'node:fs';
import { db } from './db.js';
import { computeCrewRecord } from './routes/users.js';
import {
  PAGE_META,
  NOT_FOUND_META,
  PRIVATE_PATHS,
  gigMeta,
  crewMeta,
} from '../../client/src/pageMeta.js';

// Everything that goes into the HTML is escaped - gig titles and names are typed by users.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Works out the meta for a path, and whether the page exists (unknown paths get a real 404).
function metaFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (PAGE_META[path]) return { meta: PAGE_META[path], found: true };

  const gig = path.match(/^\/gigs\/(\d+)$/);
  if (gig) {
    const listing = db
      .prepare(
        `SELECT l.title, l.location, l.category, l.amount, l.due_date, org.name AS organizer_name
         FROM job_listings l JOIN users org ON org.id = l.organizer_id
         WHERE l.id = ? AND l.status = 'open'`
      )
      .get(Number(gig[1]));
    return listing ? { meta: gigMeta(listing), found: true } : { meta: NOT_FOUND_META, found: false };
  }

  const crew = path.match(/^\/crew\/(\d+)$/);
  if (crew) {
    const profile = db
      .prepare(
        `SELECT id, name, professional_role, years_experience FROM users
         WHERE id = ? AND role = 'crew_member' AND verification_status = 'approved'`
      )
      .get(Number(crew[1]));
    return profile
      ? { meta: crewMeta({ ...profile, ...computeCrewRecord(profile.id) }), found: true }
      : { meta: NOT_FOUND_META, found: false };
  }

  return { meta: NOT_FOUND_META, found: false };
}

function setTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

let cachedTemplate = null;

// Sends index.html with this page's tags filled in. Unknown paths still get the app (it
// shows the 404 page) but with a real 404 status, so search engines don't index them.
export function sendPageWithMeta(indexPath, req, res) {
  if (!cachedTemplate || process.env.NODE_ENV !== 'production') {
    cachedTemplate = fs.readFileSync(indexPath, 'utf8');
  }
  const { meta, found } = metaFor(req.path);
  const origin = `${req.protocol}://${req.get('host')}`;
  const pageUrl = `${origin}${req.path === '/' ? '/' : req.path.replace(/\/+$/, '')}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = `${origin}/brand/og-image.png`;

  let html = cachedTemplate;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = setTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`);
  html = setTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`);
  html = setTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`);
  html = setTag(html, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${image}" />`);
  html = setTag(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`);
  html = setTag(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${description}" />`);
  html = setTag(html, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${image}" />`);

  // The page's own address, for search engines (canonical) and link previews (og:url).
  const addressTags = found
    ? `    <link rel="canonical" href="${escapeHtml(pageUrl)}" />\n    <meta property="og:url" content="${escapeHtml(pageUrl)}" />\n`
    : '';
  html = html.replace('</head>', `${addressTags}  </head>`);

  if (!found || PRIVATE_PATHS.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  }

  res.status(found ? 200 : 404).type('html').send(html);
}
