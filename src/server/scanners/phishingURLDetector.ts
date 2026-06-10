import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface PhishingIndicator {
  name: string;
  detected: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  detail: string;
}

export interface PhishingResult {
  url: string;
  score: number;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'PHISHING';
  indicators: PhishingIndicator[];
}

const POPULAR_DOMAINS = [
  'google', 'facebook', 'paypal', 'apple', 'amazon', 'microsoft',
  'netflix', 'instagram', 'twitter', 'linkedin', 'dropbox', 'github',
  'bankofamerica', 'chase', 'wellsfargo', 'citibank', 'irs',
];

const SUSPICIOUS_KEYWORDS = /login|verify|secure|account|update|banking|signin|password|credential|confirm|billing/i;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0).map((_, j) => j === 0 ? i : 0));
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Basic homoglyph detection
const HOMOGLYPHS: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'і': 'i',
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's',
};

function normalizeForHomoglyph(s: string): string {
  return s.split('').map((c) => HOMOGLYPHS[c] ?? c).join('');
}

export function checkPhishingURL(url: string): PhishingResult {
  logToolActivity('Phishing Detector', `Checking ${url}`, 'info');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return { url, score: 50, verdict: 'SUSPICIOUS', indicators: [{ name: 'Invalid URL', detected: true, severity: 'high', detail: 'Could not parse URL' }] };
  }

  const hostname = parsedUrl.hostname;
  const pathname = parsedUrl.pathname;
  const indicators: PhishingIndicator[] = [];
  let score = 0;

  // IP in hostname
  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  indicators.push({
    name: 'IP Address as Hostname',
    detected: isIP,
    severity: 'high',
    detail: isIP ? `IP address ${hostname} used instead of domain name` : 'Domain name used',
  });
  if (isIP) score += 30;

  // URL length
  const isLong = url.length > 75;
  indicators.push({
    name: 'Excessive URL Length',
    detected: isLong,
    severity: 'medium',
    detail: `URL length: ${url.length} characters${isLong ? ' (>75)' : ''}`,
  });
  if (isLong) score += 15;

  // @ symbol in URL
  const hasAt = url.includes('@');
  indicators.push({
    name: '@ Symbol in URL',
    detected: hasAt,
    severity: 'high',
    detail: hasAt ? 'URL contains @ which can redirect to attacker domain' : 'No @ symbol',
  });
  if (hasAt) score += 25;

  // Multiple subdomains (>3 dots)
  const dotCount = hostname.split('.').length - 1;
  const manySubdomains = dotCount > 3;
  indicators.push({
    name: 'Excessive Subdomains',
    detected: manySubdomains,
    severity: 'medium',
    detail: `${dotCount} dot(s) in hostname${manySubdomains ? ' — suspicious nesting' : ''}`,
  });
  if (manySubdomains) score += 15;

  // Suspicious keywords in path
  const hasSuspiciousPath = SUSPICIOUS_KEYWORDS.test(pathname);
  indicators.push({
    name: 'Suspicious Keywords in Path',
    detected: hasSuspiciousPath,
    severity: 'medium',
    detail: hasSuspiciousPath ? `Path contains sensitive keywords: ${pathname}` : 'No suspicious keywords in path',
  });
  if (hasSuspiciousPath) score += 15;

  // Typosquatting check
  const domainParts = hostname.split('.');
  const domainName = domainParts.slice(0, -1).join('.').toLowerCase();
  const normalizedDomain = normalizeForHomoglyph(domainName);

  let typosquatMatch: string | null = null;
  let homoglyphMatch: string | null = null;

  for (const popular of POPULAR_DOMAINS) {
    const dist = levenshtein(normalizedDomain, popular);
    if (dist > 0 && dist <= 2 && !normalizedDomain.includes(popular)) {
      typosquatMatch = popular;
      break;
    }
    if (normalizedDomain !== domainName && normalizeForHomoglyph(domainName) === popular) {
      homoglyphMatch = popular;
      break;
    }
  }

  indicators.push({
    name: 'Typosquatting',
    detected: typosquatMatch !== null,
    severity: 'critical',
    detail: typosquatMatch
      ? `Domain "${hostname}" closely resembles "${typosquatMatch}.com" (Levenshtein distance ≤ 2)`
      : 'No typosquatting detected',
  });
  if (typosquatMatch) score += 35;

  indicators.push({
    name: 'Homoglyph Attack',
    detected: homoglyphMatch !== null,
    severity: 'critical',
    detail: homoglyphMatch
      ? `Domain uses visually similar characters to impersonate "${homoglyphMatch}"`
      : 'No homoglyph characters detected',
  });
  if (homoglyphMatch) score += 40;

  // HTTPS check
  const noHTTPS = parsedUrl.protocol !== 'https:';
  indicators.push({
    name: 'No HTTPS',
    detected: noHTTPS,
    severity: 'low',
    detail: noHTTPS ? 'Connection is unencrypted (HTTP)' : 'HTTPS is used',
  });
  if (noHTTPS) score += 10;

  score = Math.min(100, score);
  const verdict: PhishingResult['verdict'] = score >= 70 ? 'PHISHING' : score >= 30 ? 'SUSPICIOUS' : 'SAFE';

  logToolActivity('Phishing Detector', `Score: ${score} — verdict: ${verdict}`, score >= 70 ? 'warning' : 'success');

  return { url, score, verdict, indicators };
}
