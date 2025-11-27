import net from 'node:net';
import dns from 'node:dns/promises';

export interface ServiceInfo {
  port: number;
  protocol: string;
  service: string;
  version?: string;
  banner?: string;
  cpe?: string;
  confidence: number;
  vulnerabilities?: string[];
}

export interface ServiceDetectionResult {
  target: string;
  totalServices: number;
  services: ServiceInfo[];
  scanDuration: number;
}

// Service signatures database
const SERVICE_SIGNATURES: Record<number, { service: string; protocol: string }> = {
  20: { service: 'FTP-Data', protocol: 'tcp' },
  21: { service: 'FTP', protocol: 'tcp' },
  22: { service: 'SSH', protocol: 'tcp' },
  23: { service: 'Telnet', protocol: 'tcp' },
  25: { service: 'SMTP', protocol: 'tcp' },
  53: { service: 'DNS', protocol: 'udp' },
  80: { service: 'HTTP', protocol: 'tcp' },
  110: { service: 'POP3', protocol: 'tcp' },
  143: { service: 'IMAP', protocol: 'tcp' },
  443: { service: 'HTTPS', protocol: 'tcp' },
  445: { service: 'SMB', protocol: 'tcp' },
  3306: { service: 'MySQL', protocol: 'tcp' },
  3389: { service: 'RDP', protocol: 'tcp' },
  5432: { service: 'PostgreSQL', protocol: 'tcp' },
  5900: { service: 'VNC', protocol: 'tcp' },
  6379: { service: 'Redis', protocol: 'tcp' },
  8080: { service: 'HTTP-Proxy', protocol: 'tcp' },
  27017: { service: 'MongoDB', protocol: 'tcp' },
};

/**
 * Check if port is open
 */
