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
  vulnerabilityCount: { critical: number; high: number; medium: number; low: number };
  scanDuration: number;
  /** How CVE scanning was performed, or why it was not available. */
  cveScan: string;
  note?: string;
}

interface ImageRef { namespace: string; repo: string; tag: string; unsupported?: boolean; }

function parseImageRef(ref: string): ImageRef {
  let rest = ref.trim();
  let tag = 'latest';
  const at = rest.indexOf('@');
  if (at > 0) { tag = rest.slice(at + 1); rest = rest.slice(0, at); }
  const slash = rest.lastIndexOf('/');
  const colon = rest.lastIndexOf(':');
  if (colon > slash) { tag = rest.slice(colon + 1); rest = rest.slice(0, colon); }
  const parts = rest.split('/');
  // A dotted/port-bearing first segment means a non-Docker-Hub registry host.
  if (parts.length >= 2 && /[.:]/.test(parts[0])) return { namespace: '', repo: rest, tag, unsupported: true };
  if (parts.length === 1) return { namespace: 'library', repo: parts[0], tag };
  if (parts.length === 2) return { namespace: parts[0], repo: parts[1], tag };
  return { namespace: '', repo: rest, tag, unsupported: true };
}

const j = async (url: string, headers: Record<string, string> = {}) => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  return { ok: r.ok, status: r.status, body: r.ok ? await r.json() : null };
};

function calculateSecurityScore(issues: SecurityIssue[]): number {
  let score = 100;
  for (const i of issues) {
    score -= i.severity === 'critical' ? 20 : i.severity === 'high' ? 12 : i.severity === 'medium' ? 6 : i.severity === 'low' ? 2 : 0;
  }
  return Math.max(0, score);
}

/**
 * Perform a container image analysis against the Docker Hub registry.
 *
 * REAL: image existence, size, created date, layer count, architecture/OS, and
 * config-derived security issues (runs-as-root, :latest tag, secrets in ENV,
 * large base image). These come from the live Docker Hub + registry v2 API.
 *
 * NOT performed here: package-level CVE scanning, which requires a scanner with
 * a vulnerability database (e.g. Trivy/Grype) to pull and inspect image layers.
 * The result says so and gives the exact command — it never invents CVEs.
 */
