import { performance } from 'node:perf_hooks';

interface Vulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface JWTAnalysisResult {
  valid: boolean;
  header: any;
  payload: any;
  signature: string;
  algorithm: string;
  issuer?: string;
  subject?: string;
  audience?: string;
  expiresAt?: number;
  issuedAt?: number;
  notBefore?: number;
  isExpired: boolean;
  timeUntilExpiry?: string;
  vulnerabilities: Vulnerability[];
  securityScore: number;
  riskLevel: string;
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Pad with '=' to make length multiple of 4
  while (base64.length % 4) {
    base64 += '=';
  }
  
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Parse JWT token
 */
function parseJWT(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');
  
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  const signature = parts[2];
  
  return { header, payload, signature };
}

/**
 * Check for vulnerabilities
 */
function analyzeVulnerabilities(header: any, payload: any): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  
  // Check for 'none' algorithm
  if (header.alg === 'none' || header.alg === 'None' || header.alg === 'NONE') {
    vulns.push({
      type: 'Algorithm "none" Detected',
      severity: 'critical',
      description: 'JWT uses "none" algorithm which allows signature bypass. Anyone can forge tokens.',
      recommendation: 'Use strong signing algorithms like RS256 or HS256. Never accept "none" algorithm.',
    });
  }
  
  // Check for weak algorithms
  if (header.alg === 'HS256' || header.alg === 'HS384' || header.alg === 'HS512') {
    vulns.push({
      type: 'HMAC Algorithm Detected',
      severity: 'medium',
      description: 'JWT uses HMAC symmetric algorithm. Vulnerable to brute-force attacks if secret is weak.',
      recommendation: 'Use asymmetric algorithms like RS256, RS384, or RS512 for better security.',
    });
  }
  
  // Check for algorithm confusion vulnerability
  if (header.alg && header.alg.startsWith('HS')) {
    vulns.push({
      type: 'Algorithm Confusion Risk',
      severity: 'high',
      description: 'HMAC algorithm susceptible to algorithm confusion attacks. Attacker could change to RSA and use public key.',
      recommendation: 'Explicitly validate expected algorithm. Do not rely on alg header alone.',
    });
  }
  
  // Check for missing expiration
  if (!payload.exp) {
    vulns.push({
      type: 'No Expiration Time',
      severity: 'high',
      description: 'JWT has no expiration (exp) claim. Token remains valid indefinitely.',
      recommendation: 'Always set expiration time. Tokens should have short lifespans (e.g., 15 minutes).',
    });
  }
  
  // Check for long expiration
  if (payload.exp && payload.iat) {
    const lifespanHours = (payload.exp - payload.iat) / 3600;
    if (lifespanHours > 24) {
      vulns.push({
        type: 'Excessive Token Lifespan',
        severity: 'medium',
        description: `Token is valid for ${Math.round(lifespanHours)} hours. Long-lived tokens increase security risk.`,
        recommendation: 'Reduce token lifespan. Use refresh tokens for long sessions.',
      });
    }
  }
  
  // Check for sensitive data in payload
  const sensitiveKeys = ['password', 'secret', 'apiKey', 'api_key', 'privateKey', 'credit_card', 'ssn'];
  const payloadKeys = Object.keys(payload).map(k => k.toLowerCase());
  
  for (const key of sensitiveKeys) {
    if (payloadKeys.includes(key.toLowerCase())) {
      vulns.push({
        type: 'Sensitive Data in Payload',
        severity: 'critical',
        description: `JWT payload contains sensitive field: "${key}". Payload is not encrypted and can be decoded by anyone.`,
        recommendation: 'Never store sensitive information in JWT payload. Use encrypted tokens or store sensitive data server-side.',
      });
      break;
    }
  }
  
  // Check for jku header
  if (header.jku) {
    vulns.push({
      type: 'JKU Header Present',
      severity: 'high',
      description: 'JWT contains jku (JWK Set URL) header. Vulnerable to key injection attacks if not validated.',
      recommendation: 'Remove jku header or strictly validate URLs against whitelist.',
    });
  }
  
  // Check for kid manipulation risk
  if (header.kid) {
    vulns.push({
      type: 'Key ID Parameter Present',
      severity: 'medium',
      description: 'JWT contains kid (Key ID) parameter. Could be vulnerable to path traversal or SQL injection.',
      recommendation: 'Validate and sanitize kid parameter. Use whitelisted values only.',
    });
  }
  
  return vulns;
}

/**
 * Calculate security score
 */
function calculateSecurityScore(vulns: Vulnerability[]): number {
  let score = 100;
  
  vulns.forEach(v => {
    switch (v.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  });
  
  return Math.max(0, score);
}

/**
 * Format time until expiry
 */
function formatTimeUntilExpiry(exp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = exp - now;
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Decode and analyze JWT
 */
export async function decodeJWT(token: string): Promise<JWTAnalysisResult> {
  try {
    const { header, payload, signature } = parseJWT(token);
    
    const vulnerabilities = analyzeVulnerabilities(header, payload);
    
    const algorithm = header.alg || 'unknown';
    const issuer = payload.iss;
    const subject = payload.sub;
    const audience = payload.aud;
    const expiresAt = payload.exp;
    const issuedAt = payload.iat;
    const notBefore = payload.nbf;
    
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiresAt ? expiresAt < now : false;
    const timeUntilExpiry = expiresAt ? formatTimeUntilExpiry(expiresAt) : undefined;
    
    const securityScore = calculateSecurityScore(vulnerabilities);
    const riskLevel = 
      securityScore >= 80 ? 'LOW' :
      securityScore >= 60 ? 'MEDIUM' :
      securityScore >= 40 ? 'HIGH' : 'CRITICAL';
    
    return {
      valid: true,
      header,
      payload,
      signature,
      algorithm,
      issuer,
      subject,
      audience,
      expiresAt,
      issuedAt,
      notBefore,
      isExpired,
      timeUntilExpiry,
      vulnerabilities,
      securityScore,
      riskLevel,
    };
  } catch (error: any) {
    throw new Error(`Failed to decode JWT: ${error.message}`);
  }
}
