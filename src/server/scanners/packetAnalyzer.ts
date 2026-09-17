import { performance } from 'node:perf_hooks';

export interface PacketLayer {
  protocol: string;
  fields: Record<string, any>;
}

export interface Packet {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
  layers: PacketLayer[];
  rawHex: string;
}

export interface AnalysisResult {
  totalPackets: number;
  packets: Packet[];
  statistics: {
    protocols: Record<string, number>;
    topSources: Array<{ ip: string; count: number }>;
    topDestinations: Array<{ ip: string; count: number }>;
    avgPacketSize: number;
    duration: number;
  };
  scanDuration: number;
  /** true when the returned packets are demo/sample data (no file was provided). */
  sample?: boolean;
  /** Human-readable note (e.g. truncation, unsupported format). */
  note?: string;
}

/**
 * Generate sample network packets
 */
function generateSamplePackets(): Packet[] {
  const packets: Packet[] = [];
  const protocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'ARP'];
  const ips = ['192.168.1.1', '192.168.1.100', '10.0.0.5', '8.8.8.8', '1.1.1.1', '172.16.0.10'];
  
  for (let i = 1; i <= 50; i++) {
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const source = ips[Math.floor(Math.random() * ips.length)];
    const destination = ips[Math.floor(Math.random() * ips.length)];
    const length = Math.floor(Math.random() * 1400) + 60;
    
    const timestamp = new Date(Date.now() - Math.random() * 300000).toISOString();
    
    const layers: PacketLayer[] = [];
    
    // Ethernet layer
    layers.push({
      protocol: 'Ethernet',
      fields: {
        'Source MAC': '00:11:22:33:44:55',
        'Destination MAC': 'ff:ff:ff:ff:ff:ff',
        'Type': '0x0800 (IPv4)',
      },
    });
    
    // IP layer
    layers.push({
      protocol: 'IPv4',
      fields: {
        'Version': '4',
        'Header Length': '20 bytes',
        'TTL': Math.floor(Math.random() * 128) + 32,
        'Protocol': protocol === 'TCP' ? '6 (TCP)' : protocol === 'UDP' ? '17 (UDP)' : '1 (ICMP)',
        'Source IP': source,
        'Destination IP': destination,
        'Total Length': length,
      },
    });
    
    // Transport/Application layer
    if (protocol === 'TCP' || protocol === 'HTTP' || protocol === 'HTTPS') {
      layers.push({
        protocol: 'TCP',
        fields: {
          'Source Port': Math.floor(Math.random() * 65535),
          'Destination Port': protocol === 'HTTP' ? 80 : protocol === 'HTTPS' ? 443 : Math.floor(Math.random() * 65535),
          'Sequence Number': Math.floor(Math.random() * 4294967295),
          'Acknowledgment Number': Math.floor(Math.random() * 4294967295),
          'Flags': '0x018 (PSH, ACK)',
          'Window Size': 65535,
        },
      });
    } else if (protocol === 'UDP' || protocol === 'DNS') {
      layers.push({
        protocol: 'UDP',
        fields: {
          'Source Port': Math.floor(Math.random() * 65535),
          'Destination Port': protocol === 'DNS' ? 53 : Math.floor(Math.random() * 65535),
          'Length': length - 20,
          'Checksum': '0x' + Math.floor(Math.random() * 65535).toString(16),
        },
      });
    }
    
    // Generate hex dump
    const rawHex = Array.from({ length: Math.min(length, 256) }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(' ');
    
    const info = protocol === 'HTTP' ? 'GET /index.html HTTP/1.1' :
                 protocol === 'HTTPS' ? 'TLS Application Data' :
                 protocol === 'DNS' ? 'Standard query A google.com' :
                 protocol === 'ICMP' ? 'Echo (ping) request' :
                 protocol === 'ARP' ? 'Who has 192.168.1.1? Tell 192.168.1.100' :
                 `${protocol} ${source}:${Math.floor(Math.random() * 65535)} → ${destination}:${Math.floor(Math.random() * 65535)}`;
    
    packets.push({
      id: i,
      timestamp,
      source,
      destination,
      protocol,
      length,
      info,
      layers,
      rawHex,
    });
  }
  
  return packets;
}

/**
 * Calculate statistics
 */
