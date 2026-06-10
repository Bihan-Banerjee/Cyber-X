import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface WAFResult {
  url: string;
  wafDetected: boolean;
  wafName?: string;
  confidence: number;
  indicators: string[];
  headers: Record<string, string>;
}

interface WAFSignature {
  name: string;
  headerPatterns: Array<{ header: string; pattern: RegExp }>;
  bodyPatterns: RegExp[];
  statusCodes: number[];
  points: number;
}

const WAF_SIGNATURES: WAFSignature[] = [
  {
    name: 'Cloudflare',
    headerPatterns: [
      { header: 'cf-ray', pattern: /.*/ },
      { header: 'server', pattern: /cloudflare/i },
    ],
    bodyPatterns: [/cloudflare/i, /ray id:/i],
    statusCodes: [403, 503],
    points: 40,
  },
  {
    name: 'AWS WAF',
    headerPatterns: [
      { header: 'x-amzn-requestid', pattern: /.*/ },
      { header: 'x-amzn-trace-id', pattern: /.*/ },
    ],
    bodyPatterns: [/aws/i],
    statusCodes: [403],
    points: 35,
  },
  {
    name: 'Akamai',
    headerPatterns: [
      { header: 'x-check-cacheable', pattern: /.*/ },
      { header: 'server', pattern: /akamaighost/i },
    ],
    bodyPatterns: [/akamai/i],
    statusCodes: [403],
    points: 40,
  },
  {
    name: 'Sucuri',
    headerPatterns: [
      { header: 'x-sucuri-id', pattern: /.*/ },
      { header: 'x-sucuri-cache', pattern: /.*/ },
      { header: 'server', pattern: /sucuri/i },
    ],
    bodyPatterns: [/sucuri/i],
    statusCodes: [403],
    points: 40,
  },
  {
    name: 'ModSecurity',
    headerPatterns: [
      { header: 'server', pattern: /mod_security/i },
    ],
    bodyPatterns: [/mod_security/i, /ModSecurity/],
    statusCodes: [403, 406],
    points: 35,
  },
  {
    name: 'Imperva / Incapsula',
    headerPatterns: [
      { header: 'x-iinfo', pattern: /.*/ },
      { header: 'x-cdn', pattern: /imperva/i },
    ],
    bodyPatterns: [/incapsula/i, /imperva/i],
    statusCodes: [403],
    points: 40,
  },
  {
    name: 'F5 BIG-IP ASM',
    headerPatterns: [
      { header: 'x-cnection', pattern: /.*/ },
      { header: 'server', pattern: /bigip/i },
    ],
    bodyPatterns: [/bigip|f5/i],
    statusCodes: [403],
    points: 35,
  },
];

const MALICIOUS_PAYLOADS = [
  "?q=<script>alert(1)</script>",
  "?id=1' OR '1'='1",
  "?cmd=../../../etc/passwd",
];

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<{ status: number; headers: Record<string, string>; body: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    const body = await res.text().catch(() => '');
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { status: res.status, headers, body: body.substring(0, 5000) };
  } catch {
    return null;
  }
}

export async function detectWAF(url: string, timeoutMs: number = 10000): Promise<WAFResult> {
  const start = performance.now();
  logToolActivity('WAF Detector', `Detecting WAF for ${url}`, 'info');

  const normalRes = await fetchWithTimeout(url, timeoutMs);
  const maliciousUrl = url + MALICIOUS_PAYLOADS[0];
  const maliciousRes = await fetchWithTimeout(maliciousUrl, timeoutMs);

  const headers = normalRes?.headers ?? {};
  const malHeaders = maliciousRes?.headers ?? {};
  const allHeaders = { ...headers, ...malHeaders };

  const indicators: string[] = [];
  let totalPoints = 0;
  let detectedWAF: string | undefined;
  let maxPoints = 0;

  for (const sig of WAF_SIGNATURES) {
    let sigPoints = 0;

    for (const { header, pattern } of sig.headerPatterns) {
      const val = allHeaders[header.toLowerCase()];
      if (val && pattern.test(val)) {
        sigPoints += sig.points;
        indicators.push(`Header "${header}: ${val}" matches ${sig.name} signature`);
      }
    }

    const body = (normalRes?.body ?? '') + (maliciousRes?.body ?? '');
    for (const bp of sig.bodyPatterns) {
      if (bp.test(body)) {
        sigPoints += sig.points / 2;
        indicators.push(`Response body matches ${sig.name} pattern`);
      }
    }

    if (maliciousRes && sig.statusCodes.includes(maliciousRes.status) && (normalRes?.status !== maliciousRes.status)) {
      sigPoints += 20;
      indicators.push(`Status code change: ${normalRes?.status} → ${maliciousRes.status} on malicious payload`);
    }

    if (sigPoints > maxPoints) {
      maxPoints = sigPoints;
      detectedWAF = sig.name;
    }
    totalPoints = Math.max(totalPoints, sigPoints);
  }

  if (maliciousRes && normalRes && maliciousRes.status !== normalRes.status) {
    if (!indicators.some((i) => i.includes('Status code change'))) {
      indicators.push(`Payload triggered different response: ${maliciousRes.status}`);
      totalPoints += 15;
    }
  }

  const confidence = Math.min(100, totalPoints);
  const wafDetected = confidence >= 25;

  logToolActivity('WAF Detector', `Detection complete — WAF: ${wafDetected ? detectedWAF : 'none'}`, 'success');

  return {
    url,
    wafDetected,
    wafName: wafDetected ? detectedWAF : undefined,
    confidence,
    indicators,
    headers: allHeaders,
  };
}
