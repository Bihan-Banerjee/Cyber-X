import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Shield, ShieldOff, ShieldAlert } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PhishingIndicator {
  name: string;
  detected: boolean;
  severity: "critical" | "high" | "medium" | "low" | "info";
  detail: string;
}

interface PhishingResult {
  url: string;
  score: number;
  verdict: "SAFE" | "SUSPICIOUS" | "PHISHING";
  indicators: PhishingIndicator[];
}

const getSeverityColor = (severity: string) => {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/50",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    info: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  };
  return colors[severity] || colors.info;
};

const PhishingURLDetector = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PhishingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/phishing-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Check failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Phishing check failed");
    } finally {
      setIsLoading(false);
    }
  };

  const verdictConfig = {
    SAFE: { color: "text-green-400", border: "border-green-500/50 bg-green-500/5", Icon: Shield },
    SUSPICIOUS: { color: "text-yellow-400", border: "border-yellow-500/50 bg-yellow-500/5", Icon: ShieldAlert },
    PHISHING: { color: "text-red-400", border: "border-red-500/50 bg-red-500/5", Icon: ShieldOff },
  };

  const scoreColor = (s: number) => s >= 70 ? "bg-red-400" : s >= 40 ? "bg-yellow-400" : "bg-green-400";
  const scoreText = (s: number) => s >= 70 ? "text-red-400" : s >= 40 ? "text-yellow-400" : "text-green-400";

  return (
    <CyberpunkCard title="PHISHING URL DETECTOR">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="https://suspicious-site.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !url.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : <><Shield className="w-4 h-4 mr-2" />Check</>}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (() => {
          const vc = verdictConfig[result.verdict];
          const VerdictIcon = vc.Icon;
          return (
            <div className="space-y-4">
              <div className={`glass-panel rounded p-6 text-center border-2 ${vc.border}`}>
                <VerdictIcon className={`w-12 h-12 mx-auto mb-3 ${vc.color}`} />
                <p className={`text-3xl font-bold tracking-widest ${vc.color}`}>{result.verdict}</p>
                <div className="mt-4 max-w-xs mx-auto">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Threat Score</span>
                    <span className={`text-sm font-bold ${scoreText(result.score)}`}>{result.score}/100</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${scoreColor(result.score)}`}
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.indicators.map((ind, i) => (
                  <div key={i} className={`p-3 rounded border ${ind.detected ? getSeverityColor(ind.severity) : "bg-gray-500/5 border-gray-500/20 text-gray-500"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold">{ind.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ind.detected ? getSeverityColor(ind.severity) : "border-gray-500/30 text-gray-500"}`}>
                        {ind.detected ? "DETECTED" : "CLEAN"}
                      </span>
                    </div>
                    <p className="text-xs">{ind.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </CyberpunkCard>
  );
};

export default PhishingURLDetector;
