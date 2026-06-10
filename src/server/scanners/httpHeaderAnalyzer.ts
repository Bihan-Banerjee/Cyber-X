import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SecurityHeaderCheck {
  name: string;
  present: boolean;
  value?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  recommendation: string;
}

export interface HeaderAnalysisResult {
  url: string;
  statusCode: number;
  responseTime: number;
  headers: Record<string, string>;
  securityHeaders: SecurityHeaderCheck[];
  overallScore: number;
  grade: string;
  scanDuration: number;
}

const SECURITY_HEADER_SPECS: Array<{
  header: string;
  displayName: string;
  missingSeverity: SecurityHeaderCheck['severity'];
  recommendation: string;
  validate?: (value: string) => SecurityHeaderCheck['severity'] | null;
  validateRec?: (value: string) => string | null;
}> = [
  {
    header: 'strict-transport-security',
    displayName: 'Strict-Transport-Security',
    missingSeverity: 'high',
    recommendation: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    validate: (v) => {
      const maxAge = parseInt((v.match(/max-age=(\d+)/i) || [])[1] || '0', 10);
      if (maxAge < 15768000) return 'low';
      return null;
    },
    validateRec: (v) => {
      const maxAge = parseInt((v.match(/max-age=(\d+)/i) || [])[1] || '0', 10);
      if (maxAge < 15768000) return 'HSTS max-age is too short. Use at least 6 months (15768000).';
      return null;
    },
  },
  {
    header: 'content-security-policy',
    displayName: 'Content-Security-Policy',
    missingSeverity: 'high',
    recommendation: 'Implement a Content-Security-Policy. Start with "default-src \'self\'" and tighten from there.',
    validate: (v) => {
      const lower = v.toLowerCase();
      if (lower.includes("'unsafe-inline'") || lower.includes("'unsafe-eval'")) return 'medium';
      return null;
    },
    validateRec: (v) => {
      const lower = v.toLowerCase();
      const issues = [];
      if (lower.includes("'unsafe-inline'")) issues.push("'unsafe-inline'");
      if (lower.includes("'unsafe-eval'")) issues.push("'unsafe-eval'");
      if (issues.length) return `CSP contains ${issues.join(', ')} which weakens its protection. Remove them if possible.`;
      return null;
    },
  },
  {
    header: 'x-content-type-options',
    displayName: 'X-Content-Type-Options',
    missingSeverity: 'medium',
    recommendation: 'Add: X-Content-Type-Options: nosniff',
    validate: (v) => (v.toLowerCase() !== 'nosniff' ? 'low' : null),
    validateRec: () => 'Value should be exactly "nosniff".',
  },
  {
    header: 'x-frame-options',
    displayName: 'X-Frame-Options',
    missingSeverity: 'medium',
    recommendation: 'Add: X-Frame-Options: DENY (or SAMEORIGIN if framing from same origin is needed)',
  },
  {
    header: 'x-xss-protection',
    displayName: 'X-XSS-Protection',
    missingSeverity: 'low',
    recommendation: 'Add: X-XSS-Protection: 1; mode=block (legacy browsers) or rely on CSP for modern browsers.',
  },
  {
    header: 'referrer-policy',
    displayName: 'Referrer-Policy',
    missingSeverity: 'low',
    recommendation: 'Add: Referrer-Policy: strict-origin-when-cross-origin',
  },
  {
    header: 'permissions-policy',
    displayName: 'Permissions-Policy',
    missingSeverity: 'low',
    recommendation: 'Add: Permissions-Policy: geolocation=(), microphone=(), camera=() to restrict browser features.',
  },
  {
    header: 'cache-control',
    displayName: 'Cache-Control',
    missingSeverity: 'info',
    recommendation: 'Add: Cache-Control: no-store for sensitive pages.',
  },
];

function calculateScore(checks: SecurityHeaderCheck[]): number {
  const weights: Record<SecurityHeaderCheck['severity'], number> = {
    critical: 25,
    high: 15,
    medium: 10,
    low: 5,
    info: 2,
  };
  let deductions = 0;
  for (const check of checks) {
    if (!check.present) deductions += weights[check.severity] || 0;
  }
  return Math.max(0, 100 - deductions);
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export async function analyzeHTTPHeaders(
  url: string,
  timeoutMs: number = 10000
): Promise<HeaderAnalysisResult> {
  const start = performance.now();
  logToolActivity('HTTP Header Analyzer', `Fetching headers for ${url}`, 'info');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let statusCode = 0;
  let headers: Record<string, string> = {};
  const reqStart = performance.now();

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    // Some servers reject HEAD — fall back to GET
    if (response.status === 405) {
      clearTimeout(timer);
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
      response = await fetch(url, {
        method: 'GET',
        signal: controller2.signal,
        redirect: 'follow',
      });
      clearTimeout(timer2);
    } else {
      clearTimeout(timer);
    }

    statusCode = response.status;
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }

  const responseTime = Math.round(performance.now() - reqStart);

  // Build security header checks
  const securityHeaders: SecurityHeaderCheck[] = SECURITY_HEADER_SPECS.map((spec) => {
    const value = headers[spec.header];
    if (!value) {
      return {
        name: spec.displayName,
        present: false,
        severity: spec.missingSeverity,
        recommendation: spec.recommendation,
      };
    }

    // Header is present — validate value
    const badSeverity = spec.validate?.(value);
    const badRec = spec.validateRec?.(value);
    return {
      name: spec.displayName,
      present: true,
      value,
      severity: badSeverity ?? 'info',
      recommendation: badSeverity ? (badRec || spec.recommendation) : 'Header is configured correctly.',
    };
  });

  const overallScore = calculateScore(securityHeaders);

  logToolActivity('HTTP Header Analyzer', `Completed analysis for ${url} — score ${overallScore}`, 'success');

  return {
    url,
    statusCode,
    responseTime,
    headers,
    securityHeaders,
    overallScore,
    grade: scoreToGrade(overallScore),
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
