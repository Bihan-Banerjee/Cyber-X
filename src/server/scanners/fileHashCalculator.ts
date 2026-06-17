import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface FileHashResult {
  filename: string;
  size: number;
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
  mimeType: string;
  extension: string;
  scanDuration: number;
}

// Magic byte signatures for common file types
const MAGIC_BYTES: Array<{ bytes: number[]; mime: string; ext: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', ext: 'pdf' },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png', ext: 'png' },
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg', ext: 'jpg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif', ext: 'gif' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: 'application/zip', ext: 'zip' },
  { bytes: [0x4d, 0x5a], mime: 'application/x-msdownload', ext: 'exe' },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], mime: 'application/x-elf', ext: 'elf' },
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], mime: 'application/x-rar-compressed', ext: 'rar' },
  { bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], mime: 'application/x-7z-compressed', ext: '7z' },
  { bytes: [0x1f, 0x8b], mime: 'application/gzip', ext: 'gz' },
  { bytes: [0x42, 0x5a, 0x68], mime: 'application/x-bzip2', ext: 'bz2' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], mime: 'application/java-vm', ext: 'class' },
  { bytes: [0x25, 0x21, 0x50, 0x53], mime: 'application/postscript', ext: 'ps' },
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: 'audio/ogg', ext: 'ogg' },
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg', ext: 'mp3' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav', ext: 'wav' },
  { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mime: 'video/mp4', ext: 'mp4' },
  { bytes: [0x66, 0x4c, 0x61, 0x43], mime: 'audio/flac', ext: 'flac' },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], mime: 'application/msword', ext: 'doc' },
  { bytes: [0xef, 0xbb, 0xbf], mime: 'text/plain', ext: 'txt' },
];

function detectMimeFromBuffer(buffer: Buffer): { mime: string; ext: string } {
  for (const sig of MAGIC_BYTES) {
    const match = sig.bytes.every((b, i) => buffer[i] === b);
    if (match) return { mime: sig.mime, ext: sig.ext };
  }

  // Check if it looks like text
  const sample = buffer.slice(0, 512);
  const isText = [...sample].every((b) => (b >= 0x09 && b <= 0x0d) || (b >= 0x20 && b <= 0x7e) || b >= 0x80);
  if (isText) return { mime: 'text/plain', ext: 'txt' };

  return { mime: 'application/octet-stream', ext: 'bin' };
}

export async function calculateFileHashes(
  buffer: Buffer,
  filename: string
): Promise<FileHashResult> {
  const start = performance.now();
  logToolActivity('File Hash Calculator', `Hashing file: ${filename} (${buffer.length} bytes)`, 'info');

  const md5 = createHash('md5').update(buffer).digest('hex');
  const sha1 = createHash('sha1').update(buffer).digest('hex');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const sha512 = createHash('sha512').update(buffer).digest('hex');

  const { mime: mimeType, ext } = detectMimeFromBuffer(buffer);

  // Try file-type package for better detection
  let detectedMime = mimeType;
  let detectedExt = ext;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – file-type is optional; graceful fallback in catch block
    const { fileTypeFromBuffer } = await import('file-type');
    const fileType = await fileTypeFromBuffer(buffer);
    if (fileType) {
      detectedMime = fileType.mime;
      detectedExt = fileType.ext;
    }
  } catch {
    // file-type package not available, use magic bytes fallback
  }

  // Extension from filename
  const filenameExt = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || '' : '';

  logToolActivity('File Hash Calculator', `Hashes computed for ${filename}`, 'success');

  return {
    filename,
    size: buffer.length,
    md5,
    sha1,
    sha256,
    sha512,
    mimeType: detectedMime,
    extension: detectedExt || filenameExt,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
