import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface PDFResult {
  filename: string;
  metadata: Record<string, string>;
  pages: number;
  objects: number;
  javascript: boolean;
  embeddedFiles: string[];
  urls: string[];
  anomalies: string[];
  suspiciousFeatures: Array<{ feature: string; severity: 'critical' | 'high' | 'medium' | 'low' }>;
}

function extractBetween(text: string, start: string, end: string): string | null {
  const si = text.indexOf(start);
  if (si === -1) return null;
  const ei = text.indexOf(end, si + start.length);
  if (ei === -1) return null;
  return text.substring(si + start.length, ei).trim();
}

function parseDate(pdfDate: string): string {
  // PDF date format: D:YYYYMMDDHHmmSSOHH'mm
  if (!pdfDate) return pdfDate;
  const m = pdfDate.replace(/^D:/, '').match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return pdfDate;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function analyzePDF(buffer: Buffer, filename: string): PDFResult {
  const start = performance.now();
  logToolActivity('PDF Forensics', `Analyzing ${filename}`, 'info');

  const text = buffer.toString('latin1');

  // Check magic bytes
  if (!text.startsWith('%PDF')) {
    throw new Error('Not a valid PDF file');
  }

  const suspiciousFeatures: PDFResult['suspiciousFeatures'] = [];
  const anomalies: string[] = [];

  // Dangerous keywords
  const DANGEROUS_KEYWORDS: Array<{ keyword: string; severity: 'critical' | 'high' | 'medium' | 'low'; label: string }> = [
    { keyword: '/JavaScript', severity: 'critical', label: 'JavaScript embedded' },
    { keyword: '/JS', severity: 'critical', label: 'JavaScript (short form)' },
    { keyword: '/Launch', severity: 'critical', label: 'Launch action (can execute programs)' },
    { keyword: '/EmbeddedFile', severity: 'high', label: 'Embedded file attachment' },
    { keyword: '/OpenAction', severity: 'high', label: 'OpenAction (auto-execute on open)' },
    { keyword: '/AA', severity: 'high', label: 'Additional Actions trigger' },
    { keyword: '/RichMedia', severity: 'medium', label: 'Rich media (Flash/video)' },
    { keyword: '/XFA', severity: 'medium', label: 'XFA forms (complex form processing)' },
    { keyword: '/ObjStm', severity: 'low', label: 'Object stream (obfuscation technique)' },
  ];

  let hasJavaScript = false;
  const embeddedFiles: string[] = [];

  for (const { keyword, severity, label } of DANGEROUS_KEYWORDS) {
    if (text.includes(keyword)) {
      suspiciousFeatures.push({ feature: label, severity });
      if (keyword === '/JavaScript' || keyword === '/JS') hasJavaScript = true;
      if (keyword === '/EmbeddedFile') {
        const ctx = text.substring(text.indexOf(keyword), text.indexOf(keyword) + 200);
        const nameMatch = ctx.match(/\/F\s*\(([^)]+)\)/);
        if (nameMatch) embeddedFiles.push(nameMatch[1]);
        else embeddedFiles.push('(unknown embedded file)');
      }
    }
  }

  // Extract metadata from << >> sections
  const metadata: Record<string, string> = {};
  const infoSection = extractBetween(text, '<<', '>>');

  const metaFields: Array<[string, string]> = [
    ['/Title', 'Title'],
    ['/Author', 'Author'],
    ['/Subject', 'Subject'],
    ['/Creator', 'Creator'],
    ['/Producer', 'Producer'],
    ['/CreationDate', 'Created'],
    ['/ModDate', 'Modified'],
    ['/Keywords', 'Keywords'],
  ];

  for (const [key, label] of metaFields) {
    // Try to find in full text
    const idx = text.indexOf(key);
    if (idx !== -1) {
      const after = text.substring(idx + key.length, idx + key.length + 200);
      // Match (value) or <hexvalue>
      const parenMatch = after.match(/^\s*\(([^)]+)\)/);
      const hexMatch = after.match(/^\s*<([0-9a-fA-F]+)>/);
      if (parenMatch) {
        let val = parenMatch[1];
        if (label === 'Created' || label === 'Modified') val = parseDate(val);
        metadata[label] = val;
      } else if (hexMatch) {
        try {
          const decoded = Buffer.from(hexMatch[1], 'hex').toString('utf8');
          metadata[label] = label === 'Created' || label === 'Modified' ? parseDate(decoded) : decoded;
        } catch {}
      }
    }
  }

  // Count pages (simplified: count /Page occurrences)
  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  // Count objects
  const objectCount = (text.match(/\d+ \d+ obj/g) ?? []).length;

  // Extract URIs
  const urls: string[] = [];
  const uriRegex = /\/URI\s*\(([^)]+)\)/g;
  let uriMatch: RegExpExecArray | null;
  while ((uriMatch = uriRegex.exec(text)) !== null) {
    if (!urls.includes(uriMatch[1])) urls.push(uriMatch[1]);
  }

  if (hasJavaScript) {
    anomalies.push('JavaScript code detected — potential for drive-by download or exploit');
  }

  logToolActivity('PDF Forensics', `Analysis complete — ${suspiciousFeatures.length} suspicious features`, 'success');

  return {
    filename,
    metadata,
    pages: Math.max(pageCount, 1),
    objects: objectCount,
    javascript: hasJavaScript,
    embeddedFiles,
    urls,
    anomalies,
    suspiciousFeatures,
  };
}
