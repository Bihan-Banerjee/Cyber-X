import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck, Mail } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface SPFRecord { present: boolean; record?: string; policy?: string; allMechanism?: string; valid: boolean; }
interface DKIMRecord { present: boolean; selector?: string; record?: string; valid: boolean; }
interface DMARCRecord { present: boolean; record?: string; policy?: string; spfAlignment?: string; dkimAlignment?: string; valid: boolean; }

interface SpoofCheckResult {
  domain: string;
  spf: SPFRecord;
  dkim: DKIMRecord;
  dmarc: DMARCRecord;
  spoofable: boolean;
  verdict: string;
  recommendations: string[];
  scanDuration: number;
}

const SpoofedEmailChecker = () => {
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SpoofCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/email-spoof-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Check failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to email spoof checker service");
    } finally {
      setIsLoading(false);
    }
  };

  const statusBadge = (present: boolean, policy?: string) => {
    if (!present) return { label: "MISSING", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (policy === "none") return { label: "WEAK", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    return { label: "PASS", color: "bg-green-500/20 text-green-400 border-green-500/30" };
  };

  const spfBadge = result ? statusBadge(result.spf.present, result.spf.allMechanism === '+all' || result.spf.allMechanism === '?all' ? 'none' : undefined) : null;
  const dkimBadge = result ? statusBadge(result.dkim.present) : null;
  const dmarcBadge = result ? statusBadge(result.dmarc.present, result.dmarc.policy) : null;

  return (
    <CyberpunkCard title="SPOOFED EMAIL CHECKER">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleCheck}
            disabled={isLoading || !domain.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</>
            ) : (
              <><Mail className="w-4 h-4 mr-2" />Check</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Big verdict */}
            <div className={`flex items-center gap-4 p-6 rounded border ${
              result.spoofable
                ? "bg-red-500/20 border-red-500/30 text-red-400"
                : "bg-green-500/20 border-green-500/30 text-green-400"
            }`}>
              {result.spoofable ? (
                <ShieldAlert className="w-12 h-12 flex-shrink-0" />
              ) : (
                <ShieldCheck className="w-12 h-12 flex-shrink-0" />
              )}
              <div>
                <p className="text-xl font-bold tracking-widest">
                  {result.spoofable ? "⚠ DOMAIN CAN BE SPOOFED" : "✓ DOMAIN IS PROTECTED"}
                </p>
                <p className="text-sm opacity-80 mt-1">{result.domain}</p>
              </div>
            </div>

            {/* SPF / DKIM / DMARC cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* SPF */}
              <div className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-cyber-cyan font-bold tracking-wide">SPF</h3>
                  {spfBadge && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${spfBadge.color}`}>
                      {spfBadge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">Sender Policy Framework</p>
                {result.spf.record ? (
                  <pre className="text-xs font-mono text-green-400 bg-black/30 rounded p-2 break-all whitespace-pre-wrap">{result.spf.record}</pre>
                ) : (
                  <p className="text-xs text-red-400">No SPF record found</p>
                )}
                {result.spf.allMechanism && (
                  <p className="text-xs text-gray-400 mt-1">All mechanism: <span className="font-mono text-cyber-cyan">{result.spf.allMechanism}</span></p>
                )}
              </div>

              {/* DKIM */}
              <div className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-cyber-cyan font-bold tracking-wide">DKIM</h3>
                  {dkimBadge && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${dkimBadge.color}`}>
                      {dkimBadge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">DomainKeys Identified Mail</p>
                {result.dkim.present ? (
                  <div>
                    <p className="text-xs text-gray-400">Selector: <span className="font-mono text-cyber-cyan">{result.dkim.selector}</span></p>
                    <pre className="text-xs font-mono text-green-400 bg-black/30 rounded p-2 break-all whitespace-pre-wrap mt-2 max-h-24 overflow-y-auto">{result.dkim.record}</pre>
                  </div>
                ) : (
                  <p className="text-xs text-red-400">No DKIM record found on common selectors</p>
                )}
              </div>

              {/* DMARC */}
              <div className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-cyber-cyan font-bold tracking-wide">DMARC</h3>
                  {dmarcBadge && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${dmarcBadge.color}`}>
                      {dmarcBadge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">Domain-based Message Authentication</p>
                {result.dmarc.record ? (
                  <div>
                    <pre className="text-xs font-mono text-green-400 bg-black/30 rounded p-2 break-all whitespace-pre-wrap">{result.dmarc.record}</pre>
                    {result.dmarc.policy && (
                      <p className="text-xs text-gray-400 mt-1">Policy: <span className={`font-mono font-bold ${result.dmarc.policy === "reject" ? "text-green-400" : result.dmarc.policy === "quarantine" ? "text-yellow-400" : "text-red-400"}`}>{result.dmarc.policy}</span></p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-red-400">No DMARC record found at _dmarc.{result.domain}</p>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RECOMMENDATIONS</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className={`flex-shrink-0 mt-0.5 ${result.spoofable ? "text-yellow-400" : "text-green-400"}`}>
                        {result.spoofable ? "⚠" : "✓"}
                      </span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500 text-right">Check completed in {result.scanDuration}s</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default SpoofedEmailChecker;
