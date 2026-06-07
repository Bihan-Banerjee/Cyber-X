import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface CrawlResult {
  url: string;
  pages: string[];
  links: string[];
  forms: string[];
  jsEndpoints: string[];
  emails: string[];
  totalPages: number;
  scanDuration: number;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const HREF_REGEX = /href=["']([^"']+)["']/gi;
const ACTION_REGEX = /action=["']([^"']+)["']/gi;
const SCRIPT_SRC_REGEX = /src=["']([^"']+\.js[^"']*)["']/gi;

async function fetchPage(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CyberX-Scanner/1.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function resolveUrl(base: string, href: string): string | null {
  try {
    if (href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('#')) return null;
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function crawlWebsite(
  startUrl: string,
  maxDepth: number = 3,
  maxPages: number = 50,
  timeoutMs: number = 60000
): Promise<CrawlResult> {
  const start = performance.now();
  logToolActivity('Web Crawler', `Crawling ${startUrl} (depth=${maxDepth}, max=${maxPages})`, 'info');

  const baseOrigin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

  const pages: string[] = [];
  const allLinks = new Set<string>();
  const forms = new Set<string>();
  const jsEndpoints = new Set<string>();
  const emails = new Set<string>();

  const pageTimeout = Math.min(timeoutMs / maxPages, 5000);

  while (queue.length > 0 && pages.length < maxPages) {
    const elapsed = performance.now() - start;
    if (elapsed > timeoutMs * 0.9) break;

    const item = queue.shift();
    if (!item) break;

    const { url, depth } = item;
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchPage(url, pageTimeout);
    if (!html) continue;

    pages.push(url);

    // Extract emails
    const emailMatches = html.match(EMAIL_REGEX) ?? [];
    emailMatches.forEach((e) => emails.add(e));

    // Extract hrefs
    let m: RegExpExecArray | null;
    const hrefRe = new RegExp(HREF_REGEX.source, 'gi');
    while ((m = hrefRe.exec(html)) !== null) {
      const resolved = resolveUrl(url, m[1]);
      if (!resolved) continue;
      allLinks.add(resolved);
      if (depth < maxDepth && resolved.startsWith(baseOrigin) && !visited.has(resolved)) {
        queue.push({ url: resolved, depth: depth + 1 });
      }
    }

    // Extract form actions
    const actionRe = new RegExp(ACTION_REGEX.source, 'gi');
    while ((m = actionRe.exec(html)) !== null) {
      const resolved = resolveUrl(url, m[1]);
      if (resolved) forms.add(resolved);
    }

    // Extract script sources
    const scriptRe = new RegExp(SCRIPT_SRC_REGEX.source, 'gi');
    while ((m = scriptRe.exec(html)) !== null) {
      const resolved = resolveUrl(url, m[1]);
      if (resolved) jsEndpoints.add(resolved);
    }
  }

  const scanDuration = Math.round((performance.now() - start) / 1000);
  logToolActivity('Web Crawler', `Crawled ${pages.length} pages in ${scanDuration}s`, 'success');

  return {
    url: startUrl,
    pages,
    links: [...allLinks],
    forms: [...forms],
    jsEndpoints: [...jsEndpoints],
    emails: [...emails],
    totalPages: pages.length,
    scanDuration,
  };
}
