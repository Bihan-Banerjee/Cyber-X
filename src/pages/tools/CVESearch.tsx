import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CVEItem {
  id: string;
  description: string;
  cvssScore: number | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE" | "UNKNOWN";
  publishedDate: string;
  lastModified: string;
  references: string[];
  affectedProducts: string[];
}

interface CVESearchResult {
  results: CVEItem[];
  total: number;
  query: string;
  scanDuration: number;
}

const CVESearch = () => {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CVESearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    setExpanded(new Set());

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/cve-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), limit }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Search failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to CVE search service");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "bg-red-500/20 text-red-400 border-red-500/50",
      HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      LOW: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      NONE: "bg-gray-500/20 text-gray-400 border-gray-500/50",
      UNKNOWN: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return colors[severity] || colors.UNKNOWN;
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 9) return "bg-red-500";
    if (score >= 7) return "bg-orange-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const filteredResults = result?.results.filter(
    (r) => severityFilter === "ALL" || r.severity === severityFilter
  ) || [];

  const severities = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

  return (
    <CyberpunkCard title="CVE SEARCH">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Apache Log4j, OpenSSL, CVE-2021-44228"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={isLoading}
              className="bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-2 text-sm focus:outline-none"
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n} results</option>
              ))}
            </select>
            <Button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Search</>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Showing <span className="text-cyber-cyan font-bold">{filteredResults.length}</span> of{" "}
                <span className="text-cyber-cyan font-bold">{result.total.toLocaleString()}</span> total CVEs
                {result.total > result.results.length && (
                  <span className="text-gray-500"> (showing first {result.results.length})</span>
                )}
              </p>
              <span className="text-xs text-gray-500">{result.scanDuration}s</span>
            </div>

            {/* Severity filter */}
            <div className="flex flex-wrap gap-2">
              {severities.map((s) => {
                const count = s === "ALL" ? result.results.length : result.results.filter((r) => r.severity === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                      severityFilter === s
                        ? s === "ALL"
                          ? "bg-cyber-cyan text-black border-cyber-cyan"
                          : getSeverityColor(s)
                        : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </div>

            {/* CVE cards */}
            <div className="space-y-2">
              {filteredResults.map((cve) => {
                const isExpanded = expanded.has(cve.id);
                return (
                  <div key={cve.id} className="glass-panel rounded overflow-hidden">
                    <button
                      className="w-full text-left p-4 hover:bg-white/5 transition-colors"
                      onClick={() => toggleExpand(cve.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-cyber-cyan font-mono font-bold text-sm">{cve.id}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(cve.severity)}`}>
                              {cve.severity}
                            </span>
                            {cve.cvssScore !== null && (
                              <span className="text-xs text-gray-400">CVSS: <span className="font-bold text-gray-200">{cve.cvssScore.toFixed(1)}</span></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2">{cve.description}</p>
                        </div>
                        {cve.cvssScore !== null && (
                          <div className="flex-shrink-0 text-right">
                            <div className="w-16 h-2 bg-black/50 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full ${getScoreBarColor(cve.cvssScore)} rounded-full`}
                                style={{ width: `${(cve.cvssScore / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-cyber-cyan/10 pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500">Published: </span>
                            <span className="text-gray-300">{new Date(cve.publishedDate).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Modified: </span>
                            <span className="text-gray-300">{new Date(cve.lastModified).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-300">{cve.description}</p>

                        {cve.affectedProducts.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 font-bold mb-1">Affected Products:</p>
                            <div className="flex flex-wrap gap-1">
                              {cve.affectedProducts.map((p, i) => (
                                <span key={i} className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-300">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {cve.references.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 font-bold mb-1">References:</p>
                            <div className="space-y-1">
                              {cve.references.map((ref, i) => (
                                <a
                                  key={i}
                                  href={ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-cyber-cyan hover:underline break-all"
                                >
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  {ref}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredResults.length === 0 && (
              <p className="text-center text-gray-500 py-8">No CVEs match the selected filter.</p>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CVESearch;
