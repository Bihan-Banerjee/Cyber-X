import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface RedirectResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  redirectedTo?: string;
  payloadUsed?: string;
  severity: string;
  recommendations: string[];
  payloads?: string[];
}

const OpenRedirectFinder = () => {
  const [url, setUrl] = useState("");
  const [parameter, setParameter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RedirectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "payloads">("results");

  const handleScan = async () => {
    if (!url.trim() || !parameter.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/open-redirect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), parameter: parameter.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Test failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Open redirect test failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="OPEN REDIRECT FINDER">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">TARGET URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/redirect"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">PARAMETER NAME</label>
            <Input
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              placeholder="url, redirect, next, return_to"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !url.trim() || !parameter.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</> : <><ExternalLink className="w-4 h-4 mr-2" />Test Open Redirect</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`glass-panel rounded p-6 text-center border-2 ${result.vulnerable ? "border-red-500/50 bg-red-500/5" : "border-green-500/50 bg-green-500/5"}`}>
              <p className={`text-3xl font-bold tracking-widest ${result.vulnerable ? "text-red-400" : "text-green-400"}`}>
                {result.vulnerable ? "VULNERABLE" : "NOT DETECTED"}
              </p>
              {result.redirectedTo && (
                <p className="text-sm text-gray-400 mt-2">Redirected to: <span className="text-red-400 font-mono">{result.redirectedTo}</span></p>
              )}
              {result.payloadUsed && (
                <p className="text-sm text-gray-400 mt-1">Payload: <span className="text-orange-400 font-mono">{result.payloadUsed}</span></p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("results")}
                className={`px-4 py-2 rounded text-sm font-bold ${activeTab === "results" ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30"}`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveTab("payloads")}
                className={`px-4 py-2 rounded text-sm font-bold ${activeTab === "payloads" ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30"}`}
              >
                Payload List
              </button>
            </div>

            {activeTab === "results" && result.recommendations.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RECOMMENDATIONS</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 mt-0.5">→</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === "payloads" && result.payloads && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">TEST PAYLOADS</h3>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {result.payloads.map((p, i) => (
                    <div key={i} className="text-xs font-mono text-cyber-cyan bg-black/40 px-2 py-1 rounded">{p}</div>
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

export default OpenRedirectFinder;
