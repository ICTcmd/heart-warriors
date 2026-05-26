// /api/posts — GET list, POST create, PUT /api/posts?id=xxx, DELETE /api/posts?id=xxx
const supabase = require('./_lib/supabase');
const { requireAuth, cors, getClientIp, checkWriteRateLimit, enforceBodySizeLimit, auditLog } = require('./_lib/auth');
const cache = require('./_lib/cache');

// ── Slug helper ────────────────────────────────────────────────────────────
function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
}

// ── Input length limits ────────────────────────────────────────────────────
const MAX_TITLE   = 255;
const MAX_EXCERPT = 500;
const MAX_CONTENT = 200_000; // ~200KB — enough for any article
const MAX_IMAGE_URL = 2048;

// ── Allowed status values ──────────────────────────────────────────────────
const ALLOWED_STATUS = new Set(['draft', 'published', 'archived']);

module.exports = async (req, res) => {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query?.id || null;

  // ── GET single post ────────────────────────────────────────
  if (req.method === 'GET' && id) {
    const { data, error } = await supabase
      .from('posts').select('*, categories(name,slug), admins(name)').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Post not found' });
    await supabase.from('posts').update({ views: (data.views || 0) + 1 }).eq('id', id);
    return res.status(200).json({
      data: { ...data, category_name: data.categories?.name, author_name: data.admins?.name }
    });
  }

  // ── GET list ───────────────────────────────────────────────
  if (req.method === 'GET') {
    const page  = Math.max(1, parseInt(req.query?.page || '1'));
    const limit = Math.min(50, parseInt(req.query?.limit || '9'));
    const category = req.query?.category || '';
    const from  = (page - 1) * limit;

    let isAdmin = false;
    try {
      const ah = req.headers['authorization'];
      if (ah?.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('./_lib/auth');
        jwt.verify(ah.split(' ')[1], JWT_SECRET);
        isAdmin = true;
      }
    } catch { /* public */ }

    const status = isAdmin ? (req.query?.status || '') : 'published';
    const cacheKey = `posts:${status}:${category}:${page}:${limit}`;

    if (!isAdmin) {
      const cached = cache.get(cacheKey);
      if (cached) { cache.setCacheHeaders(res, 60); return res.status(200).json(cached); }
    }

    let query = supabase.from('posts')
      .select('*, categories(name,slug)', { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (status) query = query.eq('status', status);
    if (category) {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single();
      if (cat) query = query.eq('category_id', cat.id);
    }

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch posts.' });

    const result = {
      data: (data || []).map(p => ({ ...p, category_name: p.categories?.name })),
      total: count || 0, pages: Math.ceil((count || 0) / limit), page
    };
    if (!isAdmin) { cache.set(cacheKey, result, 60); cache.setCacheHeaders(res, 60); }
    return res.status(200).json(result);
  }

  // Auth required for all write operations
  const admin = requireAuth(req, res);
  if (!admin) return;

  // Rate limit write operations
  const writeIp = getClientIp(req);
  const writeCheck = checkWriteRateLimit(writeIp);
  if (!writeCheck.allowed) {
    res.setHeader('Retry-After', String(writeCheck.retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  // Body size limit for JSON payloads (1MB)
  if (!enforceBodySizeLimit(req, res)) return;

  // ── POST create ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { title, excerpt, content, category_id, status, is_featured, tags, featured_image } = req.body || {};

    // Type + presence checks
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
    if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Content is required.' });

    // Length limits
    if (title.trim().length > MAX_TITLE) return res.status(400).json({ error: `Title too long (max ${MAX_TITLE} chars).` });
    if (excerpt && typeof excerpt === 'string' && excerpt.trim().length > MAX_EXCERPT) {
      return res.status(400).json({ error: `Excerpt too long (max ${MAX_EXCERPT} chars).` });
    }
    if (content.trim().length > MAX_CONTENT) return res.status(400).json({ error: 'Content too long.' });

    // Validate status
    const safeStatus = ALLOWED_STATUS.has(status) ? status : 'draft';

    // Validate featured_image is a URL string if provided
    if (featured_image && (typeof featured_image !== 'string' || featured_image.length > MAX_IMAGE_URL)) {
      return res.status(400).json({ error: 'Invalid featured image URL.' });
    }

    // Validate tags is an array of strings
    const safeTags = Array.isArray(tags)
      ? tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 50)).slice(0, 20)
      : [];

    let slug = slugify(title);
    const { data: ex } = await supabase.from('posts').select('id').eq('slug', slug);
    if (ex?.length) slug = `${slug}-${Date.now()}`;

    const { data, error } = await supabase.from('posts').insert({
      title: title.trim().slice(0, MAX_TITLE),
      slug,
      excerpt: excerpt?.trim().slice(0, MAX_EXCERPT) || null,
      content: content.trim().slice(0, MAX_CONTENT),
      featured_image: featured_image || null,
      category_id: category_id || null,
      author_id: admin.id,
      status: safeStatus,
      is_featured: is_featured === true,
      tags: safeTags,
      published_at: safeStatus === 'published' ? new Date() : null
    }).select().single();

    if (error) return res.status(500).json({ error: 'Failed to create post.' });
    cache.del('posts:');
    auditLog(supabase, admin.id, 'post.create', { title: data.title, id: data.id });
    return res.status(201).json({ data });
  }

  // ── PUT update ─────────────────────────────────────────────
  if (req.method === 'PUT' && id) {
    const { title, excerpt, content, category_id, status, is_featured, tags, featured_image } = req.body || {};
    const updates = { updated_at: new Date() };

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title cannot be empty.' });
      if (title.trim().length > MAX_TITLE) return res.status(400).json({ error: `Title too long (max ${MAX_TITLE} chars).` });
      updates.title = title.trim();
    }
    if (excerpt !== undefined) {
      updates.excerpt = (typeof excerpt === 'string' ? excerpt.trim().slice(0, MAX_EXCERPT) : null) || null;
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Content cannot be empty.' });
      if (content.trim().length > MAX_CONTENT) return res.status(400).json({ error: 'Content too long.' });
      updates.content = content.trim();
    }
    if (featured_image !== undefined) {
      if (featured_image && (typeof featured_image !== 'string' || featured_image.length > MAX_IMAGE_URL)) {
        return res.status(400).json({ error: 'Invalid featured image URL.' });
      }
      updates.featured_image = featured_image || null;
    }
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (is_featured !== undefined) updates.is_featured = is_featured === true;
    if (tags !== undefined) {
      updates.tags = Array.isArray(tags)
        ? tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 50)).slice(0, 20)
        : [];
    }
    if (status !== undefined) {
      updates.status = ALLOWED_STATUS.has(status) ? status : 'draft';
      if (updates.status === 'published') updates.published_at = new Date();
    }

    const { data, error } = await supabase.from('posts').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: 'Failed to update post.' });
    cache.del('posts:');
    auditLog(supabase, admin.id, 'post.update', { id });
    return res.status(200).json({ data });
  }

  // ── DELETE ─────────────────────────────────────────────────
  if (req.method === 'DELETE' && id) {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete post.' });
    cache.del('posts:');
    auditLog(supabase, admin.id, 'post.delete', { id });
    return res.status(200).json({ message: 'Post deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
