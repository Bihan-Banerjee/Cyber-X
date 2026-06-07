import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, Globe } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface ReputationSource {
  name: string;
  flagged: boolean;
  details?: string;
}

interface DomainReputationResult {
  domain: string;
  overallScore: number;
  categories: string[];
  malicious: boolean;
  phishing: boolean;
  spam: boolean;
  age?: string;
  registrar?: string;
  sources: ReputationSource[];
}

const DomainReputation = () => {
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DomainReputationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/domain-reputation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Check failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to check domain reputation");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (s: number) => s >= 70 ? "text-green-400" : s >= 40 ? "text-yellow-400" : "text-red-400";

  return (
    <CyberpunkCard title="DOMAIN REPUTATION">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading} />
          <Button onClick={handleCheck} disabled={isLoading || !domain.trim()}
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
            <div className="glass-panel rounded p-5 flex flex-col md:flex-row items-center gap-6">
              <div className="text-center">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    <circle cx="60" cy="60" r="50" fill="none"
                      stroke={result.overallScore >= 70 ? "#4ade80" : result.overallScore >= 40 ? "#facc15" : "#ef4444"}
                      strokeWidth="12"
                      strokeDasharray={`${(result.overallScore / 100) * 314} 314`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}>{result.overallScore}</span>
                    <span className="text-xs text-gray-400">Score</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-cyber-cyan font-mono">{result.domain}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.malicious && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">⚠ Malicious</span>}
                  {result.phishing && <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400">⚠ Phishing</span>}
                  {result.spam && <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400">⚠ Spam</span>}
                  {!result.malicious && !result.phishing && !result.spam && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400">✓ Clean</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.categories.map((cat) => (
                    <span key={cat} className="px-2 py-0.5 rounded text-xs bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">{cat}</span>
                  ))}
                </div>
                {(result.age || result.registrar) && (
                  <div className="mt-2 text-xs text-gray-400">
                    {result.age && <span className="mr-3">Age: {result.age}</span>}
                    {result.registrar && <span>Registrar: {result.registrar}</span>}
                  </div>
                )}
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
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${src.flagged ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
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
            <Globe className="w-8 h-8 text-cyber-cyan/30 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Enter a domain to check its reputation</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default DomainReputation;
