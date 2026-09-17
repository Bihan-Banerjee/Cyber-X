import { performance } from 'node:perf_hooks';
import dns from 'node:dns/promises';

export interface HostedDomain {
  domain: string;
  firstSeen?: string;
  lastSeen?: string;
  rank?: number;
  ssl?: boolean;
}

export interface ReverseIPResult {
  ip: string;
  ptr: string;
  totalDomains: number;
  domains: HostedDomain[];
  sharedHosting: boolean;
  hostingProvider?: string;
  scanDuration: number;
  note?: string;
}

/**
 * Perform a reverse IP lookup.
 * - PTR record comes from a real reverse-DNS query.
 * - The co-hosted domain list comes from the HackerTarget reverse-IP API
 *   (free tier, no key, limited daily quota). On quota/no-data/error the tool
 *   still returns the PTR plus a `note`, and never fabricates domains.
 */
export async function performReverseIPLookup(
  ip: string,
  timeoutMs: number = 30000
): Promise<ReverseIPResult> {
  const startTime = performance.now();

  // Real reverse-DNS (PTR)
  let ptr = '';
  try {
    const hostnames = await dns.reverse(ip);
    ptr = hostnames[0] || '';
  } catch {
    ptr = '';
  }

  // Real co-hosted domains via HackerTarget
  let domains: HostedDomain[] = [];
  let note: string | undefined;
  try {
    const r = await fetch(`https://api.hackertarget.com/reverseiplookup/?q=${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(Math.min(timeoutMs, 15000)),
    });
    const text = (await r.text()).trim();
    if (/api count exceeded/i.test(text)) {
      note = 'Reverse-IP API daily quota reached — showing PTR record only.';
    } else if (/error|no dns|no records|invalid/i.test(text)) {
      note = 'No co-hosted domains found for this IP.';
    } else {
      domains = text
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean)
        .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d) && !d.endsWith('.arpa'))
        .slice(0, 500)
        .map((domain) => ({ domain }));
      if (domains.length === 0) note = 'No co-hosted domains found for this IP.';
    }
  } catch (e: any) {
    note = `Reverse-IP lookup service unavailable: ${e.message}`;
  }

  const totalDomains = domains.length;
  const sharedHosting = totalDomains > 1;

  // Hosting provider inferred from the (real) PTR record only.
  let hostingProvider: string | undefined;
  if (ptr) {
    if (/amazon|aws/i.test(ptr)) hostingProvider = 'Amazon Web Services';
    else if (/google|1e100/i.test(ptr)) hostingProvider = 'Google Cloud';
    else if (/digitalocean/i.test(ptr)) hostingProvider = 'DigitalOcean';
    else if (/cloudflare/i.test(ptr)) hostingProvider = 'Cloudflare';
    else if (/microsoft|azure/i.test(ptr)) hostingProvider = 'Microsoft Azure';
    else if (/linode/i.test(ptr)) hostingProvider = 'Linode';
    else if (/hetzner/i.test(ptr)) hostingProvider = 'Hetzner';
  }

  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  return { ip, ptr, totalDomains, domains, sharedHosting, hostingProvider, scanDuration, note };
}
