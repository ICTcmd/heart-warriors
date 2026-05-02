// Temporary debug endpoint - REMOVE AFTER FIXING
const supabase = require('./_lib/supabase');
const { cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Test 1: Check env vars are set (don't expose values)
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      JWT_SECRET: !!process.env.JWT_SECRET,
      url_value: process.env.SUPABASE_URL || 'NOT SET'
    };

    // Test 2: Try to query admins table
    const { data, error, count } = await supabase
      .from('admins')
      .select('id, email, is_active', { count: 'exact' });

    return res.status(200).json({
      env: envCheck,
      admins_query: {
        success: !error,
        error: error?.message || null,
        count: count,
        rows: data?.length || 0,
        emails: data?.map(a => a.email) || []
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
