import dns from 'node:dns/promises';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SPFRecord {
  present: boolean;
  record?: string;
  policy?: string;
  allMechanism?: string;
  valid: boolean;
}

export interface DKIMRecord {
  present: boolean;
  selector?: string;
  record?: string;
  valid: boolean;
}

export interface DMARCRecord {
  present: boolean;
  record?: string;
  policy?: string;
  spfAlignment?: string;
  dkimAlignment?: string;
  valid: boolean;
}

export interface SpoofCheckResult {
  domain: string;
  spf: SPFRecord;
  dkim: DKIMRecord;
  dmarc: DMARCRecord;
  spoofable: boolean;
  verdict: string;
  recommendations: string[];
  scanDuration: number;
}

async function resolveTXT(hostname: string): Promise<string[][]> {
  try {
    return await dns.resolveTxt(hostname);
  } catch {
    return [];
  }
}

async function checkSPF(domain: string): Promise<SPFRecord> {
  const records = await resolveTXT(domain);
  const spfRecords = records
    .map((r) => r.join(''))
    .filter((r) => r.toLowerCase().startsWith('v=spf1'));

  if (spfRecords.length === 0) {
    return { present: false, valid: false };
  }

  const record = spfRecords[0];
  const allMatch = record.match(/[~\-+?]all/i);
  const allMechanism = allMatch ? allMatch[0].toLowerCase() : undefined;

  return {
    present: true,
    record,
    allMechanism,
    policy: allMechanism === '-all' ? 'fail' : allMechanism === '~all' ? 'softfail' : allMechanism === '?all' ? 'neutral' : 'unknown',
    valid: true,
  };
}

async function checkDKIM(domain: string): Promise<DKIMRecord> {
  const SELECTORS = ['default', 'google', 'mail', 'dkim', 'k1', 's1', 's2', 'mx', 'email', 'selector1', 'selector2'];

  for (const selector of SELECTORS) {
    const hostname = `${selector}._domainkey.${domain}`;
    const records = await resolveTXT(hostname);
    const dkimRecords = records
      .map((r) => r.join(''))
      .filter((r) => r.toLowerCase().includes('v=dkim1') || r.toLowerCase().includes('p='));

    if (dkimRecords.length > 0) {
      return {
        present: true,
        selector,
        record: dkimRecords[0],
        valid: true,
      };
    }
  }

  return { present: false, valid: false };
}

async function checkDMARC(domain: string): Promise<DMARCRecord> {
  const records = await resolveTXT(`_dmarc.${domain}`);
  const dmarcRecords = records
    .map((r) => r.join(''))
    .filter((r) => r.toLowerCase().startsWith('v=dmarc1'));

  if (dmarcRecords.length === 0) {
    return { present: false, valid: false };
  }

  const record = dmarcRecords[0];
  const pMatch = record.match(/p=(\w+)/i);
  const aspfMatch = record.match(/aspf=(\w)/i);
  const adkimMatch = record.match(/adkim=(\w)/i);

  return {
    present: true,
    record,
    policy: pMatch ? pMatch[1].toLowerCase() : 'none',
    spfAlignment: aspfMatch ? aspfMatch[1].toLowerCase() : 'r',
    dkimAlignment: adkimMatch ? adkimMatch[1].toLowerCase() : 'r',
    valid: true,
  };
}

export async function checkEmailSpoofability(domain: string): Promise<SpoofCheckResult> {
  const start = performance.now();
  logToolActivity('Spoofed Email Checker', `Checking email spoofability for ${domain}`, 'info');

  const [spf, dkim, dmarc] = await Promise.all([
    checkSPF(domain),
    checkDKIM(domain),
    checkDMARC(domain),
  ]);

  const recommendations: string[] = [];

  // Determine if domain can be spoofed
  let spoofable = false;

  if (!dmarc.present) {
    spoofable = true;
    recommendations.push('Add a DMARC record: _dmarc.' + domain + ' TXT "v=DMARC1; p=reject; rua=mailto:dmarc@' + domain + '"');
  } else if (dmarc.policy === 'none') {
    spoofable = true;
    recommendations.push('Change DMARC policy from "none" to "quarantine" or "reject" to prevent spoofing.');
  }

  if (!spf.present) {
    spoofable = true;
    recommendations.push(`Add an SPF record: ${domain} TXT "v=spf1 mx -all"`);
  } else if (spf.allMechanism === '+all' || spf.allMechanism === '?all') {
    spoofable = true;
    recommendations.push('Change your SPF record\'s "all" mechanism from "+" or "?" to "-all" (fail) or at minimum "~all" (softfail).');
  }

  if (!dkim.present) {
    recommendations.push('Set up DKIM signing for your outgoing email. Contact your email provider for the DKIM public key and DNS record to add.');
  }

  if (!spoofable && recommendations.length === 0) {
    recommendations.push('Your email configuration looks good! Continue monitoring with DMARC reports.');
  }

  const verdict = spoofable
    ? 'DOMAIN CAN BE SPOOFED'
    : 'DOMAIN IS PROTECTED';

  logToolActivity('Spoofed Email Checker', `${domain}: spoofable=${spoofable}`, 'success');

  return {
    domain,
    spf,
    dkim,
    dmarc,
    spoofable,
    verdict,
    recommendations,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
