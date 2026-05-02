// /api/upload — File upload to Supabase Storage
const { requireAuth, cors } = require('./_lib/auth');
const supabase = require('./_lib/supabase');

// Disable body parser so we can handle raw multipart
module.exports.config = {
  api: { bodyParser: false }
};

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/ogg'
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET = 'heart-warriors-media';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = requireAuth(req, res);
  if (!admin) return;

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'Invalid multipart request' });

    const boundary = boundaryMatch[1].trim();
    const parts = parseMultipart(buffer, boundary);

    const filePart = parts.find(p => p.name === 'file');
    const titlePart = parts.find(p => p.name === 'title');
    const albumPart = parts.find(p => p.name === 'album');

    if (!filePart || !filePart.filename) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!ALLOWED_TYPES.includes(filePart.contentType)) {
      return res.status(400).json({ error: `File type not allowed: ${filePart.contentType}` });
    }
    if (filePart.data.length > MAX_SIZE) {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }
    if (filePart.data.length === 0) {
      return res.status(400).json({ error: 'File is empty' });
    }

    const ext = filePart.filename.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const folder = filePart.contentType.startsWith('video/') ? 'videos' : 'images';
    const storagePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, filePart.data, {
        contentType: filePart.contentType,
        upsert: false
      });

    if (uploadError) return res.status(500).json({ error: 'Storage error: ' + uploadError.message });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const title = titlePart?.data?.toString('utf8').trim() || null;
    const album = albumPart?.data?.toString('utf8').trim() || null;

    const { data: galleryItem, error: dbError } = await supabase.from('gallery').insert({
      file_url: publicUrl,
      title: title || null,
      file_type: filePart.contentType.startsWith('video/') ? 'video' : 'image',
      album: album || null,
      uploaded_by: admin.id
    }).select().single();

    if (dbError) return res.status(500).json({ error: 'DB error: ' + dbError.message });

    return res.status(201).json({ data: galleryItem, url: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
};

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let pos = 0;

  while (pos < buffer.length) {
    const bIdx = buffer.indexOf(boundaryBuf, pos);
    if (bIdx === -1) break;

    const afterBoundary = bIdx + boundaryBuf.length;
    // Check for final boundary (--)
    if (buffer[afterBoundary] === 45 && buffer[afterBoundary + 1] === 45) break;
    // Skip \r\n after boundary
    const headerStart = afterBoundary + 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headers = buffer.slice(headerStart, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;
    const nextBoundary = buffer.indexOf(boundaryBuf, dataStart);
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2;

    const nameMatch = headers.match(/name="([^"]+)"/i);
    const filenameMatch = headers.match(/filename="([^"]+)"/i);
    const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1] || '',
        contentType: ctMatch?.[1]?.trim() || 'application/octet-stream',
        data: buffer.slice(dataStart, dataEnd)
      });
    }

    pos = nextBoundary === -1 ? buffer.length : nextBoundary;
  }

  return parts;
}
