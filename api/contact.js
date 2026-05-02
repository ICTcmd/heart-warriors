// /api/contact — Submit contact messages
const supabase = require('./_lib/supabase');
const { cors, getClientIp } = require('./_lib/auth');

// ── Rate limiter for contact form ──────────────────────────────────────────
// Prevents spam: max 5 submissions per IP per 10 minutes
const contactAttempts = new Map();
const CONTACT_LIMIT  = 5;
const CONTACT_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkContactRateLimit(ip) {
  const now = Date.now();
  const entry = contactAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    contactAttempts.set(ip, { count: 1, resetAt: now + CONTACT_WINDOW });
    return true;
  }
  if (entry.count >= CONTACT_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Strict email regex ─────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit
  const ip = getClientIp(req);
  if (!checkContactRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many messages. Please wait before sending again.' });
  }

  const { name, email, subject, message } = req.body || {};

  // Type checks — reject non-string inputs
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid input.' });
  }

  if (!name.trim() || !email.trim() || !message.trim()) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  // Length limits
  if (name.trim().length > 100)    return res.status(400).json({ error: 'Name is too long (max 100 characters).' });
  if (message.trim().length > 5000) return res.status(400).json({ error: 'Message is too long (max 5000 characters).' });
  if (message.trim().length < 10)   return res.status(400).json({ error: 'Message is too short.' });

  const { error } = await supabase.from('contact_messages').insert({
    name:    name.trim().slice(0, 100),
    email:   email.trim().toLowerCase().slice(0, 254),
    subject: (typeof subject === 'string' ? subject.trim() : '').slice(0, 255) || 'General Inquiry',
    message: message.trim().slice(0, 5000)
  });

  // Generic error — don't leak DB details
  if (error) return res.status(500).json({ error: 'Failed to save message. Please try again.' });

  return res.status(201).json({ message: 'Message sent successfully!' });
};
