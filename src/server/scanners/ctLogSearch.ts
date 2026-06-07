import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CertEntry {
  id: number;
  loggedAt: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  domains: string[];
}

export interface CTSearchResult {
  domain: string;
  certificates: CertEntry[];
  uniqueDomains: string[];
  total: number;
  scanDuration: number;
}

export async function searchCTLogs(
  domain: string,
  includeSubdomains: boolean = true,
  limit: number = 100
): Promise<CTSearchResult> {
  const start = performance.now();
  logToolActivity('CT Log Search', `Searching certificate transparency logs for ${domain}`, 'info');

  const query = includeSubdomains ? `%.${domain}` : domain;
  const url = `https://crt.sh/?q=${encodeURIComponent(query)}&output=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CyberX-Security-Platform/1.0' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`crt.sh returned status ${response.status}`);
    }

    const data: any[] = await response.json();

    // De-duplicate by certificate ID
    const seen = new Set<number>();
    const entries: any[] = [];
    for (const item of data) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        entries.push(item);
      }
    }

    // Apply limit
    const limited = entries.slice(0, limit);

    // Parse entries
    const certificates: CertEntry[] = limited.map((item) => {
      const domains = (item.name_value || '')
        .split('\n')
        .map((d: string) => d.trim())
        .filter(Boolean);

      return {
        id: item.id,
        loggedAt: item.entry_timestamp || item.logged_at || '',
        issuer: item.issuer_name || item.issuer_ca_id?.toString() || 'Unknown',
        notBefore: item.not_before || '',
        notAfter: item.not_after || '',
        domains,
      };
    });

    // Collect unique domains across all certs
    const allDomains = new Set<string>();
    for (const cert of certificates) {
      for (const d of cert.domains) {
        allDomains.add(d.toLowerCase());
      }
    }

    const uniqueDomains = Array.from(allDomains).sort();

    logToolActivity('CT Log Search', `Found ${certificates.length} certificates for ${domain}`, 'success');

    return {
      domain,
      certificates,
      uniqueDomains,
      total: data.length,
      scanDuration: Math.round((performance.now() - start) / 1000),
    };
  } catch (err: any) {
    clearTimeout(timer);
    logToolActivity('CT Log Search', `Search failed: ${err.message}`, 'warning');
    throw err;
  }
}
