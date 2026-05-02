// /api/auth/change-password
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../_lib/supabase');
const { cors, JWT_SECRET } = require('../_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  await supabase.from('admins')
    .update({ password_hash: hash, updated_at: new Date() })
    .eq('id', decoded.id);

  return res.status(200).json({ message: 'Password updated successfully.' });
};
