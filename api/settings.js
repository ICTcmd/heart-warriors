// /api/settings — GET and PUT site settings
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — public (used by frontend to read settings)
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    // Convert to key-value object
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return res.status(200).json({ data: settings });
  }

  // PUT — admin only
  const admin = requireAuth(req, res);
  if (!admin) return;

  if (req.method === 'PUT') {
    const settings = req.body || {};
    const updates = Object.entries(settings).map(([key, value]) => ({
      key, value: String(value), updated_at: new Date()
    }));

    for (const update of updates) {
      await supabase.from('site_settings')
        .upsert(update, { onConflict: 'key' });
    }

    return res.status(200).json({ message: 'Settings saved.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
