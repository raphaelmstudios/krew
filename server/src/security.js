// Security middleware and helpers shared by the whole API (pre-launch hardening pass).
// Kept dependency-free on purpose - everything here is small enough to read in one go, and
// it avoids adding packages (helmet, express-rate-limit, csurf) for a single-server app.

const isProduction = process.env.NODE_ENV === 'production';

// --- Security headers ---------------------------------------------------------------
// Sent on every response (pages, API and uploaded files alike).
// - The Content-Security-Policy only lets the page run scripts from this site, load fonts
//   from Google Fonts and talk to this API, so injected markup can't pull in or send to
//   anywhere else. Inline styles stay allowed because React writes style attributes.
// - nosniff stops a browser treating an uploaded "photo" as a web page or script.
// - frame-ancestors / X-Frame-Options stop KREW being embedded in another site (clickjacking).
// - HSTS (production only, over HTTPS) tells browsers to never use plain HTTP again.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// --- HTTPS ----------------------------------------------------------------------------
// In production the host (Render) terminates HTTPS and forwards the original protocol in
// X-Forwarded-Proto. Anything that arrives over plain HTTP is sent to the HTTPS address.
export function requireHttps(req, res, next) {
  if (isProduction && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
}

// --- CSRF protection --------------------------------------------------------------------
// The session cookie is SameSite=Lax, so other sites can't send it with a form POST. As a
// second layer, any request that changes something must come from KREW's own pages:
// browsers always send an Origin header on cross-site POST/DELETE, and if it isn't this
// site (or an origin listed in ALLOWED_ORIGINS), the request is refused.
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // not sent by a browser making a cross-site request
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return res.status(403).json({ error: 'Request blocked.' });
  }
  const sameHost = originHost === req.headers.host || originHost === req.headers['x-forwarded-host'];
  if (sameHost || extraAllowedOrigins.includes(origin)) return next();
  return res.status(403).json({ error: 'Request blocked.' });
}

// --- Rate limiting ------------------------------------------------------------------------
// A small fixed-window counter kept in memory - fine for KREW's single server process.
// Each limiter counts requests per key (the visitor's IP by default) and answers 429 once
// the limit for the current window is used up. With failuresOnly, only requests that end in
// an error (status 400+) count - so a busy shared connection (a campus Wi-Fi where a whole
// class logs in at once) is never blocked by successful logins, only by repeated wrong ones.
export function rateLimit({ windowMs, max, message, key = (req) => req.ip, failuresOnly = false }) {
  const hits = new Map();
  // Forget old windows now and then so the map doesn't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message || 'Too many requests. Please wait a few minutes and try again.' });
    }
    if (failuresOnly) {
      res.on('finish', () => {
        if (res.statusCode >= 400) entry.count += 1;
      });
    } else {
      entry.count += 1;
    }
    next();
  };
}

// --- Input cleaning ---------------------------------------------------------------------------
// Every string in a JSON body has invisible control characters removed (newlines and tabs
// stay) and is capped at a generous hard limit, so no field can be used to stuff megabytes
// or odd bytes into the database. Each route still applies its own, tighter limits.
const HARD_STRING_LIMIT = 5000;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanValue(value, depth = 0) {
  if (typeof value === 'string') return value.replace(CONTROL_CHARACTERS, '').slice(0, HARD_STRING_LIMIT);
  if (depth > 3) return undefined;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => cleanValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(value)) cleaned[k] = cleanValue(v, depth + 1);
    return cleaned;
  }
  return value;
}

export function cleanBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = cleanValue(req.body);
  next();
}

// Returns the trimmed text, '' when the value is missing, or null when it isn't text at all
// or is longer than max - so a route can tell "left blank" apart from "not acceptable".
export function text(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > max ? null : trimmed;
}

// Field limits used across the routes, in characters.
export const LIMITS = {
  name: 80,
  title: 100,
  location: 100,
  description: 1000,
  disputeReason: 300,
  disputeDetails: 2000,
  resolutionNotes: 1000,
  // The largest single payment KREW will record, in KES - well above any event job, and
  // low enough that a mistyped extra zero or two gets caught.
  maxAmount: 10_000_000,
};

// --- Phone numbers ------------------------------------------------------------------------------
// Kenyan mobile numbers can be typed as 0712345678, 712345678, 254712345678 or +254712345678.
// They're all stored as 0712345678, so the same person can't register twice by typing their
// number differently, and logging in works whichever way they type it.
const PHONE_PATTERN = /^(?:\+?254|0)?([71]\d{8})$/;

export function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const match = value.replace(/[\s-]/g, '').match(PHONE_PATTERN);
  return match ? `0${match[1]}` : null;
}

// --- Errors -------------------------------------------------------------------------------------
// The last stop for anything a route didn't handle: logs the details on the server and
// sends the browser a plain message - never a stack trace, file path or SQL.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That request is too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'That request could not be read.' });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} failed:`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
