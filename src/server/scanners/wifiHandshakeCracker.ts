import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

const pbkdf2Async = promisify(pbkdf2);

export interface WifiCrackResult {
  tried: number;
  found: boolean;
  password?: string;
  timeMs: number;
  ssid: string;
  note: string;
}

const MAX_WORDS = 1000;

/**
 * Derive WPA PMK from password and SSID using PBKDF2-SHA1
 */
async function derivePMK(password: string, ssid: string): Promise<Buffer> {
  return pbkdf2Async(password, ssid, 4096, 32, 'sha1');
}

/**
 * Attempt WPA handshake cracking using a wordlist
 * The targetPMK is a hex string of the expected PMK (32 bytes = 64 hex chars)
 * In a real scenario this would come from parsing a .cap file.
 */
export async function crackWifiHandshake(
  ssid: string,
  wordlist: string[],
  targetPMK?: string
): Promise<WifiCrackResult> {
  const startTime = performance.now();

  logToolActivity('WiFi Handshake Cracker', `Starting crack attempt for SSID "${ssid}" with ${Math.min(wordlist.length, MAX_WORDS)} words`, 'info');

  const words = wordlist.slice(0, MAX_WORDS);
  let tried = 0;

  for (const password of words) {
    const trimmed = password.trim();
    if (!trimmed || trimmed.length < 8 || trimmed.length > 63) {
      tried++;
      continue;
    }

    const pmk = await derivePMK(trimmed, ssid);
    tried++;

    if (targetPMK) {
      const derivedHex = pmk.toString('hex');
      if (derivedHex === targetPMK.toLowerCase()) {
        const timeMs = Math.round(performance.now() - startTime);
        logToolActivity('WiFi Handshake Cracker', `Password found for SSID "${ssid}" after ${tried} attempts`, 'success');
        return {
          tried,
          found: true,
          password: trimmed,
          timeMs,
          ssid,
          note: 'Password found via PMK derivation match.',
        };
      }
    }
  }

  const timeMs = Math.round(performance.now() - startTime);

  if (!targetPMK) {
    logToolActivity('WiFi Handshake Cracker', `Derived ${tried} PMKs for SSID "${ssid}" — no target PMK to match against`, 'info');
    return {
      tried,
      found: false,
      timeMs,
      ssid,
      note: `Derived ${tried} PMK values. Provide a target PMK (hex) for matching. In a real attack, the PMK would be extracted from a .cap handshake file using hcxtools.`,
    };
  }

  logToolActivity('WiFi Handshake Cracker', `Crack failed for SSID "${ssid}" after ${tried} attempts`, 'warning');
  return {
    tried,
    found: false,
    timeMs,
    ssid,
    note: `Tried ${tried} passwords. Password not found in wordlist.`,
  };
}
