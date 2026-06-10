import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, ShieldAlert } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface ReputationSource {
  name: string;
  flagged: boolean;
  details?: string;
}

interface IPReputationResult {
  ip: string;
  abuseScore: number;
  isMalicious: boolean;
  isProxy: boolean;
  isVPN: boolean;
  isTor: boolean;
  isBotnet: boolean;
  country: string;
  org: string;
  recentReports: number;
  sources: ReputationSource[];
}

const IPReputationChecker = () => {
  const [ip, setIp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IPReputationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!ip.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/ip-reputation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: ip.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Check failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to check IP reputation");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score === 0) return "text-green-400";
    if (score < 25) return "text-yellow-400";
    if (score < 60) return "text-orange-400";
    return "text-red-400";
  };

  const tags = result
    ? [
        { label: "Malicious", active: result.isMalicious, color: "bg-red-500/20 text-red-400 border-red-500/40" },
        { label: "Proxy", active: result.isProxy, color: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
        { label: "VPN", active: result.isVPN, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
        { label: "Tor", active: result.isTor, color: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
        { label: "Botnet", active: result.isBotnet, color: "bg-red-700/20 text-red-300 border-red-700/40" },
      ]
    : [];

  return (
    <CyberpunkCard title="IP REPUTATION CHECKER">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="Enter IP address (e.g. 1.2.3.4)"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            disabled={isLoading}
          />
          <Button onClick={handleCheck} disabled={isLoading || !ip.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="glass-panel rounded p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="text-center">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={result.abuseScore === 0 ? "#4ade80" : result.abuseScore < 25 ? "#facc15" : result.abuseScore < 60 ? "#fb923c" : "#ef4444"}
                      strokeWidth="12"
                      strokeDasharray={`${(result.abuseScore / 100) * 314} 314`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${getScoreColor(result.abuseScore)}`}>{result.abuseScore}</span>
                    <span className="text-xs text-gray-400">Abuse Score</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-cyber-cyan font-mono">{result.ip}</p>
                <p className="text-sm text-gray-400">{result.org} · {result.country}</p>
                <p className="text-sm text-gray-400 mt-1">{result.recentReports} recent reports</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {tags.map((tag) => (
                    <span key={tag.label}
                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        tag.active ? tag.color : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                      }`}>
                      {tag.active ? "⚠ " : "✓ "}{tag.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {result.sources.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">SOURCE BREAKDOWN</h3>
                <div className="space-y-2">
                  {result.sources.map((src, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-cyber-cyan/10">
                      <span className="text-sm text-gray-300">{src.name}</span>
                      <div className="flex items-center gap-2">
                        {src.details && <span className="text-xs text-gray-500">{src.details}</span>}
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          src.flagged ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                        }`}>
                          {src.flagged ? "FLAGGED" : "CLEAN"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !isLoading && (
          <div className="glass-panel rounded p-6 text-center">
            <ShieldAlert className="w-8 h-8 text-cyber-cyan/30 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Enter an IP address to check its reputation against threat intelligence feeds</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default IPReputationChecker;
