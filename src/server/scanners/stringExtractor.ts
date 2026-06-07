import { logToolActivity } from '../utils/activityLogger.js';

export interface ExtractedString {
  value: string;
  offset: number;
  encoding: 'ascii' | 'unicode';
  category: string;
}

export interface StringCategory {
  name: string;
  count: number;
}

export interface StringExtractResult {
  filename: string;
  totalStrings: number;
  strings: ExtractedString[];
  categories: StringCategory[];
}

const URL_RE = /https?:\/\/[^\s"'<>]+/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const PATH_WIN_RE = /[A-Za-z]:\\[^\0\n"']+/g;
const PATH_UNIX_RE = /\/(?:etc|var|home|usr|tmp|proc|sys|dev|opt|root|bin|sbin|lib|mnt|srv)[/\w.-]*/g;
const REGISTRY_RE = /HKEY_(?:LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)[\\A-Za-z0-9_ ]+/g;

function categorize(value: string): string {
  if (URL_RE.test(value)) return 'URL';
  if (EMAIL_RE.test(value)) return 'Email';
  if (IP_RE.test(value)) return 'IP';
  if (REGISTRY_RE.test(value)) return 'Registry';
  if (PATH_WIN_RE.test(value) || PATH_UNIX_RE.test(value)) return 'Path';
  return 'Other';
}

export function extractStrings(buffer: Buffer, minLength: number = 4): Omit<StringExtractResult, 'filename'> {
  const strings: ExtractedString[] = [];
  const bytes = new Uint8Array(buffer);

  // ASCII extraction
  let start = -1;
  for (let i = 0; i <= bytes.length; i++) {
    const b = i < bytes.length ? bytes[i] : 0;
    const printable = b >= 0x20 && b <= 0x7e;
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= minLength) {
        const value = Array.from(bytes.slice(start, i))
          .map((c) => String.fromCharCode(c))
          .join('');
        strings.push({ value, offset: start, encoding: 'ascii', category: categorize(value) });
      }
      start = -1;
    }
  }

  // UTF-16LE extraction (every other byte is 0x00)
  start = -1;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const lo = bytes[i];
    const hi = bytes[i + 1];
    const printable = hi === 0 && lo >= 0x20 && lo <= 0x7e;
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && (i - start) / 2 >= minLength) {
        const chars: string[] = [];
        for (let j = start; j < i; j += 2) chars.push(String.fromCharCode(bytes[j] | (bytes[j + 1] << 8)));
        const value = chars.join('');
        strings.push({ value, offset: start, encoding: 'unicode', category: categorize(value) });
      }
      start = -1;
    }
  }

  // Sort by offset
  strings.sort((a, b) => a.offset - b.offset);

  // Build category counts
  const catCounts: Record<string, number> = {};
  for (const s of strings) {
    catCounts[s.category] = (catCounts[s.category] || 0) + 1;
  }
  const categories: StringCategory[] = Object.entries(catCounts)
    .filter(([name]) => name !== 'Other')
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { totalStrings: strings.length, strings, categories };
}

export function extractStringsFromBuffer(buffer: Buffer, filename: string, minLength: number = 4): StringExtractResult {
  logToolActivity('String Extractor', `Extracting strings from ${filename}`, 'info');
  const result = extractStrings(buffer, minLength);
  logToolActivity('String Extractor', `Found ${result.totalStrings} strings in ${filename}`, 'success');
  return { filename, ...result };
}
