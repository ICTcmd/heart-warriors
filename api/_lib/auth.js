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

module.exports = { verifyToken, requireAuth, cors, JWT_SECRET, checkLoginRateLimit, resetLoginRateLimit, getClientIp };
