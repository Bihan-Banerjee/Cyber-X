import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, AlertTriangle, Search, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface DarkWebMention {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface DarkWebCheckResult {
  query: string;
  type: string;
  found: boolean;
  mentions: DarkWebMention[];
  sources: string[];
  total: number;
  disclaimer: string;
}

const DarkWebChecker = () => {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("general");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DarkWebCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!query) return;
    setIsChecking(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/dark-web-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Check failed");
      }

      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to connect to service");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <CyberpunkCard title="DARK WEB CHECKER">
      <div className="space-y-6">
        {/* Disclaimer */}
        <div className="p-4 bg-orange-500/10 border-2 border-orange-500/50 rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-orange-400 font-bold text-sm">IMPORTANT DISCLAIMER</p>
              <p className="text-orange-300 text-xs mt-1">
                This tool searches <strong>Ahmia.fi</strong> — a public dark web search index of .onion sites. It does NOT connect to the dark web directly, does NOT use Tor, and results are from publicly crawled/indexed sources only. Results may be incomplete, stale, or inaccurate. For authorized OSINT and security research only.
              </p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded p-4 space-y-3">
          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">SEARCH QUERY</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. domain.com, email@example.com, CompanyName"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isChecking}
              onKeyDown={(e) => e.key === "Enter" && !isChecking && check()}
            />
          </div>

          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">SEARCH TYPE</label>
            <div className="flex gap-2 flex-wrap">
              {["general", "domain", "email", "company", "credential"].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                    type === t ? "bg-cyber-red text-white border-cyber-red" : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={check}
            disabled={isChecking || !query}
            className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            {isChecking ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />SEARCHING...</>
            ) : (
              <><Search className="mr-2 h-4 w-4" />SEARCH DARK WEB INDEX</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Result Summary */}
            <div className={`p-4 rounded border ${result.found ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
              <p className={`font-bold ${result.found ? "text-red-400" : "text-green-400"}`}>
                {result.found
                  ? `${result.total} mention(s) found in dark web index`
                  : "No mentions found in indexed sources"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Query: "{result.query}" — Sources: {result.sources.join(", ") || "none"}</p>
            </div>

            {/* Mentions */}
            {result.mentions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-cyber-cyan font-bold tracking-wide">INDEXED MENTIONS</h3>
                {result.mentions.map((mention, i) => (
                  <div key={i} className="glass-panel rounded p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-cyber-cyan font-bold text-sm">{mention.title}</p>
                        <p className="text-gray-400 text-xs font-mono break-all mt-0.5">{mention.url}</p>
                        {mention.snippet && (
                          <p className="text-gray-400 text-xs mt-2">{mention.snippet}</p>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded text-xs">
                          Source: {mention.source}
                        </span>
                      </div>
                      <a
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyber-cyan/50 hover:text-cyber-cyan shrink-0"
                        title="Open link (Tor browser required for .onion)"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded">
              <p className="text-gray-400 text-xs">{result.disclaimer}</p>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default DarkWebChecker;
