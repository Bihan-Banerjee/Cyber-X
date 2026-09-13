/**
 * ssrfGuard.ts — Server-Side Request Forgery guard for user-supplied URLs.
 *
 * Many CyberX scanners fetch a user-supplied URL from the server. On an exposed
 * instance that is an SSRF primitive: a caller can make the server hit
 * 169.254.169.254 (cloud metadata), 127.0.0.1 (internal admin), or RFC1918
 * hosts. This guard rejects those ranges BY DEFAULT.
 *
 * Lab use (testing your own localhost app) is still possible: set
 * CYBERX_ALLOW_PRIVATE_TARGETS=1 to allow private/loopback targets. Keep it
 * unset (the default) whenever the server is reachable by anyone else.
 *
 * Note: this validates the hostname/literal IP in the URL. Full DNS-rebinding
 * protection would also pin the resolved IP at fetch time; that is a larger
 * change — this closes the common, high-impact cases.
 */

const ALLOW_PRIVATE = process.env.CYBERX_ALLOW_PRIVATE_TARGETS === '1';

const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'ip6-localhost', 'ip6-loopback',
]);

/** Is a literal IPv4 string in a private / loopback / link-local / metadata range? */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false; // not an IPv4 literal
  }
  const [a, b] = parts;
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 127) return true;                         // loopback
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 169 && b === 254) return true;            // link-local + metadata (169.254.169.254)
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT 100.64.0.0/10
  if (a === 0) return true;                           // 0.0.0.0/8
  return false;
}

function isBlockedIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true;         // loopback / unspecified
  if (h.startsWith('fe80')) return true;              // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local
  if (h.startsWith('::ffff:')) {                      // IPv4-mapped
    return isBlockedIPv4(h.slice('::ffff:'.length));
  }
  return false;
}

export interface UrlCheck { allowed: boolean; reason?: string; }

/** Validate a user-supplied URL string for SSRF safety. */
export function checkUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { allowed: false, reason: 'invalid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { allowed: false, reason: `blocked protocol: ${url.protocol}` };
  }
  if (ALLOW_PRIVATE) return { allowed: true };

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { allowed: false, reason: `blocked host: ${host}` };
  }
  if (host.includes(':') && isBlockedIPv6(host)) {
    return { allowed: false, reason: `blocked IPv6 range: ${host}` };
  }
  if (isBlockedIPv4(host)) {
    return { allowed: false, reason: `blocked IPv4 range: ${host}` };
  }
  return { allowed: true };
}

/** Throw if a URL is not allowed. Use before any server-side fetch of a
 *  user-supplied URL. */
export function assertUrlAllowed(raw: string): void {
  const { allowed, reason } = checkUrl(raw);
  if (!allowed) {
    throw new Error(
      `Request to '${raw}' refused (${reason}). Set CYBERX_ALLOW_PRIVATE_TARGETS=1 `
      + 'to allow private/loopback targets in a trusted lab environment.',
    );
  }
}
