export interface Breach {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  addedDate: string;
  modifiedDate: string;
  pwnCount: number;
  description: string;
  dataClasses: string[];
  isVerified: boolean;
  isFabricated: boolean;
  isSensitive: boolean;
  isRetired: boolean;
  isSpamList: boolean;
  logoPath?: string;
}

export interface BreachCheckResult {
  email: string;
  isBreached: boolean;
  totalBreaches: number;
  breaches: Breach[];
  riskScore: number;
  dataClassSummary: Record<string, number>;
  oldestBreach?: string;
  newestBreach?: string;
  source?: string;
}

/**
 * Calculate risk score based on breaches
 */
function calculateRiskScore(breaches: Breach[]): number {
  if (breaches.length === 0) return 0;

  let score = 0;

  // More breaches = higher risk
  score += Math.min(breaches.length * 10, 40);

  // Recent breaches are more concerning
  const recentBreaches = breaches.filter(b => {
    const breachYear = new Date(b.breachDate).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - breachYear <= 2;
  });
  score += recentBreaches.length * 5;

  // Sensitive data exposure
  const sensitiveDataClasses = ['Passwords', 'Credit cards', 'Social security numbers', 'Bank account numbers'];
  breaches.forEach(b => {
    const hasSensitiveData = b.dataClasses.some(dc =>
      sensitiveDataClasses.some(sdc => dc.toLowerCase().includes(sdc.toLowerCase()))
    );
    if (hasSensitiveData) score += 15;
  });

  // Large breaches indicate more exposure
  const largeBreaches = breaches.filter(b => b.pwnCount > 10000000);
  score += largeBreaches.length * 5;

  return Math.min(score, 100);
}

/** Map one XposedOrNot breach-analytics detail record to our Breach shape. */
function mapDetail(d: any): Breach {
  const dataClasses = (d.xposed_data ? String(d.xposed_data).split(';') : [])
    .map((s: string) => s.trim())
    .filter(Boolean);
  const year = d.xposed_date ? String(d.xposed_date).slice(0, 4) : '';
  return {
    name: d.breach || 'Unknown',
    title: d.breach || 'Unknown',
    domain: d.domain || '',
    breachDate: year ? `${year}-01-01` : '',
    addedDate: d.added || '',
    modifiedDate: d.added || '',
    pwnCount: Number(d.xposed_records) || 0,
    description: d.details || '',
    dataClasses,
    isVerified: String(d.verified).toLowerCase() === 'yes',
    isFabricated: false,
    isSensitive: /password|credit|ssn|social security|bank/i.test(dataClasses.join(' ')),
    isRetired: false,
    isSpamList: false,
    logoPath: d.logo || undefined,
  };
}

/**
 * Perform a breach check for an email using the XposedOrNot public API
 * (free, no API key). Returns real breach records — never fabricated data.
 * breach-analytics provides per-breach detail; check-email is the fallback for
 * just the list of names.
 */
export async function performBreachCheck(email: string): Promise<BreachCheckResult> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  const notBreached = (): BreachCheckResult => ({
    email, isBreached: false, totalBreaches: 0, breaches: [], riskScore: 0,
    dataClassSummary: {}, source: 'XposedOrNot',
  });

  let details: any[] = [];

  // Primary: breach-analytics (rich per-breach detail).
  try {
    const r = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) {
      const data = await r.json();
      details = data?.ExposedBreaches?.breaches_details || [];
    }
  } catch { /* fall through to check-email */ }

  // Fallback: check-email (names only). 404 there means "not found" = clean.
  if (details.length === 0) {
    try {
      const r = await fetch(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (r.status === 404) return notBreached();
      if (r.ok) {
        const data = await r.json();
        const names: string[] = data?.breaches?.[0] || [];
        if (names.length === 0) return notBreached();
        details = names.map((n) => ({ breach: n }));
      } else {
        throw new Error(`breach service returned HTTP ${r.status}`);
      }
    } catch (e: any) {
      throw new Error(`Breach lookup service unavailable: ${e.message}`);
    }
  }

  if (details.length === 0) return notBreached();

  const breaches = details.map(mapDetail);

  const dataClassSummary: Record<string, number> = {};
  breaches.forEach((b) => b.dataClasses.forEach((dc) => { dataClassSummary[dc] = (dataClassSummary[dc] || 0) + 1; }));

  const years = breaches.map((b) => new Date(b.breachDate).getFullYear()).filter((y) => !isNaN(y));
  const oldestBreach = years.length ? String(Math.min(...years)) : undefined;
  const newestBreach = years.length ? String(Math.max(...years)) : undefined;

  return {
    email,
    isBreached: true,
    totalBreaches: breaches.length,
    breaches,
    riskScore: calculateRiskScore(breaches),
    dataClassSummary,
    oldestBreach,
    newestBreach,
    source: 'XposedOrNot',
  };
}
