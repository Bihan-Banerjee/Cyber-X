import { performance } from 'node:perf_hooks';

export interface Vulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  description: string;
  recommendation: string;
}

export interface APIEndpoint {
  url: string;
  method: string;
  status: number;
  responseTime: number;
  vulnerabilities: Vulnerability[];
  headers: Record<string, string>;
  securityScore: number;
}

export interface APIScanResult {
  target: string;
  totalEndpoints: number;
  endpoints: APIEndpoint[];
  overallScore: number;
  vulnerabilityCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scanDuration: number;
}

/**
 * Test API endpoint with various HTTP methods
 */
async function testEndpoint(
  url: string,
  method: string,
  apiKey?: string,
  timeoutMs: number = 10000
): Promise<{
  status: number;
  responseTime: number;
  headers: Record<string, string>;
  body?: any;
}> {
  const start = performance.now();

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'API-Security-Scanner/1.0',
    };

    if (apiKey) {
      if (apiKey.startsWith('Bearer ')) {
        headers['Authorization'] = apiKey;
      } else {
        headers['X-API-Key'] = apiKey;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTime = Math.round(performance.now() - start);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    let body;
    try {
      body = await response.json();
    } catch {
      // Not JSON
    }

    return {
      status: response.status,
      responseTime,
      headers: responseHeaders,
      body,
    };
  } catch (error: any) {
    return {
      status: 0,
      responseTime: Math.round(performance.now() - start),
      headers: {},
    };
  }
}

/**
 * Check for missing security headers
 */
function checkSecurityHeaders(headers: Record<string, string>): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  // Check for missing headers
  const securityHeaders = {
    'strict-transport-security': {
      name: 'HSTS',
      severity: 'high' as const,
      description: 'Missing Strict-Transport-Security header. API is vulnerable to protocol downgrade attacks.',
      recommendation: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains" header.',
    },
    'x-content-type-options': {
      name: 'X-Content-Type-Options',
      severity: 'medium' as const,
      description: 'Missing X-Content-Type-Options header. API may be vulnerable to MIME-sniffing attacks.',
      recommendation: 'Add "X-Content-Type-Options: nosniff" header.',
    },
    'x-frame-options': {
      name: 'X-Frame-Options',
      severity: 'medium' as const,
      description: 'Missing X-Frame-Options header. API endpoints may be embedded in iframes.',
      recommendation: 'Add "X-Frame-Options: DENY" or "SAMEORIGIN" header.',
    },
    'content-security-policy': {
      name: 'CSP',
      severity: 'medium' as const,
      description: 'Missing Content-Security-Policy header.',
      recommendation: 'Implement a strict Content-Security-Policy to prevent XSS attacks.',
    },
  };

  for (const [header, config] of Object.entries(securityHeaders)) {
    if (!headers[header]) {
      vulnerabilities.push({
        severity: config.severity,
        type: `Missing ${config.name} Header`,
        description: config.description,
        recommendation: config.recommendation,
      });
    }
  }

  // Check for information disclosure
  if (headers['server']) {
    vulnerabilities.push({
      severity: 'info',
      type: 'Server Information Disclosure',
      description: `Server header reveals: ${headers['server']}`,
      recommendation: 'Remove or obfuscate the Server header to prevent information disclosure.',
    });
  }

  if (headers['x-powered-by']) {
    vulnerabilities.push({
      severity: 'info',
      type: 'Technology Stack Disclosure',
      description: `X-Powered-By header reveals: ${headers['x-powered-by']}`,
      recommendation: 'Remove the X-Powered-By header.',
    });
  }

  return vulnerabilities;
}

/**
 * Check for CORS misconfigurations
 */
function checkCORS(headers: Record<string, string>): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  if (headers['access-control-allow-origin'] === '*') {
    vulnerabilities.push({
      severity: 'high',
      type: 'Insecure CORS Configuration',
      description: 'API allows requests from any origin (Access-Control-Allow-Origin: *). This can lead to unauthorized data access.',
      recommendation: 'Restrict CORS to specific trusted origins. Never use "*" in production APIs.',
    });
  }

  if (headers['access-control-allow-credentials'] === 'true' && headers['access-control-allow-origin'] === '*') {
    vulnerabilities.push({
      severity: 'critical',
      type: 'Critical CORS Misconfiguration',
      description: 'API allows credentials with wildcard origin. This is a severe security vulnerability.',
      recommendation: 'Never combine "Access-Control-Allow-Credentials: true" with wildcard origin.',
    });
  }

  return vulnerabilities;
}

/**
 * Check authentication and authorization
 */
