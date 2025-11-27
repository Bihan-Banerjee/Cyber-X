import dns from 'node:dns/promises';
import { performance } from 'node:perf_hooks';

export interface Subdomain {
  subdomain: string;
  ip?: string;
  status: 'active' | 'inactive';
  responseTime?: number;
  records?: {
    A?: string[];
    AAAA?: string[];
    CNAME?: string[];
    MX?: string[];
  };
}

export interface SubdomainResult {
  domain: string;
  totalFound: number;
  subdomains: Subdomain[];
  scanDuration: number;
  method: string;
}

// Common subdomain wordlist
const COMMON_SUBDOMAINS = [
  'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'ns2',
  'webdisk', 'ns', 'admin', 'mobile', 'remote', 'blog', 'dev', 'api', 'test',
  'staging', 'beta', 'old', 'new', 'shop', 'forum', 'community', 'portal',
  'email', 'secure', 'vpn', 'git', 'cdn', 'static', 'assets', 'img', 'images',
  'media', 'download', 'downloads', 'files', 'support', 'help', 'docs',
  'documentation', 'status', 'monitor', 'dashboard', 'panel', 'cpanel',
  'whm', 'dns', 'dns1', 'dns2', 'ns3', 'ns4', 'mail1', 'mail2', 'smtp1',
  'smtp2', 'pop3', 'imap', 'exchange', 'autodiscover', 'autoconfig',
  'mx', 'mx1', 'mx2', 'backup', 'db', 'database', 'mysql', 'sql', 'postgres',
  'redis', 'cache', 'app', 'apps', 'cloud', 'server', 'host', 'demo', 'sandbox',
  'lab', 'prod', 'production', 'stage', 'uat', 'qa', 'ci', 'jenkins',
  'gitlab', 'github', 'bitbucket', 'jira', 'confluence', 'wiki', 'intranet',
  'extranet', 'internal', 'external', 'public', 'private', 'member', 'members',
  'user', 'users', 'account', 'accounts', 'login', 'signin', 'signup',
  'register', 'auth', 'oauth', 'sso', 'ldap', 'ad', 'directory',
];

/**
 * Check if subdomain exists and get its IP
 */
async function checkSubdomain(
  subdomain: string,
  timeoutMs: number
): Promise<Subdomain> {
  const start = performance.now();

  try {
    // Try A record lookup
    const addresses = await Promise.race([
      dns.resolve4(subdomain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);

    const responseTime = Math.round(performance.now() - start);

    return {
      subdomain,
      ip: addresses[0],
      status: 'active',
      responseTime,
      records: {
        A: addresses,
      },
    };
  } catch (error: any) {
    // Try CNAME record if A record fails
    try {
      const cnames = await dns.resolveCname(subdomain);
      const responseTime = Math.round(performance.now() - start);

      return {
        subdomain,
        status: 'active',
        responseTime,
        records: {
          CNAME: cnames,
        },
      };
    } catch {
      return {
        subdomain,
        status: 'inactive',
      };
    }
  }
}

/**
 * Perform subdomain enumeration
 */
export async function performSubdomainEnumeration(
  domain: string,
  timeoutMs: number = 3000
): Promise<SubdomainResult> {
  const startTime = Date.now();

  // Clean domain
  const cleanDomain = domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  // Generate subdomain list
  const subdomainList = COMMON_SUBDOMAINS.map((sub) => `${sub}.${cleanDomain}`);

  // Also check the main domain
  subdomainList.unshift(cleanDomain);
  subdomainList.unshift(`www.${cleanDomain}`);

  // Check subdomains in batches to avoid overwhelming DNS
  const batchSize = 10;
  const results: Subdomain[] = [];

  for (let i = 0; i < subdomainList.length; i += batchSize) {
    const batch = subdomainList.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((sub) => checkSubdomain(sub, timeoutMs))
    );
    results.push(...batchResults);
  }

  // Filter out duplicates and sort
  const uniqueSubdomains = results.filter(
    (sub, index, self) =>
      index === self.findIndex((s) => s.subdomain === sub.subdomain)
  );

  // Sort: active first, then by subdomain name
  uniqueSubdomains.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }
    return a.subdomain.localeCompare(b.subdomain);
  });

  const scanDuration = Math.round((Date.now() - startTime) / 1000);

  return {
    domain: cleanDomain,
    totalFound: uniqueSubdomains.filter((s) => s.status === 'active').length,
    subdomains: uniqueSubdomains,
    scanDuration,
    method: 'DNS Brute Force',
  };
}
