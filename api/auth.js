// /api/auth — Login, logout, change password
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('./_lib/supabase');
const { cors, JWT_SECRET } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel rewrites strip the sub-path, use x-matched-path or parse from original url
  const originalUrl = req.headers['x-vercel-deployment-url']
    ? req.url
    : (req.headers['x-matched-path'] || req.url);
  const path = (req.url || '').split('?')[0].replace(/^\/api\/auth/, '') || '/';

  // POST /api/auth/login
  if (req.method === 'POST' && path === '/login') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar_url: admin.avatar_url
      }
    });
  }

  // POST /api/auth/change-password
  if (req.method === 'POST' && path === '/change-password') {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both passwords are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const { data: admin } = await supabase
      .from('admins').select('*').eq('id', decoded.id).single();

    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 12);
    await supabase.from('admins').update({ password_hash: hash, updated_at: new Date() }).eq('id', decoded.id);

    return res.status(200).json({ message: 'Password updated successfully.' });
  }

  return res.status(404).json({ error: 'Not found' });
};
