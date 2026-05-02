// /api/posts — CRUD for posts
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

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

  // Extract ID from URL: /api/posts/[id]
  const urlParts = req.url.replace('/api/posts', '').split('?');
  const pathSegment = urlParts[0].replace(/^\//, '');
  const id = pathSegment || null;

  // GET /api/posts or /api/posts/:id
  if (req.method === 'GET') {
    if (id) {
      // Single post
      const { data, error } = await supabase
        .from('posts')
        .select('*, categories(name, slug), admins(name)')
        .eq('id', id)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Post not found' });

      // Increment views
      await supabase.from('posts').update({ views: (data.views || 0) + 1 }).eq('id', id);

      return res.status(200).json({
        data: {
          ...data,
          category_name: data.categories?.name,
          author_name: data.admins?.name
        }
      });
    }

    // List posts
    const params = new URLSearchParams(urlParts[1] || '');
    const page = Math.max(1, parseInt(params.get('page') || '1'));
    const limit = Math.min(50, parseInt(params.get('limit') || '9'));
    const status = params.get('status') || '';
    const category = params.get('category') || '';
    const from = (page - 1) * limit;

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

    return res.status(200).json({
      data: (data || []).map(p => ({ ...p, category_name: p.categories?.name })),
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
      page
    });
  }

  // All write operations require auth
  const admin = requireAuth(req, res);
  if (!admin) return;

  // POST /api/posts
  if (req.method === 'POST' && !id) {
    const { title, excerpt, content, category_id, status, is_featured, tags, featured_image } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });

    let slug = slugify(title);
    // Ensure unique slug
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
    return res.status(201).json({ data });
  }

  // PUT /api/posts/:id
  if (req.method === 'PUT' && id) {
    const { title, excerpt, content, category_id, status, is_featured, tags, featured_image } = req.body || {};

    const updates = {
      updated_at: new Date()
    };
    if (title !== undefined) updates.title = title.trim();
    if (excerpt !== undefined) updates.excerpt = excerpt?.trim() || null;
    if (content !== undefined) updates.content = content.trim();
    if (featured_image !== undefined) updates.featured_image = featured_image || null;
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (is_featured !== undefined) updates.is_featured = is_featured;
    if (tags !== undefined) updates.tags = tags;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'published') updates.published_at = new Date();
    }

    const { data, error } = await supabase.from('posts').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  // DELETE /api/posts/:id
  if (req.method === 'DELETE' && id) {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Post deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
