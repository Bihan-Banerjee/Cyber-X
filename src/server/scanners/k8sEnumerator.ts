import { performance } from 'node:perf_hooks';
import https from 'node:https';
import http from 'node:http';

export interface K8sResource {
  type: string;
  name: string;
  namespace: string;
  status: string;
  issues: string[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface K8sMisconfiguration {
  category: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resource: string;
  description: string;
  recommendation: string;
}

export interface K8sEnumerationResult {
  clusterName: string;
  version: string;
  totalResources: number;
  namespaces: string[];
  resources: K8sResource[];
  misconfigurations: K8sMisconfiguration[];
  securityScore: number;
  riskLevel: string;
  findings: {
    privilegedPods: number;
    exposedSecrets: number;
    publicServices: number;
    missingRBAC: number;
    insecureConfigs: number;
  };
  scanDuration: number;
  note?: string;
}

interface ApiResp { status: number; body: any; }

/**
 * GET a Kubernetes API path. TLS verification is disabled because API servers
 * commonly present a private-CA/self-signed certificate — this is an
 * authenticated admin tool the operator points at their OWN cluster.
 */
function k8sGet(base: string, path: string, token: string | undefined, timeoutMs: number): Promise<ApiResp> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try { u = new URL(path, base.endsWith('/') ? base : base + '/'); } catch { return reject(new Error('Invalid API endpoint URL')); }
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json' },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => { let body: any = null; try { body = JSON.parse(data); } catch { /* non-JSON */ } resolve({ status: res.statusCode || 0, body }); });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Connection timed out')));
    req.end();
  });
}

function scoreFromMisconfigs(m: K8sMisconfiguration[]): number {
  let s = 100;
  for (const x of m) s -= x.severity === 'critical' ? 15 : x.severity === 'high' ? 10 : x.severity === 'medium' ? 5 : 2;
  return Math.max(0, s);
}

/**
 * Enumerate a Kubernetes cluster via its REST API using a bearer token.
 * Queries real endpoints (/version, /api/v1/namespaces, pods, services, secrets)
 * and derives findings from live data — no mock resources. Per-resource 403s are
 * tolerated (a scoped token still yields partial results).
 */
