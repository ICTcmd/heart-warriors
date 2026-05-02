// /api/upload — File upload with auto image compression
const { requireAuth, cors } = require('./_lib/auth');
const supabase = require('./_lib/supabase');
const Jimp = require('jimp');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB input (will be compressed down)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
const BUCKET = 'heart-warriors-media';

// ── Magic number (file signature) validation ───────────────────────────────
// Checks the actual bytes of the file, not just the MIME type header.
// This prevents attackers from uploading executables disguised as images.
const MAGIC_NUMBERS = [
  { mime: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif',  offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP" at offset 8
  { mime: 'video/mp4',  offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp" box
  { mime: 'video/webm', offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] },
  { mime: 'video/ogg',  offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] }, // "OggS"
];

function validateMagicNumber(buffer, declaredMime) {
  const entry = MAGIC_NUMBERS.find(m => m.mime === declaredMime);
  if (!entry) return false; // Unknown type — reject
  if (buffer.length < entry.offset + entry.bytes.length) return false;
  return entry.bytes.every((b, i) => buffer[entry.offset + i] === b);
}

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

    // Validate actual file bytes match the declared MIME type
    // Prevents uploading executables/scripts disguised as images
    if (!validateMagicNumber(filePart.data, filePart.contentType)) {
      return res.status(400).json({ error: 'File content does not match its declared type.' });
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
      // Resize if larger than 1920x1080 (keeps aspect ratio, never upscales)
      // Jimp is pure JS — no native binaries, works on Vercel Hobby
      const image = await Jimp.read(filePart.data);

      // Only downscale, never upscale
      if (image.getWidth() > MAX_WIDTH || image.getHeight() > MAX_HEIGHT) {
        image.scaleToFit(MAX_WIDTH, MAX_HEIGHT);
      }

      // Save as JPEG (Jimp doesn't support WebP encode natively)
      const compressed = await image
        .quality(IMAGE_QUALITY)
        .getBufferAsync(Jimp.MIME_JPEG);

      uploadBuffer = compressed;
      uploadContentType = 'image/jpeg';
      fileExt = 'jpg';
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
