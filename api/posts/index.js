// /api/posts — GET list, POST create
const supabase = require('../_lib/supabase');
const { requireAuth, cors } = require('../_lib/auth');
const cache = require('../_lib/cache');

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — list posts (public sees only published; admin sees all)
  if (req.method === 'GET') {
    const params = req.query || {};
    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(50, parseInt(params.limit || '9'));
    const category = params.category || '';
    const from = (page - 1) * limit;

    // Check if request is from admin (has valid token)
    let isAdmin = false;
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../_lib/auth');
        jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        isAdmin = true;
      }
    } catch { /* not authenticated */ }

    const statusParam = params.status || '';
    const status = isAdmin ? statusParam : 'published';

    // Check cache for public requests
    const cacheKey = `posts:${status}:${category}:${page}:${limit}`;
    if (!isAdmin) {
      const cached = cache.get(cacheKey);
      if (cached) {
        cache.setCacheHeaders(res, 60);
        return res.status(200).json(cached);
      }
    }

    let query = supabase
      .from('posts')
      .select('*, categories(name, slug)', { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (status) query = query.eq('status', status);
    if (category) {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single();
      if (cat) query = query.eq('category_id', cat.id);
    }

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const result = {
      data: (data || []).map(p => ({ ...p, category_name: p.categories?.name })),
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
      page
    };

    // Cache public published posts for 60 seconds
    if (!isAdmin && status === 'published') {
      cache.set(cacheKey, result, 60);
      cache.setCacheHeaders(res, 60);
    }

    return res.status(200).json(result);
  }

  // POST — create post (auth required)
  const admin = requireAuth(req, res);
  if (!admin) return;

  if (req.method === 'POST') {
    const { title, excerpt, content, category_id, status, is_featured, tags, featured_image } = req.body || {};
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    let slug = slugify(title);
    const { data: existing } = await supabase.from('posts').select('id').eq('slug', slug);
    if (existing?.length) slug = `${slug}-${Date.now()}`;

    const { data, error } = await supabase.from('posts').insert({
      title: title.trim(),
      slug,
      excerpt: excerpt?.trim() || null,
      content: content.trim(),
      featured_image: featured_image || null,
      category_id: category_id || null,
      author_id: admin.id,
      status: status || 'draft',
      is_featured: is_featured || false,
      tags: tags || [],
      published_at: status === 'published' ? new Date() : null
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    cache.del('posts:'); // invalidate all post caches
    return res.status(201).json({ data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
