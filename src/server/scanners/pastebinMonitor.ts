import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface PasteResult {
  id: string;
  title?: string;
  date: string;
  snippet: string;
  url: string;
  hasCredentials: boolean;
}

export interface PasteSearchResult {
  results: PasteResult[];
  total: number;
}

const CREDENTIAL_PATTERN = /[a-zA-Z0-9._%+\-]+:[^\s:]+|password\s*[:=]\s*\S+|passwd\s*[:=]\s*\S+|api.?key\s*[:=]\s*\S+/i;

async function searchPsbdmp(query: string): Promise<PasteResult[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `https://psbdmp.ws/api/v2/search/${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'CyberX-Monitor/1.0' },
      }
    );
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.data)) return [];

    return data.data.slice(0, 20).map((item: any) => {
      const snippet = (item.text ?? item.data ?? '').substring(0, 300);
      const hasCredentials = CREDENTIAL_PATTERN.test(snippet);
      return {
        id: item.id ?? String(Math.random()),
        title: item.tags ?? undefined,
        date: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
        snippet,
        url: `https://pastebin.com/${item.id}`,
        hasCredentials,
      };
    });
  } catch {
    return [];
  }
}

async function searchGithubGists(query: string): Promise<PasteResult[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://api.github.com/gists/public?per_page=10`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CyberX-Monitor/1.0',
          Accept: 'application/vnd.github+json',
        },
      }
    );
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((g: any) => {
        const desc = (g.description ?? '').toLowerCase();
        const files = Object.keys(g.files ?? {}).join(' ').toLowerCase();
        return desc.includes(query.toLowerCase()) || files.includes(query.toLowerCase());
      })
      .slice(0, 5)
      .map((g: any) => ({
        id: g.id,
        title: g.description || '(no description)',
        date: g.created_at ?? new Date().toISOString(),
        snippet: `Files: ${Object.keys(g.files ?? {}).join(', ')}`,
        url: g.html_url,
        hasCredentials: false,
      }));
  } catch {
    return [];
  }
}

export async function searchPastebins(query: string, type: string): Promise<PasteSearchResult> {
  const start = performance.now();
  logToolActivity('Pastebin Monitor', `Searching for "${query}" (${type})`, 'info');

  const [psbResults, gistResults] = await Promise.all([
    searchPsbdmp(query),
    searchGithubGists(query),
  ]);

  const results = [...psbResults, ...gistResults];
  const credentialResults = results.filter((r) => r.hasCredentials).length;

  logToolActivity('Pastebin Monitor', `Found ${results.length} results, ${credentialResults} with credentials`, results.length > 0 ? 'warning' : 'success');

  return { results, total: results.length };
}
