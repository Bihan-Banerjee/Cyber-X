import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

// execFile (no shell) instead of exec: the target is passed as an argv element,
// never interpolated into a shell command string, so shell metacharacters in
// `target` cannot inject commands even if the route-level validation regresses.
const execFileAsync = promisify(execFile);

export interface Hop {
  hop: number;
  ip?: string;
  hostname?: string;
  rtt: number[];
  status: 'success' | 'timeout' | 'unreachable';
}

export interface TracerouteResult {
  target: string;
  hops: Hop[];
  totalHops: number;
  reachedTarget: boolean;
  totalRtt: number;
}

function parseWindows(output: string): Hop[] {
  const hops: Hop[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Windows tracert line: "  1    <1 ms    <1 ms    <1 ms  192.168.1.1"
    const match = line.match(/^\s*(\d+)\s+(.+)/);
    if (!match) continue;
    const hopNum = parseInt(match[1]);
    const rest = match[2].trim();

    if (rest.includes('* * *') || rest.includes('Solicitação expirou') || rest.includes('Request timed out')) {
      hops.push({ hop: hopNum, rtt: [], status: 'timeout' });
      continue;
    }

    const rttMatches = rest.match(/(<?\d+)\s*ms/g) || [];
    const rtts = rttMatches.map((r) => {
      const n = r.replace('ms', '').replace('<', '').trim();
      return parseInt(n) || 1;
    });

    const addrMatch = rest.match(/(\d{1,3}\.){3}\d{1,3}|\[[\w:]+\]/);
    const hostnameMatch = rest.match(/([a-zA-Z][\w.-]+\.[a-zA-Z]{2,})/);

    hops.push({
      hop: hopNum,
      ip: addrMatch?.[0],
      hostname: hostnameMatch?.[0],
      rtt: rtts.length ? rtts : [0],
      status: 'success',
    });
  }
  return hops;
}

function parseUnix(output: string): Hop[] {
  const hops: Hop[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Unix traceroute: " 1  gateway (192.168.1.1)  1.234 ms  1.100 ms  1.090 ms"
    const match = line.match(/^\s*(\d+)\s+(.+)/);
    if (!match) continue;
    const hopNum = parseInt(match[1]);
    const rest = match[2].trim();

    if (rest === '* * *' || rest.startsWith('* *') || rest === '*') {
      hops.push({ hop: hopNum, rtt: [], status: 'timeout' });
      continue;
    }

    const rttMatches = rest.match(/[\d.]+\s*ms/g) || [];
    const rtts = rttMatches.map((r) => parseFloat(r));

    const hostnameMatch = rest.match(/([a-zA-Z][\w.-]+)/);
    const ipMatch = rest.match(/\(?((\d{1,3}\.){3}\d{1,3})\)?/);

    hops.push({
      hop: hopNum,
      hostname: hostnameMatch?.[1],
      ip: ipMatch?.[1],
      rtt: rtts.length ? rtts : [0],
      status: 'success',
    });
  }
  return hops;
}

/**
 * Build the traceroute command as (bin, argv). Pure + exported so the
 * injection-safety property — the target is a single argv element, never
 * interpolated into a shell string — is unit-testable. execFile runs argv
 * directly with no shell, so metacharacters in `target` cannot inject.
 */
export function tracerouteCommand(
  target: string,
  maxHops: number = 30,
  isWindows: boolean = process.platform === 'win32',
): { bin: string; args: string[] } {
  // Clamp hop count to a sane bounded integer (defends against NaN / huge values).
  const safeMaxHops = Math.min(Math.max(1, Math.floor(Number(maxHops) || 30)), 64);
  const bin = isWindows ? 'tracert' : 'traceroute';
  const args = isWindows
    ? ['-h', String(safeMaxHops), '-w', '3000', target]
    : ['-m', String(safeMaxHops), '-w', '3', target];
  return { bin, args };
}

export async function performTraceroute(
  target: string,
  maxHops: number = 30,
  timeoutMs: number = 60000
): Promise<TracerouteResult> {
  const start = performance.now();

  logToolActivity('Traceroute', `Running traceroute to ${target}`, 'info');

  const isWindows = process.platform === 'win32';
  const { bin, args } = tracerouteCommand(target, maxHops, isWindows);

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });

    const output = stdout || stderr;
    const hops = isWindows ? parseWindows(output) : parseUnix(output);

    const validHops = hops.filter((h) => h.status === 'success');
    const totalRtt = validHops.length > 0
      ? validHops[validHops.length - 1].rtt[0] || 0
      : 0;

    const lastHop = hops[hops.length - 1];
    const reachedTarget = lastHop?.ip !== undefined && lastHop?.status === 'success';

    logToolActivity('Traceroute', `Traceroute to ${target} complete: ${hops.length} hops`, 'success');

    return {
      target,
      hops,
      totalHops: hops.length,
      reachedTarget,
      totalRtt,
    };
  } catch (error: any) {
    // execFile rejects on timeout (SIGTERM) or non-zero exit, but any hops
    // collected before the kill are on error.stdout. On ICMP-filtered paths the
    // command is killed mid-run; return the partial trace instead of a hard 500.
    const partial = String(error?.stdout || '');
    if (partial.trim()) {
      const hops = isWindows ? parseWindows(partial) : parseUnix(partial);
      if (hops.length) {
        logToolActivity('Traceroute', `Traceroute to ${target} returned ${hops.length} partial hops`, 'warning');
        const lastHop = hops[hops.length - 1];
        return {
          target,
          hops,
          totalHops: hops.length,
          reachedTarget: lastHop?.ip !== undefined && lastHop?.status === 'success',
          totalRtt: 0,
        };
      }
    }
    logToolActivity('Traceroute', `Traceroute failed: ${error.message}`, 'warning');
    throw new Error(`Traceroute failed: ${error.message}`);
  }
}
