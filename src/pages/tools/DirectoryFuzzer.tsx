import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, FolderSearch, CheckCircle, XCircle, Clock, Download, ExternalLink, Copy, Check } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface FuzzResult {
  path: string;
  fullUrl: string;
  status: number;
  size: number;
  responseTime: number;
  contentType?: string;
  exists: boolean;
}

interface FuzzerResult {
  target: string;
  totalPaths: number;
  foundPaths: number;
  notFoundPaths: number;
  results: FuzzResult[];
  totalTime: number;
  wordlistSize: number;
}

type SortField = "path" | "status" | "size" | "time";
type SortDirection = "asc" | "desc";

const RESULTS_PER_PAGE = 20;

const DirectoryFuzzer = () => {
  const [targetURL, setTargetURL] = useState("");
  const [isFuzzing, setIsFuzzing] = useState(false);
  const [result, setResult] = useState<FuzzerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pathFilter, setPathFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<number>>(new Set([200, 301, 302, 403]));
  const [showNotFound, setShowNotFound] = useState(false);

  const handleFuzz = async () => {
    if (!targetURL) return;

    setIsFuzzing(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/dir-fuzz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetURL,
          timeoutMs: 60000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fuzzing failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to directory fuzzer service");
    } finally {
      setIsFuzzing(false);
    }
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
      "Path,Full URL,Status,Size (bytes),Response Time (ms),Content Type",
      ...result.results.filter(r => r.exists).map(r => 
        `"${r.path}","${r.fullUrl}",${r.status},${r.size},${r.responseTime},"${r.contentType || 'N/A'}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `directory_fuzz_${Date.now()}.csv`;
    a.click();
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-400 bg-green-500/20 border-green-500/50";
    if (status >= 300 && status < 400) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/50";
    if (status >= 400 && status < 500) return "text-orange-400 bg-orange-500/20 border-orange-500/50";
    if (status >= 500) return "text-red-400 bg-red-500/20 border-red-500/50";
    return "text-gray-400 bg-gray-500/20 border-gray-500/50";
  };

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (status === 403) return <XCircle className="w-4 h-4 text-orange-400" />;
    if (status >= 400) return <XCircle className="w-4 h-4 text-red-400" />;
    return <CheckCircle className="w-4 h-4 text-yellow-400" />;
  };

  const toggleStatusFilter = (status: number) => {
    const newFilters = new Set(statusFilters);
    if (newFilters.has(status)) {
      newFilters.delete(status);
    } else {
      newFilters.add(status);
    }
    setStatusFilters(newFilters);
    setCurrentPage(1);
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

  const getProcessedResults = (): FuzzResult[] => {
    if (!result) return [];

    let results = [...result.results];

    // Filter out 404s unless showNotFound is true
    if (!showNotFound) {
      results = results.filter(r => r.exists);
    }

    // Filter by path
    if (pathFilter) {
      results = results.filter((r) =>
        r.path.toLowerCase().includes(pathFilter.toLowerCase()) ||
        r.contentType?.toLowerCase().includes(pathFilter.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilters.size > 0) {
      results = results.filter((r) => statusFilters.has(r.status));
    }

    // Sort results
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "path":
          comparison = a.path.localeCompare(b.path);
          break;
        case "status":
          comparison = a.status - b.status;
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "time":
          comparison = a.responseTime - b.responseTime;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return results;
  };

  const processedResults = getProcessedResults();
  const totalPages = Math.ceil(processedResults.length / RESULTS_PER_PAGE);
  const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
  const endIndex = startIndex + RESULTS_PER_PAGE;
  const paginatedResults = processedResults.slice(startIndex, endIndex);

  const uniqueStatuses = result ? Array.from(new Set(result.results.map(r => r.status))).sort((a, b) => a - b) : [];

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

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
    <CyberpunkCard title="DIRECTORY FUZZER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET URL
            </label>
            <Input
              value={targetURL}
              onChange={(e) => setTargetURL(e.target.value)}
              placeholder="https://example.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isFuzzing}
            />
          </div>

          <Button
            onClick={handleFuzz}
            disabled={isFuzzing || !targetURL}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isFuzzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                FUZZING DIRECTORIES...
              </>
            ) : (
              <>
                <FolderSearch className="mr-2 h-4 w-4" />
                START FUZZING
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ About Directory Fuzzing</p>
            <p>Discovers hidden directories and files using common wordlists. Tests ~750 common paths including admin panels, backups, config files, and more.</p>
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
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">FUZZING SUMMARY</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <FolderSearch className="w-6 h-6 text-cyber-cyan mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyber-cyan">{result.totalPaths}</p>
                  <p className="text-xs text-cyber-cyan">Paths Tested</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-400">{result.foundPaths}</p>
                  <p className="text-xs text-green-400">Found</p>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-400">{result.notFoundPaths}</p>
                  <p className="text-xs text-red-400">Not Found</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-yellow-400">{result.totalTime}s</p>
                  <p className="text-xs text-yellow-400">Total Time</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-red/20">
                <p className="text-sm text-gray-400">
                  <span className="font-semibold text-cyber-cyan">Discovery Rate:</span> {result.totalPaths > 0 ? Math.round((result.foundPaths / result.totalPaths) * 100) : 0}%
                </p>
              </div>
            </div>

            {/* Results Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  DISCOVERED PATHS ({processedResults.length})
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
                    onClick={() => handleSort("path")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "path"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Path{getSortIcon("path")}
                  </button>
                  <button
                    onClick={() => handleSort("size")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "size"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Size{getSortIcon("size")}
                  </button>
                  <button
                    onClick={() => handleSort("time")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "time"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Response Time{getSortIcon("time")}
                  </button>
                </div>

                {/* Path Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={pathFilter}
                    onChange={(e) => {
                      setPathFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by path or content type..."
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">STATUS:</span>
                  {uniqueStatuses.filter(s => s !== 404).map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status)}
                      className={`px-2 py-1 rounded text-xs font-bold border transition-all ${
                        statusFilters.has(status)
                          ? getStatusColor(status)
                          : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNotFound(!showNotFound)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      showNotFound
                        ? "bg-gray-500/20 text-gray-400 border border-gray-500/50"
                        : "bg-gray-500/10 text-gray-500 border border-gray-500/30"
                    }`}
                  >
                    {showNotFound ? "Hide" : "Show"} 404s
                  </button>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-2">
                {paginatedResults.map((fuzzResult, idx) => (
                  <div
                    key={`${fuzzResult.path}-${startIndex + idx}`}
                    className="flex items-center justify-between p-3 bg-black/30 rounded hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(fuzzResult.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-cyber-cyan font-mono font-bold truncate">
                            {fuzzResult.path}
                          </p>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getStatusColor(fuzzResult.status)}`}>
                            {fuzzResult.status}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span>📦 {formatSize(fuzzResult.size)}</span>
                          <span>⏱️ {fuzzResult.responseTime}ms</span>
                          {fuzzResult.contentType && (
                            <span className="truncate">📄 {fuzzResult.contentType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(fuzzResult.fullUrl)}
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                        title="Copy URL"
                      >
                        {copiedUrl === fuzzResult.fullUrl ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                        )}
                      </button>
                      <a
                        href={fuzzResult.fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                        title="Open in new tab"
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

export default DirectoryFuzzer;
