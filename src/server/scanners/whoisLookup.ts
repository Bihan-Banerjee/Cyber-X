import whois from 'whois';

export interface WHOISResult {
  domain: string;
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

/**
 * Perform WHOIS lookup for a domain
 */
export async function performWHOISLookup(domain: string): Promise<WHOISResult> {
  return new Promise((resolve, reject) => {
    try {
      const cleanDomain = domain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];

      whois.lookup(cleanDomain, { timeout: 15000 }, (err, data) => {
        if (err) {
          reject(new Error(`WHOIS lookup failed: ${err.message}`));
          return;
        }

        if (!data) {
          reject(new Error('No WHOIS data returned'));
          return;
        }

        const result = parseWHOISData(cleanDomain, data);
        resolve(result);
      });
    } catch (error: any) {
      reject(new Error(`WHOIS lookup failed: ${error.message}`));
    }
  });
}
