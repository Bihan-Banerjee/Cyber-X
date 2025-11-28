import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Globe, Server, ExternalLink, Copy, Check, Download } from "lucide-react";

interface HostedDomain {
  domain: string;
  firstSeen?: string;
  lastSeen?: string;
  rank?: number;
  ssl?: boolean;
}

interface ReverseIPResult {
  ip: string;
  ptr: string;
  totalDomains: number;
  domains: HostedDomain[];
  sharedHosting: boolean;
  hostingProvider?: string;
  scanDuration: number;
}

type SortField = "domain" | "rank" | "date";
type SortDirection = "asc" | "desc";

const DOMAINS_PER_PAGE = 10;

const ReverseIPLookup = () => {
  const [ipAddress, setIpAddress] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [result, setResult] = useState<ReverseIPResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [domainFilter, setDomainFilter] = useState("");

  const handleLookup = async () => {
    if (!ipAddress.trim()) return;

    setIsLookingUp(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:3001/api/scan/reverse-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: ipAddress,
          timeoutMs: 30000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Lookup failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to perform reverse IP lookup");
    } finally {
      setIsLookingUp(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDomain(text);
      setTimeout(() => setCopiedDomain(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "Domain,Rank,SSL,First Seen,Last Seen",
      ...result.domains.map(d => 
        `${d.domain},${d.rank || 'N/A'},${d.ssl ? 'Yes' : 'No'},"${d.firstSeen || 'N/A'}","${d.lastSeen || 'N/A'}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reverse_ip_${ipAddress.replace(/\./g, '_')}_${Date.now()}.csv`;
    a.click();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const getProcessedDomains = (): HostedDomain[] => {
    if (!result) return [];

    let domains = [...result.domains];

    // Filter by domain name
    if (domainFilter) {
      domains = domains.filter((d) =>
        d.domain.toLowerCase().includes(domainFilter.toLowerCase())
      );
    }

    // Sort
    domains.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "domain":
          comparison = a.domain.localeCompare(b.domain);
          break;
        case "rank":
          comparison = (a.rank || 999999) - (b.rank || 999999);
          break;
        case "date":
          comparison = (a.lastSeen || '').localeCompare(b.lastSeen || '');
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return domains;
  };

  const processedDomains = getProcessedDomains();
  const totalPages = Math.ceil(processedDomains.length / DOMAINS_PER_PAGE);
  const startIndex = (currentPage - 1) * DOMAINS_PER_PAGE;
  const endIndex = startIndex + DOMAINS_PER_PAGE;
  const paginatedDomains = processedDomains.slice(startIndex, endIndex);

  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const goToPrevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-cyber-red">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <CyberpunkCard title="REVERSE IP LOOKUP">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              IP ADDRESS
            </label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.1.1 or 2001:4860:4860::8888"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono"
              disabled={isLookingUp}
            />
          </div>

          <Button
            onClick={handleLookup}
            disabled={isLookingUp || !ipAddress.trim()}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isLookingUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                PERFORMING REVERSE LOOKUP...
              </>
            ) : (
              <>
                <Server className="mr-2 h-4 w-4" />
                FIND HOSTED DOMAINS
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Reverse IP Lookup</p>
            <p>Discovers all domains hosted on a specific IP address. Useful for finding websites on shared hosting, identifying related domains, or mapping infrastructure.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-6">
            {/* IP Info Summary */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-8 h-8 text-cyber-cyan" />
                <div>
                  <h3 className="text-2xl font-bold text-cyber-cyan font-mono">{result.ip}</h3>
                  {result.ptr && (
                    <p className="text-sm text-gray-400">PTR: {result.ptr}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <Globe className="w-6 h-6 text-cyber-cyan mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyber-cyan">{result.totalDomains}</p>
                  <p className="text-xs text-cyber-cyan">Total Domains</p>
                </div>
                <div className={`p-3 rounded text-center ${result.sharedHosting ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <Server className={`w-6 h-6 mx-auto mb-1 ${result.sharedHosting ? 'text-yellow-400' : 'text-green-400'}`} />
                  <p className={`text-sm font-bold ${result.sharedHosting ? 'text-yellow-400' : 'text-green-400'}`}>
                    {result.sharedHosting ? 'SHARED' : 'DEDICATED'}
                  </p>
                  <p className="text-xs text-gray-400">Hosting Type</p>
                </div>
                {result.hostingProvider && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center md:col-span-2">
                    <p className="text-sm font-bold text-purple-400">{result.hostingProvider}</p>
                    <p className="text-xs text-gray-400">Hosting Provider</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-red/20 text-sm text-gray-400">
                <p>Scan duration: {result.scanDuration}s</p>
              </div>
            </div>

            {/* Domains Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  HOSTED DOMAINS ({processedDomains.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    onClick={downloadResults}
                    className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                    size="sm"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Export CSV
                  </Button>
                  {totalPages > 1 && (
                    <span className="text-sm text-gray-400 flex items-center">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="mb-4 space-y-3">
                {/* Sort Controls */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    SORT BY:
                  </span>
                  <button
                    onClick={() => handleSort("rank")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "rank" ? "bg-cyber-cyan text-black font-bold" : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Rank{getSortIcon("rank")}
                  </button>
                  <button
                    onClick={() => handleSort("domain")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "domain" ? "bg-cyber-cyan text-black font-bold" : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Domain{getSortIcon("domain")}
                  </button>
                  <button
                    onClick={() => handleSort("date")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "date" ? "bg-cyber-cyan text-black font-bold" : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Last Seen{getSortIcon("date")}
                  </button>
                </div>

                {/* Domain Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={domainFilter}
                    onChange={(e) => { setDomainFilter(e.target.value); setCurrentPage(1); }}
                    placeholder="Filter by domain name..."
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>
              </div>

              {/* Domains List */}
              <div className="space-y-2">
                {paginatedDomains.map((domain, idx) => (
                  <div
                    key={`${domain.domain}-${startIndex + idx}`}
                    className="flex items-center justify-between p-3 bg-black/30 rounded hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Globe className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-cyber-cyan font-semibold truncate">{domain.domain}</p>
                          {domain.ssl && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/50">
                              SSL
                            </span>
                          )}
                          {domain.rank && domain.rank <= 1000 && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                              TOP {domain.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          {domain.rank && <span>Rank: {domain.rank}</span>}
                          {domain.lastSeen && <span>Last seen: {domain.lastSeen}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(domain.domain)}
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                        title="Copy domain"
                      >
                        {copiedDomain === domain.domain ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                        )}
                      </button>
                      <a
                        href={`https://${domain.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                        title="Visit domain"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-cyber-cyan" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-cyber-red/20">
                  <Button onClick={goToPrevPage} disabled={currentPage === 1} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-1">
                    {getPageNumbers().map((page, idx) => (
                      <button
                        key={idx}
                        onClick={() => typeof page === "number" && goToPage(page)}
                        disabled={page === "..."}
                        className={`px-3 py-1 min-w-[2.5rem] rounded text-sm font-mono transition-colors ${
                          page === currentPage ? "bg-cyber-red text-white font-bold" : page === "..." ? "text-gray-500 cursor-default" : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <Button onClick={goToNextPage} disabled={currentPage === totalPages} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed" size="sm">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default ReverseIPLookup;
