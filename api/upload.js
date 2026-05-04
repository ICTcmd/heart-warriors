// /api/upload — File upload (direct, no Jimp compression to avoid Vercel timeout)
const { requireAuth, cors } = require('./_lib/auth');
const supabase = require('./_lib/supabase');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const BUCKET = 'heart-warriors-media';

const MAGIC_NUMBERS = [
  { mime: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif',  offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  { mime: 'video/mp4',  offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { mime: 'video/webm', offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] },
  { mime: 'video/ogg',  offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] },
];

function validateMagicNumber(buffer, declaredMime) {
  const entry = MAGIC_NUMBERS.find(m => m.mime === declaredMime);
  if (!entry) return false;
  if (buffer.length < entry.offset + entry.bytes.length) return false;
  return entry.bytes.every((b, i) => buffer[entry.offset + i] === b);
}

const handler = async (req, res) => {
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

    const parts = parseMultipart(buffer, boundaryMatch[1].trim());
    const filePart  = parts.find(p => p.name === 'file');
    const titlePart = parts.find(p => p.name === 'title');
    const albumPart = parts.find(p => p.name === 'album');

    if (!filePart?.filename) return res.status(400).json({ error: 'No file provided' });

    const isImage = ALLOWED_IMAGE_TYPES.includes(filePart.contentType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(filePart.contentType);

    if (!isImage && !isVideo) {
      return res.status(400).json({ error: `File type not allowed: ${filePart.contentType}` });
    }

    if (!validateMagicNumber(filePart.data, filePart.contentType)) {
      return res.status(400).json({ error: 'File content does not match its declared type.' });
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (filePart.data.length > maxSize) {
      return res.status(400).json({ error: `File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB.` });
    }
    if (filePart.data.length === 0) return res.status(400).json({ error: 'File is empty' });

    const safeExts = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv'
    };
    const fileExt = safeExts[filePart.contentType] || 'bin';
    const folder = isVideo ? 'videos' : 'images';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const storagePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, filePart.data, {
        contentType: filePart.contentType,
        upsert: false
      });

    if (uploadError) return res.status(500).json({ error: 'Storage error: ' + uploadError.message });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const title = titlePart?.data?.toString('utf8').trim().slice(0, 255) || null;
    const album = albumPart?.data?.toString('utf8').trim().slice(0, 100) || null;

    const { data: galleryItem, error: dbError } = await supabase.from('gallery').insert({
      file_url: publicUrl,
      title: title || null,
      file_type: isVideo ? 'video' : 'image',
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

handler.config = { api: { bodyParser: false } };
module.exports = handler;

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let pos = 0;

  while (pos < buffer.length) {
    const bIdx = buffer.indexOf(boundaryBuf, pos);
    if (bIdx === -1) break;
    const afterBoundary = bIdx + boundaryBuf.length;
    if (buffer[afterBoundary] === 45 && buffer[afterBoundary + 1] === 45) break;
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
