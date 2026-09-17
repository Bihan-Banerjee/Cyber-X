import { performance } from 'node:perf_hooks';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  displayUrl: string;
}

export interface OSINTSearchResult {
  query: string;
  totalResults: number;
  results: SearchResult[];
  searchDuration: number;
  source?: string;
  note?: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<encoded real url>. */
function unwrapDdgUrl(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { /* noop */ } }
  return href.startsWith('//') ? 'https:' + href : href;
}

/**
 * Perform an OSINT web search using the DuckDuckGo HTML endpoint (no API key).
 * Returns real search results for the query (e.g. a Google-dork string). This
 * replaces the previous simulated placeholder results.
 */
export async function performOSINTSearch(query: string): Promise<OSINTSearchResult> {
  const startTime = performance.now();

  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!resp.ok) throw new Error(`search endpoint returned HTTP ${resp.status}`);
    const html = await resp.text();

    const results: SearchResult[] = [];
    // Each organic result: an anchor with class result__a (title+link) and a
    // following result__snippet anchor/div (snippet).
    const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe = /<(?:a|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/g;
    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snippetRe.exec(html)) !== null) snippets.push(stripTags(sm[1]));

    let lm: RegExpExecArray | null;
    let i = 0;
    while ((lm = linkRe.exec(html)) !== null && results.length < 30) {
      const url = unwrapDdgUrl(lm[1]);
      const title = stripTags(lm[2]);
      if (!title || !/^https?:\/\//i.test(url)) { i++; continue; }
      let displayUrl = url;
      try { displayUrl = new URL(url).hostname + new URL(url).pathname; } catch { /* noop */ }
      results.push({ title, url, snippet: snippets[i] || '', displayUrl });
      i++;
    }

    return {
      query,
      totalResults: results.length,
      results,
      searchDuration: Math.round(performance.now() - startTime),
      source: 'DuckDuckGo',
      note: results.length === 0 ? 'No results (the search provider may be rate-limiting — try again shortly).' : undefined,
    };
  } catch (error: any) {
    throw new Error(`OSINT search failed: ${error.message}`);
  }
}
