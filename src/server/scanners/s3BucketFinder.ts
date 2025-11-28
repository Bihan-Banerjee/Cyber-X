import { performance } from 'node:perf_hooks';

export interface S3Bucket {
  name: string;
  url: string;
  exists: boolean;
  accessible: boolean;
  region?: string;
  objects?: number;
  totalSize?: string;
  lastModified?: string;
  permissions: {
    read: boolean;
    write: boolean;
    list: boolean;
  };
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  findings: string[];
}

export interface S3FinderResult {
  target: string;
  totalTested: number;
  foundBuckets: number;
  accessibleBuckets: number;
  buckets: S3Bucket[];
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    safe: number;
  };
  scanDuration: number;
}

// Common S3 bucket naming patterns
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
  '{keyword}.com',
  'www.{keyword}.com',
  '{keyword}-web',
  '{keyword}-app',
  '{keyword}-api',
];

/**
 * Check if S3 bucket exists
 */
async function checkBucket(bucketName: string): Promise<S3Bucket> {
  const url = `https://${bucketName}.s3.amazonaws.com/`;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    const exists = response.status !== 404;

    if (!exists) {
      return {
        name: bucketName,
        url,
        exists: false,
        accessible: false,
        permissions: { read: false, write: false, list: false },
        riskLevel: 'safe',
        findings: [],
      };
    }

    // Check permissions
    const permissions = await checkPermissions(url);
    const { riskLevel, findings } = assessRisk(permissions, response.status);

    // Attempt to get region
    const region = response.headers.get('x-amz-bucket-region') || 'us-east-1';

    return {
      name: bucketName,
      url,
      exists: true,
      accessible: permissions.read || permissions.list,
      region,
      permissions,
      riskLevel,
      findings,
    };
  } catch (error) {
    return {
      name: bucketName,
      url,
      exists: false,
      accessible: false,
      permissions: { read: false, write: false, list: false },
      riskLevel: 'safe',
      findings: [],
    };
  }
}

/**
 * Check bucket permissions
 */
async function checkPermissions(
  url: string
): Promise<{ read: boolean; write: boolean; list: boolean }> {
  const permissions = {
    read: false,
    write: false,
    list: false,
  };

  try {
    // Check LIST permission
    const listResponse = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (listResponse.status === 200) {
      permissions.list = true;
      permissions.read = true; // If we can list, we can likely read
    } else if (listResponse.status === 403) {
      // Bucket exists but listing is forbidden
      permissions.read = false;
      permissions.list = false;
    }

    // Check READ permission on root
    const readResponse = await fetch(`${url}index.html`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (readResponse.status === 200 || readResponse.status === 404) {
      // 404 means we can access but file doesn't exist (still readable)
      permissions.read = true;
    }

  } catch (error) {
    // Permissions check failed, assume no access
  }

  return permissions;
}

/**
 * Assess risk level based on permissions
 */
function assessRisk(
  permissions: { read: boolean; write: boolean; list: boolean },
  status: number
): { riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe'; findings: string[] } {
  const findings: string[] = [];

  if (permissions.write) {
    findings.push('Write access enabled - anyone can upload files');
    return { riskLevel: 'critical', findings };
  }

  if (permissions.list && permissions.read) {
    findings.push('Public read and list access enabled');
    findings.push('All bucket contents are publicly accessible');
    return { riskLevel: 'critical', findings };
  }

  if (permissions.list) {
    findings.push('Public list access enabled - bucket contents can be enumerated');
    return { riskLevel: 'high', findings };
  }

  if (permissions.read) {
    findings.push('Public read access enabled for known files');
    return { riskLevel: 'medium', findings };
  }

  if (status === 403) {
    findings.push('Bucket exists but access is forbidden (properly configured)');
    return { riskLevel: 'safe', findings };
  }

  return { riskLevel: 'low', findings };
}

/**
 * Generate bucket names from keyword
 */
function generateBucketNames(keyword: string): string[] {
  const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  
  return BUCKET_PATTERNS.map(pattern => 
    pattern.replace('{keyword}', cleanKeyword)
  );
}

/**
 * Perform S3 bucket discovery
 */
export async function performS3BucketFinding(
  keyword: string,
  timeoutMs: number = 60000
): Promise<S3FinderResult> {
  const startTime = performance.now();

  const bucketNames = generateBucketNames(keyword);
  const buckets: S3Bucket[] = [];

  // Check buckets in batches
  const batchSize = 10;
  for (let i = 0; i < bucketNames.length; i += batchSize) {
    const batch = bucketNames.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(name => checkBucket(name))
    );
    buckets.push(...batchResults);
  }

  const foundBuckets = buckets.filter(b => b.exists).length;
  const accessibleBuckets = buckets.filter(b => b.accessible).length;

  const riskSummary = {
    critical: buckets.filter(b => b.riskLevel === 'critical').length,
    high: buckets.filter(b => b.riskLevel === 'high').length,
    medium: buckets.filter(b => b.riskLevel === 'medium').length,
    low: buckets.filter(b => b.riskLevel === 'low').length,
    safe: buckets.filter(b => b.riskLevel === 'safe').length,
  };

  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  return {
    target: keyword,
    totalTested: bucketNames.length,
    foundBuckets,
    accessibleBuckets,
    buckets,
    riskSummary,
    scanDuration,
  };
}
