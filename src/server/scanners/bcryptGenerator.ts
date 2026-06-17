import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface HashResult {
  hash: string;
  algorithm: string;
  rounds?: number;
  timeTaken: number;
  match?: boolean;
}

async function getBcrypt(): Promise<any> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('bcryptjs');
  } catch {
    return null;
  }
}

export async function generateHash(input: string, algorithm: string, rounds?: number, verify?: string): Promise<HashResult> {
  const start = performance.now();
  logToolActivity('Hash Generator', `Generating ${algorithm} hash`, 'info');

  let hash = '';
  let matchResult: boolean | undefined;

  if (algorithm === 'bcrypt') {
    const bcrypt = await getBcrypt();
    if (!bcrypt) {
      throw new Error('bcryptjs is not installed. Run: npm install bcryptjs');
    }
    const costFactor = Math.min(Math.max(rounds ?? 10, 4), 14);

    if (verify) {
      matchResult = await bcrypt.compare(input, verify);
      hash = verify;
    } else {
      const salt = await bcrypt.genSalt(costFactor);
      hash = await bcrypt.hash(input, salt);
    }
  } else {
    const algoMap: Record<string, string> = {
      sha256: 'sha256',
      sha512: 'sha512',
      md5: 'md5',
    };
    const algoName = algoMap[algorithm.toLowerCase()];
    if (!algoName) throw new Error(`Unsupported algorithm: ${algorithm}`);

    if (verify) {
      const computedHash = createHash(algoName).update(input, 'utf8').digest('hex');
      matchResult = computedHash.toLowerCase() === verify.trim().toLowerCase();
      hash = verify;
    } else {
      hash = createHash(algoName).update(input, 'utf8').digest('hex');
    }
  }

  const timeTaken = Math.round(performance.now() - start);
  logToolActivity('Hash Generator', `Hash generated in ${timeTaken}ms`, 'success');

  return {
    hash,
    algorithm,
    rounds: algorithm === 'bcrypt' ? (rounds ?? 10) : undefined,
    timeTaken,
    match: matchResult,
  };
}

export async function verifyHash(input: string, hash: string, algorithm: string): Promise<boolean> {
  const result = await generateHash(input, algorithm, undefined, hash);
  return result.match ?? false;
}
