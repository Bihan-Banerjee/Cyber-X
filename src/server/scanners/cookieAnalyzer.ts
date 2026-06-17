import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CookieDetail {
  name: string;
  value?: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  expires: string;
  size: number;
  issues: string[];
}

export interface CookieIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  cookie: string;
}

export interface CookieAnalysisResult {
  url: string;
  cookies: CookieDetail[];
  issues: CookieIssue[];
  overallScore: number;
}

function parseCookieHeader(header: string, requestUrl: string): CookieDetail {
  const parts = header.split(';').map((p) => p.trim());
  const nameValue = parts[0];
  const eqIdx = nameValue.indexOf('=');
  const name = eqIdx >= 0 ? nameValue.slice(0, eqIdx).trim() : nameValue;
  const value = eqIdx >= 0 ? nameValue.slice(eqIdx + 1).trim() : '';

  let domain = '';
  let path = '/';
  let httpOnly = false;
  let secure = false;
  let sameSite = '';
  let expires = '';

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const lpart = part.toLowerCase();
    if (lpart === 'httponly') { httpOnly = true; continue; }
    if (lpart === 'secure') { secure = true; continue; }
    if (lpart.startsWith('samesite=')) sameSite = part.slice(9);
    else if (lpart.startsWith('domain=')) domain = part.slice(7);
    else if (lpart.startsWith('path=')) path = part.slice(5);
    else if (lpart.startsWith('expires=')) expires = part.slice(8);
    else if (lpart.startsWith('max-age=')) {
      const maxAge = parseInt(part.slice(8));
      if (!isNaN(maxAge)) {
        expires = new Date(Date.now() + maxAge * 1000).toUTCString();
      }
    }
  }

  try {
    const parsed = new URL(requestUrl);
    if (!domain) domain = parsed.hostname;
  } catch { /* noop */ }

  return {
    name,
    value: value.slice(0, 20) + (value.length > 20 ? '...' : ''),
    domain,
    path,
    httpOnly,
    secure,
    sameSite,
    expires,
    size: header.length,
    issues: [],
  };
}

export async function analyzeCookies(url: string, timeoutMs: number = 10000): Promise<CookieAnalysisResult> {
  const start = performance.now();

  logToolActivity('Cookie Analyzer', `Analyzing cookies for ${url}`, 'info');

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let rawCookies: string[] = [];

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Security-Scanner/1.0)' },
    });
    clearTimeout(timeout);

    // Collect all Set-Cookie headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') rawCookies.push(value);
    });

    // Also check for multiple headers (Node fetch may combine them)
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader && rawCookies.length === 0) {
      rawCookies = setCookieHeader.split(',').filter((c) => c.includes('='));
    }
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw new Error(`Could not fetch URL: ${err.message}`);
  }

  const cookies = rawCookies.map((c) => parseCookieHeader(c, url));
  const issues: CookieIssue[] = [];

  for (const cookie of cookies) {
    // Missing HttpOnly
    if (!cookie.httpOnly) {
      issues.push({
        severity: 'medium',
        description: `Cookie "${cookie.name}" is missing the HttpOnly flag — accessible via JavaScript`,
        cookie: cookie.name,
      });
    }
    // Missing Secure on non-localhost
    if (!cookie.secure && !isLocalhost) {
      issues.push({
        severity: 'high',
        description: `Cookie "${cookie.name}" is missing the Secure flag — can be transmitted over HTTP`,
        cookie: cookie.name,
      });
    }
    // SameSite=None without Secure
    if (cookie.sameSite.toLowerCase() === 'none' && !cookie.secure) {
      issues.push({
        severity: 'high',
        description: `Cookie "${cookie.name}" has SameSite=None without Secure — violates spec and allows cross-site sending`,
        cookie: cookie.name,
      });
    }
    // Missing SameSite
    if (!cookie.sameSite) {
      issues.push({
        severity: 'medium',
        description: `Cookie "${cookie.name}" is missing the SameSite attribute — defaults to Lax in modern browsers but should be explicit`,
        cookie: cookie.name,
      });
    }
    // Very long expiry
    if (cookie.expires) {
      const expiry = new Date(cookie.expires).getTime();
      const oneYear = Date.now() + 365 * 24 * 3600 * 1000;
      if (expiry > oneYear) {
        issues.push({
          severity: 'low',
          description: `Cookie "${cookie.name}" has a very long expiry (> 1 year) — consider shorter session duration`,
          cookie: cookie.name,
        });
      }
    }
  }

  const deductions = { critical: 20, high: 10, medium: 5, low: 2, info: 1 };
  const overallScore = Math.max(
    0,
    100 - issues.reduce((sum, i) => sum + (deductions[i.severity] || 0), 0)
  );

  logToolActivity('Cookie Analyzer', `Analysis complete for ${url}: ${cookies.length} cookies, ${issues.length} issues`, 'success');

  return { url, cookies, issues, overallScore };
}