function calculateStatistics(packets: Packet[]) {
  if (packets.length === 0) {
    return { protocols: {}, topSources: [], topDestinations: [], avgPacketSize: 0, duration: 0 };
  }
  const protocols: Record<string, number> = {};
  const sources: Record<string, number> = {};
  const destinations: Record<string, number> = {};
  let totalSize = 0;

  packets.forEach(p => {
    protocols[p.protocol] = (protocols[p.protocol] || 0) + 1;
    sources[p.source] = (sources[p.source] || 0) + 1;
    destinations[p.destination] = (destinations[p.destination] || 0) + 1;
    totalSize += p.length;
  });
  
  const topSources = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, count]) => ({ ip, count }));
  
  const topDestinations = Object.entries(destinations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, count]) => ({ ip, count }));
  
  const timestamps = packets.map(p => new Date(p.timestamp).getTime());
  const duration = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 1000);
  
  return {
    protocols,
    topSources,
    topDestinations,
    avgPacketSize: Math.round(totalSize / packets.length),
    duration,
  };
}

// ─── Real libpcap (.pcap) parser ────────────────────────────────────────────
// Parses classic libpcap files. pcapng is detected and reported as unsupported
// rather than silently mis-parsed. Link types handled: Ethernet(1), raw IP(101),
// null/loopback(0), Linux SLL(113); others still yield length/time with an
// "Unknown" protocol so counts stay accurate.

const MAX_PARSED_PACKETS = 5000;

function ipProtoName(n: number): string {
  return ({ 1: 'ICMP', 2: 'IGMP', 6: 'TCP', 17: 'UDP', 47: 'GRE', 50: 'ESP', 58: 'ICMPv6', 89: 'OSPF' } as Record<number, string>)[n] || `IP proto ${n}`;
}

function decodePcapInput(pcapData: string): Buffer | null {
  let s = pcapData.trim();
  const comma = s.indexOf(',');
  if (s.startsWith('data:') && comma !== -1) s = s.slice(comma + 1); // strip data: URL prefix
  // Try base64 first, then hex.
  try {
    const b = Buffer.from(s.replace(/\s+/g, ''), 'base64');
    if (b.length >= 24) return b;
  } catch { /* fall through */ }
  try {
    const hex = s.replace(/[^0-9a-fA-F]/g, '');
    if (hex.length >= 48) return Buffer.from(hex, 'hex');
  } catch { /* fall through */ }
  return null;
}

interface ParsedFrame { src: string; dst: string; protocol: string; sport?: number; dport?: number; }

function parseL3(buf: Buffer, off: number, etherType: number): ParsedFrame | null {
  // IPv4
  if (etherType === 0x0800 && off + 20 <= buf.length) {
    const ihl = (buf[off] & 0x0f) * 4;
    const proto = buf[off + 9];
    const src = `${buf[off + 12]}.${buf[off + 13]}.${buf[off + 14]}.${buf[off + 15]}`;
    const dst = `${buf[off + 16]}.${buf[off + 17]}.${buf[off + 18]}.${buf[off + 19]}`;
    const l4 = off + ihl;
    let sport: number | undefined, dport: number | undefined;
    if ((proto === 6 || proto === 17) && l4 + 4 <= buf.length) { sport = buf.readUInt16BE(l4); dport = buf.readUInt16BE(l4 + 2); }
    const protocol = proto === 6 ? (dport === 80 || sport === 80 ? 'HTTP' : dport === 443 || sport === 443 ? 'HTTPS' : 'TCP')
      : proto === 17 ? (dport === 53 || sport === 53 ? 'DNS' : 'UDP') : ipProtoName(proto);
    return { src, dst, protocol, sport, dport };
  }
  // IPv6
  if (etherType === 0x86dd && off + 40 <= buf.length) {
    const next = buf[off + 6];
    const hx = (i: number) => buf.subarray(off + 8 + i * 2, off + 8 + i * 2 + 2).toString('hex');
    const src = [0, 1, 2, 3, 4, 5, 6, 7].map(hx).join(':').replace(/\b:?(?:0+:?){2,}/, '::');
    const dhx = (i: number) => buf.subarray(off + 24 + i * 2, off + 24 + i * 2 + 2).toString('hex');
    const dst = [0, 1, 2, 3, 4, 5, 6, 7].map(dhx).join(':').replace(/\b:?(?:0+:?){2,}/, '::');
    return { src, dst, protocol: ipProtoName(next) };
  }
  if (etherType === 0x0806) return { src: '', dst: '', protocol: 'ARP' };
  return null;
}

