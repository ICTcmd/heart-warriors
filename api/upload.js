// /api/upload — File upload with auto image compression
const { requireAuth, cors } = require('./_lib/auth');
const supabase = require('./_lib/supabase');
const sharp = require('sharp');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB input (will be compressed down)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
const BUCKET = 'heart-warriors-media';

// Image compression settings — high quality, much smaller file
const IMAGE_QUALITY = 85; // 85% quality — visually identical, ~60-80% smaller
const MAX_WIDTH = 1920;   // Max 1920px wide (Full HD) — enough for any screen
const MAX_HEIGHT = 1080;  // Max 1080px tall

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

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (filePart.data.length > maxSize) {
      const limitMB = Math.round(maxSize / 1024 / 1024);
      return res.status(400).json({ error: `File too large. Max ${limitMB}MB for ${isVideo ? 'videos' : 'images'}.` });
    }
    if (filePart.data.length === 0) return res.status(400).json({ error: 'File is empty' });

    let uploadBuffer = filePart.data;
    let uploadContentType = filePart.contentType;
    let fileExt = 'bin';
    let originalSize = filePart.data.length;
    let compressedSize = filePart.data.length;

    if (isImage) {
      // ── Auto-compress image ──────────────────────────────────────
      // Convert to WebP: smaller file, same quality, supported by all modern browsers
      // Resize if larger than 1920x1080 (keeps aspect ratio, never upscales)
      const compressed = await sharp(filePart.data)
        .resize(MAX_WIDTH, MAX_HEIGHT, {
          fit: 'inside',        // maintain aspect ratio
          withoutEnlargement: true  // never upscale small images
        })
        .webp({ quality: IMAGE_QUALITY })
        .toBuffer();

      uploadBuffer = compressed;
      uploadContentType = 'image/webp';
      fileExt = 'webp';
      compressedSize = compressed.length;
    } else {
      // Video — store as-is, just sanitize extension
      const safeVideoExts = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv' };
      fileExt = safeVideoExts[filePart.contentType] || 'mp4';
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const folder = isVideo ? 'videos' : 'images';
    const storagePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: uploadContentType,
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

    const savings = isImage
      ? `${Math.round((1 - compressedSize / originalSize) * 100)}% smaller`
      : 'stored as-is';

    return res.status(201).json({
      data: galleryItem,
      url: publicUrl,
      compression: {
        original_kb: Math.round(originalSize / 1024),
        compressed_kb: Math.round(compressedSize / 1024),
        savings
      }
    });

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
