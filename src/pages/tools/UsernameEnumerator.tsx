import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, ExternalLink, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PlatformResult {
  platform: string;
  url: string;
  status: "found" | "not_found" | "error";
  profileUrl?: string;
  responseTime: number;
  errorMessage?: string;
}

interface UsernameEnumResult {
  username: string;
  results: PlatformResult[];
  found: number;
  notFound: number;
  errors: number;
  scanDuration: number;
}

type FilterType = "all" | "found" | "not_found" | "error";

const UsernameEnumerator = () => {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<UsernameEnumResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const handleScan = async () => {
    if (!username.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/username-enum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), timeoutMs: 8000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Scan failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to username enumerator service");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = result?.results.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  }) || [];

  const total = result?.results.length || 0;
  const progress = total > 0 ? 100 : 0;

  return (
    <CyberpunkCard title="USERNAME ENUMERATOR">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Enter username to search"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !username.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" />Search</>
            )}
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Checking platforms...</span>
            </div>
            <div className="h-2 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyber-red rounded-full transition-all duration-300 animate-pulse"
                style={{ width: "60%" }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Progress/summary */}
            <div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-cyber-red rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-panel rounded p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{result.found}</p>
                  <p className="text-xs text-gray-400">Found</p>
                </div>
                <div className="glass-panel rounded p-3 text-center">
                  <p className="text-2xl font-bold text-gray-400">{result.notFound}</p>
                  <p className="text-xs text-gray-400">Not Found</p>
                </div>
                <div className="glass-panel rounded p-3 text-center">
                  <p className="text-2xl font-bold text-orange-400">{result.errors}</p>
                  <p className="text-xs text-gray-400">Errors</p>
                </div>
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "all", label: `All (${total})` },
                { key: "found", label: `Found (${result.found})` },
                { key: "not_found", label: `Not Found (${result.notFound})` },
                { key: "error", label: `Error (${result.errors})` },
              ] as { key: FilterType; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                    filter === key
                      ? "bg-cyber-cyan text-black border-cyber-cyan"
                      : "bg-transparent text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Results grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredResults.map((r) => (
                <div
                  key={r.platform}
                  className={`flex items-center gap-3 p-3 rounded border transition-colors ${
                    r.status === "found"
                      ? "bg-green-500/10 border-green-500/30"
                      : r.status === "error"
                      ? "bg-orange-500/10 border-orange-500/20"
                      : "bg-black/20 border-cyber-cyan/10"
                  }`}
                >
                  {r.status === "found" ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : r.status === "error" ? (
                    <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${r.status === "found" ? "text-green-400" : "text-gray-400"}`}>
                      {r.platform}
                    </p>
                    {r.errorMessage && (
                      <p className="text-xs text-orange-400">{r.errorMessage}</p>
                    )}
                    <p className="text-xs text-gray-600">{r.responseTime}ms</p>
                  </div>
                  {r.profileUrl && (
                    <a
                      href={r.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyber-cyan hover:text-cyber-cyan/80"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 text-right">Scan completed in {result.scanDuration}s</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default UsernameEnumerator;