export async function performK8sEnumeration(
  apiEndpoint: string,
  token?: string,
  timeoutMs: number = 30000
): Promise<K8sEnumerationResult> {
  const startTime = performance.now();
  const perCall = Math.min(Math.max(timeoutMs, 3000), 15000);

  if (!/^https?:\/\//i.test(apiEndpoint)) {
    throw new Error('API endpoint must be a full URL, e.g. https://<host>:6443');
  }

  // Connectivity + auth check via /version.
  let version = 'unknown';
  try {
    const v = await k8sGet(apiEndpoint, 'version', token, perCall);
    if (v.status === 401 || v.status === 403) throw new Error('Unauthorized — the token is missing, invalid, or lacks permission.');
    if (v.status === 0 || v.body === null) {
      // /version may be closed; try /api as a fallback probe.
      const api = await k8sGet(apiEndpoint, 'api', token, perCall);
      if (api.status === 401 || api.status === 403) throw new Error('Unauthorized — the token is missing, invalid, or lacks permission.');
      if (!api.body) throw new Error('Endpoint did not return a Kubernetes API response (is this a kube-apiserver URL?).');
    } else {
      version = v.body?.gitVersion || 'unknown';
    }
  } catch (e: any) {
    const msg = /unauthorized/i.test(e.message) ? e.message
      : `Could not reach the Kubernetes API at ${apiEndpoint}: ${e.message}`;
    throw new Error(msg);
  }

  const resources: K8sResource[] = [];
  const misconfigurations: K8sMisconfiguration[] = [];
  const permIssues: string[] = [];

  // Namespaces
  let namespaces: string[] = [];
  const ns = await k8sGet(apiEndpoint, 'api/v1/namespaces', token, perCall);
  if (ns.status === 200 && Array.isArray(ns.body?.items)) namespaces = ns.body.items.map((i: any) => i.metadata?.name).filter(Boolean);
  else if (ns.status === 403) permIssues.push('list namespaces');

  // Pods (cluster-wide)
  const pods = await k8sGet(apiEndpoint, 'api/v1/pods', token, perCall);
  if (pods.status === 200 && Array.isArray(pods.body?.items)) {
    for (const p of pods.body.items.slice(0, 300)) {
      const containers = [...(p.spec?.containers || []), ...(p.spec?.initContainers || [])];
      const privileged = containers.some((c: any) => c.securityContext?.privileged === true);
      const runsRoot = !(p.spec?.securityContext?.runAsNonRoot === true) && !containers.some((c: any) => c.securityContext?.runAsNonRoot === true);
      const hostNet = p.spec?.hostNetwork === true;
      const defaultSA = !p.spec?.serviceAccountName || p.spec.serviceAccountName === 'default';
      const issues: string[] = [];
      if (privileged) issues.push('Running as privileged');
      if (hostNet) issues.push('hostNetwork enabled');
      if (runsRoot) issues.push('May run as root (no runAsNonRoot)');
      if (defaultSA) issues.push('Uses default service account');
      resources.push({
        type: 'Pod', name: p.metadata?.name || '?', namespace: p.metadata?.namespace || '?',
        status: p.status?.phase || 'Unknown', issues,
        severity: privileged || hostNet ? 'critical' : issues.length ? 'high' : 'low',
      });
      const rname = `${p.metadata?.namespace}/${p.metadata?.name}`;
      if (privileged) misconfigurations.push({ category: 'Pod Security', issue: 'Privileged Pod', severity: 'critical', resource: rname, description: 'Container runs with privileged: true (full host access).', recommendation: 'Remove privileged; grant only required capabilities.' });
      if (hostNet) misconfigurations.push({ category: 'Pod Security', issue: 'hostNetwork Enabled', severity: 'high', resource: rname, description: 'Pod shares the host network namespace.', recommendation: 'Disable hostNetwork unless strictly required.' });
    }
  } else if (pods.status === 403) permIssues.push('list pods');

  // Services
  const svcs = await k8sGet(apiEndpoint, 'api/v1/services', token, perCall);
  if (svcs.status === 200 && Array.isArray(svcs.body?.items)) {
    for (const s of svcs.body.items.slice(0, 200)) {
      const type = s.spec?.type || 'ClusterIP';
      const isPublic = type === 'LoadBalancer' || type === 'NodePort';
      resources.push({
        type: 'Service', name: s.metadata?.name || '?', namespace: s.metadata?.namespace || '?',
        status: type, issues: isPublic ? [`Exposed via ${type}`] : [], severity: isPublic ? 'high' : 'low',
      });
      if (isPublic) misconfigurations.push({ category: 'Network', issue: `Publicly exposed Service (${type})`, severity: 'high', resource: `${s.metadata?.namespace}/${s.metadata?.name}`, description: `Service type ${type} exposes it outside the cluster.`, recommendation: 'Use ClusterIP + an ingress with authn/authz where possible.' });
    }
  } else if (svcs.status === 403) permIssues.push('list services');

  // Secrets — being able to list them at all is itself an RBAC finding.
  const secrets = await k8sGet(apiEndpoint, 'api/v1/secrets', token, perCall);
  let listableSecrets = 0;
  if (secrets.status === 200 && Array.isArray(secrets.body?.items)) {
    listableSecrets = secrets.body.items.length;
    for (const s of secrets.body.items.slice(0, 100)) {
      resources.push({ type: 'Secret', name: s.metadata?.name || '?', namespace: s.metadata?.namespace || '?', status: s.type || 'Opaque', issues: ['Readable with this token'], severity: 'high' });
    }
    if (listableSecrets > 0) misconfigurations.push({ category: 'RBAC', issue: 'Secrets listable with this token', severity: 'critical', resource: 'cluster-wide', description: `This token can list ${listableSecrets} secrets — overly broad RBAC.`, recommendation: 'Restrict secret access with least-privilege RBAC roles.' });
  } else if (secrets.status === 403) permIssues.push('list secrets');

  const findings = {
    privilegedPods: resources.filter((r) => r.type === 'Pod' && r.issues.includes('Running as privileged')).length,
    exposedSecrets: listableSecrets,
    publicServices: resources.filter((r) => r.type === 'Service' && r.issues.length > 0).length,
    missingRBAC: misconfigurations.filter((m) => m.category === 'RBAC').length,
    insecureConfigs: misconfigurations.filter((m) => m.category !== 'RBAC').length,
  };

  const securityScore = scoreFromMisconfigs(misconfigurations);
  const riskLevel = securityScore >= 80 ? 'LOW' : securityScore >= 60 ? 'MEDIUM' : securityScore >= 40 ? 'HIGH' : 'CRITICAL';

  let clusterName = 'kubernetes';
  try { clusterName = new URL(apiEndpoint).hostname; } catch { /* noop */ }

  const note = permIssues.length
    ? `Limited permissions: this token could not ${permIssues.join(', ')}. Results are partial.`
    : undefined;

  return {
    clusterName, version, totalResources: resources.length, namespaces, resources,
    misconfigurations, securityScore, riskLevel, findings,
    scanDuration: Math.round((performance.now() - startTime) / 1000), note,
  };
}
