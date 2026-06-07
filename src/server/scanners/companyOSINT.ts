import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CompanyResult {
  company: string;
  domain?: string;
  subdomains: string[];
  emails: string[];
  socialProfiles: Array<{ platform: string; url: string; found: boolean }>;
  cloudAssets: Array<{ provider: string; asset: string; status: string }>;
  techStack: string[];
  certData: Array<{ cn: string; issuer: string; date: string }>;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CyberX-OSINT/1.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchCertSH(domain: string): Promise<Array<{ cn: string; issuer: string; date: string }>> {
  try {
    const data = await fetchWithTimeout(
      `https://crt.sh/?q=%.${domain}&output=json`,
      8000
    );
    if (!Array.isArray(data)) return [];
    return data.slice(0, 50).map((cert: any) => ({
      cn: cert.common_name ?? '',
      issuer: cert.issuer_name ?? '',
      date: cert.entry_timestamp ?? '',
    }));
  } catch {
    return [];
  }
}

async function extractSubdomainsFromCerts(
  certData: Array<{ cn: string }>
): Promise<string[]> {
  const subdomains = new Set<string>();
  for (const { cn } of certData) {
    if (cn && cn.includes('.')) {
      subdomains.add(cn.replace(/^\*\./, ''));
    }
  }
  return [...subdomains];
}

async function detectTechStack(domain: string): Promise<string[]> {
  const tech: string[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://${domain}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v.toLowerCase(); });

    if (headers['x-powered-by']?.includes('php')) tech.push('PHP');
    if (headers['x-powered-by']?.includes('asp')) tech.push('ASP.NET');
    if (headers['x-powered-by']?.includes('express')) tech.push('Express.js');
    if (headers['server']?.includes('nginx')) tech.push('Nginx');
    if (headers['server']?.includes('apache')) tech.push('Apache');
    if (headers['server']?.includes('iis')) tech.push('IIS');
    if (headers['server']?.includes('cloudflare')) tech.push('Cloudflare');
    if (headers['cf-ray']) tech.push('Cloudflare');
    if (headers['x-vercel-id']) tech.push('Vercel');
    if (headers['x-amzn-requestid']) tech.push('AWS');

    const body = await res.text().catch(() => '');
    if (body.includes('react') || body.includes('__REACT')) tech.push('React');
    if (body.includes('angular') || body.includes('ng-version')) tech.push('Angular');
    if (body.includes('vue.js') || body.includes('__vue__')) tech.push('Vue.js');
    if (body.includes('wordpress') || body.includes('wp-content')) tech.push('WordPress');
    if (body.includes('drupal')) tech.push('Drupal');
    if (body.includes('joomla')) tech.push('Joomla');
    if (body.includes('shopify')) tech.push('Shopify');
    if (body.includes('jquery')) tech.push('jQuery');
    if (body.includes('bootstrap')) tech.push('Bootstrap');
    if (body.includes('tailwind')) tech.push('Tailwind CSS');
  } catch {}
  return [...new Set(tech)];
}

const SOCIAL_PLATFORMS = [
  { platform: 'LinkedIn', template: (company: string) => `https://www.linkedin.com/company/${company.toLowerCase().replace(/\s+/g, '-')}` },
  { platform: 'Twitter', template: (company: string) => `https://twitter.com/${company.toLowerCase().replace(/\s+/g, '')}` },
  { platform: 'GitHub', template: (company: string) => `https://github.com/${company.toLowerCase().replace(/\s+/g, '')}` },
  { platform: 'Facebook', template: (company: string) => `https://www.facebook.com/${company.toLowerCase().replace(/\s+/g, '')}` },
  { platform: 'YouTube', template: (company: string) => `https://www.youtube.com/c/${company.toLowerCase().replace(/\s+/g, '')}` },
  { platform: 'Instagram', template: (company: string) => `https://www.instagram.com/${company.toLowerCase().replace(/\s+/g, '')}` },
];

async function checkSocialProfiles(company: string): Promise<Array<{ platform: string; url: string; found: boolean }>> {
  const results = await Promise.all(
    SOCIAL_PLATFORMS.map(async ({ platform, template }) => {
      const url = template(company);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);
        return { platform, url, found: res.status === 200 };
      } catch {
        return { platform, url, found: false };
      }
    })
  );
  return results;
}

export async function performCompanyOSINT(company: string, domain?: string): Promise<CompanyResult> {
  const start = performance.now();
  logToolActivity('Company OSINT', `Gathering intel on "${company}"`, 'info');

  const certData = domain ? await fetchCertSH(domain) : [];
  const subdomains = domain ? await extractSubdomainsFromCerts(certData) : [];
  const techStack = domain ? await detectTechStack(domain) : [];
  const socialProfiles = await checkSocialProfiles(company);

  // Emails (if Hunter API key is set)
  const emails: string[] = [];
  const hunterKey = process.env.HUNTER_API_KEY;
  if (hunterKey && domain) {
    try {
      const data = await fetchWithTimeout(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}`,
        5000
      );
      if (data?.data?.emails) {
        for (const e of data.data.emails.slice(0, 20)) {
          emails.push(e.value);
        }
      }
    } catch {}
  }

  // Cloud assets (basic check)
  const cloudAssets: Array<{ provider: string; asset: string; status: string }> = [];
  if (domain) {
    const orgName = domain.split('.')[0];
    const cloudChecks = [
      { provider: 'AWS S3', url: `https://${orgName}.s3.amazonaws.com` },
      { provider: 'Azure Blob', url: `https://${orgName}.blob.core.windows.net` },
      { provider: 'GCP Storage', url: `https://storage.googleapis.com/${orgName}` },
      { provider: 'Firebase', url: `https://${orgName}-default-rtdb.firebaseio.com/.json` },
    ];

    await Promise.all(
      cloudChecks.map(async ({ provider, url }) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timer);
          const status = res.status === 200 ? 'public' : res.status < 500 ? 'exists' : 'not found';
          cloudAssets.push({ provider, asset: url, status });
        } catch {
          cloudAssets.push({ provider, asset: url, status: 'not found' });
        }
      })
    );
  }

  logToolActivity('Company OSINT', `Intel gathered for "${company}"`, 'success');

  return {
    company,
    domain,
    subdomains,
    emails,
    socialProfiles,
    cloudAssets,
    techStack,
    certData: certData.slice(0, 20),
  };
}
