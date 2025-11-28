import { performance } from 'node:perf_hooks';

export interface AuthTest {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  details?: string;
}

export interface AuthCheckResult {
  target: string;
  overallScore: number;
  riskLevel: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  tests: AuthTest[];
  vulnerabilitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanDuration: number;
}

/**
 * Test for secure cookie attributes
 */
async function testCookieSecurity(
  url: string,
  timeoutMs: number
): Promise<AuthTest[]> {
  const tests: AuthTest[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeout);

    const cookieHeaders = response.headers.get('set-cookie');

    if (!cookieHeaders) {
      tests.push({
        category: 'Session Management',
        test: 'Cookie Usage',
        status: 'warning',
        severity: 'medium',
        description: 'No cookies detected in response',
        recommendation: 'Verify that session management is implemented properly',
      });
    } else {
      // Check for Secure flag
      const hasSecure = cookieHeaders.toLowerCase().includes('secure');
      tests.push({
        category: 'Session Management',
        test: 'Secure Cookie Flag',
        status: hasSecure ? 'pass' : 'fail',
        severity: hasSecure ? 'low' : 'high',
        description: hasSecure
          ? 'Cookies have the Secure flag set'
          : 'Cookies are missing the Secure flag, allowing transmission over HTTP',
        recommendation: 'Always set the Secure flag on cookies containing sensitive data',
        details: hasSecure ? undefined : 'Set-Cookie header: ' + cookieHeaders.substring(0, 100),
      });

      // Check for HttpOnly flag
      const hasHttpOnly = cookieHeaders.toLowerCase().includes('httponly');
      tests.push({
        category: 'Session Management',
        test: 'HttpOnly Cookie Flag',
        status: hasHttpOnly ? 'pass' : 'fail',
        severity: hasHttpOnly ? 'low' : 'high',
        description: hasHttpOnly
          ? 'Cookies have the HttpOnly flag set'
          : 'Cookies are accessible via JavaScript, vulnerable to XSS attacks',
        recommendation: 'Set HttpOnly flag to prevent client-side script access to cookies',
      });

      // Check for SameSite attribute
      const hasSameSite = cookieHeaders.toLowerCase().includes('samesite');
      tests.push({
        category: 'Session Management',
        test: 'SameSite Cookie Attribute',
        status: hasSameSite ? 'pass' : 'warning',
        severity: hasSameSite ? 'low' : 'medium',
        description: hasSameSite
          ? 'Cookies have SameSite attribute set'
          : 'Cookies missing SameSite attribute, potentially vulnerable to CSRF',
        recommendation: 'Set SameSite=Strict or SameSite=Lax to prevent CSRF attacks',
      });
    }
  } catch {
    tests.push({
      category: 'Session Management',
      test: 'Cookie Security Check',
      status: 'warning',
      severity: 'medium',
      description: 'Unable to retrieve cookie headers from target',
      recommendation: 'Ensure target URL is accessible and returns proper headers',
    });
  }

  return tests;
}

/**
 * Test for HTTPS enforcement
 */
async function testHTTPSEnforcement(url: string): Promise<AuthTest> {
  const isHTTPS = url.startsWith('https://');

  return {
    category: 'Transport Security',
    test: 'HTTPS Enforcement',
    status: isHTTPS ? 'pass' : 'fail',
    severity: isHTTPS ? 'low' : 'critical',
    description: isHTTPS
      ? 'Login endpoint uses HTTPS'
      : 'Login endpoint uses HTTP - credentials transmitted in plaintext',
    recommendation: 'Always use HTTPS for authentication endpoints to encrypt data in transit',
  };
}

/**
 * Test for security headers
 */
async function testSecurityHeaders(
  url: string,
  timeoutMs: number
): Promise<AuthTest[]> {
  const tests: AuthTest[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Check for HSTS
    const hsts = response.headers.get('strict-transport-security');
    tests.push({
      category: 'Transport Security',
      test: 'HSTS Header',
      status: hsts ? 'pass' : 'fail',
      severity: hsts ? 'low' : 'high',
      description: hsts
        ? 'HSTS header present - enforces HTTPS'
        : 'Missing HSTS header - protocol downgrade attacks possible',
      recommendation: 'Add Strict-Transport-Security header with appropriate max-age',
    });

    // Check for CSP
    const csp = response.headers.get('content-security-policy');
    tests.push({
      category: 'XSS Protection',
      test: 'Content Security Policy',
      status: csp ? 'pass' : 'warning',
      severity: csp ? 'low' : 'medium',
      description: csp
        ? 'CSP header present'
        : 'Missing Content-Security-Policy - XSS attacks may be easier',
      recommendation: 'Implement a strict Content-Security-Policy',
    });

    // Check for X-Frame-Options
    const xframe = response.headers.get('x-frame-options');
    tests.push({
      category: 'Clickjacking Protection',
      test: 'X-Frame-Options Header',
      status: xframe ? 'pass' : 'warning',
      severity: xframe ? 'low' : 'medium',
      description: xframe
        ? 'X-Frame-Options header present'
        : 'Missing X-Frame-Options - clickjacking attacks possible',
      recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN',
    });
  } catch {
    tests.push({
      category: 'Transport Security',
      test: 'Security Headers Check',
      status: 'warning',
      severity: 'medium',
      description: 'Unable to check security headers',
      recommendation: 'Verify target URL is accessible',
    });
  }

  return tests;
}

/**
 * Test for rate limiting
 */
