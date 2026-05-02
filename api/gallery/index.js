// /api/gallery — GET list, POST add
const supabase = require('../_lib/supabase');
const { requireAuth, cors } = require('../_lib/auth');
const cache = require('../_lib/cache');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — public
  if (req.method === 'GET') {
    const params = req.query || {};
    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(100, parseInt(params.limit || '20'));
    const album = params.album || '';
    const from = (page - 1) * limit;

    const cacheKey = `gallery:${album}:${page}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      cache.setCacheHeaders(res, 120);
      return res.status(200).json(cached);
    }

    let query = supabase
      .from('gallery')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (album) query = query.eq('album', album);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const result = { data: data || [], total: count || 0, pages: Math.ceil((count || 0) / limit), page };
    cache.set(cacheKey, result, 120);
    cache.setCacheHeaders(res, 120);
    return res.status(200).json(result);
  }

  const admin = requireAuth(req, res);
  if (!admin) return;

  if (req.method === 'POST') {
    const { file_url, title, description, file_type, album, is_featured } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url is required.' });

    const { data, error } = await supabase.from('gallery').insert({
      file_url,
      title: title?.trim() || null,
      description: description?.trim() || null,
      file_type: file_type || 'image',
      album: album || null,
      is_featured: is_featured || false,
      uploaded_by: admin.id
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
