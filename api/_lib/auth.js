// JWT auth middleware helper
const jwt = require('jsonwebtoken');

// ── JWT Secret ─────────────────────────────────────────────────────────────
// Must be set in environment. No insecure fallback.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Crash loudly at startup so misconfigured deploys are caught immediately
  throw new Error('FATAL: JWT_SECRET environment variable is not set.');
}

// ── In-memory rate limiter (resets on cold start, good enough for Hobby) ───
// Tracks failed login attempts per IP to block brute-force attacks
const loginAttempts = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT_MAX  = 10;          // max attempts
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    // First attempt or window expired — reset
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

function resetLoginRateLimit(ip) {
  loginAttempts.delete(ip);
}

// ── Token verification ─────────────────────────────────────────────────────
function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new Error('Invalid or expired token');
  }
}

function requireAuth(req, res) {
  try {
    return verifyToken(req);
  } catch (err) {
    res.status(401).json({ error: err.message });
    return null;
  }
}

// ── CORS ───────────────────────────────────────────────────────────────────
// Restrict to known origins only. Never falls back to wildcard in production.
const ALLOWED_ORIGINS = new Set([
  process.env.ALLOWED_ORIGIN,
  'https://heart-warriors.vercel.app',
  'https://wheels-of-love.vercel.app',
  'https://smile-bright-bago.vercel.app',
  'https://lgu-bago-portal.vercel.app',
  'https://asenso-bago.vercel.app',
].filter(Boolean));

function cors(res, req) {
  const origin = req?.headers?.origin || '';
  // Allow known origins; block everything else
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ── Client IP helper ───────────────────────────────────────────────────────
function getClientIp(req) {
  // Vercel sets x-forwarded-for; fall back to socket address
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// ── Write rate limiter ─────────────────────────────────────────────────────
// Prevents authenticated users from spamming write endpoints
// Max 60 write operations per IP per minute
const writeAttempts = new Map();
const WRITE_LIMIT  = 60;
const WRITE_WINDOW = 60 * 1000; // 1 minute

function checkWriteRateLimit(ip) {
  const now = Date.now();
  const entry = writeAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    writeAttempts.set(ip, { count: 1, resetAt: now + WRITE_WINDOW });
    return { allowed: true };
  }
  if (entry.count >= WRITE_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  entry.count++;
  return { allowed: true };
}

// ── Body size limit ────────────────────────────────────────────────────────
// Rejects requests with Content-Length over the specified limit
// Protects against memory exhaustion from huge payloads
// Default: 1MB for JSON endpoints
const DEFAULT_MAX_BODY = 1 * 1024 * 1024; // 1MB

function enforceBodySizeLimit(req, res, maxBytes = DEFAULT_MAX_BODY) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > maxBytes) {
    res.status(413).json({ error: `Request too large. Maximum size is ${Math.round(maxBytes / 1024)}KB.` });
    return false;
  }
  return true;
}

// ── Audit Logger ──────────────────────────────────────────────────────────
// Records admin actions to the audit_log table in Supabase
// Non-blocking — failures are silently ignored so they never break the main operation
async function auditLog(supabase, adminId, action, details = {}) {
  try {
    await supabase.from('audit_log').insert({
      admin_id:   adminId,
      action:     String(action).slice(0, 100),
      details:    JSON.stringify(details).slice(0, 1000),
      created_at: new Date()
    });
  } catch { /* never block main operation */ }
}
// ── HTML sanitizer ─────────────────────────────────────────────────────────
// Strips all HTML tags from a string to prevent stored XSS via settings
function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // remove script blocks
    .replace(/<style[\s\S]*?<\/style>/gi, '')     // remove style blocks
    .replace(/<[^>]+>/g, '')                       // remove all HTML tags
    .replace(/javascript:/gi, '')                  // remove js: protocol
    .replace(/on\w+\s*=/gi, '')                    // remove event handlers
    .trim();
}

module.exports = { verifyToken, requireAuth, cors, JWT_SECRET, checkLoginRateLimit, resetLoginRateLimit, getClientIp, checkWriteRateLimit, enforceBodySizeLimit, stripHtml, auditLog };
