import { performance } from 'node:perf_hooks';

export interface CipherResult {
  cipherType: string;
  operation: string;
  input: string;
  output: string;
  key?: string | number;
  processingTime: number;
}

export interface AnalysisResult {
  input: string;
  possibleCiphers: Array<{
    type: string;
    confidence: number;
    decrypted: string;
    key?: string | number;
  }>;
  frequencyAnalysis: Record<string, number>;
  statistics: {
    length: number;
    letters: number;
    uppercase: number;
    lowercase: number;
    digits: number;
    spaces: number;
    special: number;
  };
}

// English letter frequency for analysis
const ENGLISH_FREQ: Record<string, number> = {
  E: 12.70, T: 9.06, A: 8.17, O: 7.51, I: 6.97, N: 6.75, S: 6.33, H: 6.09,
  R: 5.99, D: 4.25, L: 4.03, C: 2.78, U: 2.76, M: 2.41, W: 2.36, F: 2.23,
  G: 2.02, Y: 1.97, P: 1.93, B: 1.29, V: 0.98, K: 0.77, J: 0.15, X: 0.15,
  Q: 0.10, Z: 0.07,
};

/**
 * Caesar Cipher
 */
function caesarCipher(text: string, shift: number, decode: boolean = false): string {
  if (decode) shift = 26 - shift;
  shift = ((shift % 26) + 26) % 26;

  return text
    .split('')
    .map((char) => {
      if (/[a-z]/.test(char)) {
        return String.fromCharCode(((char.charCodeAt(0) - 97 + shift) % 26) + 97);
      } else if (/[A-Z]/.test(char)) {
        return String.fromCharCode(((char.charCodeAt(0) - 65 + shift) % 26) + 65);
      }
      return char;
    })
    .join('');
}

/**
 * Atbash Cipher
 */
function atbashCipher(text: string): string {
  return text
    .split('')
    .map((char) => {
      if (/[a-z]/.test(char)) {
        return String.fromCharCode(122 - (char.charCodeAt(0) - 97));
      } else if (/[A-Z]/.test(char)) {
        return String.fromCharCode(90 - (char.charCodeAt(0) - 65));
      }
      return char;
    })
    .join('');
}

/**
 * Vigenère Cipher
 */
function vigenereCipher(text: string, key: string, decode: boolean = false): string {
  const cleanKey = key.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (!cleanKey) return text;

  let result = '';
  let keyIndex = 0;

  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) {
      const isUpper = char === char.toUpperCase();
      const charCode = char.toUpperCase().charCodeAt(0) - 65;
      const keyShift = cleanKey[keyIndex % cleanKey.length].charCodeAt(0) - 65;
      const shift = decode ? (charCode - keyShift + 26) % 26 : (charCode + keyShift) % 26;
      
      result += String.fromCharCode(shift + 65);
      if (!isUpper) result = result.slice(0, -1) + result.slice(-1).toLowerCase();
      
      keyIndex++;
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Rail Fence Cipher
 */
function railFenceCipher(text: string, rails: number, decode: boolean = false): string {
  if (rails <= 1) return text;

  if (!decode) {
    const fence: string[][] = Array(rails).fill(null).map(() => []);
    let rail = 0;
    let direction = 1;

    for (const char of text) {
      fence[rail].push(char);
      rail += direction;
      if (rail === 0 || rail === rails - 1) direction *= -1;
    }

    return fence.flat().join('');
  } else {
    // Decoding logic
    const fence: (string | null)[][] = Array(rails).fill(null).map(() => Array(text.length).fill(null));
    let rail = 0;
    let direction = 1;

    // Mark positions
    for (let i = 0; i < text.length; i++) {
      fence[rail][i] = '*';
      rail += direction;
      if (rail === 0 || rail === rails - 1) direction *= -1;
    }

    // Fill with text
    let index = 0;
    for (let r = 0; r < rails; r++) {
      for (let c = 0; c < text.length; c++) {
        if (fence[r][c] === '*') {
          fence[r][c] = text[index++];
        }
      }
    }

    // Read zigzag
    rail = 0;
    direction = 1;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += fence[rail][i];
      rail += direction;
      if (rail === 0 || rail === rails - 1) direction *= -1;
    }

    return result;
  }
}

/**
 * Analyze text and calculate statistics
 */
