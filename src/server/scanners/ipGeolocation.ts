export interface GeolocationResult {
  ip: string;
  type: string;
  continent: string;
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  timezone: string;
  currency: string;
  languages: string[];
  isp: string;
  organization: string;
  asn: string;
  asnOrg: string;
  isProxy: boolean;
  isVPN: boolean;
  isTor: boolean;
  isHosting: boolean;
  threatLevel: string;
  isAnonymous: boolean;
  mapsUrl: string;
}

interface NormalizedGeo {
  query: string; continent?: string; country?: string; countryCode?: string;
  regionName?: string; region?: string; city?: string; zip?: string;
  lat?: number; lon?: number; timezone?: string; currency?: string;
  isp?: string; org?: string; as?: string; asname?: string;
  proxy?: boolean; hosting?: boolean;
}

// Primary provider: ip-api.com (free, no key, rich fields incl. proxy/hosting).
// It is HTTP-only on the free tier, which some networks block.
async function fetchIpApi(ip: string): Promise<NormalizedGeo | null> {
  try {
    const apiUrl = ip === 'auto' ? 'http://ip-api.com/json/' : `http://ip-api.com/json/${ip}`;
    const r = await fetch(`${apiUrl}?fields=status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,currency,isp,org,as,asname,mobile,proxy,hosting,query`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.status === 'fail') throw new Error(d.message || 'Invalid IP address');
    return d as NormalizedGeo;
  } catch (e: any) {
    if (e?.message === 'Invalid IP address') throw e;
    return null;
  }
}

// Fallback provider: ipwho.is (free, no key, HTTPS). Used when ip-api is
// unreachable. It does not expose proxy/VPN flags, so those default to false.
async function fetchIpWho(ip: string): Promise<NormalizedGeo | null> {
  try {
    const r = await fetch(`https://ipwho.is/${ip === 'auto' ? '' : ip}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.success === false) throw new Error(d.message || 'Invalid IP address');
    return {
      query: d.ip, continent: d.continent, country: d.country, countryCode: d.country_code,
      regionName: d.region, region: d.region_code, city: d.city, zip: d.postal,
      lat: d.latitude, lon: d.longitude, timezone: d.timezone?.id,
      isp: d.connection?.isp, org: d.connection?.org,
      as: d.connection?.asn ? `AS${d.connection.asn}` : undefined, asname: d.connection?.org,
      proxy: false, hosting: false,
    };
  } catch (e: any) {
    if (e?.message === 'Invalid IP address') throw e;
    return null;
  }
}

/**
 * Perform IP geolocation lookup. Tries ip-api.com (rich) then falls back to
 * ipwho.is (HTTPS) so the tool still works where plain HTTP is blocked.
 *
 * Honesty note: only proxy/hosting flags come from real provider data. Free
 * geolocation APIs do NOT reliably detect VPN or Tor, so those are reported as
 * false rather than guessed. The UI states this limitation.
 */
export async function performIPGeolocation(ip: string): Promise<GeolocationResult> {
  try {
    const data = (await fetchIpApi(ip)) || (await fetchIpWho(ip));
    if (!data || !data.query) {
      throw new Error('All geolocation providers are unreachable');
    }

    // Determine IP type (IPv4 or IPv6)
    const ipType = data.query.includes(':') ? '6' : '4';

    // Generate Google Maps URL
    const mapsUrl = `https://www.google.com/maps?q=${data.lat},${data.lon}`;

    // Threat flags: derived ONLY from real provider data. Free providers surface
    // proxy/hosting; VPN and Tor detection are not available and are reported as
    // false (never fabricated). isAnonymous reflects the proxy flag only.
    const isProxy = data.proxy || false;
    const isVPN = false;
    const isTor = false;
    const isHosting = data.hosting || false;
    const isAnonymous = isProxy;

    let threatLevel = 'low';
    if (isProxy) threatLevel = 'medium';
    else if (isHosting) threatLevel = 'low';

    // Get currency based on country
    const currencyMap: Record<string, string> = {
      US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', CN: 'CNY',
      JP: 'JPY', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', BR: 'BRL',
      RU: 'RUB', MX: 'MXN', KR: 'KRW', ID: 'IDR', TR: 'TRY', SA: 'SAR',
    };

    const currency = data.currency || currencyMap[data.countryCode || ''] || 'USD';

    // Get languages based on country
    const languageMap: Record<string, string[]> = {
      US: ['English'], GB: ['English'], CA: ['English', 'French'],
      IN: ['Hindi', 'English'], CN: ['Mandarin'], JP: ['Japanese'],
      DE: ['German'], FR: ['French'], IT: ['Italian'], ES: ['Spanish'],
      BR: ['Portuguese'], RU: ['Russian'], MX: ['Spanish'], KR: ['Korean'],
    };

    const languages = languageMap[data.countryCode || ''] || ['English'];

    return {
      ip: data.query,
      type: ipType,
      continent: data.continent || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.countryCode || 'XX',
      region: data.regionName || 'Unknown',
      regionCode: data.region || 'XX',
      city: data.city || 'Unknown',
      zip: data.zip || '',
      latitude: data.lat || 0,
      longitude: data.lon || 0,
      timezone: data.timezone || 'UTC',
      currency,
      languages,
      isp: data.isp || 'Unknown ISP',
      organization: data.org || 'Unknown Organization',
      asn: data.as?.split(' ')[0] || 'Unknown',
      asnOrg: data.asname || data.as || 'Unknown',
      isProxy,
      isVPN,
      isTor,
      isHosting,
      threatLevel,
      isAnonymous,
      mapsUrl,
    };
  } catch (error: any) {
    throw new Error(`IP geolocation lookup failed: ${error.message}`);
  }
}