async function testRateLimiting(
  url: string,
  timeoutMs: number
): Promise<AuthTest> {
  try {
    // Make multiple requests quickly
    const requests = Array(5).fill(null).map(() =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' }),
      }).catch(() => null)
    );

    const responses = await Promise.all(requests);
    const validResponses = responses.filter(r => r !== null);

    // Check if any response indicates rate limiting
    const hasRateLimit = validResponses.some(r =>
      r && (r.status === 429 || r.headers.get('x-ratelimit-limit'))
    );

    return {
      category: 'Brute Force Protection',
      test: 'Rate Limiting',
      status: hasRateLimit ? 'pass' : 'fail',
      severity: hasRateLimit ? 'low' : 'high',
      description: hasRateLimit
        ? 'Rate limiting detected - protects against brute force'
        : 'No rate limiting detected - vulnerable to brute force attacks',
      recommendation: 'Implement rate limiting (e.g., max 5 failed attempts per minute)',
    };
  } catch {
    return {
      category: 'Brute Force Protection',
      test: 'Rate Limiting',
      status: 'warning',
      severity: 'medium',
      description: 'Unable to test rate limiting',
      recommendation: 'Manually verify rate limiting is implemented',
    };
  }
}

/**
 * Test for account enumeration
 */
async function testAccountEnumeration(
  url: string,
  timeoutMs: number
): Promise<AuthTest> {
  try {
    // Test with non-existent user
    const response1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_user_xyz', password: 'test' }),
    });

    // Test with existing pattern
    const response2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test' }),
    });

    const text1 = await response1.text();
    const text2 = await response2.text();

    // If responses are different, user enumeration may be possible
    const areDifferent = text1 !== text2;

    return {
      category: 'Information Disclosure',
      test: 'User Enumeration',
      status: areDifferent ? 'fail' : 'pass',
      severity: areDifferent ? 'medium' : 'low',
      description: areDifferent
        ? 'Different responses for valid/invalid usernames allow user enumeration'
        : 'Generic error messages prevent user enumeration',
      recommendation: 'Return identical generic error messages for all authentication failures',
    };
  } catch {
    return {
      category: 'Information Disclosure',
      test: 'User Enumeration',
      status: 'warning',
      severity: 'medium',
      description: 'Unable to test user enumeration',
      recommendation: 'Manually verify error messages are generic',
    };
  }
}

/**
 * Test for session timeout
 */
function testSessionTimeout(): AuthTest {
  return {
    category: 'Session Management',
    test: 'Session Timeout',
    status: 'warning',
    severity: 'medium',
    description: 'Session timeout cannot be automatically tested - requires manual verification',
    recommendation: 'Implement absolute timeout (e.g., 30 minutes) and idle timeout (e.g., 15 minutes)',
  };
}

/**
 * Test for password policy
 */
function testPasswordPolicy(): AuthTest {
  return {
    category: 'Password Security',
    test: 'Password Policy',
    status: 'warning',
    severity: 'medium',
    description: 'Password strength requirements cannot be automatically tested',
    recommendation: 'Enforce strong passwords: minimum 12 characters, mixed case, numbers, special chars',
  };
}

/**
 * Test for 2FA/MFA
 */
function testMultiFactorAuth(): AuthTest {
  return {
    category: 'Authentication Methods',
    test: 'Multi-Factor Authentication',
    status: 'warning',
    severity: 'high',
    description: 'MFA presence cannot be automatically detected',
    recommendation: 'Implement 2FA/MFA using TOTP, SMS, or hardware tokens for enhanced security',
  };
}

/**
 * Calculate overall security score
 */
function calculateScore(tests: AuthTest[]): number {
  let score = 100;

  for (const test of tests) {
    if (test.status === 'fail') {
      switch (test.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    } else if (test.status === 'warning') {
      switch (test.severity) {
        case 'critical':
          score -= 10;
          break;
        case 'high':
          score -= 7;
          break;
        case 'medium':
          score -= 4;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }
  }

  return Math.max(0, score);
}

/**
 * Perform comprehensive authentication security check
 */
export async function performAuthCheck(
  target: string,
  username?: string,
  password?: string,
  timeoutMs: number = 15000
): Promise<AuthCheckResult> {
  const startTime = performance.now();

  const tests: AuthTest[] = [];

  // Run all tests
  tests.push(await testHTTPSEnforcement(target));
  tests.push(...await testSecurityHeaders(target, timeoutMs));
  tests.push(...await testCookieSecurity(target, timeoutMs));
  tests.push(await testRateLimiting(target, timeoutMs));
  tests.push(await testAccountEnumeration(target, timeoutMs));
  tests.push(testSessionTimeout());
  tests.push(testPasswordPolicy());
  tests.push(testMultiFactorAuth());

  // Calculate statistics
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const warnings = tests.filter(t => t.status === 'warning').length;

  const vulnerabilitySummary = {
    critical: tests.filter(t => t.status === 'fail' && t.severity === 'critical').length,
    high: tests.filter(t => t.status === 'fail' && t.severity === 'high').length,
    medium: tests.filter(t => (t.status === 'fail' || t.status === 'warning') && t.severity === 'medium').length,
    low: tests.filter(t => t.severity === 'low').length,
  };

  const overallScore = calculateScore(tests);
  
  const riskLevel = 
    overallScore >= 80 ? 'LOW' :
    overallScore >= 60 ? 'MEDIUM' :
    overallScore >= 40 ? 'HIGH' : 'CRITICAL';

  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  return {
    target,
    overallScore,
    riskLevel,
    totalTests: tests.length,
    passed,
    failed,
    warnings,
    tests,
    vulnerabilitySummary,
    scanDuration,
  };
}
