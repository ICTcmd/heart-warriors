// /api/upload — File upload to Supabase Storage
const { requireAuth, cors } = require('./_lib/auth');
const supabase = require('./_lib/supabase');

// Vercel requires this config to handle multipart/form-data
export const config = {
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
    // Parse multipart form data using built-in Node.js streams
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Parse boundary from content-type
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'Invalid multipart request' });

    const boundary = boundaryMatch[1];
    const parts = parseMultipart(buffer, boundary);

    const filePart = parts.find(p => p.name === 'file');
    const titlePart = parts.find(p => p.name === 'title');
    const albumPart = parts.find(p => p.name === 'album');

    if (!filePart) return res.status(400).json({ error: 'No file provided' });
    if (!ALLOWED_TYPES.includes(filePart.contentType)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }
    if (filePart.data.length > MAX_SIZE) {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }

    const ext = filePart.filename.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const folder = filePart.contentType.startsWith('video/') ? 'videos' : 'images';
    const storagePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, filePart.data, {
        contentType: filePart.contentType,
        upsert: false
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    // Save to gallery table
    const { data: galleryItem, error: dbError } = await supabase.from('gallery').insert({
      file_url: publicUrl,
      title: titlePart?.data?.toString().trim() || null,
      file_type: filePart.contentType.startsWith('video/') ? 'video' : 'image',
      album: albumPart?.data?.toString().trim() || null,
      uploaded_by: admin.id
    }).select().single();

    if (dbError) return res.status(500).json({ error: dbError.message });

    return res.status(201).json({ data: galleryItem, url: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
};

// Simple multipart parser
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = 0;

  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuf, start);
    if (boundaryIdx === -1) break;

    const headerStart = boundaryIdx + boundaryBuf.length + 2; // skip \r\n
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headers = buffer.slice(headerStart, headerEnd).toString();
    const dataStart = headerEnd + 4;
    const nextBoundary = buffer.indexOf(boundaryBuf, dataStart);
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2; // trim \r\n

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1] || '',
        contentType: ctMatch?.[1]?.trim() || 'text/plain',
        data: buffer.slice(dataStart, dataEnd)
      });
    }

    start = nextBoundary === -1 ? buffer.length : nextBoundary;
  }

  return parts;
}
