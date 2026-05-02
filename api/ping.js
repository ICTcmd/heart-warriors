// /api/ping — Keep Supabase awake + health check
// Call this endpoint periodically (e.g. UptimeRobot every 5 minutes, free)
const supabase = require('./_lib/supabase');
const { cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');

  const start = Date.now();
  try {
    // Lightweight query — just checks DB is alive
    const { error } = await supabase
      .from('site_settings')
      .select('key')
      .eq('key', 'site_name')
      .single();

    const ms = Date.now() - start;
    return res.status(200).json({
      status: error ? 'degraded' : 'ok',
      db: error ? 'error' : 'connected',
      latency_ms: ms,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Ping error:', err);
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
};
