import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface RobotsResult {
  domain: string;
  robotsTxt: string;
  disallowedPaths: string[];
  allowedPaths: string[];
  sitemapUrls: string[];
  crawlDelay?: number;
  userAgents: string[];
  interestingPaths: string[];
}

const INTERESTING_PATTERN = /admin|backup|config|private|secret|internal|test|dev|staging|upload|api/i;

export async function analyzeRobotsTxt(domain: string, timeoutMs: number = 10000): Promise<RobotsResult> {
  const start = performance.now();
  logToolActivity('Robots.txt Analyzer', `Fetching robots.txt for ${domain}`, 'info');

  let robotsTxt = '';

  const tryFetch = async (url: string): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return await res.text();
      }
      return '';
    } catch {
      clearTimeout(timer);
      return '';
    }
  };

  robotsTxt = await tryFetch(`https://${domain}/robots.txt`);
  if (!robotsTxt) {
    robotsTxt = await tryFetch(`http://${domain}/robots.txt`);
  }

  const lines = robotsTxt.split('\n').map((l) => l.trim());

  const disallowedPaths: string[] = [];
  const allowedPaths: string[] = [];
  const sitemapUrls: string[] = [];
  const userAgents: string[] = [];
  let crawlDelay: number | undefined;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    if (line.toLowerCase().startsWith('user-agent:')) {
      const ua = line.substring('user-agent:'.length).trim();
      if (ua && !userAgents.includes(ua)) userAgents.push(ua);
    } else if (line.toLowerCase().startsWith('disallow:')) {
      const path = line.substring('disallow:'.length).trim();
      if (path) disallowedPaths.push(path);
    } else if (line.toLowerCase().startsWith('allow:')) {
      const path = line.substring('allow:'.length).trim();
      if (path) allowedPaths.push(path);
    } else if (line.toLowerCase().startsWith('sitemap:')) {
      const url = line.substring('sitemap:'.length).trim();
      if (url) sitemapUrls.push(url);
    } else if (line.toLowerCase().startsWith('crawl-delay:')) {
      const delay = parseFloat(line.substring('crawl-delay:'.length).trim());
      if (!isNaN(delay)) crawlDelay = delay;
    }
  }

  const interestingPaths = disallowedPaths.filter((p) => INTERESTING_PATTERN.test(p));

  logToolActivity('Robots.txt Analyzer', `Found ${disallowedPaths.length} rules, ${interestingPaths.length} interesting`, 'success');

  return {
    domain,
    robotsTxt: robotsTxt || '(could not fetch robots.txt)',
    disallowedPaths,
    allowedPaths,
    sitemapUrls,
    crawlDelay,
    userAgents: userAgents.length > 0 ? userAgents : ['*'],
    interestingPaths,
  };
}
