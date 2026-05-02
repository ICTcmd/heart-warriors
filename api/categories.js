// /api/categories — List categories
const supabase = require('./_lib/supabase');
const { cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: data || [] });
};
