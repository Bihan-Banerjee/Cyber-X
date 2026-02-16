import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Database, CheckCircle, XCircle, Lock, Unlock, ExternalLink, Download, Copy, Check } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface S3Bucket {
  name: string;
  url: string;
  exists: boolean;
  accessible: boolean;
  region?: string;
  objects?: number;
  totalSize?: string;
  lastModified?: string;
  permissions: {
    read: boolean;
    write: boolean;
    list: boolean;
  };
  riskLevel: "critical" | "high" | "medium" | "low" | "safe";
  findings: string[];
}

interface S3FinderResult {
  target: string;
  totalTested: number;
  foundBuckets: number;
  accessibleBuckets: number;
  buckets: S3Bucket[];
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    safe: number;
  };
  scanDuration: number;
}

type SortField = "name" | "risk" | "accessible";
type SortDirection = "asc" | "desc";

const BUCKETS_PER_PAGE = 5;

const S3BucketFinder = () => {
  const [targetKeyword, setTargetKeyword] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<S3FinderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("risk");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [nameFilter, setNameFilter] = useState("");
  const [riskFilters, setRiskFilters] = useState<Set<string>>(new Set(["critical", "high", "medium", "low", "safe"]));
  const [showOnlyAccessible, setShowOnlyAccessible] = useState(false);

  const handleScan = async () => {
    if (!targetKeyword) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/s3-finder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: targetKeyword,
          timeoutMs: 60000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to S3 finder service");
    } finally {
      setIsScanning(false);
    }
  };

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/50",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      safe: "bg-green-500/20 text-green-400 border-green-500/50",
    };
    return colors[level] || colors.safe;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "Bucket Name,URL,Exists,Accessible,Region,Risk Level,Read,Write,List,Findings",
      ...result.buckets.filter(b => b.exists).map(b => 
        `"${b.name}","${b.url}",${b.exists},${b.accessible},"${b.region || 'N/A'}",${b.riskLevel},${b.permissions.read},${b.permissions.write},${b.permissions.list},"${b.findings.join('; ')}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `s3_buckets_${targetKeyword}_${Date.now()}.csv`;
    a.click();
  };

  const toggleRiskFilter = (risk: string) => {
    const newFilters = new Set(riskFilters);
    if (newFilters.has(risk)) {
      newFilters.delete(risk);
    } else {
      newFilters.add(risk);
    }
    setRiskFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "risk" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const getProcessedBuckets = (): S3Bucket[] => {
    if (!result) return [];

    let buckets = [...result.buckets].filter(b => b.exists);

    // Filter by name
    if (nameFilter) {
      buckets = buckets.filter((b) =>
        b.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Filter by accessible
    if (showOnlyAccessible) {
      buckets = buckets.filter((b) => b.accessible);
    }

    // Filter by risk
    if (riskFilters.size > 0) {
      buckets = buckets.filter((b) => riskFilters.has(b.riskLevel));
    }

    // Sort
    const riskOrder = { critical: 5, high: 4, medium: 3, low: 2, safe: 1 };
    buckets.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "risk":
          comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
          break;
        case "accessible":
          comparison = (a.accessible ? 1 : 0) - (b.accessible ? 1 : 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return buckets;
  };

  const processedBuckets = getProcessedBuckets();
  const totalPages = Math.ceil(processedBuckets.length / BUCKETS_PER_PAGE);
  const startIndex = (currentPage - 1) * BUCKETS_PER_PAGE;
  const endIndex = startIndex + BUCKETS_PER_PAGE;
  const paginatedBuckets = processedBuckets.slice(startIndex, endIndex);

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
    <CyberpunkCard title="S3 BUCKET FINDER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET KEYWORD
            </label>
            <Input
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="company-name or domain.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !targetKeyword}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                SCANNING FOR S3 BUCKETS...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                FIND S3 BUCKETS
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ S3 Bucket Discovery</p>
            <p>Enumerates AWS S3 buckets using common naming patterns. Tests for public accessibility, read/write permissions, and misconfigurations. Enter a company name or domain to search.</p>
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
            {/* Summary Stats */}
            <div className="glass-panel rounded p-6">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">DISCOVERY SUMMARY</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <Database className="w-6 h-6 text-cyber-cyan mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyber-cyan">{result.totalTested}</p>
                  <p className="text-xs text-cyber-cyan">Tested</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-400">{result.foundBuckets}</p>
                  <p className="text-xs text-green-400">Found</p>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                  <Unlock className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-400">{result.accessibleBuckets}</p>
                  <p className="text-xs text-red-400">Accessible</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-yellow-400">{result.scanDuration}s</p>
                  <p className="text-xs text-yellow-400">Scan Time</p>
                </div>
              </div>

              <div className="pt-4 border-t border-cyber-red/20 grid grid-cols-5 gap-2 text-center text-sm">
                <div>
                  <p className="font-bold text-red-400">{result.riskSummary.critical}</p>
                  <p className="text-xs text-gray-400">Critical</p>
                </div>
                <div>
                  <p className="font-bold text-orange-400">{result.riskSummary.high}</p>
                  <p className="text-xs text-gray-400">High</p>
                </div>
                <div>
                  <p className="font-bold text-yellow-400">{result.riskSummary.medium}</p>
                  <p className="text-xs text-gray-400">Medium</p>
                </div>
                <div>
                  <p className="font-bold text-blue-400">{result.riskSummary.low}</p>
                  <p className="text-xs text-gray-400">Low</p>
                </div>
                <div>
                  <p className="font-bold text-green-400">{result.riskSummary.safe}</p>
                  <p className="text-xs text-gray-400">Safe</p>
                </div>
              </div>
            </div>

            {/* Buckets Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  DISCOVERED BUCKETS ({processedBuckets.length})
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
                    onClick={() => handleSort("risk")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "risk"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Risk{getSortIcon("risk")}
                  </button>
                  <button
                    onClick={() => handleSort("name")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "name"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Name{getSortIcon("name")}
                  </button>
                  <button
                    onClick={() => handleSort("accessible")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "accessible"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Access{getSortIcon("accessible")}
                  </button>
                </div>

                {/* Name Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={nameFilter}
                    onChange={(e) => {
                      setNameFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by bucket name..."
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">FILTERS:</span>
                  <button
                    onClick={() => setShowOnlyAccessible(!showOnlyAccessible)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      showOnlyAccessible
                        ? "bg-red-500/20 text-red-400 border border-red-500/50"
                        : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                    }`}
                  >
                    {showOnlyAccessible ? "Accessible Only" : "Show All"}
                  </button>
                </div>

                {/* Risk Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">RISK:</span>
                  {["critical", "high", "medium", "low", "safe"].map((risk) => (
                    <button
                      key={risk}
                      onClick={() => toggleRiskFilter(risk)}
                      className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                        riskFilters.has(risk)
                          ? getRiskColor(risk)
                          : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                      }`}
                    >
                      {risk.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buckets List */}
              <div className="space-y-3">
                {paginatedBuckets.map((bucket, idx) => (
                  <div
                    key={`${bucket.name}-${startIndex + idx}`}
                    className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {bucket.accessible ? (
                        <Unlock className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                      ) : (
                        <Lock className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-cyber-cyan">{bucket.name}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRiskColor(bucket.riskLevel)}`}>
                              {bucket.riskLevel.toUpperCase()}
                            </span>
                            {bucket.region && (
                              <span className="text-xs text-gray-500">• {bucket.region}</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => copyToClipboard(bucket.url)}
                              className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                              title="Copy URL"
                            >
                              {copiedUrl === bucket.url ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                              )}
                            </button>
                            <a
                              href={bucket.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-cyber-cyan" />
                            </a>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 font-mono mb-2">{bucket.url}</p>

                        <div className="flex gap-4 mb-2 text-xs">
                          <div className={bucket.permissions.read ? "text-red-400" : "text-gray-500"}>
                            Read: {bucket.permissions.read ? "✓" : "✗"}
                          </div>
                          <div className={bucket.permissions.write ? "text-red-400" : "text-gray-500"}>
                            Write: {bucket.permissions.write ? "✓" : "✗"}
                          </div>
                          <div className={bucket.permissions.list ? "text-yellow-400" : "text-gray-500"}>
                            List: {bucket.permissions.list ? "✓" : "✗"}
                          </div>
                          {bucket.objects !== undefined && (
                            <div className="text-cyber-cyan">
                              Objects: {bucket.objects}
                            </div>
                          )}
                          {bucket.totalSize && (
                            <div className="text-cyber-cyan">
                              Size: {bucket.totalSize}
                            </div>
                          )}
                        </div>

                        {bucket.findings.length > 0 && (
                          <div className="p-2 bg-red-500/5 border border-red-500/20 rounded">
                            <p className="text-xs text-red-400 font-semibold mb-1">⚠️ Findings:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {bucket.findings.map((finding, fIdx) => (
                                <li key={fIdx} className="text-xs text-gray-400">{finding}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
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

export default S3BucketFinder;