function checkAuthentication(
  url: string,
  status: number,
  headers: Record<string, string>,
  hasAuth: boolean
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  // Check if sensitive endpoints are unprotected
  const sensitivePatterns = ['/admin', '/api/users', '/api/user', '/delete', '/update'];
  const isSensitive = sensitivePatterns.some(pattern => url.toLowerCase().includes(pattern));

  if (isSensitive && status === 200 && !hasAuth) {
    vulnerabilities.push({
      severity: 'critical',
      type: 'Broken Authentication',
      description: 'Sensitive endpoint is accessible without authentication.',
      recommendation: 'Implement proper authentication (OAuth 2.0, JWT) for all sensitive endpoints.',
    });
  }

  // Check for weak authentication
  if (headers['www-authenticate']?.toLowerCase().includes('basic')) {
    vulnerabilities.push({
      severity: 'high',
      type: 'Weak Authentication Scheme',
      description: 'API uses Basic Authentication which transmits credentials in Base64 (easily decoded).',
      recommendation: 'Use OAuth 2.0 or JWT-based authentication instead of Basic Auth.',
    });
  }

  return vulnerabilities;
}

/**
 * Check for rate limiting
 */
function checkRateLimiting(headers: Record<string, string>): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  const rateLimitHeaders = ['x-ratelimit-limit', 'x-rate-limit-limit', 'ratelimit-limit'];
  const hasRateLimit = rateLimitHeaders.some(h => headers[h]);

  if (!hasRateLimit) {
    vulnerabilities.push({
      severity: 'medium',
      type: 'Missing Rate Limiting',
      description: 'API does not implement rate limiting. Vulnerable to abuse and DDoS attacks.',
      recommendation: 'Implement rate limiting to prevent API abuse. Return rate limit headers (X-RateLimit-*).',
    });
  }

  return vulnerabilities;
}

/**
 * Check HTTP methods
 */
async function checkHTTPMethods(
  url: string,
  apiKey?: string
): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];

  // Test dangerous methods
  const dangerousMethods = ['TRACE', 'TRACK'];
  
  for (const method of dangerousMethods) {
    const result = await testEndpoint(url, method, apiKey, 3000);
    if (result.status > 0 && result.status < 405) {
      vulnerabilities.push({
        severity: 'medium',
        type: `Dangerous HTTP Method: ${method}`,
        description: `API allows ${method} method which can be exploited for XST attacks.`,
        recommendation: `Disable ${method} method on the web server.`,
      });
    }
  }

  return vulnerabilities;
}

/**
 * Calculate security score
 */
function calculateScore(vulnerabilities: Vulnerability[]): number {
  let score = 100;

  for (const vuln of vulnerabilities) {
    switch (vuln.severity) {
      case 'critical':
        score -= 20;
        break;
      case 'high':
        score -= 10;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'low':
        score -= 2;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  return Math.max(0, score);
}

/**
 * Perform comprehensive API security scan
 */
export async function performAPIScan(
  target: string,
  apiKey?: string,
  timeoutMs: number = 10000
): Promise<APIScanResult> {
  const startTime = performance.now();

  const baseURL = target.endsWith('/') ? target.slice(0, -1) : target;
  
  // Common API endpoints to test
  const endpointsToTest = [
    { path: '', method: 'GET' },
    { path: '/api', method: 'GET' },
    { path: '/api/v1', method: 'GET' },
    { path: '/users', method: 'GET' },
    { path: '/api/users', method: 'GET' },
    { path: '/admin', method: 'GET' },
    { path: '/api/admin', method: 'GET' },
    { path: '', method: 'POST' },
    { path: '', method: 'PUT' },
    { path: '', method: 'DELETE' },
  ];

  const endpoints: APIEndpoint[] = [];

  for (const endpoint of endpointsToTest) {
    const url = endpoint.path ? `${baseURL}${endpoint.path}` : baseURL;
    const result = await testEndpoint(url, endpoint.method, apiKey, timeoutMs);

    if (result.status === 0) continue; // Skip failed requests

    const vulnerabilities: Vulnerability[] = [];

    // Run security checks
    vulnerabilities.push(...checkSecurityHeaders(result.headers));
    vulnerabilities.push(...checkCORS(result.headers));
    vulnerabilities.push(...checkAuthentication(url, result.status, result.headers, !!apiKey));
    vulnerabilities.push(...checkRateLimiting(result.headers));
    
    // Check HTTP methods for GET requests only
    if (endpoint.method === 'GET') {
      vulnerabilities.push(...await checkHTTPMethods(url, apiKey));
    }

    const securityScore = calculateScore(vulnerabilities);

    endpoints.push({
      url,
      method: endpoint.method,
      status: result.status,
      responseTime: result.responseTime,
      vulnerabilities,
      headers: result.headers,
      securityScore,
    });
  }

  // Calculate overall statistics
  const vulnerabilityCount = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  let totalScore = 0;

  for (const endpoint of endpoints) {
    totalScore += endpoint.securityScore;
    for (const vuln of endpoint.vulnerabilities) {
      vulnerabilityCount[vuln.severity]++;
    }
  }

  const overallScore = endpoints.length > 0 ? Math.round(totalScore / endpoints.length) : 0;
  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  return {
    target: baseURL,
    totalEndpoints: endpoints.length,
    endpoints,
    overallScore,
    vulnerabilityCount,
    scanDuration,
  };
}
