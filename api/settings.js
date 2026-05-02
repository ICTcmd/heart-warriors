// /api/settings — GET and PUT site settings
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

// Whitelist of allowed setting keys to prevent arbitrary DB writes
const ALLOWED_KEYS = [
  // Site basics
  'site_name', 'site_tagline', 'facebook_page_url',
  'contact_email', 'contact_phone', 'contact_address', 'maintenance_mode',
  // Hero section
  'hero_badge', 'hero_title_line1', 'hero_title_highlight', 'hero_title_line2',
  'hero_description', 'hero_btn1_text', 'hero_btn2_text',
  'hero_card_title', 'hero_card_subtitle',
  'hero_tag1', 'hero_tag2', 'hero_tag3',
  // Stats
  'stat1_value', 'stat1_suffix', 'stat1_label',
  'stat2_value', 'stat2_suffix', 'stat2_label',
  'stat3_value', 'stat3_suffix', 'stat3_label',
  'stat4_value', 'stat4_suffix', 'stat4_label',
  // Mission & Vision
  'mission_text', 'vision_text', 'core_values_text', 'lgu_commitment_text'
];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error) return res.status(500).json({ error: 'Failed to load settings.' });
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return res.status(200).json({ data: settings });
  }

  const admin = requireAuth(req, res);
  if (!admin) return;

  if (req.method === 'PUT') {
    const body = req.body || {};
    const filtered = Object.entries(body).filter(([k]) => ALLOWED_KEYS.includes(k));
    if (!filtered.length) return res.status(400).json({ error: 'No valid settings provided.' });

    for (const [key, value] of filtered) {
      await supabase.from('site_settings').upsert(
        { key, value: String(value).slice(0, 2000), updated_at: new Date() },
        { onConflict: 'key' }
      );
    }
    return res.status(200).json({ message: 'Settings saved.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
