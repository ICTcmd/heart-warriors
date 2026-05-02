// /api/settings — GET and PUT site settings
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

// Whitelist of allowed setting keys to prevent arbitrary DB writes
const ALLOWED_KEYS = [
  // Site basics
  'site_name', 'site_tagline', 'facebook_page_url',
  'contact_email', 'contact_phone', 'contact_address', 'maintenance_mode',
  
  // Navigation & Header
  'brand_name', 'brand_tagline',
  'nav_home', 'nav_about', 'nav_news', 'nav_events', 'nav_gallery', 'nav_contact',
  'nav_cta_text',
  'topbar_text1', 'topbar_text2',
  
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
  'mission_text', 'vision_text', 'core_values_text', 'lgu_commitment_text',
  
  // About Page
  'about_page_title', 'about_page_desc',
  'about_intro_p1', 'about_intro_p2', 'about_intro_p3',
  'about_established_year',
  'about_highlight1', 'about_highlight2', 'about_highlight3', 'about_highlight4',
  'service1_title', 'service1_desc', 'service1_icon',
  'service2_title', 'service2_desc', 'service2_icon',
  'service3_title', 'service3_desc', 'service3_icon',
  'service4_title', 'service4_desc', 'service4_icon',
  'service5_title', 'service5_desc', 'service5_icon',
  'service6_title', 'service6_desc', 'service6_icon',
  'lgu_involvement_text',
  
  // Contact Page
  'contact_page_title', 'contact_page_desc',
  'contact_office_hours',
  'contact_form_name_label', 'contact_form_email_label',
  'contact_form_subject_label', 'contact_form_message_label',
  'contact_form_submit_text',
  
  // Events Page
  'events_page_title', 'events_page_desc',
  'events_empty_text',
  
  // Gallery Page
  'gallery_page_title', 'gallery_page_desc',
  
  // News Page
  'news_page_title', 'news_page_desc',
  'news_search_placeholder',
  
  // Footer
  'footer_description',
  'footer_section1_title', 'footer_section2_title', 'footer_section3_title',
  'footer_copyright',
  'social_facebook', 'social_email', 'social_phone'
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
