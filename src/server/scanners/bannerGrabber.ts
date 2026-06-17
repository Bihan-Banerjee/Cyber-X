import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface BannerEntry {
  port: number;
  service: string;
  banner: string;
  open: boolean;
}

export interface BannerResult {
  target: string;
  results: BannerEntry[];
}

const SERVICE_NAMES: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  23: 'TELNET',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  445: 'SMB',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'HTTP-ALT',
  8443: 'HTTPS-ALT',
  27017: 'MongoDB',
};

const HTTP_PROBE = 'GET / HTTP/1.0\r\nHost: {HOST}\r\n\r\n';

function grabBanner(host: string, port: number, timeout: number): Promise<BannerEntry> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout }, () => {
      let banner = '';

      // Send probe for HTTP-like ports
      if ([80, 8080, 8443, 443].includes(port)) {
        socket.write(HTTP_PROBE.replace('{HOST}', host));
      }

      socket.on('data', (chunk) => {
        banner += chunk.toString('utf8', 0, Math.min(chunk.length, 2048));
        if (banner.length > 2048) socket.destroy();
      });

      socket.on('end', () => {
        socket.destroy();
        resolve({
          port,
          service: SERVICE_NAMES[port] ?? 'UNKNOWN',
          banner: banner.trim().substring(0, 512),
          open: true,
        });
      });

      setTimeout(() => {
        socket.destroy();
        resolve({
          port,
          service: SERVICE_NAMES[port] ?? 'UNKNOWN',
          banner: banner.trim().substring(0, 512),
          open: true,
        });
      }, timeout);
    });

    socket.on('error', () => {
      resolve({
        port,
        service: SERVICE_NAMES[port] ?? 'UNKNOWN',
        banner: '',
        open: false,
      });
    });

    socket.setTimeout(timeout, () => {
      socket.destroy();
      resolve({
        port,
        service: SERVICE_NAMES[port] ?? 'UNKNOWN',
        banner: '',
        open: false,
      });
    });
  });
}

export async function grabBanners(
  target: string,
  ports: number[] = [21, 22, 23, 25, 80, 110, 143, 443, 8080],
  timeoutMs: number = 5000
): Promise<BannerResult> {
  const start = performance.now();
  logToolActivity('Banner Grabber', `Grabbing banners from ${target} on ${ports.length} ports`, 'info');

  const perPort = Math.min(Math.floor(timeoutMs / ports.length), 3000);

  const results = await Promise.all(
    ports.map((port) => grabBanner(target, port, perPort))
  );

  const openCount = results.filter((r) => r.open).length;
  logToolActivity('Banner Grabber', `Got banners from ${openCount}/${ports.length} ports`, 'success');

  return { target, results };
}
