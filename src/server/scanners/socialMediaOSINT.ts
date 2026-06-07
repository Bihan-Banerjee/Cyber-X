import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SocialProfile {
  platform: string;
  found: boolean;
  url?: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  isPrivate?: boolean;
}

export interface SocialOSINTResult {
  handle: string;
  profiles: SocialProfile[];
  crossLinks: string[];
}

async function fetchWithTimeout(url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', ...headers },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function checkGitHub(handle: string): Promise<SocialProfile> {
  const data = await fetchWithTimeout(`https://api.github.com/users/${handle}`, 5000);
  if (!data || data.message === 'Not Found') {
    return { platform: 'GitHub', found: false };
  }
  return {
    platform: 'GitHub',
    found: true,
    url: data.html_url,
    displayName: data.name,
    bio: data.bio,
    followers: data.followers,
    isPrivate: false,
  };
}

async function checkReddit(handle: string): Promise<SocialProfile> {
  const data = await fetchWithTimeout(`https://www.reddit.com/user/${handle}/about.json`, 5000);
  if (!data || data.error) {
    return { platform: 'Reddit', found: false };
  }
  const d = data.data;
  return {
    platform: 'Reddit',
    found: true,
    url: `https://www.reddit.com/user/${handle}`,
    displayName: d.name,
    followers: d.total_karma,
    isPrivate: d.is_suspended,
  };
}

async function checkHackerNews(handle: string): Promise<SocialProfile> {
  const data = await fetchWithTimeout(
    `https://hacker-news.firebaseio.com/v0/user/${handle}.json`,
    5000
  );
  if (!data) return { platform: 'HackerNews', found: false };
  return {
    platform: 'HackerNews',
    found: true,
    url: `https://news.ycombinator.com/user?id=${handle}`,
    displayName: data.id,
    bio: data.about,
    followers: data.karma,
    isPrivate: false,
  };
}

async function checkByHTTPStatus(platform: string, url: string): Promise<SocialProfile> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    });
    clearTimeout(timer);
    return { platform, found: res.status === 200, url };
  } catch {
    return { platform, found: false, url };
  }
}

export async function performSocialOSINT(
  handle: string,
  platforms: string[] = ['GitHub', 'Reddit', 'Twitter', 'Instagram', 'LinkedIn', 'HackerNews']
): Promise<SocialOSINTResult> {
  const start = performance.now();
  logToolActivity('Social Media OSINT', `Searching for "${handle}"`, 'info');

  const profileChecks: Array<() => Promise<SocialProfile>> = [];

  const platformSet = new Set(platforms.map((p) => p.toLowerCase()));

  if (platformSet.has('github')) profileChecks.push(() => checkGitHub(handle));
  if (platformSet.has('reddit')) profileChecks.push(() => checkReddit(handle));
  if (platformSet.has('hackernews')) profileChecks.push(() => checkHackerNews(handle));
  if (platformSet.has('twitter')) profileChecks.push(() => checkByHTTPStatus('Twitter', `https://twitter.com/${handle}`));
  if (platformSet.has('instagram')) profileChecks.push(() => checkByHTTPStatus('Instagram', `https://www.instagram.com/${handle}`));
  if (platformSet.has('linkedin')) profileChecks.push(() => checkByHTTPStatus('LinkedIn', `https://www.linkedin.com/in/${handle}`));
  if (platformSet.has('youtube')) profileChecks.push(() => checkByHTTPStatus('YouTube', `https://www.youtube.com/@${handle}`));
  if (platformSet.has('tiktok')) profileChecks.push(() => checkByHTTPStatus('TikTok', `https://www.tiktok.com/@${handle}`));
  if (platformSet.has('twitch')) profileChecks.push(() => checkByHTTPStatus('Twitch', `https://www.twitch.tv/${handle}`));
  if (platformSet.has('pinterest')) profileChecks.push(() => checkByHTTPStatus('Pinterest', `https://www.pinterest.com/${handle}`));
  if (platformSet.has('steam')) profileChecks.push(() => checkByHTTPStatus('Steam', `https://steamcommunity.com/id/${handle}`));

  const profiles = await Promise.all(profileChecks.map((fn) => fn()));

  const foundProfiles = profiles.filter((p) => p.found);
  const crossLinks = foundProfiles.filter((p) => p.url).map((p) => p.url!);

  logToolActivity('Social Media OSINT', `Found ${foundProfiles.length}/${profiles.length} profiles`, 'success');

  return { handle, profiles, crossLinks };
}
