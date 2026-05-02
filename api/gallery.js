// /api/gallery — GET list, POST add, DELETE /api/gallery?id=xxx
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');
const cache = require('./_lib/cache');

const ALLOWED_FILE_TYPES = new Set(['image', 'video']);
const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 255;
const MAX_DESC_LENGTH = 1000;
const MAX_ALBUM_LENGTH = 100;

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query?.id || null;

  // ── GET list (public) ──────────────────────────────────────
  if (req.method === 'GET') {
    const page  = Math.max(1, parseInt(req.query?.page || '1'));
    const limit = Math.min(100, parseInt(req.query?.limit || '20'));
    const album = req.query?.album || '';
    const from  = (page - 1) * limit;

    const cacheKey = `gallery:${album}:${page}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) { cache.setCacheHeaders(res, 120); return res.status(200).json(cached); }

    let query = supabase.from('gallery').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, from + limit - 1);
    if (album) query = query.eq('album', album);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch gallery.' });

    const result = { data: data || [], total: count || 0, pages: Math.ceil((count || 0) / limit), page };
    cache.set(cacheKey, result, 120);
    cache.setCacheHeaders(res, 120);
    return res.status(200).json(result);
  }

  // Auth required for all write ops
  const admin = requireAuth(req, res);
  if (!admin) return;

  // ── POST add item ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { file_url, title, description, file_type, album, is_featured } = req.body || {};

    if (!file_url || typeof file_url !== 'string') return res.status(400).json({ error: 'file_url is required.' });
    if (file_url.length > MAX_URL_LENGTH) return res.status(400).json({ error: 'file_url is too long.' });

    // Validate file_type
    const safeFileType = ALLOWED_FILE_TYPES.has(file_type) ? file_type : 'image';

    // Validate optional string fields
    if (title && typeof title !== 'string') return res.status(400).json({ error: 'Invalid title.' });
    if (description && typeof description !== 'string') return res.status(400).json({ error: 'Invalid description.' });
    if (album && typeof album !== 'string') return res.status(400).json({ error: 'Invalid album.' });

    const { data, error } = await supabase.from('gallery').insert({
      file_url,
      title:       title?.trim().slice(0, MAX_TITLE_LENGTH) || null,
      description: description?.trim().slice(0, MAX_DESC_LENGTH) || null,
      file_type:   safeFileType,
      album:       album?.trim().slice(0, MAX_ALBUM_LENGTH) || null,
      is_featured: is_featured === true,
      uploaded_by: admin.id
    }).select().single();

    if (error) return res.status(500).json({ error: 'Failed to add gallery item.' });
    cache.del('gallery:');
    return res.status(201).json({ data });
  }

  // ── DELETE /api/gallery?id=xxx ─────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });

    const { data: item } = await supabase.from('gallery').select('file_url').eq('id', id).single();
    if (item?.file_url) {
      try {
        const url = new URL(item.file_url);
        const parts = url.pathname.split('/storage/v1/object/public/');
        if (parts[1]) {
          const [bucket, ...fp] = parts[1].split('/');
          await supabase.storage.from(bucket).remove([fp.join('/')]);
        }
      } catch { /* ignore storage cleanup errors — DB record still gets deleted */ }
    }

    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete item.' });
    cache.del('gallery:');
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