export async function performContainerScan(
  imageName: string,
  _timeoutMs: number = 30000
): Promise<ContainerScanResult> {
  const startTime = performance.now();
  const ref = parseImageRef(imageName);

  const empty = (note: string, cveScan = 'not available'): ContainerScanResult => ({
    imageName, imageId: '', baseImage: undefined, totalVulnerabilities: 0, vulnerabilities: [],
    securityIssues: [], securityScore: 0, riskLevel: 'UNKNOWN', layers: 0, size: 'unknown',
    created: 'unknown', vulnerabilityCount: { critical: 0, high: 0, medium: 0, low: 0 },
    scanDuration: Math.round((performance.now() - startTime) / 1000), cveScan, note,
  });

  if (ref.unsupported) {
    return empty('Only Docker Hub images are supported (e.g. "nginx:1.25", "library/alpine:3.19", "grafana/grafana"). Private/other registries are not queried.');
  }

  // 1) Docker Hub tag metadata (size, last_updated, per-arch digests).
  const hub = await j(`https://hub.docker.com/v2/repositories/${ref.namespace}/${ref.repo}/tags/${encodeURIComponent(ref.tag)}`);
  if (hub.status === 404) return empty(`Image not found on Docker Hub: ${ref.namespace}/${ref.repo}:${ref.tag}`);
  if (!hub.ok) return empty(`Docker Hub API error (HTTP ${hub.status}).`);

  const fullSize = hub.body?.full_size || (hub.body?.images?.[0]?.size) || 0;
  const created = hub.body?.last_updated ? String(hub.body.last_updated).split('T')[0] : 'unknown';
  const amd = (hub.body?.images || []).find((im: any) => im.architecture === 'amd64') || hub.body?.images?.[0];
  const arch = amd?.architecture, os = amd?.os;

  // 2) Registry v2: token -> manifest (layers, config digest) -> config blob.
  let layers = 0, imageId = '', configEnv: string[] = [], configUser = '', historyBase = '';
  let cveScan = `Not performed. For package CVEs run: trivy image ${ref.namespace === 'library' ? ref.repo : ref.namespace + '/' + ref.repo}:${ref.tag}`;
  try {
    const tok = await j(`https://auth.docker.io/token?service=registry.docker.io&scope=repository:${ref.namespace}/${ref.repo}:pull`);
    const token = tok.body?.token;
    if (token) {
      const auth = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json' };
      let man = await j(`https://registry-1.docker.io/v2/${ref.namespace}/${ref.repo}/manifests/${encodeURIComponent(ref.tag)}`, auth);
      // Multi-arch index: pick amd64 and fetch the concrete manifest.
      const list = man.body?.manifests;
      if (Array.isArray(list) && list.length) {
        const pick = list.find((m: any) => m.platform?.architecture === 'amd64') || list[0];
        if (pick?.digest) man = await j(`https://registry-1.docker.io/v2/${ref.namespace}/${ref.repo}/manifests/${pick.digest}`, auth);
      }
      layers = Array.isArray(man.body?.layers) ? man.body.layers.length : 0;
      const configDigest = man.body?.config?.digest;
      if (configDigest) {
        imageId = configDigest;
        const cfg = await j(`https://registry-1.docker.io/v2/${ref.namespace}/${ref.repo}/blobs/${configDigest}`, auth);
        configEnv = cfg.body?.config?.Env || [];
        configUser = cfg.body?.config?.User || '';
        const hist = (cfg.body?.history || []).map((h: any) => h.created_by || '').join('\n');
        const baseMatch = hist.match(/(?:FROM|debian|ubuntu|alpine|distroless|scratch)[^\n]*/i);
        historyBase = baseMatch ? baseMatch[0].slice(0, 60) : '';
      }
    }
  } catch { cveScan += ' (registry config unavailable, so config-level checks were limited)'; }

  // 3) Real, config-derived security issues.
  const issues: SecurityIssue[] = [];
  if (ref.tag === 'latest') issues.push({ type: 'Mutable :latest tag', severity: 'medium', description: 'Uses the "latest" tag — builds are not reproducible and can change without notice.', recommendation: 'Pin a specific version tag or a digest (image@sha256:...).' });
  if (!configUser || configUser === 'root' || configUser === '0' || configUser.startsWith('0:')) {
    issues.push({ type: 'Runs as root', severity: 'high', description: 'No non-root USER is set in the image config; the container runs as root by default.', recommendation: 'Add a non-root USER in the Dockerfile and drop capabilities.' });
  }
  for (const e of configEnv) {
    const name = String(e).split('=')[0];
    if (/(_KEY|_TOKEN|PASSWORD|PASSWD|SECRET|_PASS|APIKEY|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i.test(name)) {
      issues.push({ type: 'Secret in image ENV', severity: 'critical', description: `Environment variable "${name}" looks like a baked-in secret (its value ships inside the image).`, recommendation: 'Never bake secrets into images; inject them at runtime (secrets/env, mounted files).' });
    }
  }
  const sizeMB = Math.round((fullSize || 0) / (1024 * 1024));
  if (sizeMB > 300) issues.push({ type: 'Large image', severity: 'low', description: `Image is ~${sizeMB} MB — a large base increases the attack surface.`, recommendation: 'Prefer alpine/slim/distroless bases and multi-stage builds.' });

  const securityScore = calculateSecurityScore(issues);
  const riskLevel = securityScore >= 80 ? 'LOW' : securityScore >= 60 ? 'MEDIUM' : securityScore >= 40 ? 'HIGH' : 'CRITICAL';

  return {
    imageName,
    imageId: imageId ? imageId.replace('sha256:', 'sha256:').slice(0, 26) : (amd?.digest || '').slice(0, 26),
    baseImage: historyBase || (os && arch ? `${os}/${arch}` : undefined),
    totalVulnerabilities: 0,
    vulnerabilities: [],
    securityIssues: issues,
    securityScore,
    riskLevel,
    layers,
    size: sizeMB ? `${sizeMB} MB` : 'unknown',
    created,
    vulnerabilityCount: { critical: 0, high: 0, medium: 0, low: 0 },
    scanDuration: Math.round((performance.now() - startTime) / 1000),
    cveScan,
    note: 'Image metadata and config-level checks are live from Docker Hub. Package CVE scanning requires a local scanner (Trivy/Grype).',
  };
}
