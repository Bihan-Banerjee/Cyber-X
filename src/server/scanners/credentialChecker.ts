import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CredentialResult {
  username: string;
  success: boolean;
  statusCode?: number;
  responseTime?: number;
}

export interface CheckResult {
  target: string;
  results: CredentialResult[];
  tested: number;
  found: number;
}

const SUCCESS_INDICATORS = [
  /dashboard/i,
  /welcome/i,
  /logout/i,
  /my.?account/i,
  /profile/i,
  /home/i,
];

const FAILURE_INDICATORS = [
  /invalid/i,
  /incorrect/i,
  /error/i,
  /failed/i,
  /wrong/i,
  /unauthorized/i,
];

// Internal rate limiter: max 10 requests per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(target: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(target);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(target, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

async function testCredential(
  target: string,
  loginPath: string,
  username: string,
  password: string,
  timeoutMs: number
): Promise<CredentialResult> {
  const start = performance.now();

  if (!checkRateLimit(target)) {
    throw new Error('Rate limit exceeded — max 10 credential tests per minute');
  }

  try {
    const loginUrl = `${target}${loginPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password, user: username, pass: password, email: username }).toString(),
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    const responseTime = Math.round(performance.now() - start);
    const body = await res.text();

    // Success heuristic: redirect to dashboard, or response contains success indicators
    let success = false;

    // 302 redirect often means success
    if (res.redirected && res.url !== loginUrl) {
      const redirectUrl = res.url.toLowerCase();
      success = SUCCESS_INDICATORS.some((r) => r.test(redirectUrl));
    }

    if (!success) {
      const hasSuccess = SUCCESS_INDICATORS.some((r) => r.test(body));
      const hasFailure = FAILURE_INDICATORS.some((r) => r.test(body));
      success = hasSuccess && !hasFailure;
    }

    // Check for auth tokens in response
    if (!success) {
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      if (headers['set-cookie']?.toLowerCase().includes('session') ||
          headers['set-cookie']?.toLowerCase().includes('auth') ||
          headers['authorization']) {
        success = true;
      }
    }

    return { username, success, statusCode: res.status, responseTime };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { username, success: false, statusCode: 408 };
    }
    return { username, success: false };
  }
}

export async function checkCredentials(
  credentials: Array<{ username: string; password: string }>,
  target: string,
  loginPath: string = '/login',
  timeoutMs: number = 5000
): Promise<CheckResult> {
  const start = performance.now();
  logToolActivity('Credential Checker', `Testing ${credentials.length} credentials against ${target}`, 'warning');

  // Cap at 20 credentials
  const creds = credentials.slice(0, 20);
  const results: CredentialResult[] = [];

  for (const { username, password } of creds) {
    const result = await testCredential(target, loginPath, username, password, timeoutMs);
    results.push(result);

    // Delay between attempts to avoid lockout
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const found = results.filter((r) => r.success).length;
  logToolActivity('Credential Checker', `Tested ${results.length} credentials — found ${found} valid`, found > 0 ? 'warning' : 'success');

  return { target, results, tested: results.length, found };
}
