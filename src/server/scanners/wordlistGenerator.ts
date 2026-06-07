import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface WordlistOptions {
  includeLeet: boolean;
  includeYears: boolean;
  includeSuffixes: boolean;
  includeCapitalization: boolean;
  minLength: number;
  maxLength: number;
}

export interface WordlistResult {
  words: string[];
  count: number;
  options: WordlistOptions;
  scanDuration: number;
}

const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];
const SUFFIXES = ['123', '1234', '12345', '!', '@', '#', '$', '_2024', '_2025', '01', '99', '007', '1!', '123!'];
const LEET_MAP: Record<string, string> = { a: '@', e: '3', i: '1', o: '0', s: '$', t: '7', l: '1', g: '9' };

function leetTransform(word: string): string {
  return word
    .split('')
    .map((c) => LEET_MAP[c.toLowerCase()] ?? c)
    .join('');
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function reverseString(word: string): string {
  return word.split('').reverse().join('');
}

export function generateWordlist(
  keywords: string[],
  options: WordlistOptions
): WordlistResult {
  const start = performance.now();
  logToolActivity('Wordlist Generator', `Generating wordlist for ${keywords.length} keywords`, 'info');

  const wordSet = new Set<string>();
  const MAX_WORDS = 50000;

  for (const rawKeyword of keywords) {
    const keyword = rawKeyword.trim().toLowerCase();
    if (!keyword) continue;

    const variants: string[] = [keyword];

    if (options.includeCapitalization) {
      variants.push(keyword.toUpperCase());
      variants.push(capitalise(keyword));
    }

    if (options.includeLeet) {
      const leet = leetTransform(keyword);
      if (leet !== keyword) {
        variants.push(leet);
        if (options.includeCapitalization) {
          variants.push(capitalise(leet));
        }
      }
    }

    // Always include reversed
    const reversed = reverseString(keyword);
    if (reversed !== keyword) variants.push(reversed);

    // Expand with years
    const withYears: string[] = [];
    if (options.includeYears) {
      for (const base of variants) {
        for (const year of YEARS) {
          withYears.push(`${base}${year}`);
          withYears.push(`${year}${base}`);
        }
      }
    }

    // Expand with suffixes
    const withSuffixes: string[] = [];
    if (options.includeSuffixes) {
      for (const base of variants) {
        for (const suffix of SUFFIXES) {
          withSuffixes.push(`${base}${suffix}`);
        }
      }
    }

    const allVariants = [...variants, ...withYears, ...withSuffixes];

    for (const word of allVariants) {
      if (wordSet.size >= MAX_WORDS) break;
      if (word.length >= options.minLength && word.length <= options.maxLength) {
        wordSet.add(word);
      }
    }

    if (wordSet.size >= MAX_WORDS) break;
  }

  const words = Array.from(wordSet);
  logToolActivity('Wordlist Generator', `Generated ${words.length} words`, 'success');

  return {
    words,
    count: words.length,
    options,
    scanDuration: Math.round((performance.now() - start) / 1000),
  };
}
