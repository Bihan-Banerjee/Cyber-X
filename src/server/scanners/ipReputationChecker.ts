import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface ReputationSource {
  name: string;
  flagged: boolean;
  details?: string;
}

export interface IPReputationResult {
  ip: string;
  abuseScore: number;
  isMalicious: boolean;
  isProxy: boolean;
  isVPN: boolean;
  isTor: boolean;
  isBotnet: boolean;
  country: string;
  org: string;
  recentReports: number;
  sources: ReputationSource[];
}

export async function checkIPReputation(ip: string): Promise<IPReputationResult> {
  const start = performance.now();

  logToolActivity('IP Reputation Checker', `Checking reputation for ${ip}`, 'info');

  const sources: ReputationSource[] = [];
  let abuseScore = 0;
  let isMalicious = false;
  let isProxy = false;
  let isVPN = false;
  let isTor = false;
  let isBotnet = false;
  let country = 'Unknown';
  let org = 'Unknown';
  let recentReports = 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // Query ipinfo.io for basic info (no auth required for basic data)
    try {
      const ipinfoRes = await fetch(`https://ipinfo.io/${ip}/json`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (ipinfoRes.ok) {
        const ipinfoData = await ipinfoRes.json();
        country = ipinfoData.country || 'Unknown';
        org = ipinfoData.org || ipinfoData.hostname || 'Unknown';
        sources.push({ name: 'ipinfo.io', flagged: false, details: `${country}, ${org}` });
      }
    } catch {
      sources.push({ name: 'ipinfo.io', flagged: false, details: 'Unavailable' });
    }

    // Query AbuseIPDB if API key is set
    const abuseKey = process.env.ABUSEIPDB_API_KEY;
    if (abuseKey) {
      try {
        const abuseRes = await fetch(
          `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
          {
            signal: controller.signal,
            headers: {
              'Key': abuseKey,
              'Accept': 'application/json',
            },
          }
        );
        if (abuseRes.ok) {
          const abuseData = await abuseRes.json();
          const d = abuseData.data;
          if (d) {
            abuseScore = d.abuseConfidenceScore || 0;
            isMalicious = abuseScore > 50;
            isProxy = !!d.isPublic === false;
            recentReports = d.totalReports || 0;
            sources.push({
              name: 'AbuseIPDB',
              flagged: abuseScore > 0,
              details: `Score: ${abuseScore}/100, Reports: ${d.totalReports}`,
            });
          }
        }
      } catch {
        sources.push({ name: 'AbuseIPDB', flagged: false, details: 'API error' });
      }
    } else {
      sources.push({ name: 'AbuseIPDB', flagged: false, details: 'No API key configured (set ABUSEIPDB_API_KEY)' });
    }

    // Check for Tor exit nodes via public list
    try {
      const torRes = await fetch('https://check.torproject.org/torbulkexitlist', {
        signal: controller.signal,
      });
      if (torRes.ok) {
        const torList = await torRes.text();
        isTor = torList.includes(ip);
        sources.push({ name: 'Tor Exit List', flagged: isTor, details: isTor ? 'Known Tor exit node' : 'Not in Tor list' });
      }
    } catch {
      sources.push({ name: 'Tor Exit List', flagged: false, details: 'Unavailable' });
    }

  } finally {
    clearTimeout(timeout);
  }

  logToolActivity('IP Reputation Checker', `Completed reputation check for ${ip}`, 'success');

  return {
    ip,
    abuseScore,
    isMalicious,
    isProxy,
    isVPN,
    isTor,
    isBotnet,
    country,
    org,
    recentReports,
    sources,
  };
}
