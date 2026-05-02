// /api/posts/[id] — GET single, PUT, DELETE
const supabase = require('../_lib/supabase');
const { requireAuth, cors } = require('../_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing post ID' });

  // GET single post (public)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('posts')
      .select('*, categories(name, slug), admins(name)')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Post not found' });

    // Increment views
    await supabase.from('posts').update({ views: (data.views || 0) + 1 }).eq('id', id);

    return res.status(200).json({
      data: { ...data, category_name: data.categories?.name, author_name: data.admins?.name }
    });
  }

  // Auth required for write ops
  const admin = requireAuth(req, res);
  if (!admin) return;

  // PUT — update post
  if (req.method === 'PUT') {
    const { title, excerpt, content, category_id, status, is_featured, tags, featured_image } = req.body || {};
    const updates = { updated_at: new Date() };
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

  // DELETE
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Post deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
