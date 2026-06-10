import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface PhoneResult {
  number: string;
  formatted: string;
  valid: boolean;
  country: string;
  countryCode: string;
  carrier: string;
  lineType: 'mobile' | 'landline' | 'voip' | 'unknown';
  timezone: string;
  location: string;
}

// Basic phone number validation and formatting without external library
function parsePhoneBasic(phoneNumber: string): {
  valid: boolean;
  formatted: string;
  countryCode: string;
  national: string;
  country: string;
  timezone: string;
} {
  const cleaned = phoneNumber.replace(/[\s\-().]/g, '');
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, formatted: phoneNumber, countryCode: '', national: '', country: 'Unknown', timezone: '' };
  }

  // Country code detection by prefix
  const CC_MAP: Record<string, { country: string; timezone: string }> = {
    '1': { country: 'United States/Canada', timezone: 'America/New_York' },
    '44': { country: 'United Kingdom', timezone: 'Europe/London' },
    '91': { country: 'India', timezone: 'Asia/Kolkata' },
    '61': { country: 'Australia', timezone: 'Australia/Sydney' },
    '81': { country: 'Japan', timezone: 'Asia/Tokyo' },
    '86': { country: 'China', timezone: 'Asia/Shanghai' },
    '49': { country: 'Germany', timezone: 'Europe/Berlin' },
    '33': { country: 'France', timezone: 'Europe/Paris' },
    '39': { country: 'Italy', timezone: 'Europe/Rome' },
    '34': { country: 'Spain', timezone: 'Europe/Madrid' },
    '55': { country: 'Brazil', timezone: 'America/Sao_Paulo' },
    '7': { country: 'Russia', timezone: 'Europe/Moscow' },
    '82': { country: 'South Korea', timezone: 'Asia/Seoul' },
    '52': { country: 'Mexico', timezone: 'America/Mexico_City' },
    '31': { country: 'Netherlands', timezone: 'Europe/Amsterdam' },
    '65': { country: 'Singapore', timezone: 'Asia/Singapore' },
    '971': { country: 'United Arab Emirates', timezone: 'Asia/Dubai' },
    '966': { country: 'Saudi Arabia', timezone: 'Asia/Riyadh' },
    '20': { country: 'Egypt', timezone: 'Africa/Cairo' },
    '234': { country: 'Nigeria', timezone: 'Africa/Lagos' },
    '27': { country: 'South Africa', timezone: 'Africa/Johannesburg' },
  };

  let countryCode = '';
  let countryInfo = { country: 'Unknown', timezone: '' };

  if (hasPlus || digits.length >= 10) {
    // Try 3, 2, 1 digit country codes
    for (const len of [3, 2, 1]) {
      const cc = digits.slice(0, len);
      if (CC_MAP[cc]) {
        countryCode = cc;
        countryInfo = CC_MAP[cc];
        break;
      }
    }
  }

  const national = countryCode ? digits.slice(countryCode.length) : digits;
  const formatted = countryCode ? `+${countryCode} ${national}` : phoneNumber;

  return {
    valid: digits.length >= 7 && digits.length <= 15,
    formatted,
    countryCode,
    national,
    country: countryInfo.country,
    timezone: countryInfo.timezone,
  };
}

export async function lookupPhoneNumber(phoneNumber: string): Promise<PhoneResult> {
  const start = performance.now();

  logToolActivity('Phone Number OSINT', `Looking up ${phoneNumber}`, 'info');

  const parsed = parsePhoneBasic(phoneNumber);

  let carrier = 'Unknown';
  let lineType: PhoneResult['lineType'] = 'unknown';
  let location = '';

  // Try numverify if API key is present
  const numverifyKey = process.env.NUMVERIFY_API_KEY;
  if (numverifyKey && parsed.valid) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const url = `https://apilayer.net/api/validate?access_key=${encodeURIComponent(numverifyKey)}&number=${encodeURIComponent(phoneNumber)}&format=1`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            carrier = data.carrier || carrier;
            lineType = (data.line_type?.toLowerCase() as PhoneResult['lineType']) || 'unknown';
            location = data.location || '';
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Fall through to basic data
    }
  }

  logToolActivity('Phone Number OSINT', `Lookup complete for ${phoneNumber}`, 'success');

  return {
    number: phoneNumber,
    formatted: parsed.formatted,
    valid: parsed.valid,
    country: parsed.country,
    countryCode: parsed.countryCode,
    carrier,
    lineType,
    timezone: parsed.timezone,
    location,
  };
}
