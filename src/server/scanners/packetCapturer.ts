import os from 'node:os';

export interface NetworkInterface {
  name: string;
  description: string;
  addresses: string[];
}

export interface CapturedPacket {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
}

export interface CaptureSession {
  isCapturing: boolean;
  interfaceName: string;
  startTime: string;
  packetCount: number;
  totalBytes: number;
  duration: number;
}

// Global capture state
let captureState: {
  isCapturing: boolean;
  interfaceName: string;
  startTime: Date;
  packets: CapturedPacket[];
} | null = null;

/**
 * Get available network interfaces
 */
export function getNetworkInterfaces(): { interfaces: NetworkInterface[] } {
  const networkInterfaces = os.networkInterfaces();
  const interfaces: NetworkInterface[] = [];

  for (const [name, addresses] of Object.entries(networkInterfaces)) {
    if (!addresses) continue;

    const ipAddresses = addresses
      .filter(addr => !addr.internal)
      .map(addr => addr.address);

    if (ipAddresses.length > 0) {
      interfaces.push({
        name,
        description: `${name} (${addresses[0].family})`,
        addresses: ipAddresses,
      });
    }
  }

  return { interfaces };
}

/**
 * Start packet capture (simulated)
 */
export function startPacketCapture(
  interfaceName: string,
  filter?: string
): { session: CaptureSession } {
  if (captureState?.isCapturing) {
    throw new Error('Capture already in progress');
  }

  captureState = {
    isCapturing: true,
    interfaceName,
    startTime: new Date(),
    packets: [],
  };

  // Simulate packet generation
  const captureInterval = setInterval(() => {
    if (!captureState?.isCapturing) {
      clearInterval(captureInterval);
      return;
    }

    generateSimulatedPacket();
  }, 500);

  // Store interval for cleanup
  (global as any).captureInterval = captureInterval;

  return {
    session: getCurrentSession(),
  };
}

/**
 * Stop packet capture
 */
export function stopPacketCapture(): { success: boolean } {
  if (!captureState) {
    throw new Error('No active capture session');
  }

  captureState.isCapturing = false;

  // Clear interval
  if ((global as any).captureInterval) {
    clearInterval((global as any).captureInterval);
    (global as any).captureInterval = null;
  }

  return { success: true };
}

/**
 * Get current capture session and packets
 */
export function getCapturePackets(): {
  session: CaptureSession | null;
  packets: CapturedPacket[];
} {
  if (!captureState) {
    return { session: null, packets: [] };
  }

  return {
    session: getCurrentSession(),
    packets: captureState.packets,
  };
}

/**
 * Get current session info
 */
function getCurrentSession(): CaptureSession {
  if (!captureState) {
    throw new Error('No active capture session');
  }

  const duration = Math.floor((Date.now() - captureState.startTime.getTime()) / 1000);
  const totalBytes = captureState.packets.reduce((sum, p) => sum + p.length, 0);

  return {
    isCapturing: captureState.isCapturing,
    interfaceName: captureState.interfaceName,
    startTime: captureState.startTime.toISOString(),
    packetCount: captureState.packets.length,
    totalBytes,
    duration,
  };
}

/**
 * Generate simulated packet
 */
function generateSimulatedPacket() {
  if (!captureState) return;

  const protocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'ARP'];
  const ips = ['192.168.1.1', '192.168.1.100', '10.0.0.5', '8.8.8.8', '1.1.1.1'];

  const protocol = protocols[Math.floor(Math.random() * protocols.length)];
  const source = ips[Math.floor(Math.random() * ips.length)];
  const destination = ips[Math.floor(Math.random() * ips.length)];
  const length = Math.floor(Math.random() * 1400) + 60;

  const packet: CapturedPacket = {
    id: captureState.packets.length + 1,
    timestamp: new Date().toISOString().split('T')[1].split('.')[0],
    source,
    destination,
    protocol,
    length,
    info: `${protocol} ${source} → ${destination}`,
  };

  captureState.packets.push(packet);

  // Keep only last 100 packets
  if (captureState.packets.length > 100) {
    captureState.packets.shift();
  }
}

/**
 * Generate PCAP file (simulated)
 */
export function generatePcapFile(): Buffer {
  if (!captureState) {
    throw new Error('No capture data available');
  }

  // In production, use pcap library to generate real PCAP file
  // For now, return a simple text representation
  const content = captureState.packets
    .map(p => `${p.timestamp} ${p.protocol} ${p.source} -> ${p.destination} Length: ${p.length}`)
    .join('\n');

  return Buffer.from(content, 'utf-8');
}
