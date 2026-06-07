import { logToolActivity } from '../utils/activityLogger.js';

export interface FileTypeResult {
  filename: string;
  detectedType: string;
  mimeType: string;
  extension: string;
  confidence: number;
  magicBytes: string;
  extensionMatches: boolean;
  warning?: string;
}

interface MagicEntry {
  type: string;
  mime: string;
  ext: string;
  offset: number;
  bytes: number[];
}

const MAGIC_TABLE: MagicEntry[] = [
  { type: 'PDF', mime: 'application/pdf', ext: 'pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: 'PNG', mime: 'image/png', ext: 'png', offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { type: 'JPEG', mime: 'image/jpeg', ext: 'jpg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'GIF87a', mime: 'image/gif', ext: 'gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { type: 'GIF89a', mime: 'image/gif', ext: 'gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  { type: 'ZIP', mime: 'application/zip', ext: 'zip', offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] },
  { type: 'ZIP (empty)', mime: 'application/zip', ext: 'zip', offset: 0, bytes: [0x50, 0x4B, 0x05, 0x06] },
  { type: 'PE Executable (EXE/DLL)', mime: 'application/x-msdownload', ext: 'exe', offset: 0, bytes: [0x4D, 0x5A] },
  { type: 'ELF Binary', mime: 'application/x-elf', ext: 'elf', offset: 0, bytes: [0x7F, 0x45, 0x4C, 0x46] },
  { type: 'RAR Archive', mime: 'application/x-rar', ext: 'rar', offset: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] },
  { type: '7-Zip Archive', mime: 'application/x-7z-compressed', ext: '7z', offset: 0, bytes: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] },
  { type: 'Gzip', mime: 'application/gzip', ext: 'gz', offset: 0, bytes: [0x1F, 0x8B] },
  { type: 'BZip2', mime: 'application/x-bzip2', ext: 'bz2', offset: 0, bytes: [0x42, 0x5A, 0x68] },
  { type: 'WebP', mime: 'image/webp', ext: 'webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  { type: 'Mach-O 32-bit', mime: 'application/x-mach-binary', ext: 'macho', offset: 0, bytes: [0xCE, 0xFA, 0xED, 0xFE] },
  { type: 'Mach-O 64-bit', mime: 'application/x-mach-binary', ext: 'macho', offset: 0, bytes: [0xCF, 0xFA, 0xED, 0xFE] },
  { type: 'SQLite Database', mime: 'application/x-sqlite3', ext: 'sqlite', offset: 0, bytes: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65] },
  { type: 'Java Class', mime: 'application/java-vm', ext: 'class', offset: 0, bytes: [0xCA, 0xFE, 0xBA, 0xBE] },
];

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function identifyFileType(buffer: Buffer, filename: string): FileTypeResult {
  logToolActivity('File Type Identifier', `Identifying type for ${filename}`, 'info');

  const bytes = new Uint8Array(buffer);
  const detectedExt = getExtension(filename);

  let bestMatch: MagicEntry | null = null;
  let bestConfidence = 0;

  for (const entry of MAGIC_TABLE) {
    const matchBytes = entry.bytes;
    if (bytes.length < entry.offset + matchBytes.length) continue;

    let match = true;
    for (let i = 0; i < matchBytes.length; i++) {
      if (bytes[entry.offset + i] !== matchBytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      const confidence = 100 - Math.floor(entry.offset / 10); // offset hits reduce confidence slightly
      if (confidence > bestConfidence) {
        bestMatch = entry;
        bestConfidence = confidence;
      }
    }
  }

  // Fallback: check if text
  if (!bestMatch) {
    let textCount = 0;
    const checkLen = Math.min(512, bytes.length);
    for (let i = 0; i < checkLen; i++) {
      if (bytes[i] >= 0x20 && bytes[i] < 0x7f) textCount++;
      else if (bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d) textCount++;
    }
    if (checkLen > 0 && textCount / checkLen > 0.85) {
      const magicBytes = Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      const ext = detectedExt || 'txt';
      const extensionMatches = ['txt', 'csv', 'log', 'json', 'xml', 'html', 'css', 'js', 'ts', 'md'].includes(detectedExt);

      logToolActivity('File Type Identifier', `Identified ${filename} as text`, 'success');
      return {
        filename,
        detectedType: 'Plain Text',
        mimeType: 'text/plain',
        extension: detectedExt,
        confidence: 75,
        magicBytes,
        extensionMatches,
        warning: !extensionMatches && detectedExt ? `File has .${detectedExt} extension but appears to be plain text` : undefined,
      };
    }
  }

  const magicBytes = Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

  if (!bestMatch) {
    logToolActivity('File Type Identifier', `Could not identify type for ${filename}`, 'success');
    return {
      filename,
      detectedType: 'Unknown',
      mimeType: 'application/octet-stream',
      extension: detectedExt,
      confidence: 0,
      magicBytes,
      extensionMatches: false,
      warning: 'Could not identify file type from magic bytes',
    };
  }

  const extensionMatches = !detectedExt || detectedExt === bestMatch.ext ||
    (bestMatch.type === 'JPEG' && ['jpg', 'jpeg'].includes(detectedExt)) ||
    (bestMatch.type.includes('ZIP') && ['zip', 'docx', 'xlsx', 'pptx', 'jar'].includes(detectedExt)) ||
    (bestMatch.type.includes('EXE') && ['exe', 'dll', 'sys', 'scr'].includes(detectedExt));

  const warning = !extensionMatches
    ? `File has .${detectedExt} extension but magic bytes indicate ${bestMatch.type} — possible masquerading`
    : undefined;

  logToolActivity('File Type Identifier', `Identified ${filename} as ${bestMatch.type}`, 'success');

  return {
    filename,
    detectedType: bestMatch.type,
    mimeType: bestMatch.mime,
    extension: detectedExt,
    confidence: bestConfidence,
    magicBytes,
    extensionMatches,
    warning,
  };
}
