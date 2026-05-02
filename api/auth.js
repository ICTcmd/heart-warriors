// /api/auth — handles /api/auth?action=login and /api/auth?action=change-password
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('./_lib/supabase');
const { cors, JWT_SECRET, checkLoginRateLimit, resetLoginRateLimit, getClientIp } = require('./_lib/auth');

// Dummy hash used when user is not found — prevents timing attacks that
// would let an attacker enumerate valid email addresses by measuring response time
const DUMMY_HASH = '$2a$12$dummyhashusedtopreventimenumerationattacksonloginendpoint';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query?.action || req.body?.action || '';

  // ── LOGIN ──────────────────────────────────────────────────
  if (action === 'login') {
    // Rate limit by IP — blocks brute-force attacks
    const ip = getClientIp(req);
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfter));
      return res.status(429).json({
        error: `Too many login attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 60)} minute(s).`
      });
    }

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    // Basic input sanity — prevent absurdly large payloads
    if (typeof email !== 'string' || email.length > 254) return res.status(400).json({ error: 'Invalid email.' });
    if (typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Invalid password.' });

    const { data: admin, error } = await supabase
      .from('admins').select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true).single();

    // Always run bcrypt — even if user not found — to prevent timing-based
    // email enumeration. DUMMY_HASH will never match so login still fails.
    const hashToCheck = admin?.password_hash || DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (error || !admin || !valid) {
      // Generic message — never reveal whether email exists
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Successful login — clear rate limit for this IP
    resetLoginRateLimit(ip);

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: '8h' }  // Reduced from 7d — shorter window limits damage if token is stolen
    );
    return res.status(200).json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, avatar_url: admin.avatar_url }
    });
  }

  // ── CHANGE PASSWORD ────────────────────────────────────────
  if (action === 'change-password') {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

    let decoded;
    try { decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords are required.' });
    if (typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    if (new_password.length > 128) return res.status(400).json({ error: 'Password too long.' });
    if (new_password === current_password) return res.status(400).json({ error: 'New password must be different.' });

    const { data: admin, error: fetchError } = await supabase
      .from('admins').select('id, password_hash').eq('id', decoded.id).single();
    if (fetchError || !admin) return res.status(404).json({ error: 'Admin account not found.' });

    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 12);
    const { error: updateError } = await supabase.from('admins')
      .update({ password_hash: hash, updated_at: new Date() }).eq('id', decoded.id);
    if (updateError) return res.status(500).json({ error: 'Failed to update password.' });

    return res.status(200).json({ message: 'Password updated successfully.' });
  }

  return res.status(400).json({ error: 'Missing action. Use ?action=login or ?action=change-password' });
};
