import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';
import dns from 'node:dns/promises';

export interface ReputationSource {
  name: string;
  flagged: boolean;
  details?: string;
}

export interface DomainReputationResult {
  domain: string;
  overallScore: number;
  categories: string[];
  malicious: boolean;
  phishing: boolean;
  spam: boolean;
  age?: string;
  registrar?: string;
  sources: ReputationSource[];
}

const DNSBL_LISTS = [
  'zen.spamhaus.org',
  'bl.spamcop.net',
  'b.barracudacentral.org',
];

async function checkDNSBL(domain: string): Promise<{ listed: boolean; lists: string[] }> {
  const listed: string[] = [];
  for (const dnsbl of DNSBL_LISTS) {
    try {
      const lookup = `${domain}.${dnsbl}`;
      await dns.resolve4(lookup);
      listed.push(dnsbl);
    } catch {
      // Not listed or timeout — fine
    }
  }
  return { listed: listed.length > 0, lists: listed };
}

async function getDomainAge(domain: string): Promise<string | undefined> {
  try {
    const txt = await dns.resolveSoa(domain);
    if (txt.serial) {
      const serial = txt.serial.toString();
      if (serial.length === 10) {
        const year = serial.slice(0, 4);
        const month = serial.slice(4, 6);
        const day = serial.slice(6, 8);
        return `${year}-${month}-${day}`;
      }
    }
  } catch { /* noop */ }
  return undefined;
}

export async function checkDomainReputation(domain: string): Promise<DomainReputationResult> {
  const start = performance.now();

  logToolActivity('Domain Reputation', `Checking reputation for ${domain}`, 'info');

  const sources: ReputationSource[] = [];
  let malicious = false;
  let phishing = false;
  let spam = false;
  const categories: string[] = [];
  let age: string | undefined;
  let registrar: string | undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Check PhishTank (free JSON feed)
    try {
      const phishRes = await fetch(
        `https://checkurl.phishtank.com/checkurl/?url=${encodeURIComponent('https://' + domain)}&format=json`,
        { signal: controller.signal, headers: { 'Accept': 'application/json' } }
      );
      if (phishRes.ok) {
        const phishData = await phishRes.json();
        if (phishData.results?.in_database && phishData.results?.valid) {
          phishing = true;
          categories.push('Phishing');
          sources.push({ name: 'PhishTank', flagged: true, details: 'Confirmed phishing' });
        } else {
          sources.push({ name: 'PhishTank', flagged: false, details: 'Not in database' });
        }
      }
    } catch {
      sources.push({ name: 'PhishTank', flagged: false, details: 'Unavailable' });
    }

    // DNSBL check
    try {
      const dnsbl = await checkDNSBL(domain);
      if (dnsbl.listed) {
        spam = true;
        categories.push('Spam');
        sources.push({ name: 'DNSBL', flagged: true, details: `Listed in: ${dnsbl.lists.join(', ')}` });
      } else {
        sources.push({ name: 'DNSBL', flagged: false, details: 'Not listed' });
      }
    } catch {
      sources.push({ name: 'DNSBL', flagged: false, details: 'Check failed' });
    }

    // VirusTotal (if API key present)
    const vtKey = process.env.VT_API_KEY;
    if (vtKey) {
      try {
        const vtRes = await fetch(
          `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`,
          { signal: controller.signal, headers: { 'x-apikey': vtKey } }
        );
        if (vtRes.ok) {
          const vtData = await vtRes.json();
          const stats = vtData.data?.attributes?.last_analysis_stats;
          if (stats) {
            const flagged = (stats.malicious || 0) + (stats.suspicious || 0);
            if (flagged > 2) malicious = true;
            sources.push({
              name: 'VirusTotal',
              flagged: flagged > 0,
              details: `${flagged} engines flagged (${stats.malicious} malicious, ${stats.suspicious} suspicious)`,
            });
            if (vtData.data?.attributes?.categories) {
              const cats = Object.values(vtData.data.attributes.categories) as string[];
              categories.push(...cats.slice(0, 3));
            }
            registrar = vtData.data?.attributes?.registrar;
          }
        }
      } catch {
        sources.push({ name: 'VirusTotal', flagged: false, details: 'API error' });
      }
    } else {
      sources.push({ name: 'VirusTotal', flagged: false, details: 'No API key (set VT_API_KEY)' });
    }

    // Domain age
    age = await getDomainAge(domain).catch(() => undefined);

    clearTimeout(timeout);

    // Calculate score
    let score = 100;
    if (malicious) score -= 40;
    if (phishing) score -= 40;
    if (spam) score -= 20;
    score = Math.max(0, score);

    if (!categories.includes('Web') && !malicious && !phishing && !spam) {
      categories.push('Web');
    }

    logToolActivity('Domain Reputation', `Check complete for ${domain}: score=${score}`, 'success');

    return {
      domain,
      overallScore: score,
      categories: [...new Set(categories)],
      malicious,
      phishing,
      spam,
      age,
      registrar,
      sources,
    };
  } catch (error: any) {
    clearTimeout(timeout);
    logToolActivity('Domain Reputation', `Check failed: ${error.message}`, 'warning');
    throw error;
  }
}
