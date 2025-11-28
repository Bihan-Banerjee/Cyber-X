import { performance } from 'node:perf_hooks';

export interface Vulnerability {
  cve: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
}

export interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  recommendation: string;
}

export interface ContainerScanResult {
  imageName: string;
  imageId: string;
  baseImage?: string;
  totalVulnerabilities: number;
  vulnerabilities: Vulnerability[];
  securityIssues: SecurityIssue[];
  securityScore: number;
  riskLevel: string;
  layers: number;
  size: string;
  created: string;
  vulnerabilityCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanDuration: number;
}

// Mock vulnerability database (in production, this would integrate with CVE databases)
const MOCK_VULNERABILITIES: Record<string, Vulnerability[]> = {
  'nginx': [
    {
      cve: 'CVE-2023-44487',
      severity: 'high',
      package: 'nginx',
      version: '1.24.0',
      fixedVersion: '1.25.2',
      description: 'HTTP/2 Rapid Reset Attack vulnerability in nginx',
    },
    {
      cve: 'CVE-2022-41741',
      severity: 'medium',
      package: 'nginx',
      version: '1.24.0',
      fixedVersion: '1.23.2',
      description: 'Integer overflow in mp4 module',
    },
  ],
  'ubuntu': [
    {
      cve: 'CVE-2023-4911',
      severity: 'critical',
      package: 'glibc',
      version: '2.35-0ubuntu3',
      fixedVersion: '2.35-0ubuntu3.4',
      description: 'Buffer overflow in glibc dynamic loader (Looney Tunables)',
    },
    {
      cve: 'CVE-2023-38545',
      severity: 'high',
      package: 'curl',
      version: '7.81.0-1ubuntu1.13',
      fixedVersion: '7.81.0-1ubuntu1.14',
      description: 'SOCKS5 heap buffer overflow in libcurl',
    },
    {
      cve: 'CVE-2023-29491',
      severity: 'medium',
      package: 'ncurses',
      version: '6.3-2',
      fixedVersion: '6.3-2ubuntu0.1',
      description: 'Memory corruption in ncurses',
    },
  ],
  'alpine': [
    {
      cve: 'CVE-2023-5363',
      severity: 'high',
      package: 'openssl',
      version: '3.1.2-r0',
      fixedVersion: '3.1.4-r0',
      description: 'Incorrect cipher key and IV length processing in OpenSSL',
    },
  ],
  'node': [
    {
      cve: 'CVE-2023-46809',
      severity: 'critical',
      package: 'nodejs',
      version: '18.16.0',
      fixedVersion: '18.19.0',
      description: 'Node.js permission model bypass via path traversal',
    },
    {
      cve: 'CVE-2023-39333',
      severity: 'high',
      package: 'nodejs',
      version: '18.16.0',
      fixedVersion: '18.18.2',
      description: 'Code injection via WebAssembly export names',
    },
  ],
  'python': [
    {
      cve: 'CVE-2023-40217',
      severity: 'high',
      package: 'python3',
      version: '3.11.4',
      fixedVersion: '3.11.5',
      description: 'TLS handshake bypass in Python SSL module',
    },
    {
      cve: 'CVE-2023-27043',
      severity: 'medium',
      package: 'python3',
      version: '3.11.4',
      fixedVersion: '3.11.6',
      description: 'Email header injection in Python email library',
    },
  ],
};

// Common security issues to check
const SECURITY_CHECKS = [
  {
    check: (imageName: string) => imageName.includes('latest'),
    issue: {
      type: 'Using :latest Tag',
      severity: 'medium' as const,
      description: 'Image uses the "latest" tag which is not recommended for production. Version-specific tags should be used.',
      recommendation: 'Use specific version tags (e.g., nginx:1.25.2) instead of :latest to ensure reproducible builds',
    },
  },
  {
    check: (imageName: string) => !imageName.includes('alpine') && !imageName.includes('slim'),
    issue: {
      type: 'Large Base Image',
      severity: 'low' as const,
      description: 'Image may be using a full OS base instead of minimal variants, increasing attack surface.',
      recommendation: 'Consider using Alpine or slim variants to reduce image size and attack surface',
    },
  },
  {
    check: () => Math.random() > 0.5,
    issue: {
      type: 'Running as Root',
      severity: 'high' as const,
      description: 'Container appears to be configured to run as root user, which is a security risk.',
      recommendation: 'Use USER directive in Dockerfile to run as non-root user',
    },
  },
  {
    check: () => Math.random() > 0.6,
    issue: {
      type: 'Exposed Secrets',
      severity: 'critical' as const,
      description: 'Potential secrets or credentials found in image layers.',
      recommendation: 'Use Docker secrets or environment variables instead of hardcoding credentials',
    },
  },
  {
    check: () => Math.random() > 0.7,
    issue: {
      type: 'Unnecessary Packages',
      severity: 'low' as const,
      description: 'Image contains development tools or unnecessary packages that increase attack surface.',
      recommendation: 'Use multi-stage builds and remove unnecessary packages',
    },
  },
];

