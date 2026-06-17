import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface RobotsResult {
  domain: string;
  robotsTxt: string;
  disallowedPaths: string[];
  allowedPaths: string[];
  sitemapUrls: string[];
  crawlDelay?: number;
  userAgents: string[];
  interestingPaths: string[];
}

const RobotsTxtAnalyzer = () => {
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RobotsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/robots-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to fetch robots.txt");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="ROBOTS.TXT ANALYZER">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !domain.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Search className="w-4 h-4 mr-2" />Analyze</>}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.disallowedPaths.length}</p>
                <p className="text-xs text-gray-400 mt-1">Total Rules</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.interestingPaths.length > 0 ? "text-yellow-400" : "text-green-400"}`}>
                  {result.interestingPaths.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">Interesting Paths</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.sitemapUrls.length}</p>
                <p className="text-xs text-gray-400 mt-1">Sitemaps Found</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RAW ROBOTS.TXT</h3>
                <pre className="bg-black/60 border border-cyber-cyan/20 rounded p-3 text-xs font-mono text-cyber-cyan overflow-auto max-h-64 whitespace-pre-wrap">
                  {result.robotsTxt || "(empty)"}
                </pre>
              </div>

              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">DISALLOWED PATHS ({result.disallowedPaths.length})</h3>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {result.disallowedPaths.map((path, i) => {
                    const interesting = result.interestingPaths.includes(path);
                    return (
                      <div key={i} className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-2 ${interesting ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400" : "bg-black/40 text-gray-300"}`}>
                        {interesting && <span className="text-yellow-400 font-bold">!</span>}
                        {path}
                      </div>
                    );
                  })}
                  {result.disallowedPaths.length === 0 && <p className="text-gray-500 text-sm">No disallowed paths</p>}
                </div>
              </div>
            </div>

            {result.interestingPaths.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-yellow-400 font-bold tracking-wide mb-3">INTERESTING PATHS DETECTED</h3>
                <div className="flex flex-wrap gap-2">
                  {result.interestingPaths.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs font-mono text-yellow-400">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {result.sitemapUrls.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">SITEMAPS</h3>
                {result.sitemapUrls.map((url, i) => (
                  <p key={i} className="text-cyber-cyan font-mono text-sm">{url}</p>
                ))}
              </div>
            )}

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">USER AGENTS</h3>
              <div className="flex flex-wrap gap-2">
                {result.userAgents.map((ua, i) => (
                  <span key={i} className="px-2 py-1 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-xs text-cyber-cyan">{ua}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default RobotsTxtAnalyzer;
