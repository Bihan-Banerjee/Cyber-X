import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CVEItem {
  id: string;
  description: string;
  cvssScore: number | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN';
  publishedDate: string;
  lastModified: string;
  references: string[];
  affectedProducts: string[];
}

export interface CVESearchResult {
  results: CVEItem[];
  total: number;
  query: string;
  scanDuration: number;
}

function scoreToSeverity(score: number | null): CVEItem['severity'] {
  if (score === null) return 'UNKNOWN';
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'NONE';
}

export async function searchCVE(
  query: string,
  limit: number = 20
): Promise<CVESearchResult> {
  const start = performance.now();
  logToolActivity('CVE Search', `Searching NVD for: ${query}`, 'info');

  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const encodedQuery = encodeURIComponent(query.trim());
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodedQuery}&resultsPerPage=${safeLimit}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CyberX-Security-Platform/1.0',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('NVD API rate limit exceeded. Please wait 30 seconds and try again.');
      }
      throw new Error(`NVD API returned ${response.status}`);
    }

    const data = await response.json();
    const vulnerabilities: any[] = data.vulnerabilities || [];

    const results: CVEItem[] = vulnerabilities.map((item: any) => {
      const cve = item.cve;

      // Description
      const descriptions: any[] = cve.descriptions || [];
      const desc = descriptions.find((d: any) => d.lang === 'en')?.value || 'No description available.';

      // CVSS score — try v3.1 first, then v3.0, then v2
      let cvssScore: number | null = null;
      const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore;
      const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore;
      const v2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore;
      cvssScore = v31 ?? v30 ?? v2 ?? null;

      // References
      const references: string[] = (cve.references || []).slice(0, 5).map((r: any) => r.url);

      // Affected products (CPE configurations)
      const configs: any[] = cve.configurations || [];
      const products: string[] = [];
      for (const config of configs) {
        const nodes: any[] = config.nodes || [];
        for (const node of nodes) {
          const cpeMatches: any[] = node.cpeMatch || [];
          for (const match of cpeMatches.slice(0, 3)) {
            const cpe = match.criteria || '';
            // Parse CPE: cpe:2.3:a:vendor:product:version
            const parts = cpe.split(':');
            if (parts.length >= 5) {
              const vendor = parts[3] !== '*' ? parts[3] : '';
              const product = parts[4] !== '*' ? parts[4] : '';
              const version = parts[5] !== '*' && parts[5] !== '-' ? ` ${parts[5]}` : '';
              if (product) products.push(`${vendor ? vendor + ' ' : ''}${product}${version}`);
            }
          }
        }
      }

      return {
        id: cve.id,
        description: desc.length > 300 ? desc.substring(0, 300) + '...' : desc,
        cvssScore,
        severity: scoreToSeverity(cvssScore),
        publishedDate: cve.published || '',
        lastModified: cve.lastModified || '',
        references,
        affectedProducts: [...new Set(products)].slice(0, 10),
      };
    });

    logToolActivity('CVE Search', `Found ${results.length} CVEs for "${query}"`, 'success');

    return {
      results,
      total: data.totalResults || results.length,
      query,
      scanDuration: Math.round((performance.now() - start) / 1000),
    };
  } catch (err: any) {
    clearTimeout(timer);
    logToolActivity('CVE Search', `Search failed: ${err.message}`, 'warning');
    throw err;
  }
}
