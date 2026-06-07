import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CloudAsset {
  provider: string;
  name: string;
  url: string;
  status: 'public' | 'exists' | 'private' | 'not found';
  details?: string;
}

export interface CloudAssetResult {
  assets: CloudAsset[];
}

async function checkURL(url: string, provider: string, name: string, timeoutMs: number): Promise<CloudAsset> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    const body = await res.text().catch(() => '');
    let status: CloudAsset['status'] = 'not found';
    let details: string | undefined;

    if (res.status === 200) {
      // Check if it's actually public and has content
      if (body.includes('AccessDenied') || body.includes('NoSuchBucket') || body.includes('The specified bucket does not exist')) {
        status = 'not found';
      } else if (body.includes('ListBucketResult') || body.includes('EnumerationResults') || body.includes('"name"')) {
        status = 'public';
        details = 'Storage listing is publicly accessible';
      } else {
        status = 'exists';
      }
    } else if (res.status === 403 || res.status === 401) {
      status = 'private';
      details = `Accessible but restricted (HTTP ${res.status})`;
    } else if (res.status === 404 || res.status === 400) {
      status = 'not found';
    } else {
      status = 'exists';
    }

    return { provider, name, url, status, details };
  } catch {
    return { provider, name, url, status: 'not found' };
  }
}

export async function enumerateCloudAssets(domain: string, organization: string = ''): Promise<CloudAssetResult> {
  const start = performance.now();
  logToolActivity('Cloud Asset Enumerator', `Enumerating assets for ${domain}`, 'info');

  const orgName = organization || domain.split('.')[0];
  const domainBase = domain.replace(/\./g, '-');

  const checks: Array<{ provider: string; name: string; url: string }> = [
    // AWS S3
    { provider: 'AWS', name: `${orgName} (S3)`, url: `https://${orgName}.s3.amazonaws.com` },
    { provider: 'AWS', name: `${domainBase} (S3)`, url: `https://${domainBase}.s3.amazonaws.com` },
    { provider: 'AWS', name: `${orgName}-backup (S3)`, url: `https://${orgName}-backup.s3.amazonaws.com` },
    { provider: 'AWS', name: `${orgName}-assets (S3)`, url: `https://${orgName}-assets.s3.amazonaws.com` },
    { provider: 'AWS', name: `${orgName}-dev (S3)`, url: `https://${orgName}-dev.s3.amazonaws.com` },
    { provider: 'AWS', name: `${orgName}-prod (S3)`, url: `https://${orgName}-prod.s3.amazonaws.com` },
    // Azure Blob
    { provider: 'Azure', name: `${orgName} (Blob)`, url: `https://${orgName}.blob.core.windows.net` },
    { provider: 'Azure', name: `${orgName}backup (Blob)`, url: `https://${orgName}backup.blob.core.windows.net` },
    { provider: 'Azure', name: `${orgName}assets (Blob)`, url: `https://${orgName}assets.blob.core.windows.net` },
    // GCP
    { provider: 'GCP', name: `${orgName} (GCS)`, url: `https://storage.googleapis.com/${orgName}` },
    { provider: 'GCP', name: `${domainBase} (GCS)`, url: `https://storage.googleapis.com/${domainBase}` },
    { provider: 'GCP', name: `${orgName}-assets (GCS)`, url: `https://storage.googleapis.com/${orgName}-assets` },
    // Firebase
    { provider: 'Firebase', name: `${orgName} (Realtime DB)`, url: `https://${orgName}-default-rtdb.firebaseio.com/.json` },
    { provider: 'Firebase', name: `${orgName} (Hosting)`, url: `https://${orgName}.web.app` },
  ];

  const results = await Promise.all(
    checks.map((c) => checkURL(c.url, c.provider, c.name, 5000))
  );

  const publicAssets = results.filter((r) => r.status === 'public').length;
  logToolActivity('Cloud Asset Enumerator', `Found ${publicAssets} public assets`, publicAssets > 0 ? 'warning' : 'success');

  return { assets: results };
}
