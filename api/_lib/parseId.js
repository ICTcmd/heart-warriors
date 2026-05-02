// Helper: extract ID from Vercel serverless function URL
// Handles both /api/posts and /api/posts/[id]
function parseId(req, base) {
  const url = req.url || '';
  const withoutQuery = url.split('?')[0];
  const afterBase = withoutQuery.replace(new RegExp(`^/api/${base}`), '');
  const id = afterBase.replace(/^\//, '').trim();
  return id || null;
}

module.exports = parseId;