function analyzeText(text: string): AnalysisResult['statistics'] {
  return {
    length: text.length,
    letters: (text.match(/[a-zA-Z]/g) || []).length,
    uppercase: (text.match(/[A-Z]/g) || []).length,
    lowercase: (text.match(/[a-z]/g) || []).length,
    digits: (text.match(/[0-9]/g) || []).length,
    spaces: (text.match(/ /g) || []).length,
    special: text.length - (text.match(/[a-zA-Z0-9 ]/g) || []).length,
  };
}

/**
 * Frequency analysis
 */
function frequencyAnalysis(text: string): Record<string, number> {
  const freq: Record<string, number> = {};
  
  for (const char of text.toUpperCase()) {
    if (/[A-Z]/.test(char)) {
      freq[char] = (freq[char] || 0) + 1;
    }
  }

  return freq;
}

/**
 * Calculate chi-squared statistic for frequency comparison
 */
function chiSquared(observed: Record<string, number>, totalLetters: number): number {
  let chi2 = 0;

  for (const [letter, expectedFreq] of Object.entries(ENGLISH_FREQ)) {
    const observedCount = observed[letter] || 0;
    const expectedCount = (expectedFreq / 100) * totalLetters;
    chi2 += Math.pow(observedCount - expectedCount, 2) / expectedCount;
  }

  return chi2;
}

/**
 * Try to detect and decrypt cipher
 */
function detectCipher(text: string): AnalysisResult['possibleCiphers'] {
  const results: AnalysisResult['possibleCiphers'] = [];
  const cleanText = text.replace(/[^a-zA-Z]/g, '');

  // Try Caesar with all shifts
  let bestCaesar = { shift: 0, chi2: Infinity, text: '' };
  for (let shift = 1; shift <= 25; shift++) {
    const decrypted = caesarCipher(text, shift, true);
    const freq = frequencyAnalysis(decrypted);
    const chi2 = chiSquared(freq, cleanText.length);
    
    if (chi2 < bestCaesar.chi2) {
      bestCaesar = { shift, chi2, text: decrypted };
    }
  }

  const confidence = Math.max(0, Math.min(100, 100 - (bestCaesar.chi2 / 10)));
  results.push({
    type: 'Caesar Cipher',
    confidence: Math.round(confidence),
    decrypted: bestCaesar.text,
    key: bestCaesar.shift,
  });

  // Try ROT13
  const rot13 = caesarCipher(text, 13, true);
  const rot13Freq = frequencyAnalysis(rot13);
  const rot13Chi2 = chiSquared(rot13Freq, cleanText.length);
  const rot13Confidence = Math.max(0, Math.min(100, 100 - (rot13Chi2 / 10)));

  results.push({
    type: 'ROT13',
    confidence: Math.round(rot13Confidence),
    decrypted: rot13,
    key: 13,
  });

  // Try Atbash
  const atbash = atbashCipher(text);
  const atbashFreq = frequencyAnalysis(atbash);
  const atbashChi2 = chiSquared(atbashFreq, cleanText.length);
  const atbashConfidence = Math.max(0, Math.min(100, 100 - (atbashChi2 / 10)));

  results.push({
    type: 'Atbash Cipher',
    confidence: Math.round(atbashConfidence),
    decrypted: atbash,
  });

  // Sort by confidence
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Process cipher encode/decode
 */
export async function processCipher(
  cipherType: string,
  operation: string,
  input: string,
  key?: string | number
): Promise<CipherResult> {
  const startTime = performance.now();
  let output = '';
  const decode = operation === 'decode';

  switch (cipherType) {
    case 'caesar':
      output = caesarCipher(input, Number(key) || 3, decode);
      break;
    case 'rot13':
      output = caesarCipher(input, 13, decode);
      key = 13;
      break;
    case 'atbash':
      output = atbashCipher(input);
      break;
    case 'vigenere':
      output = vigenereCipher(input, String(key || ''), decode);
      break;
    case 'railfence':
      output = railFenceCipher(input, Number(key) || 3, decode);
      break;
    default:
      output = input;
  }

  const processingTime = Math.round(performance.now() - startTime);

  return {
    cipherType,
    operation,
    input,
    output,
    key,
    processingTime,
  };
}

/**
 * Analyze ciphertext
 */
export async function analyzeCipher(input: string): Promise<AnalysisResult> {
  const statistics = analyzeText(input);
  const frequencyData = frequencyAnalysis(input);
  const possibleCiphers = detectCipher(input);

  return {
    input,
    possibleCiphers,
    frequencyAnalysis: frequencyData,
    statistics,
  };
}