function parseFrame(buf: Buffer, linkType: number): ParsedFrame | null {
  if (linkType === 1) { // Ethernet
    if (buf.length < 14) return null;
    let etherType = buf.readUInt16BE(12);
    let l3 = 14;
    while (etherType === 0x8100 && l3 + 4 <= buf.length) { etherType = buf.readUInt16BE(l3 + 2); l3 += 4; } // VLAN
    return parseL3(buf, l3, etherType);
  }
  if (linkType === 101) { // raw IP
    const ver = buf[0] >> 4;
    return parseL3(buf, 0, ver === 6 ? 0x86dd : 0x0800);
  }
  if (linkType === 0) { // null/loopback: 4-byte address family
    const ver = buf[4] >> 4;
    return parseL3(buf, 4, ver === 6 ? 0x86dd : 0x0800);
  }
  if (linkType === 113) { // Linux SLL
    if (buf.length < 16) return null;
    return parseL3(buf, 16, buf.readUInt16BE(14));
  }
  return null;
}

function parsePcap(buf: Buffer): { packets: Packet[]; truncated: boolean } {
  const magic = buf.readUInt32BE(0);
  // pcapng section header block magic
  if (magic === 0x0a0d0d0a) throw new Error('pcapng format is not supported yet — save as "Wireshark/tcpdump pcap" (.pcap) and retry.');
  let le: boolean, nano = false;
  if (magic === 0xa1b2c3d4) { le = false; }
  else if (magic === 0xd4c3b2a1) { le = true; }
  else if (magic === 0xa1b23c4d) { le = false; nano = true; }
  else if (magic === 0x4d3cb2a1) { le = true; nano = true; }
  else throw new Error('Not a libpcap file (bad magic). Upload a .pcap capture.');

  const u32 = (o: number) => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  const linkType = u32(20);
  const packets: Packet[] = [];
  let off = 24;
  let id = 0;
  let truncated = false;
  while (off + 16 <= buf.length) {
    const tsSec = u32(off), tsFrac = u32(off + 4), inclLen = u32(off + 8), origLen = u32(off + 12);
    off += 16;
    if (inclLen === 0 || off + inclLen > buf.length) break;
    const frame = buf.subarray(off, off + inclLen);
    off += inclLen;
    id++;
    if (packets.length >= MAX_PARSED_PACKETS) { truncated = true; continue; }
    const ms = tsSec * 1000 + Math.floor((nano ? tsFrac / 1e6 : tsFrac / 1e3));
    const parsed = parseFrame(frame, linkType);
    const rawHex = frame.subarray(0, 96).toString('hex').replace(/(.{2})/g, '$1 ').trim();
    packets.push({
      id,
      timestamp: new Date(ms).toISOString(),
      source: parsed?.src || '-',
      destination: parsed?.dst || '-',
      protocol: parsed?.protocol || 'Unknown',
      length: origLen,
      info: parsed
        ? `${parsed.protocol} ${parsed.src}${parsed.sport ? ':' + parsed.sport : ''} → ${parsed.dst}${parsed.dport ? ':' + parsed.dport : ''}`
        : `Link-type ${linkType} frame (${origLen} bytes)`,
      layers: [],
      rawHex,
    });
  }
  return { packets, truncated };
}

/**
 * Analyze a packet capture. Parses a real libpcap (.pcap) file supplied as
 * base64 or hex in `pcapData`. When no data is supplied (or the literal
 * "sample"), returns clearly-labeled demo packets (`sample: true`) so the UI has
 * something to show — it never presents demo data as a real capture.
 */
export async function analyzePackets(
  pcapData?: string,
  _timeoutMs: number = 30000
): Promise<AnalysisResult> {
  const startTime = performance.now();

  if (!pcapData || pcapData.trim() === '' || pcapData.trim() === 'sample') {
    const packets = generateSamplePackets();
    return {
      totalPackets: packets.length,
      packets,
      statistics: calculateStatistics(packets),
      scanDuration: Math.round((performance.now() - startTime) / 1000),
      sample: true,
      note: 'Demo data — upload a .pcap file to analyze a real capture.',
    };
  }

  const buf = decodePcapInput(pcapData);
  if (!buf || buf.length < 24) {
    throw new Error('Could not decode capture. Provide a libpcap (.pcap) file as base64 or hex.');
  }

  const { packets, truncated } = parsePcap(buf);
  return {
    totalPackets: packets.length,
    packets,
    statistics: calculateStatistics(packets),
    scanDuration: Math.round((performance.now() - startTime) / 1000),
    note: truncated ? `Showing the first ${MAX_PARSED_PACKETS} packets.` : undefined,
  };
}
