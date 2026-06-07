import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface AzureBlob {
  name: string;
  url: string;
  exists: boolean;
  accessible: boolean;
  isPublic: boolean;
  findings: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
}

export interface AzureBlobResult {
  keyword: string;
  buckets: AzureBlob[];
  total: number;
  found: number;
  public: number;
  scanDuration: number;
}

const BLOB_PATTERNS = [
  '{keyword}',
  '{keyword}backup',
  '{keyword}backups',
  '{keyword}data',
  '{keyword}assets',
  '{keyword}static',
  '{keyword}public',
  '{keyword}private',
  '{keyword}prod',
  '{keyword}production',
  '{keyword}dev',
  '{keyword}test',
  '{keyword}staging',
  '{keyword}media',
  '{keyword}images',
  '{keyword}files',
  '{keyword}uploads',
  '{keyword}logs',
  '{keyword}cdn',
  '{keyword}storage',
  '{keyword}archive',
  '{keyword}web',
  '{keyword}app',
  '{keyword}api',
];

function generateNames(keyword: string): string[] {
  const clean = keyword.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  return BLOB_PATTERNS.map((p) => p.replace('{keyword}', clean));
}

async function checkBlob(name: string): Promise<AzureBlob> {
  const url = `https://${name}.blob.core.windows.net`;
  const findings: string[] = [];

  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    // 400 = account exists but request malformed, 403 = exists but private, 404 = doesn't exist
    const exists = headRes.status !== 404 && headRes.status !== 0;

    if (!exists) {
      return { name, url, exists: false, accessible: false, isPublic: false, findings: [], riskLevel: 'safe' };
    }

    // Try to list containers
    const listUrl = `${url}?comp=list`;
    let isPublic = false;
    let accessible = false;

    try {
      const listRes = await fetch(listUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (listRes.status === 200) {
        accessible = true;
        isPublic = true;
        findings.push('Storage account publicly accessible — container listing enabled');
      } else if (listRes.status === 403) {
        findings.push('Storage account exists but listing is restricted (private)');
      }
    } catch {
      // ignore
    }

    const riskLevel: AzureBlob['riskLevel'] = isPublic ? 'critical' : accessible ? 'high' : 'safe';

    return { name, url, exists, accessible, isPublic, findings, riskLevel };
  } catch {
    return { name, url, exists: false, accessible: false, isPublic: false, findings: [], riskLevel: 'safe' };
  }
}

export async function performAzureBlobFinding(keyword: string): Promise<AzureBlobResult> {
  const startTime = performance.now();
  logToolActivity('Azure Blob Finder', `Starting scan for keyword: ${keyword}`, 'info');

  const names = generateNames(keyword);
  const results: AzureBlob[] = [];

  const batchSize = 5;
  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(checkBlob));
    results.push(...batchResults);
  }

  const found = results.filter((r) => r.exists).length;
  const pub = results.filter((r) => r.isPublic).length;
  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  logToolActivity('Azure Blob Finder', `Scan complete: ${found} found, ${pub} public`, found > 0 ? 'warning' : 'success');

  return {
    keyword,
    buckets: results,
    total: names.length,
    found,
    public: pub,
    scanDuration,
  };
}
