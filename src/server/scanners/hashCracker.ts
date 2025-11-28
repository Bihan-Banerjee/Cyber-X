import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import fs from "fs";
import zlib from "zlib";
import readline from "readline";

export interface HashResult {
  hash: string;
  identifiedType: string;
  possibleTypes: string[];
  cracked: boolean;
  plaintext?: string;
  crackedTime?: number;
  attempts?: number;
}

export interface CrackResult {
  totalHashes: number;
  crackedCount: number;
  failedCount: number;
  results: HashResult[];
  totalTime: number;
  attackMethod: string;
}

/**
 * Stream local gzipped wordlist line-by-line
 */
function streamLocalWordlist(filePath: string): AsyncGenerator<string> {
  const stream = fs.createReadStream(filePath).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  return (async function* () {
    for await (const line of rl) {
      const pwd = (line as string).trim();
      if (pwd.length > 0) yield pwd;
    }
  })();
}

/**
 * Identify hash type
 */
function identifyHashType(hash: string) {
  const clean = hash.trim();
  const len = clean.length;
  const isHex = /^[a-fA-F0-9]+$/.test(clean);

  if (len === 32 && isHex) return { primary: "MD5", possible: ["MD5"] };
  if (len === 40 && isHex) return { primary: "SHA-1", possible: ["SHA-1"] };
  if (len === 64 && isHex) return { primary: "SHA-256", possible: ["SHA-256"] };
  if (len === 128 && isHex) return { primary: "SHA-512", possible: ["SHA-512"] };

  return { primary: "Unknown", possible: ["Unknown"] };
}

/**
 * Hash plaintext
 */
function hashPassword(plaintext: string, algorithm: string): string | null {
  try {
    switch (algorithm) {
      case "MD5":
        return crypto.createHash("md5").update(plaintext).digest("hex");
      case "SHA-1":
        return crypto.createHash("sha1").update(plaintext).digest("hex");
      case "SHA-256":
        return crypto.createHash("sha256").update(plaintext).digest("hex");
      case "SHA-512":
        return crypto.createHash("sha512").update(plaintext).digest("hex");
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Crack a single hash using streaming password list
 */
async function crackHash(
  hash: string,
  algorithm: string,
  filePath: string,
  maxAttempts: number,
  timeoutMs: number
) {
  const start = performance.now();
  let attempts = 0;

  const targetLower = hash.toLowerCase();
  const stream = streamLocalWordlist(filePath);

  for await (const pwd of stream) {
    attempts++;

    const elapsed = performance.now() - start;
    if (elapsed > timeoutMs || attempts > maxAttempts) break;

    const hashed = hashPassword(pwd, algorithm);
    if (hashed && hashed.toLowerCase() === targetLower) {
      return {
        cracked: true,
        plaintext: pwd,
        attempts,
        time: Math.round(elapsed),
      };
    }
  }

  return {
    cracked: false,
    attempts,
    time: Math.round(performance.now() - start),
  };
}

/**
 * Crack multiple hashes
 */
export async function performHashCracking(
  hashes: string[],
  timeoutMs = 30000
): Promise<CrackResult> {
  const start = performance.now();
  const results: HashResult[] = [];

  const WORDLIST = "./wordlist/rockyou.txt.gz"; // local compressed dictionary
  const MAX_ATTEMPTS = 15000;

  for (const hash of hashes) {
    const clean = hash.trim();
    if (!clean) continue;

    const { primary, possible } = identifyHashType(clean);

    if (primary === "Unknown") {
      results.push({
        hash: clean,
        identifiedType: primary,
        possibleTypes: possible,
        cracked: false,
      });
      continue;
    }

    try {
      const result = await crackHash(
        clean,
        primary,
        WORDLIST,
        MAX_ATTEMPTS,
        timeoutMs
      );

      results.push({
        hash: clean,
        identifiedType: primary,
        possibleTypes: possible,
        cracked: result.cracked,
        plaintext: result.plaintext,
        crackedTime: result.time,
        attempts: result.attempts,
      });
    } catch (err) {
      console.error("Hash crack error:", err);
      results.push({
        hash: clean,
        identifiedType: primary,
        possibleTypes: possible,
        cracked: false,
      });
    }
  }

  return {
    totalHashes: results.length,
    crackedCount: results.filter((r) => r.cracked).length,
    failedCount: results.filter((r) => !r.cracked).length,
    results,
    totalTime: Math.round((performance.now() - start) / 1000),
    attackMethod: "Local Compressed Wordlist Streaming",
  };
}
