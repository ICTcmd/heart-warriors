// /api/stats — Dashboard statistics
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = requireAuth(req, res);
  if (!admin) return;

  const [postsRes, galleryRes, messagesRes, viewsRes] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('gallery').select('id', { count: 'exact', head: true }),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
    supabase.from('posts').select('views')
  ]);

  const totalViews = (viewsRes.data || []).reduce((sum, p) => sum + (p.views || 0), 0);

  return res.status(200).json({
    posts: postsRes.count || 0,
    gallery: galleryRes.count || 0,
    messages: messagesRes.count || 0,
    views: totalViews
  });
};
