// The `whois` package is CommonJS and assigns its API via `module.exports = {...}`,
// which esbuild/tsx does not hoist into named ESM bindings — `import * as whois`
// leaves `whois.lookup` undefined. A default import binds the whole exports object.
import whoisModule from 'whois';
const whois = whoisModule as unknown as {
  lookup: (
    domain: string,
    options: { timeout?: number; follow?: number },
    cb: (err: Error | null, data?: string | string[]) => void,
  ) => void;
};

export interface WHOISResult {
  domain: string;
  source?: 'whois' | 'RDAP';
  registrar?: string;
  registrarURL?: string;
  createdDate?: string;
  updatedDate?: string;
  expiryDate?: string;
  status?: string[];
  nameServers?: string[];
  registrant?: {
    name?: string;
    organization?: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  admin?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  tech?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  dnssec?: string;
  rawData?: string;
}

/**
 * Parse WHOIS raw data
 */
function parseWHOISData(domain: string, rawData: string): WHOISResult {
  const result: WHOISResult = {
    domain,
    rawData,
    status: [],
    nameServers: [],
  };

  const lines = rawData.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('%') || trimmedLine.startsWith('#')) {
      continue;
    }

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
    const value = trimmedLine.substring(colonIndex + 1).trim();

    if (!value) continue;

    // Registrar
    if (key.includes('registrar') && !key.includes('url') && !key.includes('iana') && !result.registrar) {
      if (!value.toLowerCase().includes('please') && !value.toLowerCase().includes('http')) {
        result.registrar = value;
      }
    }

    // Registrar URL
    if ((key.includes('registrar') && key.includes('url')) || key === 'registrar url') {
      result.registrarURL = value;
    }

    // Creation Date
    if (key.includes('creation date') || key.includes('created') || key === 'registered') {
      if (!result.createdDate && value.match(/\d{4}/)) {
        result.createdDate = value;
      }
    }

    // Updated Date
    if (key.includes('updated') || key.includes('modified') || key.includes('last update')) {
      if (!result.updatedDate && value.match(/\d{4}/)) {
        result.updatedDate = value;
      }
    }

    // Expiry Date
    if (key.includes('expir') || key.includes('expire')) {
      if (!result.expiryDate && value.match(/\d{4}/)) {
        result.expiryDate = value;
      }
    }

    // Status
    if (key.includes('status') || key === 'domain status') {
      const statusValue = value.split(' ')[0]; // Take first word before space
      if (statusValue && !result.status!.includes(statusValue)) {
        result.status!.push(statusValue);
      }
    }

    // Name Servers
    if (key.includes('name server') || key === 'nserver' || key === 'nameserver') {
      const ns = value.split(' ')[0].toLowerCase(); // Take first word
      if (ns && !result.nameServers!.includes(ns)) {
        result.nameServers!.push(ns);
      }
    }

    // DNSSEC
    if (key.includes('dnssec')) {
      result.dnssec = value;
    }

    // Registrant Information
    if (key.includes('registrant')) {
      if (!result.registrant) result.registrant = {};
      
      if (key.includes('name') && !key.includes('organization')) {
        result.registrant.name = value;
      } else if (key.includes('organization') || key.includes('organisation')) {
        result.registrant.organization = value;
      } else if (key.includes('email')) {
        result.registrant.email = value;
      } else if (key.includes('phone')) {
        result.registrant.phone = value;
      } else if (key.includes('country')) {
        result.registrant.country = value;
      }
    }

    // Admin Contact
    if (key.includes('admin')) {
      if (!result.admin) result.admin = {};
      
      if (key.includes('name') && !key.includes('organization')) {
        result.admin.name = value;
      } else if (key.includes('organization') || key.includes('organisation')) {
        result.admin.organization = value;
      } else if (key.includes('email')) {
        result.admin.email = value;
      }
    }

