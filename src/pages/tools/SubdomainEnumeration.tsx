import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Globe, CheckCircle, XCircle, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface Subdomain {
  subdomain: string;
  ip?: string;
  status: "active" | "inactive";
  responseTime?: number;
  records?: {
    A?: string[];
    AAAA?: string[];
    CNAME?: string[];
    MX?: string[];
  };
}

interface SubdomainResult {
  domain: string;
  totalFound: number;
  subdomains: Subdomain[];
  scanDuration: number;
  method: string;
}

type SortField = "subdomain" | "status" | "responseTime";
type SortDirection = "asc" | "desc";

const SUBDOMAINS_PER_PAGE = 20;

const SubdomainEnumeration = () => {
  const [domain, setDomain] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<SubdomainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("subdomain");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [subdomainFilter, setSubdomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const handleScan = async () => {
    if (!domain) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/subdomains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          timeoutMs: 3000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to enumeration service");
    } finally {
      setIsScanning(false);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const data = result.subdomains.map(sub => ({
      subdomain: sub.subdomain,
      ip: sub.ip || "N/A",
      status: sub.status,
      responseTime: sub.responseTime || "N/A",
    }));

    const csv = [
      "Subdomain,IP Address,Status,Response Time (ms)",
      ...data.map(row => `${row.subdomain},${row.ip},${row.status},${row.responseTime}`)
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subdomains_${result.domain}_${Date.now()}.csv`;
    a.click();
  };

  // Toggle sort field or direction
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Apply filters and sorting
  const getProcessedSubdomains = (): Subdomain[] => {
    if (!result) return [];

    let subdomains = [...result.subdomains];

    // Filter by subdomain name
    if (subdomainFilter) {
      subdomains = subdomains.filter(
        (s) =>
          s.subdomain.toLowerCase().includes(subdomainFilter.toLowerCase()) ||
          (s.ip && s.ip.includes(subdomainFilter))
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      subdomains = subdomains.filter((s) => s.status === statusFilter);
    }

    // Sort subdomains
    subdomains.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "subdomain":
          comparison = a.subdomain.localeCompare(b.subdomain);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "responseTime":
          const timeA = a.responseTime || Infinity;
          const timeB = b.responseTime || Infinity;
          comparison = timeA - timeB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return subdomains;
  };

  const processedSubdomains = getProcessedSubdomains();
  const totalPages = Math.ceil(processedSubdomains.length / SUBDOMAINS_PER_PAGE);
  const startIndex = (currentPage - 1) * SUBDOMAINS_PER_PAGE;
  const endIndex = startIndex + SUBDOMAINS_PER_PAGE;
  const paginatedSubdomains = processedSubdomains.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

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
    return (
      <span className="ml-1 text-cyber-red">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <CyberpunkCard title="SUBDOMAIN ENUMERATION">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET DOMAIN
            </label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !domain}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ENUMERATING SUBDOMAINS...
              </>
            ) : (
              <>
                <Globe className="mr-2 h-4 w-4" />
                ENUMERATE SUBDOMAINS
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-panel rounded p-4 text-center">
                <Globe className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
                <p className="text-2xl font-bold text-cyber-cyan">{result.totalFound}</p>
                <p className="text-xs text-gray-400">Total Found</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-400">
                  {result.subdomains.filter(s => s.status === "active").length}
                </p>
                <p className="text-xs text-gray-400">Active</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-400">
                  {result.subdomains.filter(s => s.status === "inactive").length}
                </p>
                <p className="text-xs text-gray-400">Inactive</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <Loader2 className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
                <p className="text-2xl font-bold text-cyber-cyan">{result.scanDuration}s</p>
                <p className="text-xs text-gray-400">Scan Time</p>
              </div>
            </div>

            {/* Subdomains Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  DISCOVERED SUBDOMAINS ({processedSubdomains.length})
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
                    onClick={() => handleSort("subdomain")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "subdomain"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Name{getSortIcon("subdomain")}
                  </button>
                  <button
                    onClick={() => handleSort("status")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "status"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Status{getSortIcon("status")}
                  </button>
                  <button
                    onClick={() => handleSort("responseTime")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "responseTime"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Response Time{getSortIcon("responseTime")}
                  </button>
                </div>

                {/* Filter Controls */}
                <div className="grid md:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                    <Input
                      value={subdomainFilter}
                      onChange={(e) => {
                        setSubdomainFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Filter by subdomain or IP..."
                      className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setStatusFilter("all");
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        statusFilter === "all"
                          ? "bg-cyber-cyan text-black"
                          : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter("active");
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        statusFilter === "active"
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-gray-500/10 text-gray-500 border border-gray-500/30"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter("inactive");
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        statusFilter === "inactive"
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-gray-500/10 text-gray-500 border border-gray-500/30"
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              {/* Subdomains List */}
              <div className="space-y-2">
                {paginatedSubdomains.map((sub, idx) => (
                  <div
                    key={`${sub.subdomain}-${startIndex + idx}`}
                    className="flex items-center justify-between p-4 bg-black/30 rounded hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {sub.status === "active" ? (
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-cyber-cyan font-mono font-bold truncate">
                          {sub.subdomain}
                        </p>
                        {sub.ip && (
                          <p className="text-sm text-gray-400 font-mono">
                            {sub.ip}
                            {sub.responseTime && (
                              <span className="ml-2 text-xs">({sub.responseTime}ms)</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        sub.status === "active"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {sub.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-cyber-red/20">
                  <Button
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex gap-1">
                    {getPageNumbers().map((page, idx) => (
                      <button
                        key={idx}
                        onClick={() => typeof page === "number" && goToPage(page)}
                        disabled={page === "..."}
                        className={`px-3 py-1 min-w-[2.5rem] rounded text-sm font-mono transition-colors ${
                          page === currentPage
                            ? "bg-cyber-red text-white font-bold"
                            : page === "..."
                            ? "text-gray-500 cursor-default"
                            : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    size="sm"
                  >
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

export default SubdomainEnumeration;
