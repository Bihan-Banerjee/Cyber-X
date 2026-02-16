import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Globe, Server, Shield, AlertCircle, Copy, Check, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface GeolocationResult {
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

const IPGeolocation = () => {
  const [ipAddress, setIpAddress] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [result, setResult] = useState<GeolocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleLookup = async () => {
    const targetIP = ipAddress.trim() || "auto";

    setIsLookingUp(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/ip-geo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: targetIP }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Lookup failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to lookup IP address");
    } finally {
      setIsLookingUp(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getThreatColor = (level: string) => {
    const colors: Record<string, string> = {
      high: "text-red-400 bg-red-500/20 border-red-500/50",
      medium: "text-yellow-400 bg-yellow-500/20 border-yellow-500/50",
      low: "text-green-400 bg-green-500/20 border-green-500/50",
      none: "text-gray-400 bg-gray-500/20 border-gray-500/50",
    };
    return colors[level.toLowerCase()] || colors.none;
  };

  return (
    <CyberpunkCard title="IP GEOLOCATION">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              IP ADDRESS
            </label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="Leave empty to lookup your own IP"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono"
              disabled={isLookingUp}
            />
          </div>

          <Button
            onClick={handleLookup}
            disabled={isLookingUp}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isLookingUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                LOOKING UP IP...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                LOOKUP LOCATION
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ IP Geolocation Lookup</p>
            <p>Retrieves detailed geolocation information for any IPv4 or IPv6 address including location, ISP, timezone, threat detection, and more.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-6">
            {/* IP Address Header */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-8 h-8 text-cyber-cyan" />
                  <div>
                    <h3 className="text-2xl font-bold text-cyber-cyan font-mono">{result.ip}</h3>
                    <p className="text-sm text-gray-400">IPv{result.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(result.ip, "ip")}
                  className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                >
                  {copiedField === "ip" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-cyber-cyan" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded text-xs font-bold border ${getThreatColor(result.threatLevel)}`}>
                  {result.threatLevel.toUpperCase()} THREAT
                </span>
                {result.isProxy && (
                  <span className="px-3 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/50">
                    PROXY
                  </span>
                )}
                {result.isVPN && (
                  <span className="px-3 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                    VPN
                  </span>
                )}
                {result.isTor && (
                  <span className="px-3 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/50">
                    TOR
                  </span>
                )}
                {result.isHosting && (
                  <span className="px-3 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/50">
                    HOSTING
                  </span>
                )}
              </div>
            </div>

            {/* Location Details */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-cyber-cyan" />
                <h3 className="text-lg font-bold text-cyber-cyan">LOCATION</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">City</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.city || "N/A"}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Region</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.region || "N/A"} ({result.regionCode || "N/A"})</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Country</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.country} ({result.countryCode})</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Continent</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.continent}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">ZIP Code</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.zip || "N/A"}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Coordinates</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-cyber-cyan font-mono">{result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</p>
                    <button
                      onClick={() => copyToClipboard(`${result.latitude}, ${result.longitude}`, "coords")}
                      className="p-1 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                    >
                      {copiedField === "coords" ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-cyber-cyan" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <a
                href={result.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 w-full p-3 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 rounded transition-colors"
              >
                <MapPin className="w-4 h-4 text-cyber-cyan" />
                <span className="text-sm text-cyber-cyan font-semibold">VIEW ON GOOGLE MAPS</span>
                <ExternalLink className="w-3 h-3 text-cyber-cyan" />
              </a>
            </div>

            {/* Network Information */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-cyber-cyan" />
                <h3 className="text-lg font-bold text-cyber-cyan">NETWORK INFO</h3>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">ISP</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.isp}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Organization</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.organization}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-3 bg-black/30 rounded">
                    <p className="text-xs text-gray-500 mb-1">ASN</p>
                    <p className="text-sm text-cyber-cyan font-mono">{result.asn}</p>
                  </div>
                  <div className="p-3 bg-black/30 rounded">
                    <p className="text-xs text-gray-500 mb-1">ASN Organization</p>
                    <p className="text-sm text-cyber-cyan font-semibold">{result.asnOrg}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Regional Information */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-cyber-cyan" />
                <h3 className="text-lg font-bold text-cyber-cyan">REGIONAL INFO</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Timezone</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.timezone}</p>
                </div>
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 mb-1">Currency</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.currency}</p>
                </div>
                <div className="p-3 bg-black/30 rounded md:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Languages</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.languages.join(", ")}</p>
                </div>
              </div>
            </div>

            {/* Security Information */}
            {(result.isProxy || result.isVPN || result.isTor || result.isHosting || result.isAnonymous) && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-bold text-red-400">SECURITY ALERTS</h3>
                </div>

                <div className="space-y-2">
                  {result.isProxy && (
                    <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded">
                      <AlertCircle className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-orange-400">This IP is detected as a proxy server</span>
                    </div>
                  )}
                  {result.isVPN && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-yellow-400">This IP is using a VPN connection</span>
                    </div>
                  )}
                  {result.isTor && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400">This IP is part of the TOR network</span>
                    </div>
                  )}
                  {result.isHosting && (
                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                      <AlertCircle className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-400">This IP belongs to a hosting provider</span>
                    </div>
                  )}
                  {result.isAnonymous && (
                    <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                      <AlertCircle className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-400">This IP is using anonymization techniques</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default IPGeolocation;
