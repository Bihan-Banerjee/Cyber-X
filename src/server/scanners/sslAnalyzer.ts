import tls from 'node:tls';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SSLVulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  recommendation: string;
}

export interface SSLScanResult {
  domain: string;
  certificate: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    daysRemaining: number;
    selfSigned: boolean;
    sans: string[];
    serialNumber: string;
    signatureAlgorithm: string;
  };
  cipherSuites: string[];
  protocolVersions: string[];
  hstsEnabled: boolean;
  hstsMaxAge: number | null;
  vulnerabilities: SSLVulnerability[];
  overallGrade: string;
  scanDuration: number;
}

const WEAK_CIPHER_PATTERNS = ['RC4', 'DES', '3DES', 'EXPORT', 'NULL', 'ANON', 'ADH', 'AECDH', 'MD5'];

function calculateGrade(vulnerabilities: SSLVulnerability[]): string {
  const critCount = vulnerabilities.filter((v) => v.severity === 'critical').length;
  const highCount = vulnerabilities.filter((v) => v.severity === 'high').length;
  const medCount = vulnerabilities.filter((v) => v.severity === 'medium').length;

  if (critCount >= 2) return 'F';
  if (critCount === 1) return 'D';
  if (highCount >= 2) return 'C';
  if (highCount === 1) return 'B';
  if (medCount >= 3) return 'B+';
  if (medCount >= 1) return 'A';
  return 'A+';
}

async function checkHSTS(domain: string, timeoutMs: number): Promise<{ enabled: boolean; maxAge: number | null }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`https://${domain}/`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    const hstsHeader = response.headers.get('strict-transport-security');
    if (!hstsHeader) return { enabled: false, maxAge: null };
    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/i);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;
    return { enabled: true, maxAge };
  } catch {
    return { enabled: false, maxAge: null };
  }
}

export async function performSSLAnalysis(
  domain: string,
  timeoutMs: number = 10000
): Promise<SSLScanResult> {
  const start = performance.now();
  logToolActivity('SSL Analyzer', `Connecting to ${domain}:443`, 'info');

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        timeout: timeoutMs,
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      },
      async () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol() || 'unknown';

          const vulnerabilities: SSLVulnerability[] = [];

          // Check self-signed
          const isSelfSigned =
            !cert.issuerCertificate ||
            (cert.issuerCertificate.fingerprint &&
              cert.issuerCertificate.fingerprint === cert.fingerprint);

          if (isSelfSigned) {
            vulnerabilities.push({
              severity: 'high',
              description: 'Self-signed certificate detected. Browsers will show security warnings.',
              recommendation: 'Obtain a certificate from a trusted Certificate Authority such as Let\'s Encrypt.',
            });
          }

          // Check expiry
          const validTo = new Date(cert.valid_to);
          const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          if (daysRemaining < 0) {
            vulnerabilities.push({
              severity: 'critical',
              description: `Certificate expired ${Math.abs(daysRemaining)} days ago.`,
              recommendation: 'Renew the certificate immediately — all connections are currently untrusted.',
            });
          } else if (daysRemaining < 7) {
            vulnerabilities.push({
              severity: 'critical',
              description: `Certificate expires in ${daysRemaining} days.`,
              recommendation: 'Renew the certificate immediately.',
            });
          } else if (daysRemaining < 30) {
            vulnerabilities.push({
              severity: 'high',
              description: `Certificate expires in ${daysRemaining} days.`,
              recommendation: 'Renew the certificate soon to avoid service interruption.',
            });
          }

          // Check SHA1 signature
          const sigAlgo = (cert as any).sigalg || '';
          if (sigAlgo.toLowerCase().includes('sha1')) {
            vulnerabilities.push({
              severity: 'high',
              description: 'Certificate uses SHA-1 signature algorithm which is cryptographically broken.',
              recommendation: 'Reissue the certificate with SHA-256 or stronger signature algorithm.',
            });
          }

          // Check weak cipher
          const cipherName = cipher?.name || '';
          if (WEAK_CIPHER_PATTERNS.some((p) => cipherName.toUpperCase().includes(p))) {
            vulnerabilities.push({
              severity: 'high',
              description: `Weak cipher suite in use: ${cipherName}. This cipher is considered insecure.`,
              recommendation: 'Disable weak ciphers and use AES-GCM or ChaCha20-Poly1305 instead.',
            });
          }

          // Check legacy protocol
          if (protocol === 'TLSv1' || protocol === 'TLSv1.1' || protocol === 'SSLv3') {
            vulnerabilities.push({
              severity: 'high',
              description: `Server negotiated legacy protocol: ${protocol}. This version has known vulnerabilities.`,
              recommendation: 'Disable TLS 1.0 and 1.1. Only allow TLS 1.2 and TLS 1.3.',
            });
          }

          socket.destroy();

          // Check HSTS
          const { enabled: hstsEnabled, maxAge: hstsMaxAge } = await checkHSTS(domain, Math.min(timeoutMs, 5000));

          if (!hstsEnabled) {
            vulnerabilities.push({
              severity: 'medium',
              description: 'HSTS (Strict-Transport-Security) header is not set.',
              recommendation: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" header.',
            });
          } else if (hstsMaxAge !== null && hstsMaxAge < 15768000) {
            vulnerabilities.push({
              severity: 'low',
              description: `HSTS max-age is only ${hstsMaxAge} seconds. Recommended minimum is 6 months (15768000s).`,
              recommendation: 'Increase HSTS max-age to at least 31536000 (1 year).',
            });
          }

          // Parse SANs
          const sans = (cert.subjectaltname || '')
            .split(', ')
            .filter(Boolean)
            .map((s) => s.replace(/^DNS:/, ''));

          const result: SSLScanResult = {
            domain,
            certificate: {
              subject: cert.subject?.CN || domain,
              issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              daysRemaining,
              selfSigned: isSelfSigned,
              sans,
              serialNumber: cert.serialNumber || '',
              signatureAlgorithm: sigAlgo || 'Unknown',
            },
            cipherSuites: cipherName ? [cipherName] : [],
            protocolVersions: [protocol],
            hstsEnabled,
            hstsMaxAge,
            vulnerabilities,
            overallGrade: calculateGrade(vulnerabilities),
            scanDuration: Math.round((performance.now() - start) / 1000),
          };

          logToolActivity('SSL Analyzer', `Completed analysis for ${domain} — grade ${result.overallGrade}`, 'success');
          resolve(result);
        } catch (innerErr) {
          socket.destroy();
          reject(innerErr);
        }
      }
    );

    socket.on('error', (err) => {
      socket.destroy();
      logToolActivity('SSL Analyzer', `Connection error for ${domain}: ${err.message}`, 'warning');
      reject(new Error(`TLS connection failed: ${err.message}`));
    });

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}
