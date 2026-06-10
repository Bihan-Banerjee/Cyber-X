import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface GCPBucket {
  name: string;
  url: string;
  exists: boolean;
  accessible: boolean;
  isPublic: boolean;
  findings: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
}

export interface GCPBucketResult {
  keyword: string;
  buckets: GCPBucket[];
  total: number;
  found: number;
  public: number;
  scanDuration: number;
}

const BUCKET_PATTERNS = [
  '{keyword}',
  '{keyword}-backup',
  '{keyword}-backups',
  '{keyword}-data',
  '{keyword}-assets',
  '{keyword}-static',
  '{keyword}-public',
  '{keyword}-private',
  '{keyword}-prod',
  '{keyword}-production',
  '{keyword}-dev',
  '{keyword}-test',
  '{keyword}-staging',
  '{keyword}-media',
  '{keyword}-images',
  '{keyword}-files',
  '{keyword}-uploads',
  '{keyword}-logs',
  '{keyword}-cdn',
  '{keyword}-storage',
  '{keyword}-archive',
  '{keyword}-web',
  '{keyword}-app',
  '{keyword}-api',
];

function generateNames(keyword: string): string[] {
  const clean = keyword.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  return BUCKET_PATTERNS.map((p) => p.replace('{keyword}', clean));
}

async function checkGCPBucket(name: string): Promise<GCPBucket> {
  const url = `https://storage.googleapis.com/${name}`;
  const findings: string[] = [];

  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    const exists = headRes.status !== 404;

    if (!exists) {
      return { name, url, exists: false, accessible: false, isPublic: false, findings: [], riskLevel: 'safe' };
    }

    // Try object listing via JSON API
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${name}/o`;
    let isPublic = false;
    let accessible = false;

    try {
      const listRes = await fetch(listUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (listRes.status === 200) {
        accessible = true;
        isPublic = true;
        findings.push('GCS bucket publicly listable — object enumeration enabled');
      } else if (listRes.status === 403) {
        findings.push('Bucket exists but is private (access denied)');
      }
    } catch {
      // ignore
    }

    const riskLevel: GCPBucket['riskLevel'] = isPublic ? 'critical' : headRes.status === 403 ? 'safe' : 'medium';

    return { name, url, exists, accessible, isPublic, findings, riskLevel };
  } catch {
    return { name, url, exists: false, accessible: false, isPublic: false, findings: [], riskLevel: 'safe' };
  }
}

export async function performGCPBucketFinding(keyword: string): Promise<GCPBucketResult> {
  const startTime = performance.now();
  logToolActivity('GCP Bucket Finder', `Starting scan for keyword: ${keyword}`, 'info');

  const names = generateNames(keyword);
  const results: GCPBucket[] = [];

  const batchSize = 5;
  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(checkGCPBucket));
    results.push(...batchResults);
  }

  const found = results.filter((r) => r.exists).length;
  const pub = results.filter((r) => r.isPublic).length;
  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  logToolActivity('GCP Bucket Finder', `Scan complete: ${found} found, ${pub} public`, found > 0 ? 'warning' : 'success');

  return {
    keyword,
    buckets: results,
    total: names.length,
    found,
    public: pub,
    scanDuration,
  };
}