/**
 * Detect base image from image name
 */
function detectBaseImage(imageName: string): string | undefined {
  const baseImages = ['ubuntu', 'alpine', 'debian', 'centos', 'fedora', 'nginx', 'node', 'python', 'java', 'golang'];
  
  for (const base of baseImages) {
    if (imageName.toLowerCase().includes(base)) {
      return base;
    }
  }
  
  return undefined;
}

/**
 * Get vulnerabilities for an image
 */
function getVulnerabilitiesForImage(imageName: string): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  // Check each known vulnerable package
  for (const [pkg, vulns] of Object.entries(MOCK_VULNERABILITIES)) {
    if (imageName.toLowerCase().includes(pkg)) {
      vulnerabilities.push(...vulns);
    }
  }
  
  // Add some random additional vulnerabilities
  const additionalVulns = [
    {
      cve: 'CVE-2023-1234',
      severity: 'low' as const,
      package: 'libssl',
      version: '1.1.1k',
      fixedVersion: '1.1.1l',
      description: 'Minor information disclosure in SSL/TLS implementation',
    },
    {
      cve: 'CVE-2023-5678',
      severity: 'medium' as const,
      package: 'zlib',
      version: '1.2.11',
      fixedVersion: '1.2.13',
      description: 'Buffer overflow in compression library',
    },
  ];
  
  if (Math.random() > 0.5) {
    vulnerabilities.push(additionalVulns[0]);
  }
  if (Math.random() > 0.6) {
    vulnerabilities.push(additionalVulns[1]);
  }
  
  return vulnerabilities;
}

/**
 * Check for security issues
 */
function checkSecurityIssues(imageName: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  for (const check of SECURITY_CHECKS) {
    if (check.check(imageName)) {
      issues.push(check.issue);
    }
  }
  
  return issues;
}

/**
 * Calculate security score
 */
function calculateSecurityScore(
  vulnerabilityCount: { critical: number; high: number; medium: number; low: number },
  issueCount: number
): number {
  let score = 100;
  
  score -= vulnerabilityCount.critical * 15;
  score -= vulnerabilityCount.high * 8;
  score -= vulnerabilityCount.medium * 4;
  score -= vulnerabilityCount.low * 1;
  score -= issueCount * 3;
  
  return Math.max(0, score);
}

/**
 * Perform container security scan
 */
export async function performContainerScan(
  imageName: string,
  timeoutMs: number = 30000
): Promise<ContainerScanResult> {
  const startTime = performance.now();
  
  // Simulate fetching image metadata
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const baseImage = detectBaseImage(imageName);
  const vulnerabilities = getVulnerabilitiesForImage(imageName);
  const securityIssues = checkSecurityIssues(imageName);
  
  // Count vulnerabilities by severity
  const vulnerabilityCount = {
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    medium: vulnerabilities.filter(v => v.severity === 'medium').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
  };
  
  const securityScore = calculateSecurityScore(vulnerabilityCount, securityIssues.length);
  
  const riskLevel = 
    securityScore >= 80 ? 'LOW' :
    securityScore >= 60 ? 'MEDIUM' :
    securityScore >= 40 ? 'HIGH' : 'CRITICAL';
  
  const scanDuration = Math.round((performance.now() - startTime) / 1000);
  
  // Generate mock image metadata
  const imageId = 'sha256:' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const layers = Math.floor(Math.random() * 15) + 5;
  const sizeMB = Math.floor(Math.random() * 500) + 50;
  const size = `${sizeMB} MB`;
  const created = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return {
    imageName,
    imageId,
    baseImage,
    totalVulnerabilities: vulnerabilities.length,
    vulnerabilities,
    securityIssues,
    securityScore,
    riskLevel,
    layers,
    size,
    created,
    vulnerabilityCount,
    scanDuration,
  };
}
