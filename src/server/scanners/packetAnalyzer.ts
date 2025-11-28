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

/**
 * Analyze packet capture
 */
export async function analyzePackets(
  pcapData?: string,
  timeoutMs: number = 30000
): Promise<AnalysisResult> {
  const startTime = performance.now();
  
  // Generate sample packets (in production, parse actual PCAP data)
  const packets = generateSamplePackets();
  
  const statistics = calculateStatistics(packets);
  
  const scanDuration = Math.round((performance.now() - startTime) / 1000);
  
  return {
    totalPackets: packets.length,
    packets,
    statistics,
    scanDuration,
  };
}