    // Tech Contact
    if (key.includes('tech')) {
      if (!result.tech) result.tech = {};
      
      if (key.includes('name') && !key.includes('organization')) {
        result.tech.name = value;
      } else if (key.includes('organization') || key.includes('organisation')) {
        result.tech.organization = value;
      } else if (key.includes('email')) {
        result.tech.email = value;
      }
    }
  }

  // Clean up empty arrays
  if (result.status?.length === 0) delete result.status;
  if (result.nameServers?.length === 0) delete result.nameServers;
  
  // Clean up empty objects
  if (result.registrant && Object.keys(result.registrant).length === 0) delete result.registrant;
  if (result.admin && Object.keys(result.admin).length === 0) delete result.admin;
  if (result.tech && Object.keys(result.tech).length === 0) delete result.tech;

  return result;
}

/** A parsed WHOIS result is "useful" only if it carries at least one real field. */
function isUsefulWhois(r: WHOISResult): boolean {
  return !!(r.registrar || r.createdDate || r.expiryDate || (r.nameServers && r.nameServers.length));
}

/** Classic WHOIS over TCP port 43 via the `whois` package. */
function port43Lookup(cleanDomain: string): Promise<WHOISResult | null> {
  return new Promise((resolve) => {
    try {
      whois.lookup(cleanDomain, { timeout: 12000, follow: 2 }, (err, data) => {
        if (err || !data) return resolve(null);
        const raw = Array.isArray(data) ? data.join('\n') : data;
        const result = parseWHOISData(cleanDomain, raw);
        result.source = 'whois';
        resolve(result);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * RDAP fallback (HTTPS/JSON, the IANA-endorsed successor to port-43 WHOIS).
 * Works on networks that block outbound port 43, and returns structured data.
 */
async function rdapLookup(cleanDomain: string): Promise<WHOISResult | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(cleanDomain)}`, {
      headers: { Accept: 'application/rdap+json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const d: any = await res.json();

    const eventDate = (action: string): string | undefined =>
      (d.events || []).find((e: any) => e.eventAction === action)?.eventDate;

    const registrarEntity = (d.entities || []).find((e: any) => (e.roles || []).includes('registrar'));
    const registrarName = registrarEntity
      ? (registrarEntity.vcardArray?.[1]?.find((f: any) => f[0] === 'fn')?.[3] || registrarEntity.handle)
      : undefined;

    const result: WHOISResult = {
      domain: cleanDomain,
      source: 'RDAP',
      registrar: registrarName,
      createdDate: eventDate('registration'),
      updatedDate: eventDate('last changed'),
      expiryDate: eventDate('expiration'),
      status: Array.isArray(d.status) ? d.status : [],
      nameServers: (d.nameservers || [])
        .map((n: any) => (n.ldhName || '').toLowerCase())
        .filter(Boolean),
      dnssec: d.secureDNS?.delegationSigned ? 'signed' : 'unsigned',
      rawData: JSON.stringify(d, null, 2),
    };
    if (result.status?.length === 0) delete result.status;
    if (result.nameServers?.length === 0) delete result.nameServers;
    return result;
  } catch {
    return null;
  }
}

/**
 * Perform a WHOIS lookup for a domain. Tries classic port-43 WHOIS first, then
 * falls back to RDAP over HTTPS when port 43 is blocked or returns nothing
 * useful — so the tool works on locked-down networks too.
 */
export async function performWHOISLookup(domain: string): Promise<WHOISResult> {
  const cleanDomain = domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  const whoisResult = await port43Lookup(cleanDomain);
  if (whoisResult && isUsefulWhois(whoisResult)) return whoisResult;

  const rdap = await rdapLookup(cleanDomain);
  if (rdap && isUsefulWhois(rdap)) return rdap;

  // Return whatever we managed to parse, even if thin, rather than nothing.
  if (whoisResult) return whoisResult;
  if (rdap) return rdap;
  throw new Error('WHOIS lookup failed: no data from port-43 WHOIS or RDAP fallback');
}
