// /api/settings — GET and PUT site settings
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

// Whitelist of allowed setting keys to prevent arbitrary DB writes
const ALLOWED_KEYS = [
  'site_name', 'site_tagline', 'facebook_page_url',
  'contact_email', 'contact_phone', 'contact_address', 'maintenance_mode'
];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return res.status(200).json({ data: settings });
  }

  const admin = requireAuth(req, res);
  if (!admin) return;

  if (req.method === 'PUT') {
    const body = req.body || {};
    // Only allow whitelisted keys
    const filtered = Object.entries(body).filter(([k]) => ALLOWED_KEYS.includes(k));
    if (!filtered.length) return res.status(400).json({ error: 'No valid settings provided.' });

    for (const [key, value] of filtered) {
      await supabase.from('site_settings').upsert(
        { key, value: String(value).slice(0, 1000), updated_at: new Date() },
        { onConflict: 'key' }
      );
    }
    return res.status(200).json({ message: 'Settings saved.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
