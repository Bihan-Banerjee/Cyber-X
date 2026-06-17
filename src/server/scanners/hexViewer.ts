import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface HexLine {
  offset: string;
  hex: string;
  ascii: string;
}

export interface HexViewResult {
  filename: string;
  size: number;
  lines: HexLine[];
  entropy: number;
  mimeType: string;
}

function calcShannon(bytes: Uint8Array): number {
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b]++;
  const len = bytes.length;
  if (len === 0) return 0;
  return -freq.reduce((acc, count) => {
    if (count === 0) return acc;
    const p = count / len;
    return acc + p * Math.log2(p);
  }, 0);
}

function detectMime(bytes: Uint8Array): string {
  if (bytes.length < 4) return 'application/octet-stream';
  const magic = Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join(' ');

  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return 'application/zip';
  if (bytes[0] === 0x4D && bytes[1] === 0x5A) return 'application/x-msdownload';
  if (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) return 'application/x-elf';
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) return 'application/x-rar';

  // Check if text
  let textBytes = 0;
  for (let i = 0; i < Math.min(512, bytes.length); i++) {
    if (bytes[i] >= 0x20 && bytes[i] < 0x7f) textBytes++;
    else if (bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d) textBytes++;
  }
  if (textBytes / Math.min(512, bytes.length) > 0.85) return 'text/plain';

  return 'application/octet-stream';
}

export function hexDump(buffer: Buffer, filename: string): HexViewResult {
  const start = performance.now();

  logToolActivity('Hex Viewer', `Analyzing file: ${filename}`, 'info');

  const sliced = buffer.slice(0, 10240);
  const bytes = new Uint8Array(sliced);
  const lines: HexLine[] = [];

  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, Math.min(i + 16, bytes.length));
    const offset = i.toString(16).padStart(8, '0').toUpperCase();

    const hexParts: string[] = [];
    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        hexParts.push(chunk[j].toString(16).padStart(2, '0').toUpperCase());
      } else {
        hexParts.push('  ');
      }
    }
    const hex = hexParts.join(' ');

    const ascii = Array.from(chunk)
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
      .join('');

    lines.push({ offset, hex, ascii });
  }

  const entropy = calcShannon(bytes);
  const mimeType = detectMime(bytes);

  logToolActivity('Hex Viewer', `Hex dump complete for ${filename}`, 'success');

  return {
    filename,
    size: buffer.length,
    lines,
    entropy,
    mimeType,
  };
}
