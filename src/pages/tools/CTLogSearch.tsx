import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CertEntry {
  id: number;
  loggedAt: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  domains: string[];
}

interface CTSearchResult {
  domain: string;
  certificates: CertEntry[];
  uniqueDomains: string[];
  total: number;
  scanDuration: number;
}

const CTLogSearch = () => {
  const [domain, setDomain] = useState("");
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [limit, setLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CTSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const handleSearch = async () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/ct-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), includeSubdomains, limit }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Search failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to CT log search service");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDomains = result?.uniqueDomains.filter((d) =>
    filterQuery ? d.toLowerCase().includes(filterQuery.toLowerCase()) : true
  ) || [];

  const downloadDomains = () => {
    if (!result) return;
    const text = filteredDomains.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ct_domains_${result.domain}_${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const isExpired = (date: string) => date && new Date(date) < new Date();

  return (
    <CyberpunkCard title="CT LOG SEARCH">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="example.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={isLoading}
              className="bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-2 text-sm focus:outline-none"
            >
              {[50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n} certs</option>
              ))}
            </select>
            <Button onClick={handleSearch} disabled={isLoading || !domain.trim()} className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6">
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Search className="w-4 h-4 mr-2" />Search</>}
            </Button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
            <input type="checkbox" checked={includeSubdomains} onChange={(e) => setIncludeSubdomains(e.target.checked)} disabled={isLoading} className="w-4 h-4 accent-cyber-cyan" />
            Include subdomains
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.certificates.length}</p>
                <p className="text-xs text-gray-400">Certificates</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.uniqueDomains.length}</p>
                <p className="text-xs text-gray-400">Unique Domains</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.total.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Total Found</p>
              </div>
            </div>

            {/* Domain list */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-cyber-cyan font-bold tracking-wide">
                  DISCOVERED DOMAINS ({filteredDomains.length})
                </h3>
                <Button onClick={downloadDomains} className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Download .txt
                </Button>
              </div>
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter domains..."
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan mb-3 h-8 text-xs"
              />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredDomains.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 hover:bg-cyber-cyan/5 rounded">
                    <span className="text-xs font-mono text-cyber-cyan">{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificate list */}
            <div>
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">
                CERTIFICATES ({result.certificates.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.certificates.map((cert) => (
                  <div key={cert.id} className="glass-panel rounded p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 truncate">{cert.issuer}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {cert.domains.slice(0, 3).map((d, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-cyber-cyan/10 rounded text-xs font-mono text-cyber-cyan border border-cyber-cyan/20">{d}</span>
                          ))}
                          {cert.domains.length > 3 && (
                            <span className="text-xs text-gray-500">+{cert.domains.length - 3} more</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {cert.notAfter && (
                          <span className={`text-xs ${isExpired(cert.notAfter) ? "text-red-400" : "text-green-400"}`}>
                            {isExpired(cert.notAfter) ? "Expired" : "Valid"} {cert.notAfter.substring(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 text-right">Scan completed in {result.scanDuration}s</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CTLogSearch;
