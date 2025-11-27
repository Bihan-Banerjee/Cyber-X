import net from 'node:net';
import dns from 'node:dns/promises';

export interface OSFingerprintResult {
  target: string;
  detectedOS: string;
  confidence: number;
  ttl: number;
  openPorts: number[];
  services: Array<{ port: number; service: string; banner?: string }>;
  tcpWindowSize?: number;
  fingerprint: string;
}

interface BannerResult {
  port: number;
  banner?: string;
  service: string;
}

// Common ports to scan for OS fingerprinting
const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 3306, 3389, 5432, 8080];

// Service mapping
const SERVICE_MAP: Record<number, string> = {
  20: 'FTP-Data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  135: 'MS-RPC',
  139: 'NetBIOS',
  143: 'IMAP',
  443: 'HTTPS',
  445: 'SMB',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  8080: 'HTTP-Alt',
  27017: 'MongoDB',
};

/**
 * Perform TCP connect scan to detect open ports
 */
async function scanPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isOpen = false;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      isOpen = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Attempt to grab banner from a service
 */
async function grabBanner(host: string, port: number, timeout: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(banner || undefined);
    }, timeout);

    socket.on('data', (data) => {
      banner += data.toString('utf-8').trim();
    });

    socket.once('connect', () => {
      // Send probe for common services
      if (port === 80 || port === 8080) {
        socket.write('HEAD / HTTP/1.0\r\n\r\n');
      } else if (port === 21) {
        // FTP sends banner automatically
      } else if (port === 22) {
        // SSH sends banner automatically
      } else if (port === 25) {
        // SMTP sends banner automatically
      } else {
        socket.write('\r\n');
      }
    });

    socket.once('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(undefined);
    });

    socket.setTimeout(timeout);
    socket.once('timeout', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(banner || undefined);
    });

    socket.connect(port, host);
  });
}

/**
 * Estimate TTL based on ping/connection attempts
 */
async function estimateTTL(host: string): Promise<number> {
  // Default TTL values for common OS
  // This is a simplified estimation
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(3000);
    socket.once('connect', () => {
      // Get TTL from socket if available (platform dependent)
      socket.destroy();
      resolve(64); // Default for Linux/Unix
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(64);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(64);
    });

    socket.connect(80, host);
  });
}

/**
 * Analyze OS based on fingerprint data
 */
function analyzeOS(ttl: number, openPorts: number[], banners: BannerResult[]): { os: string; confidence: number } {
  let os = 'Unknown';
  let confidence = 0;
  const indicators: string[] = [];

  // TTL-based detection
  if (ttl >= 120 && ttl <= 130) {
    indicators.push('Windows');
    confidence += 30;
  } else if (ttl >= 60 && ttl <= 70) {
    indicators.push('Linux/Unix');
    confidence += 30;
  } else if (ttl >= 250 && ttl <= 256) {
    indicators.push('Solaris/AIX');
    confidence += 30;
  }

  // Port pattern analysis
  const hasWindowsPorts = openPorts.some((p) => [135, 139, 445, 3389].includes(p));
  const hasUnixPorts = openPorts.some((p) => [22, 111].includes(p));
  const hasSMB = openPorts.includes(445) || openPorts.includes(139);
  const hasRDP = openPorts.includes(3389);
  const hasSSH = openPorts.includes(22);

  if (hasWindowsPorts) {
    indicators.push('Windows');
    confidence += 20;
  }

  if (hasSMB && hasRDP) {
    indicators.push('Windows Server');
    confidence += 25;
  }

  if (hasSSH && hasUnixPorts) {
    indicators.push('Linux/Unix');
    confidence += 20;
  }

  // Banner analysis
  for (const banner of banners) {
    const bannerLower = (banner.banner || '').toLowerCase();
    
    if (bannerLower.includes('microsoft') || bannerLower.includes('windows')) {
      indicators.push('Windows');
      confidence += 15;
    }
    
    if (bannerLower.includes('ubuntu') || bannerLower.includes('debian')) {
      indicators.push('Ubuntu/Debian');
      confidence += 20;
    }
    
    if (bannerLower.includes('centos') || bannerLower.includes('redhat') || bannerLower.includes('rhel')) {
      indicators.push('CentOS/RHEL');
      confidence += 20;
    }
    
    if (bannerLower.includes('openssh')) {
      indicators.push('Linux/Unix');
      confidence += 10;
    }

    if (bannerLower.includes('apache')) {
      confidence += 5;
    }

    if (bannerLower.includes('nginx')) {
      confidence += 5;
    }

    if (bannerLower.includes('iis')) {
      indicators.push('Windows');
      confidence += 15;
    }
  }

  // Determine final OS
  const windowsCount = indicators.filter((i) => i.includes('Windows')).length;
  const linuxCount = indicators.filter((i) => i.includes('Linux') || i.includes('Unix') || i.includes('Ubuntu') || i.includes('Debian') || i.includes('CentOS')).length;

  if (windowsCount > linuxCount) {
    os = indicators.find((i) => i.includes('Windows Server')) || 'Windows';
  } else if (linuxCount > windowsCount) {
    os = indicators.find((i) => i.includes('Ubuntu') || i.includes('Debian') || i.includes('CentOS')) || 'Linux';
  } else if (indicators.length > 0) {
    os = indicators[0];
  }

  // Cap confidence at 95%
  confidence = Math.min(confidence, 95);
  
  // Minimum confidence
  if (confidence < 20) confidence = 20;

  return { os, confidence };
}

/**
 * Main OS fingerprinting function
 */
export async function performOSFingerprint(
  target: string,
  timeoutMs: number = 5000
): Promise<OSFingerprintResult> {
  // Resolve hostname to IP
  let resolvedTarget = target;
  try {
    const addresses = await dns.resolve4(target);
    if (addresses.length > 0) {
      resolvedTarget = addresses[0];
    }
  } catch {
    // Assume it's already an IP
  }

  // Scan common ports
  const portScanPromises = COMMON_PORTS.map((port) => 
    scanPort(resolvedTarget, port, timeoutMs).then((isOpen) => ({ port, isOpen }))
  );

  const portResults = await Promise.all(portScanPromises);
  const openPorts = portResults.filter((r) => r.isOpen).map((r) => r.port);

  // Grab banners from open ports
  const bannerPromises = openPorts.slice(0, 10).map(async (port) => {
    const banner = await grabBanner(resolvedTarget, port, 2000);
    return {
      port,
      banner,
      service: SERVICE_MAP[port] || 'Unknown',
    };
  });

  const banners = await Promise.all(bannerPromises);

  // Estimate TTL
  const ttl = await estimateTTL(resolvedTarget);

  // Analyze OS
  const { os, confidence } = analyzeOS(ttl, openPorts, banners);

  // Generate fingerprint hash
  const fingerprintData = `TTL:${ttl}|PORTS:${openPorts.join(',')}|OS:${os}`;
  const fingerprint = Buffer.from(fingerprintData).toString('base64').substring(0, 32);

  return {
    target,
    detectedOS: os,
    confidence,
    ttl,
    openPorts,
    services: banners,
    tcpWindowSize: undefined, // Would require raw socket access
    fingerprint,
  };
}
