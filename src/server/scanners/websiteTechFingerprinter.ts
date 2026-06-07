import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface Technology {
  name: string;
  category: string;
  version?: string;
  confidence: number;
}

export interface TechFingerprintResult {
  url: string;
  technologies: Technology[];
  server?: string;
  cms?: string;
  frameworks: string[];
  analytics: string[];
  cdn?: string;
  waf?: string;
  headers: Record<string, string>;
  scanDuration: number;
}

interface Signature {
  name: string;
  category: string;
  headers?: Record<string, RegExp>;
  body?: RegExp;
  cookies?: string[];
  version?: RegExp;
}

const SIGNATURES: Signature[] = [
  // CMS
  { name: 'WordPress', category: 'CMS', body: /\/wp-content\/|\/wp-includes\/|wp-json/i, version: /WordPress\s*([\d.]+)/i },
  { name: 'Drupal', category: 'CMS', body: /Drupal|\/sites\/default\/files\//i, headers: { 'x-generator': /Drupal/i } },
  { name: 'Joomla', category: 'CMS', body: /\/components\/com_|Joomla!/i },
  { name: 'Wix', category: 'CMS', body: /wix\.com|X_Wix_Brand/i },
  { name: 'Squarespace', category: 'CMS', body: /squarespace\.com|Squarespace/i },
  { name: 'Ghost', category: 'CMS', body: /ghost\.io|content="Ghost/i },
  { name: 'Shopify', category: 'CMS', body: /cdn\.shopify\.com|Shopify\.theme/i },

  // JS Frameworks
  { name: 'React', category: 'JavaScript Framework', body: /__NEXT_DATA__|react-root|ReactDOM|react\.development/i },
  { name: 'Next.js', category: 'JavaScript Framework', body: /__NEXT_DATA__|_next\/static/i },
  { name: 'Vue.js', category: 'JavaScript Framework', body: /Vue\.js|vue\.min\.js|__vue_/i, version: /Vue\s*([\d.]+)/i },
  { name: 'Angular', category: 'JavaScript Framework', body: /ng-version|angular\.min\.js|AngularJS/i },
  { name: 'jQuery', category: 'JavaScript Framework', body: /jquery[\-.][\d.]+\.min\.js|jquery\.js/i, version: /jquery[\-.]v?([\d.]+)\.min/i },
  { name: 'Ember.js', category: 'JavaScript Framework', body: /ember\.min\.js|emberjs\.com/i },
  { name: 'Backbone.js', category: 'JavaScript Framework', body: /backbone\.min\.js|Backbone\.js/i },
  { name: 'Nuxt.js', category: 'JavaScript Framework', body: /__NUXT__|nuxt\.js/i },

  // Analytics
  { name: 'Google Analytics', category: 'Analytics', body: /google-analytics\.com\/analytics\.js|gtag\('config'|GoogleAnalyticsObject/i },
  { name: 'Google Tag Manager', category: 'Analytics', body: /googletagmanager\.com\/gtm\.js/i },
  { name: 'Matomo', category: 'Analytics', body: /matomo\.js|piwik\.js/i },
  { name: 'Hotjar', category: 'Analytics', body: /hotjar\.com\/c\/hotjar/i },
  { name: 'Mixpanel', category: 'Analytics', body: /cdn\.mxpnl\.com|mixpanel\.init/i },
  { name: 'Segment', category: 'Analytics', body: /cdn\.segment\.com|analytics\.load/i },

  // CDN
  { name: 'Cloudflare', category: 'CDN', headers: { 'cf-ray': /.+/, server: /cloudflare/i } },
  { name: 'Fastly', category: 'CDN', headers: { 'x-served-by': /cache-/i, 'x-fastly-request-id': /.+/ } },
  { name: 'Akamai', category: 'CDN', headers: { 'x-akamai-transformed': /.+/, server: /AkamaiGHost/i } },
  { name: 'AWS CloudFront', category: 'CDN', headers: { 'x-amz-cf-id': /.+/, server: /CloudFront/i } },
  { name: 'jsDelivr', category: 'CDN', body: /cdn\.jsdelivr\.net/i },
  { name: 'unpkg', category: 'CDN', body: /unpkg\.com\//i },

  // Web Servers
  { name: 'nginx', category: 'Web Server', headers: { server: /nginx/i }, version: /nginx\/([\d.]+)/i },
  { name: 'Apache', category: 'Web Server', headers: { server: /Apache/i }, version: /Apache\/([\d.]+)/i },
  { name: 'IIS', category: 'Web Server', headers: { server: /Microsoft-IIS/i }, version: /Microsoft-IIS\/([\d.]+)/i },
  { name: 'Caddy', category: 'Web Server', headers: { server: /Caddy/i } },
  { name: 'Lighttpd', category: 'Web Server', headers: { server: /lighttpd/i } },

  // Programming Languages
  { name: 'PHP', category: 'Programming Language', headers: { 'x-powered-by': /PHP/i }, version: /PHP\/([\d.]+)/i },
  { name: 'ASP.NET', category: 'Programming Language', headers: { 'x-powered-by': /ASP\.NET/i, 'x-aspnet-version': /.+/ } },
  { name: 'Ruby on Rails', category: 'Programming Language', headers: { 'x-powered-by': /Phusion Passenger/i } },

  // Security
  { name: 'Cloudflare WAF', category: 'Security', headers: { server: /cloudflare/i, 'cf-ray': /.+/ } },
  { name: 'Sucuri', category: 'Security', headers: { 'x-sucuri-id': /.+/ } },
  { name: 'Imperva', category: 'Security', headers: { 'x-iinfo': /.+/ } },

  // Hosting
  { name: 'Vercel', category: 'Hosting', headers: { server: /Vercel/i, 'x-vercel-id': /.+/ } },
  { name: 'Netlify', category: 'Hosting', headers: { server: /Netlify/i, 'x-nf-request-id': /.+/ } },
  { name: 'GitHub Pages', category: 'Hosting', headers: { server: /GitHub\.com/i } },
  { name: 'Heroku', category: 'Hosting', headers: { server: /heroku/i, 'via': /vegur/i } },

  // Cookie-based
  { name: 'Laravel', category: 'Programming Language', cookies: ['laravel_session', 'XSRF-TOKEN'] },
  { name: 'Django', category: 'Programming Language', cookies: ['csrftoken', 'sessionid'] },
  { name: 'ASP.NET Session', category: 'Programming Language', cookies: ['ASP.NET_SessionId'] },
  { name: 'WordPress', category: 'CMS', cookies: ['wordpress_logged_in', 'wp-settings-'] },
];

function extractVersion(html: string, versionRegex?: RegExp): string | undefined {
  if (!versionRegex) return undefined;
  const match = html.match(versionRegex);
  return match?.[1];
}

export async function performTechFingerprint(
  url: string,
  timeoutMs: number = 10000
): Promise<TechFingerprintResult> {
  const start = performance.now();
  logToolActivity('Tech Fingerprinter', `Fingerprinting: ${url}`, 'info');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let responseHeaders: Record<string, string> = {};
  let body = '';
  let cookieNames: string[] = [];

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)' },
    });
    clearTimeout(timer);

    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    // Extract cookie names
    const setCookieHeader = response.headers.get('set-cookie') || '';
    cookieNames = setCookieHeader
      .split(',')
      .map((c) => c.trim().split('=')[0].trim())
      .filter(Boolean);

    body = await response.text().catch(() => '');
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }

  // Run signature matching
  const detected = new Map<string, Technology>();

  for (const sig of SIGNATURES) {
    let matchCount = 0;
    let version: string | undefined;

    // Header checks
    if (sig.headers) {
      for (const [headerName, pattern] of Object.entries(sig.headers)) {
        const headerValue = responseHeaders[headerName];
        if (headerValue && pattern.test(headerValue)) {
          matchCount++;
          if (sig.version) version = extractVersion(headerValue, sig.version);
        }
      }
    }

    // Body check
    if (sig.body && sig.body.test(body)) {
      matchCount++;
      if (sig.version && !version) version = extractVersion(body, sig.version);
    }

    // Cookie check
    if (sig.cookies) {
      const cookieMatch = sig.cookies.some((c) => cookieNames.some((n) => n.startsWith(c)));
      if (cookieMatch) matchCount++;
    }

    if (matchCount > 0) {
      const confidence = Math.min(matchCount * 40, 95);
      const existing = detected.get(sig.name);
      if (!existing || confidence > existing.confidence) {
        detected.set(sig.name, { name: sig.name, category: sig.category, version, confidence });
      }
    }
  }

  // Meta generator tag
  const metaMatch = body.match(/<meta[^>]+name="generator"[^>]+content="([^"]+)"/i);
  if (metaMatch) {
    const gen = metaMatch[1];
    if (!detected.has(gen)) {
      detected.set(gen, { name: gen, category: 'CMS', confidence: 90 });
    }
  }

  const technologies = Array.from(detected.values()).sort((a, b) => b.confidence - a.confidence);

  const server = responseHeaders['server'];
  const serverTech = technologies.find((t) => t.category === 'Web Server');
  const cmsTech = technologies.find((t) => t.category === 'CMS');
  const cdnTech = technologies.find((t) => t.category === 'CDN');
  const wafTech = technologies.find((t) => t.category === 'Security');

  logToolActivity('Tech Fingerprinter', `Detected ${technologies.length} technologies at ${url}`, 'success');

  return {
    url,
    technologies,
    server: serverTech?.name || server,
    cms: cmsTech?.name,
    frameworks: technologies.filter((t) => t.category === 'JavaScript Framework').map((t) => t.name),
    analytics: technologies.filter((t) => t.category === 'Analytics').map((t) => t.name),
    cdn: cdnTech?.name,
    waf: wafTech?.name,
    headers: responseHeaders,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
