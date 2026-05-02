// Simple in-memory cache for serverless functions
// Resets on cold start but persists across warm invocations
const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data, ttlSeconds = 60) {
  store.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

function del(key) {
  // Delete by exact key or prefix
  for (const k of store.keys()) {
    if (k === key || k.startsWith(key)) store.delete(k);
  }
}

// Set cache headers on response for CDN/browser caching
function setCacheHeaders(res, ttlSeconds = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`);
  res.setHeader('Vary', 'Accept-Encoding');
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

module.exports = { get, set, del, setCacheHeaders, setNoCacheHeaders };
