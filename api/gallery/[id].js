// /api/gallery/[id] — DELETE
const supabase = require('../_lib/supabase');
const { requireAuth, cors } = require('../_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAuth(req, res);
  if (!admin) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing ID' });

  if (req.method === 'DELETE') {
    const { data: item } = await supabase.from('gallery').select('file_url').eq('id', id).single();

    if (item?.file_url) {
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
