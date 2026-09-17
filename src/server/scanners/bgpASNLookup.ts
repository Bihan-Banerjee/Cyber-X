import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface ASNResult {
  asn: string;
  name: string;
  country: string;
  description: string;
  prefixes: string[];
  peers: string[];
  upstreams: string[];
  downstreams: string[];
  abuseContact?: string;
}

export async function lookupASN(target: string): Promise<ASNResult> {
  const start = performance.now();

  logToolActivity('BGP ASN Lookup', `Looking up ${target}`, 'info');

  const isASN = /^AS\d+$/i.test(target.trim());
  const asnNum = isASN ? target.replace(/^AS/i, '') : null;
  const ip = isASN ? null : target;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let asn = '';
  let name = '';
  let country = '';
  let description = '';
  let prefixes: string[] = [];
  let peers: string[] = [];
  let upstreams: string[] = [];
  let downstreams: string[] = [];
  let abuseContact: string | undefined;

  try {
    if (ip) {
      // Query BGPView for IP (guarded: BGPView has recurring outages, and a
      // failure here must not abort the whole lookup — the fallbacks below still
      // populate the core fields).
      try {
        const res = await fetch(`https://api.bgpview.io/ip/${encodeURIComponent(ip)}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const prefix = data.data?.prefixes?.[0];
          if (prefix) {
            asn = `AS${prefix.asn?.asn || ''}`;
            name = prefix.asn?.name || '';
            description = prefix.asn?.description || '';
            country = prefix.asn?.country_code || '';
            prefixes = data.data.prefixes.map((p: any) => p.prefix || '').filter(Boolean);
          }
          if (!asn && data.data?.rir_allocation) {
            country = data.data.rir_allocation.country_code || '';
          }
        }
      } catch { /* BGPView unreachable — fall through to ipinfo/ipwho below */ }

      // Also query ipinfo.io for additional data
      try {
        const ipinfoRes = await fetch(`https://ipinfo.io/${ip}/json`, { signal: controller.signal });
        if (ipinfoRes.ok) {
          const ipinfo = await ipinfoRes.json();
          if (!asn && ipinfo.org) asn = ipinfo.org.split(' ')[0];
          if (!name && ipinfo.org) name = ipinfo.org.split(' ').slice(1).join(' ');
          if (!country) country = ipinfo.country || '';
        }
      } catch { /* noop */ }

      // Final fallback: ipwho.is (HTTPS, no key) — resolves ASN/org/country when
      // both BGPView and ipinfo are unavailable so the lookup never hard-fails.
      if (!asn) {
        try {
          const whoRes = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: controller.signal });
          if (whoRes.ok) {
            const who = await whoRes.json();
            if (who.success !== false && who.connection?.asn) {
              asn = `AS${who.connection.asn}`;
              name = name || who.connection.org || who.connection.isp || '';
              description = description || who.connection.org || '';
              country = country || who.country_code || '';
            }
          }
        } catch { /* noop */ }
      }

      // Now get full ASN data if we found an ASN
      if (asn) {
        const asnResolved = asn.replace(/^AS/i, '');
        try {
          const asnRes = await fetch(`https://api.bgpview.io/asn/${asnResolved}`, { signal: controller.signal });
          if (asnRes.ok) {
            const asnData = await asnRes.json();
            const d = asnData.data;
            if (d) {
              name = d.name || name;
              description = d.description_full || description;
              country = d.country_code || country;
              abuseContact = d.abuse_contacts?.[0] || undefined;
            }
          }
        } catch { /* noop */ }
      }
    } else if (asnNum) {
      asn = `AS${asnNum}`;
      try {
        const res = await fetch(`https://api.bgpview.io/asn/${asnNum}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const d = data.data;
          if (d) {
            name = d.name || '';
            description = d.description_full || d.description_short || '';
            country = d.country_code || '';
            abuseContact = d.abuse_contacts?.[0];
          }
        }
      } catch { /* BGPView unreachable — prefixes/peers below are also guarded */ }

      // Prefixes
      try {
        const prefRes = await fetch(`https://api.bgpview.io/asn/${asnNum}/prefixes`, { signal: controller.signal });
        if (prefRes.ok) {
          const prefData = await prefRes.json();
          prefixes = (prefData.data?.ipv4_prefixes || []).map((p: any) => p.prefix).slice(0, 50);
        }
      } catch { /* noop */ }

      // Peers
      try {
        const peerRes = await fetch(`https://api.bgpview.io/asn/${asnNum}/peers`, { signal: controller.signal });
        if (peerRes.ok) {
          const peerData = await peerRes.json();
          peers = (peerData.data?.ipv4_peers || []).map((p: any) => `AS${p.asn} ${p.name}`).slice(0, 30);
          upstreams = (peerData.data?.ipv4_upstreams || []).map((p: any) => `AS${p.asn} ${p.name}`).slice(0, 20);
          downstreams = (peerData.data?.ipv4_downstreams || []).map((p: any) => `AS${p.asn} ${p.name}`).slice(0, 20);
        }
      } catch { /* noop */ }
    }

    clearTimeout(timeout);

    logToolActivity('BGP ASN Lookup', `Lookup complete for ${target}: ${asn}`, 'success');

    return { asn: asn || target, name, country, description, prefixes, peers, upstreams, downstreams, abuseContact };
  } catch (error: any) {
    clearTimeout(timeout);
    logToolActivity('BGP ASN Lookup', `Lookup failed: ${error.message}`, 'warning');
    throw error;
  }
}
