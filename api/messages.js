// /api/messages — GET contact messages (admin only)
const supabase = require('./_lib/supabase');
const { requireAuth, cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAuth(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const params = req.query || {};
    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(50, parseInt(params.limit || '20'));
    const from = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from('contact_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) return res.status(500).json({ error: 'Failed to fetch messages.' });
    return res.status(200).json({ data: data || [], total: count || 0 });
  }

  // Mark as read
  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing ID' });
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
    return res.status(200).json({ message: 'Marked as read.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
