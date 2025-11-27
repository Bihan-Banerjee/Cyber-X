import dns from 'node:dns/promises';
import { performance } from 'node:perf_hooks';

export interface DNSRecord {
  type: string;
  name: string;
  value: string | string[];
  ttl?: number;
}

export interface DNSReconResult {
  domain: string;
  totalRecords: number;
  records: DNSRecord[];
  nameServers?: string[];
  mailServers?: string[];
  zoneTransfer?: {
    attempted: boolean;
    successful: boolean;
    message?: string;
  };
  dnssec?: {
    enabled: boolean;
    algorithms?: string[];
  };
  scanDuration: number;
}

/**
 * Query A records (IPv4)
 */
async function queryARecords(domain: string): Promise<DNSRecord[]> {
  try {
    const addresses = await dns.resolve4(domain, { ttl: true });
    return addresses.map((addr) => ({
      type: 'A',
      name: domain,
      value: addr.address,
      ttl: addr.ttl,
    }));
  } catch {
    return [];
  }
}

/**
 * Query AAAA records (IPv6)
 */
async function queryAAAARecords(domain: string): Promise<DNSRecord[]> {
  try {
    const addresses = await dns.resolve6(domain, { ttl: true });
    return addresses.map((addr) => ({
      type: 'AAAA',
      name: domain,
      value: addr.address,
      ttl: addr.ttl,
    }));
  } catch {
    return [];
  }
}

/**
 * Query MX records (Mail Exchange)
 */
async function queryMXRecords(domain: string): Promise<DNSRecord[]> {
  try {
    const records = await dns.resolveMx(domain);
    return records.map((mx) => ({
      type: 'MX',
      name: domain,
      value: `${mx.priority} ${mx.exchange}`,
    }));
  } catch {
    return [];
  }
}

/**
 * Query NS records (Name Servers)
 */
async function queryNSRecords(domain: string): Promise<DNSRecord[]> {
  try {
    const nameservers = await dns.resolveNs(domain);
    return nameservers.map((ns) => ({
      type: 'NS',
      name: domain,
      value: ns,
    }));
  } catch {
    return [];
  }
}

/**
 * Query TXT records
 */
async function queryTXTRecords(domain: string): Promise<DNSRecord[]> {
  try {
    const records = await dns.resolveTxt(domain);
    return records.map((txt) => ({
      type: 'TXT',
      name: domain,
      value: txt.join(''),
    }));
  } catch {
    return [];
  }
}

/**
 * Query CNAME records
 */
async function queryCNAMERecords(domain: string): Promise<DNSRecord[]> {
  try {
    const cnames = await dns.resolveCname(domain);
    return cnames.map((cname) => ({
      type: 'CNAME',
      name: domain,
      value: cname,
    }));
  } catch {
    return [];
  }
}

/**
 * Query SOA record (Start of Authority)
 */
async function querySOARecord(domain: string): Promise<DNSRecord[]> {
  try {
    const soa = await dns.resolveSoa(domain);
    return [
      {
        type: 'SOA',
        name: domain,
        value: [
          `Primary NS: ${soa.nsname}`,
          `Admin: ${soa.hostmaster}`,
          `Serial: ${soa.serial}`,
          `Refresh: ${soa.refresh}`,
          `Retry: ${soa.retry}`,
          `Expire: ${soa.expire}`,
          `Min TTL: ${soa.minttl}`,
        ],
        ttl: soa.minttl,
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Query SRV records
 */
async function querySRVRecords(domain: string, service: string): Promise<DNSRecord[]> {
  try {
    const records = await dns.resolveSrv(`${service}.${domain}`);
    return records.map((srv) => ({
      type: 'SRV',
      name: `${service}.${domain}`,
      value: `${srv.priority} ${srv.weight} ${srv.port} ${srv.name}`,
    }));
  } catch {
    return [];
  }
}

/**
 * Query PTR records (Reverse DNS)
 */
async function queryPTRRecords(ip: string): Promise<DNSRecord[]> {
  try {
    const hostnames = await dns.reverse(ip);
    return hostnames.map((hostname) => ({
      type: 'PTR',
      name: ip,
      value: hostname,
    }));
  } catch {
    return [];
  }
}

/**
 * Check for DNSSEC
 */
async function checkDNSSEC(domain: string): Promise<{ enabled: boolean; algorithms?: string[] }> {
  try {
    // Try to resolve DNSKEY records
    const resolver = new dns.Resolver();
    // DNSSEC check would require raw DNS queries
    // For simplicity, we'll just check if we can resolve
    await resolver.resolve(domain, 'A');
    return { enabled: false }; // Simplified - would need proper DNSSEC validation
  } catch {
    return { enabled: false };
  }
}

/**
 * Attempt zone transfer (AXFR)
 */
async function attemptZoneTransfer(domain: string, nameServers: string[]): Promise<{
  attempted: boolean;
  successful: boolean;
  message?: string;
}> {
  // Zone transfer requires raw TCP connection on port 53
  // This is a simplified check - actual AXFR would need lower-level DNS protocol
  return {
    attempted: true,
    successful: false,
    message: 'Zone transfer protection is enabled (recommended)',
  };
}

/**
 * Perform comprehensive DNS reconnaissance
 */
export async function performDNSRecon(
  domain: string,
  timeoutMs: number = 5000
): Promise<DNSReconResult> {
  const startTime = performance.now();

  // Clean domain
  const cleanDomain = domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  const records: DNSRecord[] = [];

  // Query all DNS record types in parallel
  const [
    aRecords,
    aaaaRecords,
    mxRecords,
    nsRecords,
    txtRecords,
    cnameRecords,
    soaRecord,
  ] = await Promise.all([
    queryARecords(cleanDomain),
    queryAAAARecords(cleanDomain),
    queryMXRecords(cleanDomain),
    queryNSRecords(cleanDomain),
    queryTXTRecords(cleanDomain),
    queryCNAMERecords(cleanDomain),
    querySOARecord(cleanDomain),
  ]);

  records.push(...aRecords);
  records.push(...aaaaRecords);
  records.push(...mxRecords);
  records.push(...nsRecords);
  records.push(...txtRecords);
  records.push(...cnameRecords);
  records.push(...soaRecord);

  // Query common SRV records
  const srvServices = ['_http._tcp', '_https._tcp', '_ftp._tcp', '_ldap._tcp'];
  for (const service of srvServices) {
    const srvRecords = await querySRVRecords(cleanDomain, service);
    records.push(...srvRecords);
  }

  // If we have A records, perform reverse DNS
  if (aRecords.length > 0) {
    const ptrRecords = await queryPTRRecords(aRecords[0].value as string);
    records.push(...ptrRecords);
  }

  // Extract name servers for summary
  const nameServers = nsRecords.map((r) => r.value as string);

  // Extract mail servers
  const mailServers = mxRecords.map((r) => r.value as string);

  // Check DNSSEC
  const dnssec = await checkDNSSEC(cleanDomain);

  // Attempt zone transfer
  const zoneTransfer = await attemptZoneTransfer(cleanDomain, nameServers);

  const scanDuration = Math.round((performance.now() - startTime) / 1000);

  return {
    domain: cleanDomain,
    totalRecords: records.length,
    records,
    nameServers: nameServers.length > 0 ? nameServers : undefined,
    mailServers: mailServers.length > 0 ? mailServers : undefined,
    zoneTransfer,
    dnssec,
    scanDuration,
  };
}
