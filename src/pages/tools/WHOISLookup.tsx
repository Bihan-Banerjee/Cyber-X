import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, Calendar, User, Globe, Server, Shield, Copy, Check } from "lucide-react";

interface WHOISData {
  domain: string;
  registrar?: string;
  registrarURL?: string;
  createdDate?: string;
  updatedDate?: string;
  expiryDate?: string;
  status?: string[];
  nameServers?: string[];
  registrant?: {
    name?: string;
    organization?: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  admin?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  tech?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  dnssec?: string;
  rawData?: string;
}

const WHOISLookup = () => {
  const [domain, setDomain] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [result, setResult] = useState<WHOISData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!domain) return;

    setIsLooking(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("http://localhost:5000/api/scan/whois", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Lookup failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to WHOIS service");
    } finally {
      setIsLooking(false);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status?: string[]) => {
    if (!status || status.length === 0) return "text-gray-400";
    const statusStr = status.join(" ").toLowerCase();
    if (statusStr.includes("active") || statusStr.includes("ok")) return "text-green-400";
    if (statusStr.includes("pending") || statusStr.includes("hold")) return "text-yellow-400";
    if (statusStr.includes("expired") || statusStr.includes("suspended")) return "text-red-400";
    return "text-gray-400";
  };

  const InfoRow = ({ label, value, icon: Icon, copyable = false }: any) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;

    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    const fieldId = label.toLowerCase().replace(/\s/g, "-");

    return (
      <div className="flex items-start justify-between py-3 border-b border-cyber-red/10 hover:bg-black/20 transition-colors px-2 rounded">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-cyber-cyan mt-0.5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm text-cyber-cyan font-mono break-words">{displayValue}</p>
          </div>
        </div>
        {copyable && (
          <button
            onClick={() => copyToClipboard(displayValue, fieldId)}
            className="ml-2 p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors flex-shrink-0"
            title="Copy to clipboard"
          >
            {copiedField === fieldId ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
            )}
          </button>
        )}
      </div>
    );
  };

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="glass-panel rounded p-4 space-y-2">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyber-cyan/30">
        <Icon className="w-5 h-5 text-cyber-cyan" />
        <h3 className="text-sm font-bold text-cyber-cyan tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <CyberpunkCard title="WHOIS LOOKUP">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              DOMAIN NAME
            </label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isLooking}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            />
          </div>

          <Button
            onClick={handleLookup}
            disabled={isLooking || !domain}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isLooking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                QUERYING...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                LOOKUP WHOIS
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            {/* Domain Header */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-8 h-8 text-cyber-cyan" />
                <div>
                  <h2 className="text-2xl font-bold text-cyber-cyan">{result.domain}</h2>
                  {result.status && (
                    <p className={`text-sm font-mono mt-1 ${getStatusColor(result.status)}`}>
                      {result.status.join(" • ")}
                    </p>
                  )}
                </div>
              </div>

              {result.registrar && (
                <div className="pt-4 border-t border-cyber-red/20">
                  <InfoRow
                    label="Registrar"
                    value={result.registrar}
                    icon={Shield}
                    copyable
                  />
                  {result.registrarURL && (
                    <InfoRow label="Registrar URL" value={result.registrarURL} copyable />
                  )}
                </div>
              )}
            </div>

            {/* Important Dates */}
            <Section title="IMPORTANT DATES" icon={Calendar}>
              <InfoRow
                label="Created Date"
                value={formatDate(result.createdDate)}
                icon={Calendar}
              />
              <InfoRow
                label="Updated Date"
                value={formatDate(result.updatedDate)}
                icon={Calendar}
              />
              <InfoRow
                label="Expiry Date"
                value={formatDate(result.expiryDate)}
                icon={Calendar}
              />
            </Section>

            {/* Name Servers */}
            {result.nameServers && result.nameServers.length > 0 && (
              <Section title="NAME SERVERS" icon={Server}>
                <div className="space-y-2">
                  {result.nameServers.map((ns, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-black/30 rounded hover:bg-black/50 transition-colors"
                    >
                      <span className="text-sm text-cyber-cyan font-mono">{ns}</span>
                      <button
                        onClick={() => copyToClipboard(ns, `ns-${idx}`)}
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                      >
                        {copiedField === `ns-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Registrant Information */}
            {result.registrant && Object.keys(result.registrant).length > 0 && (
              <Section title="REGISTRANT INFORMATION" icon={User}>
                <InfoRow
                  label="Name"
                  value={result.registrant.name}
                  icon={User}
                  copyable
                />
                <InfoRow
                  label="Organization"
                  value={result.registrant.organization}
                  copyable
                />
                <InfoRow
                  label="Email"
                  value={result.registrant.email}
                  copyable
                />
                <InfoRow
                  label="Phone"
                  value={result.registrant.phone}
                  copyable
                />
                <InfoRow
                  label="Country"
                  value={result.registrant.country}
                  icon={Globe}
                />
              </Section>
            )}

            {/* Admin Contact */}
            {result.admin && Object.keys(result.admin).length > 0 && (
              <Section title="ADMINISTRATIVE CONTACT" icon={Shield}>
                <InfoRow label="Name" value={result.admin.name} copyable />
                <InfoRow label="Organization" value={result.admin.organization} copyable />
                <InfoRow label="Email" value={result.admin.email} copyable />
              </Section>
            )}

            {/* Technical Contact */}
            {result.tech && Object.keys(result.tech).length > 0 && (
              <Section title="TECHNICAL CONTACT" icon={Server}>
                <InfoRow label="Name" value={result.tech.name} copyable />
                <InfoRow label="Organization" value={result.tech.organization} copyable />
                <InfoRow label="Email" value={result.tech.email} copyable />
              </Section>
            )}

            {/* DNSSEC */}
            {result.dnssec && (
              <Section title="SECURITY" icon={Shield}>
                <InfoRow label="DNSSEC" value={result.dnssec} icon={Shield} />
              </Section>
            )}

            {/* Raw Data */}
            {result.rawData && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-cyber-cyan tracking-wide">
                    RAW WHOIS DATA
                  </h3>
                  <button
                    onClick={() => copyToClipboard(result.rawData || "", "raw-data")}
                    className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan rounded text-xs flex items-center gap-1 transition-colors"
                  >
                    {copiedField === "raw-data" ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy All
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-black/50 rounded p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                    {result.rawData}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default WHOISLookup;
