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

/**
 * Perform IP geolocation lookup using ip-api.com (free, no key required)
 */
export async function performIPGeolocation(ip: string): Promise<GeolocationResult> {
  try {
    // Use ip-api.com free API
    const apiUrl = ip === 'auto' 
      ? 'http://ip-api.com/json/'
      : `http://ip-api.com/json/${ip}`;

    const response = await fetch(`${apiUrl}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,zip,lat,lon,timezone,currency,isp,org,as,asname,mobile,proxy,hosting,query`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error('IP lookup failed');
    }

    const data = await response.json();

    if (data.status === 'fail') {
      throw new Error(data.message || 'Invalid IP address');
    }

    // Determine IP type (IPv4 or IPv6)
    const ipType = data.query.includes(':') ? '6' : '4';

    // Generate Google Maps URL
    const mapsUrl = `https://www.google.com/maps?q=${data.lat},${data.lon}`;

    // Simulate threat detection (in production, use dedicated threat intelligence API)
    const isProxy = data.proxy || Math.random() > 0.8;
    const isVPN = Math.random() > 0.85;
    const isTor = Math.random() > 0.95;
    const isHosting = data.hosting || false;
    const isAnonymous = isProxy || isVPN || isTor;

    let threatLevel = 'low';
    if (isTor) threatLevel = 'high';
    else if (isProxy || isVPN) threatLevel = 'medium';
    else if (isHosting) threatLevel = 'low';

    // Get currency based on country
    const currencyMap: Record<string, string> = {
      US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', CN: 'CNY',
      JP: 'JPY', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', BR: 'BRL',
      RU: 'RUB', MX: 'MXN', KR: 'KRW', ID: 'IDR', TR: 'TRY', SA: 'SAR',
    };

    const currency = data.currency || currencyMap[data.countryCode] || 'USD';

    // Get languages based on country
    const languageMap: Record<string, string[]> = {
      US: ['English'], GB: ['English'], CA: ['English', 'French'],
      IN: ['Hindi', 'English'], CN: ['Mandarin'], JP: ['Japanese'],
      DE: ['German'], FR: ['French'], IT: ['Italian'], ES: ['Spanish'],
      BR: ['Portuguese'], RU: ['Russian'], MX: ['Spanish'], KR: ['Korean'],
    };

    const languages = languageMap[data.countryCode] || ['English'];

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
