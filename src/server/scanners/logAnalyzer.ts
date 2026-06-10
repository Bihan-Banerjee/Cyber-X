import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface LogAnomaly {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  count?: number;
  sourceIP?: string;
}

export interface LogResult {
  logType: string;
  totalLines: number;
  errorCount: number;
  warningCount: number;
  anomalies: LogAnomaly[];
  topIPs: Array<{ ip: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
  events: Array<{ ip?: string; method?: string; path?: string; status?: number; timestamp?: string }>;
  statistics: { requestCount: number; uniqueIPs: number; errorRate: number };
}

const SCANNER_UAS = /sqlmap|nikto|nmap|masscan|zgrab|dirbuster|gobuster|wfuzz|burp|acunetix/i;
const IP_REGEX = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;
const APACHE_NGINX_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+) \S+" (\d{3}) (\d+|-)/;
const AUTH_FAIL_REGEX = /failed|invalid|authentication failure|error/i;

function detectFormat(firstLine: string): string {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(firstLine)) {
    if (firstLine.includes('"GET') || firstLine.includes('"POST')) return 'apache';
    return 'nginx';
  }
  if (/^[A-Z][a-z]{2}\s+\d+/.test(firstLine)) return 'syslog';
  if (/authentication|sshd|sudo|pam/i.test(firstLine)) return 'auth';
  return 'generic';
}

export function analyzeLogs(buffer: Buffer, filename: string, logType: string = 'auto'): LogResult {
  const start = performance.now();
  logToolActivity('Log Analyzer', `Analyzing ${filename} (${logType})`, 'info');

  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 10 * 1024 * 1024));
  const lines = text.split('\n').filter((l) => l.trim());

  const detectedType = logType === 'auto' ? detectFormat(lines[0] ?? '') : logType;

  let errorCount = 0;
  let warningCount = 0;
  const ipCounts: Record<string, number> = {};
  const pathCounts: Record<string, number> = {};
  const ipFailedLogins: Record<string, number> = {};
  const events: LogResult['events'] = [];
  let status4xxCount = 0;
  let totalRequests = 0;

  for (const line of lines.slice(0, 100000)) {
    // Count errors/warnings
    if (/\berror\b/i.test(line)) errorCount++;
    if (/\bwarn(ing)?\b/i.test(line)) warningCount++;

    // Extract IPs
    const ipMatch = line.match(IP_REGEX);
    if (ipMatch) {
      const ip = ipMatch[1];
      ipCounts[ip] = (ipCounts[ip] ?? 0) + 1;
    }

    // Parse Apache/Nginx
    const apacheMatch = line.match(APACHE_NGINX_REGEX);
    if (apacheMatch) {
      const [, ip, , method, path, statusStr] = apacheMatch;
      const status = parseInt(statusStr, 10);
      totalRequests++;
      pathCounts[path] = (pathCounts[path] ?? 0) + 1;
      if (status >= 400 && status < 500) status4xxCount++;
      if (events.length < 1000) events.push({ ip, method, path, status });
    }

    // Auth log failures
    if ((detectedType === 'auth' || detectedType === 'syslog') && AUTH_FAIL_REGEX.test(line)) {
      errorCount++;
      const ipM = line.match(IP_REGEX);
      if (ipM) {
        ipFailedLogins[ipM[1]] = (ipFailedLogins[ipM[1]] ?? 0) + 1;
      }
    }
  }

  const anomalies: LogAnomaly[] = [];

  // Brute force detection
  for (const [ip, count] of Object.entries(ipFailedLogins)) {
    if (count >= 10) {
      anomalies.push({
        type: 'Brute Force Attempt',
        severity: count >= 50 ? 'critical' : 'high',
        description: `${count} failed login attempts from ${ip}`,
        count,
        sourceIP: ip,
      });
    }
  }

  // High 4xx rate
  if (totalRequests > 100 && status4xxCount / totalRequests > 0.3) {
    anomalies.push({
      type: '4xx Spike',
      severity: 'medium',
      description: `${Math.round((status4xxCount / totalRequests) * 100)}% of requests returned 4xx status codes`,
      count: status4xxCount,
    });
  }

  // Scanner detection
  const scannerIPs: string[] = [];
  for (const line of lines.slice(0, 100000)) {
    if (SCANNER_UAS.test(line)) {
      const ipM = line.match(IP_REGEX);
      if (ipM && !scannerIPs.includes(ipM[1])) {
        scannerIPs.push(ipM[1]);
      }
    }
  }
  if (scannerIPs.length > 0) {
    anomalies.push({
      type: 'Security Scanner Detected',
      severity: 'high',
      description: `Known security scanner detected from: ${scannerIPs.slice(0, 5).join(', ')}`,
      count: scannerIPs.length,
    });
  }

  const topIPs = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ip, count]) => ({ ip, count }));

  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, count]) => ({ path, count }));

  const uniqueIPs = Object.keys(ipCounts).length;
  const errorRate = totalRequests > 0 ? Math.round((status4xxCount / totalRequests) * 100) : 0;

  logToolActivity('Log Analyzer', `Analysis complete — ${anomalies.length} anomalies found`, 'success');

  return {
    logType: detectedType,
    totalLines: lines.length,
    errorCount,
    warningCount,
    anomalies,
    topIPs,
    topPaths,
    events: events.slice(0, 100),
    statistics: { requestCount: totalRequests, uniqueIPs, errorRate },
  };
}
