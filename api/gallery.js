// /api/gallery — CRUD for gallery items
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlParts = req.url.replace('/api/gallery', '').split('?');
  const id = urlParts[0].replace(/^\//, '') || null;

  // GET /api/gallery
  if (req.method === 'GET') {
    const params = new URLSearchParams(urlParts[1] || '');
    const page = Math.max(1, parseInt(params.get('page') || '1'));
    const limit = Math.min(100, parseInt(params.get('limit') || '20'));
    const album = params.get('album') || '';
    const from = (page - 1) * limit;

    let query = supabase
      .from('gallery')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (album) query = query.eq('album', album);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      data: data || [],
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
      page
    });
  }

  // All write operations require auth
  const admin = requireAuth(req, res);
  if (!admin) return;

  // POST /api/gallery — Add item (URL-based, upload handled by /api/upload)
  if (req.method === 'POST' && !id) {
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

  // DELETE /api/gallery/:id
  if (req.method === 'DELETE' && id) {
    // Get file URL to delete from storage
    const { data: item } = await supabase.from('gallery').select('file_url').eq('id', id).single();

    if (item?.file_url) {
      // Extract storage path and delete from Supabase Storage
      try {
        const url = new URL(item.file_url);
        const pathParts = url.pathname.split('/storage/v1/object/public/');
        if (pathParts[1]) {
          const [bucket, ...filePath] = pathParts[1].split('/');
          await supabase.storage.from(bucket).remove([filePath.join('/')]);
        }
      } catch { /* ignore storage errors */ }
    }

    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
