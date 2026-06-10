import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface RedirectResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  redirectedTo?: string;
  payloadUsed?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  recommendations: string[];
  payloads: string[];
}

const REDIRECT_PAYLOADS = [
  'https://evil.com',
  '//evil.com',
  '/\\evil.com',
  'https://evil.com%2F@legitimate.com',
  'javascript:alert(document.domain)',
  'https://evil.com?',
  'https://evil.com#',
  '////evil.com',
  'https:evil.com',
  '%2F%2Fevil.com',
];

async function testPayload(
  baseUrl: string,
  parameter: string,
  payload: string,
  timeoutMs: number
): Promise<string | null> {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set(parameter, payload);
    const testUrl = url.toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(testUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const location = res.headers.get('location');
    if (location && (location.includes('evil.com') || location.startsWith('/\\'))) {
      return location;
    }
    return null;
  } catch {
    return null;
  }
}

export async function testOpenRedirect(
  url: string,
  parameter: string,
  timeoutMs: number = 10000
): Promise<RedirectResult> {
  const start = performance.now();
  logToolActivity('Open Redirect Finder', `Testing ${url} param "${parameter}"`, 'info');

  let vulnerable = false;
  let redirectedTo: string | undefined;
  let payloadUsed: string | undefined;

  for (const payload of REDIRECT_PAYLOADS.slice(0, 5)) {
    const result = await testPayload(url, parameter, payload, Math.min(timeoutMs / 3, 4000));
    if (result) {
      vulnerable = true;
      redirectedTo = result;
      payloadUsed = payload;
      break;
    }
  }

  const recommendations = [
    'Validate redirect URLs against a whitelist of allowed destinations',
    'Use relative URLs instead of absolute URLs for redirects',
    'Implement a mapping layer for redirect destinations',
    'Reject any redirect URL that contains an external host',
    'Log and monitor redirect attempts for anomalies',
  ];

  logToolActivity('Open Redirect Finder', `Test complete — vulnerable: ${vulnerable}`, 'success');

  return {
    url,
    parameter,
    vulnerable,
    redirectedTo,
    payloadUsed,
    severity: vulnerable ? 'high' : 'info',
    recommendations,
    payloads: REDIRECT_PAYLOADS,
  };
}
