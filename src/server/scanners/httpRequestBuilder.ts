import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface HttpResponse {
  statusCode: number;
  statusText: string;
  responseTime: number;
  headers: Record<string, string>;
  body: string;
  size: number;
  redirectChain?: string[];
}

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

export async function sendHTTPRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body: string = '',
  timeoutMs: number = 15000,
  followRedirects: boolean = true
): Promise<HttpResponse> {
  const start = performance.now();

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  logToolActivity('HTTP Request Builder', `${method} ${url}`, 'info');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const redirectChain: string[] = [];

  try {
    const reqHeaders: Record<string, string> = {
      'User-Agent': 'CyberX-HTTP-Builder/1.0',
      ...headers,
    };

    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: reqHeaders,
      body: body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? body : undefined,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual',
    });

    clearTimeout(timer);

    const responseTime = Math.round(performance.now() - start);

    // Collect headers
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });

    // Read body (capped at 1MB)
    const arrayBuf = await res.arrayBuffer();
    const fullBuffer = Buffer.from(arrayBuf);
    const size = fullBuffer.length;
    const bodyText = fullBuffer.slice(0, MAX_BODY_SIZE).toString('utf8');

    // Extract redirect chain from location header (simplified)
    const location = responseHeaders['location'];
    if (location) redirectChain.push(location);

    logToolActivity('HTTP Request Builder', `Response: ${res.status} in ${responseTime}ms`, 'success');

    return {
      statusCode: res.status,
      statusText: res.statusText || String(res.status),
      responseTime,
      headers: responseHeaders,
      body: bodyText,
      size,
      redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  }
}