async function isPortOpen(host: string, port: number, timeout: number): Promise<boolean> {
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
 * Grab service banner
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
      if (banner.length > 1024) { // Limit banner size
        clearTimeout(timer);
        socket.destroy();
        resolve(banner);
      }
    });

    socket.once('connect', () => {
      // Send probes based on port
      if (port === 80 || port === 8080) {
        socket.write('GET / HTTP/1.0\r\n\r\n');
      } else if (port === 21) {
        // FTP sends banner automatically
      } else if (port === 22) {
        // SSH sends banner automatically
      } else if (port === 25) {
        socket.write('EHLO test\r\n');
      } else if (port === 110) {
        // POP3 sends banner automatically
      } else if (port === 143) {
        // IMAP sends banner automatically
      } else if (port === 3306) {
        // MySQL sends banner automatically
      } else if (port === 5432) {
        // PostgreSQL sends banner automatically
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
 * Analyze banner to detect service version
 */
function analyzeBanner(port: number, banner: string): {
  service: string;
  version?: string;
  confidence: number;
  cpe?: string;
  vulnerabilities?: string[];
} {
  const bannerLower = banner.toLowerCase();
  let service = SERVICE_SIGNATURES[port]?.service || 'Unknown';
  let version: string | undefined;
  let confidence = 50;
  let cpe: string | undefined;
  let vulnerabilities: string[] = [];

  // SSH Detection
  if (bannerLower.includes('ssh')) {
    service = 'SSH';
    confidence = 95;
    const sshMatch = banner.match(/SSH-([\d.]+)-OpenSSH_([\d.]+[^\s]*)/i);
    if (sshMatch) {
      version = sshMatch[2];
      cpe = `cpe:/a:openbsd:openssh:${version}`;
      confidence = 98;
    }
  }

  // HTTP/HTTPS Detection
  if (bannerLower.includes('http')) {
    confidence = 90;
    
    // Apache
    if (bannerLower.includes('apache')) {
      service = 'Apache HTTP Server';
      const apacheMatch = banner.match(/Apache\/([\d.]+)/i);
      if (apacheMatch) {
        version = apacheMatch[1];
        cpe = `cpe:/a:apache:http_server:${version}`;
        confidence = 95;
      }
    }
    
    // Nginx
    if (bannerLower.includes('nginx')) {
      service = 'Nginx';
      const nginxMatch = banner.match(/nginx\/([\d.]+)/i);
      if (nginxMatch) {
        version = nginxMatch[1];
        cpe = `cpe:/a:nginx:nginx:${version}`;
        confidence = 95;
      }
    }
    
    // IIS
    if (bannerLower.includes('microsoft-iis')) {
      service = 'Microsoft IIS';
      const iisMatch = banner.match(/Microsoft-IIS\/([\d.]+)/i);
      if (iisMatch) {
        version = iisMatch[1];
        cpe = `cpe:/a:microsoft:iis:${version}`;
        confidence = 95;
      }
    }
  }

  // FTP Detection
  if (port === 21 || bannerLower.includes('ftp')) {
    service = 'FTP';
    confidence = 85;
    
    if (bannerLower.includes('vsftpd')) {
      service = 'vsftpd';
      const vsftpdMatch = banner.match(/vsftpd ([\d.]+)/i);
      if (vsftpdMatch) {
        version = vsftpdMatch[1];
        confidence = 95;
        // vsftpd 2.3.4 has a known backdoor
        if (version === '2.3.4') {
          vulnerabilities.push('CVE-2011-2523: Backdoor vulnerability');
        }
      }
    } else if (bannerLower.includes('proftpd')) {
      service = 'ProFTPD';
      const proftpdMatch = banner.match(/ProFTPD ([\d.]+)/i);
      if (proftpdMatch) {
        version = proftpdMatch[1];
        confidence = 95;
      }
    }
  }

  // SMTP Detection
  if (port === 25 || bannerLower.includes('smtp') || bannerLower.includes('esmtp')) {
    service = 'SMTP';
    confidence = 85;
    
    if (bannerLower.includes('postfix')) {
      service = 'Postfix SMTP';
      confidence = 90;
    } else if (bannerLower.includes('sendmail')) {
      service = 'Sendmail';
      confidence = 90;
    } else if (bannerLower.includes('exim')) {
      service = 'Exim';
      confidence = 90;
    }
  }

  // MySQL Detection
  if (port === 3306 || bannerLower.includes('mysql')) {
    service = 'MySQL';
    confidence = 90;
    const mysqlMatch = banner.match(/([\d.]+)-/);
    if (mysqlMatch) {
      version = mysqlMatch[1];
      cpe = `cpe:/a:mysql:mysql:${version}`;
      confidence = 95;
    }
  }

  // PostgreSQL Detection
  if (port === 5432 || bannerLower.includes('postgresql')) {
    service = 'PostgreSQL';
    confidence = 90;
  }

  // Redis Detection
  if (port === 6379 || bannerLower.includes('redis')) {
    service = 'Redis';
    confidence = 90;
    if (bannerLower.includes('redis_version')) {
      const redisMatch = banner.match(/redis_version:([\d.]+)/i);
      if (redisMatch) {
        version = redisMatch[1];
        confidence = 95;
      }
    }
  }

  // MongoDB Detection
  if (port === 27017) {
    service = 'MongoDB';
    confidence = 85;
  }

  // SMB Detection
  if (port === 445 || bannerLower.includes('smb')) {
    service = 'SMB';
    confidence = 85;
  }

  // RDP Detection
  if (port === 3389) {
    service = 'RDP';
    confidence = 85;
  }

  return { service, version, confidence, cpe, vulnerabilities: vulnerabilities.length > 0 ? vulnerabilities : undefined };
}

/**
 * Parse port range string
 */
function parsePorts(ports: string): number[] {
  const out = new Set<number>();
  for (const part of ports.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((n) => parseInt(n, 10));
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let p = start; p <= end; p++) out.add(p);
    } else {
      out.add(parseInt(part, 10));
    }
  }
  return [...out]
    .filter((p) => Number.isFinite(p) && p > 0 && p < 65536)
    .sort((a, b) => a - b);
}

/**
 * Perform service detection scan
 */
export async function performServiceDetection(
  target: string,
  ports: string,
  timeoutMs: number = 5000
): Promise<ServiceDetectionResult> {
  const startTime = Date.now();

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

  const portList = parsePorts(ports);
  const services: ServiceInfo[] = [];

  // Scan ports concurrently
  const scanPromises = portList.map(async (port) => {
    const isOpen = await isPortOpen(resolvedTarget, port, timeoutMs);
    
    if (!isOpen) return null;

    const banner = await grabBanner(resolvedTarget, port, 3000);
    
    let serviceInfo: ServiceInfo;
    
    if (banner) {
      const analysis = analyzeBanner(port, banner);
      serviceInfo = {
        port,
        protocol: SERVICE_SIGNATURES[port]?.protocol || 'tcp',
        service: analysis.service,
        version: analysis.version,
        banner: banner.substring(0, 500), // Limit banner length
        cpe: analysis.cpe,
        confidence: analysis.confidence,
        vulnerabilities: analysis.vulnerabilities,
      };
    } else {
      // No banner, use signature database
      const signature = SERVICE_SIGNATURES[port];
      serviceInfo = {
        port,
        protocol: signature?.protocol || 'tcp',
        service: signature?.service || 'Unknown',
        confidence: signature ? 70 : 40,
      };
    }

    return serviceInfo;
  });

  const results = await Promise.all(scanPromises);
  
  for (const result of results) {
    if (result) services.push(result);
  }

  const scanDuration = Math.round((Date.now() - startTime) / 1000);

  return {
    target,
    totalServices: services.length,
    services,
    scanDuration,
  };
}
