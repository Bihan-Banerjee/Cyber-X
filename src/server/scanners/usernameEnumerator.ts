import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface PlatformResult {
  platform: string;
  url: string;
  status: 'found' | 'not_found' | 'error';
  profileUrl?: string;
  responseTime: number;
  errorMessage?: string;
}

export interface UsernameEnumResult {
  username: string;
  results: PlatformResult[];
  found: number;
  notFound: number;
  errors: number;
  scanDuration: number;
}

interface PlatformDef {
  name: string;
  urlTemplate: string;
  checkMethod: 'status' | 'body';
  bodyContains?: string;
}

const ALL_PLATFORMS: PlatformDef[] = [
  { name: 'GitHub', urlTemplate: 'https://github.com/{username}', checkMethod: 'status' },
  { name: 'Reddit', urlTemplate: 'https://www.reddit.com/user/{username}', checkMethod: 'status' },
  { name: 'Twitter/X', urlTemplate: 'https://twitter.com/{username}', checkMethod: 'status' },
  { name: 'Instagram', urlTemplate: 'https://www.instagram.com/{username}/', checkMethod: 'status' },
  { name: 'TikTok', urlTemplate: 'https://www.tiktok.com/@{username}', checkMethod: 'status' },
  { name: 'YouTube', urlTemplate: 'https://www.youtube.com/@{username}', checkMethod: 'status' },
  { name: 'Twitch', urlTemplate: 'https://www.twitch.tv/{username}', checkMethod: 'status' },
  { name: 'Pinterest', urlTemplate: 'https://www.pinterest.com/{username}/', checkMethod: 'status' },
  { name: 'Medium', urlTemplate: 'https://medium.com/@{username}', checkMethod: 'status' },
  { name: 'Keybase', urlTemplate: 'https://keybase.io/{username}', checkMethod: 'status' },
  { name: 'HackerNews', urlTemplate: 'https://news.ycombinator.com/user?id={username}', checkMethod: 'body', bodyContains: 'user?id=' },
  { name: 'GitLab', urlTemplate: 'https://gitlab.com/{username}', checkMethod: 'status' },
  { name: 'Bitbucket', urlTemplate: 'https://bitbucket.org/{username}/', checkMethod: 'status' },
  { name: 'Steam', urlTemplate: 'https://steamcommunity.com/id/{username}', checkMethod: 'body', bodyContains: 'og:title' },
  { name: 'LinkedIn', urlTemplate: 'https://www.linkedin.com/in/{username}/', checkMethod: 'status' },
  { name: 'Pastebin', urlTemplate: 'https://pastebin.com/u/{username}', checkMethod: 'status' },
];

async function checkPlatform(
  platform: PlatformDef,
  username: string,
  timeoutMs: number
): Promise<PlatformResult> {
  const url = platform.urlTemplate.replace('{username}', encodeURIComponent(username));
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: platform.checkMethod === 'body' ? 'GET' : 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)',
      },
    });
    clearTimeout(timer);

    const responseTime = Math.round(performance.now() - start);

    if (platform.checkMethod === 'status') {
      const found = response.status === 200;
      return {
        platform: platform.name,
        url,
        status: found ? 'found' : 'not_found',
        profileUrl: found ? url : undefined,
        responseTime,
      };
    } else {
      // Body check
      if (response.status === 404) {
        return { platform: platform.name, url, status: 'not_found', responseTime };
      }
      const body = await response.text();
      const found = platform.bodyContains ? body.includes(platform.bodyContains) : response.status === 200;
      return {
        platform: platform.name,
        url,
        status: found ? 'found' : 'not_found',
        profileUrl: found ? url : undefined,
        responseTime,
      };
    }
  } catch (err: any) {
    clearTimeout(timer);
    return {
      platform: platform.name,
      url,
      status: 'error',
      responseTime: Math.round(performance.now() - start),
      errorMessage: err.name === 'AbortError' ? 'Timed out' : err.message,
    };
  }
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) results.push(await task());
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

export async function enumerateUsername(
  username: string,
  platforms?: string[],
  timeoutMs: number = 8000
): Promise<UsernameEnumResult> {
  const start = performance.now();
  logToolActivity('Username Enumerator', `Checking username: ${username}`, 'info');

  const platformsToCheck = platforms?.length
    ? ALL_PLATFORMS.filter((p) => platforms.includes(p.name))
    : ALL_PLATFORMS;

  const tasks = platformsToCheck.map(
    (platform) => () => checkPlatform(platform, username, timeoutMs)
  );

  const results = await runWithConcurrency(tasks, 10);

  const found = results.filter((r) => r.status === 'found').length;
  const notFound = results.filter((r) => r.status === 'not_found').length;
  const errors = results.filter((r) => r.status === 'error').length;

  logToolActivity('Username Enumerator', `Found ${username} on ${found}/${platformsToCheck.length} platforms`, 'success');

  return {
    username,
    results,
    found,
    notFound,
    errors,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
