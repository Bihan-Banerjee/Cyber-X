import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface WAFResult {
  url: string;
  wafDetected: boolean;
  wafName?: string;
  confidence: number;
  indicators: string[];
  headers: Record<string, string>;
}

const WAFDetector = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WAFResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/waf-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Detection failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "WAF detection failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="WAF DETECTOR">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="https://example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !url.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Detecting...</> : <><ShieldCheck className="w-4 h-4 mr-2" />Detect</>}
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
            <div className={`glass-panel rounded p-6 text-center border-2 ${result.wafDetected ? "border-orange-500/50 bg-orange-500/5" : "border-green-500/50 bg-green-500/5"}`}>
              {result.wafDetected ? (
                <ShieldCheck className="w-12 h-12 text-orange-400 mx-auto mb-3" />
              ) : (
                <ShieldOff className="w-12 h-12 text-green-400 mx-auto mb-3" />
              )}
              <p className={`text-3xl font-bold tracking-widest ${result.wafDetected ? "text-orange-400" : "text-green-400"}`}>
                {result.wafDetected ? "WAF DETECTED" : "NO WAF DETECTED"}
              </p>
              {result.wafName && (
                <p className="text-xl text-cyber-cyan mt-2 font-bold">{result.wafName}</p>
              )}
              <div className="mt-3">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-sm text-gray-400">Confidence:</span>
                  <span className={`text-sm font-bold ${result.confidence >= 80 ? "text-red-400" : result.confidence >= 50 ? "text-yellow-400" : "text-gray-400"}`}>
                    {result.confidence}%
                  </span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-2 max-w-xs mx-auto">
                  <div
                    className={`h-2 rounded-full transition-all ${result.confidence >= 80 ? "bg-red-400" : result.confidence >= 50 ? "bg-yellow-400" : "bg-gray-400"}`}
                    style={{ width: `${result.confidence}%` }}
                  />
                </div>
              </div>
            </div>

            {result.indicators.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">DETECTION INDICATORS</h3>
                <ul className="space-y-2">
                  {result.indicators.map((ind, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-orange-400 mt-0.5">•</span>
                      {ind}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(result.headers).length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RESPONSE HEADERS</h3>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {Object.entries(result.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs font-mono py-0.5 border-b border-cyber-cyan/5 last:border-0">
                      <span className="text-gray-400 w-48 flex-shrink-0">{k}:</span>
                      <span className="text-cyber-cyan break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default WAFDetector;
