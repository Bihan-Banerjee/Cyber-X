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
}

/**
 * Generate mock domains for demonstration
 */
function generateMockDomains(ip: string): HostedDomain[] {
  const domains: HostedDomain[] = [];
  
  // Generate 15-50 random domains
  const domainCount = Math.floor(Math.random() * 35) + 15;
  
  const tlds = ['.com', '.net', '.org', '.io', '.co', '.dev', '.app', '.tech'];
  const prefixes = ['www', 'api', 'blog', 'shop', 'admin', 'mail', 'cdn', 'portal'];
  const words = ['tech', 'cloud', 'data', 'soft', 'web', 'net', 'digital', 'solutions', 
                 'services', 'systems', 'group', 'media', 'platform', 'hub', 'lab'];
  
  for (let i = 0; i < domainCount; i++) {
    const hasPrefix = Math.random() > 0.7;
    const prefix = hasPrefix ? prefixes[Math.floor(Math.random() * prefixes.length)] + '.' : '';
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const tld = tlds[Math.floor(Math.random() * tlds.length)];
    
    const domain = `${prefix}${word1}${word2}${tld}`;
    const rank = Math.random() > 0.8 ? Math.floor(Math.random() * 10000) + 1 : undefined;
    const ssl = Math.random() > 0.3;
    
    const daysAgo = Math.floor(Math.random() * 365);
    const lastSeen = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    domains.push({
      domain,
      lastSeen,
      rank,
      ssl,
    });
  }
  
  return domains;
}

/**
 * Perform reverse IP lookup
 */
export async function performReverseIPLookup(
  ip: string,
  timeoutMs: number = 30000
): Promise<ReverseIPResult> {
  const startTime = performance.now();
  
  // Try to get PTR record
  let ptr = '';
  try {
    const hostnames = await dns.reverse(ip);
    ptr = hostnames[0] || '';
  } catch (error) {
    // PTR record not found
    ptr = '';
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock domains
  const domains = generateMockDomains(ip);
  
  const totalDomains = domains.length;
  const sharedHosting = totalDomains > 1;
  
  // Determine hosting provider from PTR or mock
  let hostingProvider: string | undefined;
  if (ptr) {
    if (ptr.includes('amazon') || ptr.includes('aws')) hostingProvider = 'Amazon Web Services';
    else if (ptr.includes('google')) hostingProvider = 'Google Cloud';
    else if (ptr.includes('digitalocean')) hostingProvider = 'DigitalOcean';
    else if (ptr.includes('cloudflare')) hostingProvider = 'Cloudflare';
  } else {
    const providers = ['Amazon Web Services', 'Google Cloud', 'DigitalOcean', 'Linode', 'Vultr', 'Hetzner'];
    hostingProvider = Math.random() > 0.5 ? providers[Math.floor(Math.random() * providers.length)] : undefined;
  }
  
  const scanDuration = Math.round((performance.now() - startTime) / 1000);
  
  return {
    ip,
    ptr,
    totalDomains,
    domains,
    sharedHosting,
    hostingProvider,
    scanDuration,
  };
}
