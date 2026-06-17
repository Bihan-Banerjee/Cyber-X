import { exec } from 'node:child_process';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface DiscoveredHost {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  responseTime?: number;
}

export interface DiscoveryResult {
  subnet: string;
  hostsUp: number;
  hostsDown: number;
  total: number;
  scanDuration: number;
  hosts: DiscoveredHost[];
}

function parseSubnet(cidr: string): string[] {
  const [baseIP, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr ?? '24', 10);
  const parts = baseIP.split('.').map(Number);

  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return [];

  const hostBits = 32 - prefix;
  const numHosts = Math.min(Math.pow(2, hostBits) - 2, 254);

  const baseNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const networkNum = baseNum & (~((1 << hostBits) - 1));

  const ips: string[] = [];
  for (let i = 1; i <= numHosts; i++) {
    const ipNum = networkNum + i;
    ips.push([
      (ipNum >>> 24) & 0xff,
      (ipNum >>> 16) & 0xff,
      (ipNum >>> 8) & 0xff,
      ipNum & 0xff,
    ].join('.'));
  }
  return ips;
}

function getARPCache(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    exec('arp -a', { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({});
      const cache: Record<string, string> = {};
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Windows: "192.168.1.1     aa-bb-cc-dd-ee-ff"  or Unix: "192.168.1.1 ether aa:bb:cc:dd:ee:ff"
        const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+(?:ether\s+)?([0-9a-f:]{17}|[0-9a-f-]{17})/i);
        if (m) cache[m[1]] = m[2].replace(/-/g, ':').toLowerCase();
      }
      resolve(cache);
    });
  });
}

function tcpProbe(ip: string, port: number, timeout: number): Promise<number | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = net.connect({ host: ip, port }, () => {
      const t = Math.round(performance.now() - start);
      socket.destroy();
      resolve(t);
    });
    socket.on('error', () => resolve(null));
    socket.setTimeout(timeout, () => { socket.destroy(); resolve(null); });
  });
}

export async function discoverHosts(subnet: string, timeoutMs: number = 15000): Promise<DiscoveryResult> {
  const start = performance.now();
  logToolActivity('ARP Host Discovery', `Scanning subnet ${subnet}`, 'info');

  const ips = parseSubnet(subnet);
  if (ips.length === 0) {
    throw new Error('Invalid subnet CIDR notation');
  }

  const arpCache = await getARPCache();
  const hosts: DiscoveredHost[] = [];
  const probeTimeout = Math.min(timeoutMs / 2, 2000);

  // Limit to first 64 IPs to avoid long scans
  const targetIPs = ips.slice(0, 64);

  const probePromises = targetIPs.map(async (ip) => {
    // Check ARP cache first
    const mac = arpCache[ip];
    if (mac) {
      hosts.push({ ip, mac, responseTime: 0 });
      return;
    }
    // Try TCP connect on port 80 or 443
    const rtt80 = await tcpProbe(ip, 80, probeTimeout);
    if (rtt80 !== null) {
      hosts.push({ ip, mac: arpCache[ip], responseTime: rtt80 });
      return;
    }
    const rtt443 = await tcpProbe(ip, 443, probeTimeout);
    if (rtt443 !== null) {
      hosts.push({ ip, mac: arpCache[ip], responseTime: rtt443 });
    }
  });

  await Promise.all(probePromises);

  hosts.sort((a, b) => {
    const partsA = a.ip.split('.').map(Number);
    const partsB = b.ip.split('.').map(Number);
    for (let i = 0; i < 4; i++) {
      if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i];
    }
    return 0;
  });

  const scanDuration = Math.round((performance.now() - start) / 1000);
  logToolActivity('ARP Host Discovery', `Found ${hosts.length} hosts in ${subnet}`, 'success');

  return {
    subnet,
    hostsUp: hosts.length,
    hostsDown: targetIPs.length - hosts.length,
    total: targetIPs.length,
    scanDuration,
    hosts,
  };
}
