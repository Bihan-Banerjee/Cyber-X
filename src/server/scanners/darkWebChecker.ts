import { logToolActivity } from '../utils/activityLogger.js';

export interface DarkWebMention {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface DarkWebCheckResult {
  query: string;
  type: string;
  found: boolean;
  mentions: DarkWebMention[];
  sources: string[];
  total: number;
  disclaimer: string;
}

const DISCLAIMER = 'DISCLAIMER: Results are from publicly indexed sources (Ahmia.fi) only. This tool does not access the dark web directly. Results may be incomplete, outdated, or inaccurate. For authorized security research and OSINT purposes only.';

/**
 * Search Ahmia.fi for dark web index results
 */
async function searchAhmia(query: string): Promise<DarkWebMention[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://ahmia.fi/search/?q=${encodedQuery}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SecurityResearcher/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Ahmia.fi returned ${response.status}`);
  }

  const html = await response.text();
  const mentions: DarkWebMention[] = [];

  // Parse result items from Ahmia's HTML structure
  // Each result is in a <li> with class "result"
  const resultRegex = /<li[^>]*class="result"[^>]*>([\s\S]*?)<\/li>/gi;
  const titleRegex = /<h4[^>]*>([\s\S]*?)<\/h4>/i;
  const linkRegex = /href="(https?:\/\/[^"]+)"/i;
  const snippetRegex = /<p[^>]*>([\s\S]*?)<\/p>/i;

  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html)) !== null && mentions.length < 20) {
    const block = match[1];
    const titleMatch = titleRegex.exec(block);
    const linkMatch = linkRegex.exec(block);
    const snippetMatch = snippetRegex.exec(block);

    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || 'Untitled';
    const link = linkMatch?.[1] || '';
    const snippet = snippetMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

    if (link) {
      mentions.push({
        title,
        url: link,
        snippet: snippet.slice(0, 200),
        source: 'ahmia.fi',
      });
    }
  }

  return mentions;
}

export async function checkDarkWeb(
  query: string,
  type: string = 'general'
): Promise<DarkWebCheckResult> {
  logToolActivity('Dark Web Checker', `Searching for: ${query}`, 'info');

  try {
    const mentions = await searchAhmia(query);

    const sources = [...new Set(mentions.map((m) => m.source))];

    logToolActivity('Dark Web Checker', `Found ${mentions.length} indexed mentions for "${query}"`, mentions.length > 0 ? 'warning' : 'success');

    return {
      query,
      type,
      found: mentions.length > 0,
      mentions,
      sources,
      total: mentions.length,
      disclaimer: DISCLAIMER,
    };
  } catch (error: any) {
    logToolActivity('Dark Web Checker', `Search failed: ${error.message}`, 'warning');

    return {
      query,
      type,
      found: false,
      mentions: [],
      sources: [],
      total: 0,
      disclaimer: DISCLAIMER + ` Search error: ${error.message}`,
    };
  }
}
