import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Zap, CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface APIEndpoint {
  url: string;
  method: string;
  status: number;
  responseTime: number;
  vulnerabilities: Vulnerability[];
  headers: Record<string, string>;
  securityScore: number;
}

interface Vulnerability {
  severity: "critical" | "high" | "medium" | "low" | "info";
  type: string;
  description: string;
  recommendation: string;
}

interface APIScanResult {
  target: string;
  totalEndpoints: number;
  endpoints: APIEndpoint[];
  overallScore: number;
  vulnerabilityCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scanDuration: number;
}

type SortField = "url" | "method" | "status" | "score" | "responseTime";
type SortDirection = "asc" | "desc";

const ENDPOINTS_PER_PAGE = 1;

const APIScanner = () => {
  const [targetURL, setTargetURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<APIScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [urlFilter, setUrlFilter] = useState("");
  const [methodFilters, setMethodFilters] = useState<Set<string>>(new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]));
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(["critical", "high", "medium", "low", "info"]));

  const handleScan = async () => {
    if (!targetURL) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/api-scanner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetURL,
          apiKey: apiKey || undefined,
          timeoutMs: 10000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to API scanner service");
    } finally {
      setIsScanning(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/50",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      info: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return colors[severity] || colors.info;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "URL,Method,Status,Response Time (ms),Security Score,Vulnerabilities",
      ...result.endpoints.map(e => {
        const vulns = e.vulnerabilities.map(v => `${v.severity}: ${v.type}`).join('; ');
        return `"${e.url}",${e.method},${e.status},${e.responseTime},${e.securityScore},"${vulns}"`;
      })
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api_scan_${Date.now()}.csv`;
    a.click();
  };

  const toggleMethodFilter = (method: string) => {
    const newFilters = new Set(methodFilters);
    if (newFilters.has(method)) {
      newFilters.delete(method);
    } else {
      newFilters.add(method);
    }
    setMethodFilters(newFilters);
    setCurrentPage(1);
  };

  const toggleSeverityFilter = (severity: string) => {
    const newFilters = new Set(severityFilters);
    if (newFilters.has(severity)) {
      newFilters.delete(severity);
    } else {
      newFilters.add(severity);
    }
    setSeverityFilters(newFilters);
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

  const getProcessedEndpoints = (): APIEndpoint[] => {
    if (!result) return [];

    let endpoints = [...result.endpoints];

    // Filter by URL
    if (urlFilter) {
      endpoints = endpoints.filter((e) =>
        e.url.toLowerCase().includes(urlFilter.toLowerCase())
      );
    }

    // Filter by method
    if (methodFilters.size > 0) {
      endpoints = endpoints.filter((e) => methodFilters.has(e.method));
    }

    // Filter by severity
    if (severityFilters.size > 0) {
      endpoints = endpoints.filter((e) =>
        e.vulnerabilities.some(v => severityFilters.has(v.severity))
      );
    }

    // Sort endpoints
    endpoints.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "url":
          comparison = a.url.localeCompare(b.url);
          break;
        case "method":
          comparison = a.method.localeCompare(b.method);
          break;
        case "status":
          comparison = a.status - b.status;
          break;
        case "score":
          comparison = a.securityScore - b.securityScore;
          break;
        case "responseTime":
          comparison = a.responseTime - b.responseTime;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return endpoints;
  };

  const processedEndpoints = getProcessedEndpoints();
  const totalPages = Math.ceil(processedEndpoints.length / ENDPOINTS_PER_PAGE);
  const startIndex = (currentPage - 1) * ENDPOINTS_PER_PAGE;
  const endIndex = startIndex + ENDPOINTS_PER_PAGE;
  const paginatedEndpoints = processedEndpoints.slice(startIndex, endIndex);

  const availableMethods = result ? Array.from(new Set(result.endpoints.map(e => e.method))).sort() : [];

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
    <CyberpunkCard title="API SECURITY SCANNER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET API URL
            </label>
            <Input
              value={targetURL}
              onChange={(e) => setTargetURL(e.target.value)}
              placeholder="https://api.example.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              API KEY (Optional)
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Bearer token or API key"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !targetURL}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                SCANNING API...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                START API SCAN
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
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan">SECURITY OVERVIEW</h3>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}>
                    {result.overallScore}/100
                  </p>
                  <p className="text-xs text-gray-400">Overall Score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-red-400">{result.vulnerabilityCount.critical}</p>
                  <p className="text-xs text-red-400">Critical</p>
                </div>
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-orange-400">{result.vulnerabilityCount.high}</p>
                  <p className="text-xs text-orange-400">High</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-yellow-400">{result.vulnerabilityCount.medium}</p>
                  <p className="text-xs text-yellow-400">Medium</p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-blue-400">{result.vulnerabilityCount.low}</p>
                  <p className="text-xs text-blue-400">Low</p>
                </div>
                <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded text-center">
                  <p className="text-2xl font-bold text-gray-400">{result.vulnerabilityCount.info}</p>
                  <p className="text-xs text-gray-400">Info</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-red/20 flex justify-between text-sm">
                <span className="text-gray-400">Endpoints Scanned:</span>
                <span className="text-cyber-cyan font-mono">{result.totalEndpoints}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Scan Duration:</span>
                <span className="text-cyber-cyan font-mono">{result.scanDuration}s</span>
              </div>
            </div>

            {/* Endpoints Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  API ENDPOINTS ({processedEndpoints.length})
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
                    onClick={() => handleSort("url")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "url"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    URL{getSortIcon("url")}
                  </button>
                  <button
                    onClick={() => handleSort("method")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "method"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Method{getSortIcon("method")}
                  </button>
                  <button
                    onClick={() => handleSort("score")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "score"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Security Score{getSortIcon("score")}
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
                </div>

                {/* URL Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={urlFilter}
                    onChange={(e) => {
                      setUrlFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by URL..."
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>

                {/* Method Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">METHOD:</span>
                  {availableMethods.map((method) => (
                    <button
                      key={method}
                      onClick={() => toggleMethodFilter(method)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        methodFilters.has(method)
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                          : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {/* Severity Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">SEVERITY:</span>
                  {["critical", "high", "medium", "low", "info"].map((severity) => (
                    <button
                      key={severity}
                      onClick={() => toggleSeverityFilter(severity)}
                      className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                        severityFilters.has(severity)
                          ? getSeverityColor(severity)
                          : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                      }`}
                    >
                      {severity.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoints List */}
              <div className="space-y-3">
                {paginatedEndpoints.map((endpoint, idx) => (
                  <div
                    key={`${endpoint.url}-${endpoint.method}-${startIndex + idx}`}
                    className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`px-2 py-1 rounded text-xs font-bold ${
                          endpoint.method === "GET" ? "bg-blue-500/20 text-blue-400" :
                          endpoint.method === "POST" ? "bg-green-500/20 text-green-400" :
                          endpoint.method === "PUT" ? "bg-yellow-500/20 text-yellow-400" :
                          endpoint.method === "DELETE" ? "bg-red-500/20 text-red-400" :
                          "bg-purple-500/20 text-purple-400"
                        }`}>
                          {endpoint.method}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-cyber-cyan font-mono text-sm truncate">{endpoint.url}</p>
                          <div className="flex gap-3 text-xs text-gray-400 mt-1">
                            <span>Status: {endpoint.status}</span>
                            <span>Response: {endpoint.responseTime}ms</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getScoreColor(endpoint.securityScore)}`}>
                          {endpoint.securityScore}
                        </p>
                        <p className="text-xs text-gray-400">Score</p>
                      </div>
                    </div>

                    {endpoint.vulnerabilities.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-400 font-semibold">Vulnerabilities:</p>
                        {endpoint.vulnerabilities.map((vuln, vIdx) => (
                          <div
                            key={vIdx}
                            className={`p-3 rounded border ${getSeverityColor(vuln.severity).replace('text-', 'bg-').replace('/20', '/5')}`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(vuln.severity)}`}>
                                {vuln.severity.toUpperCase()}
                              </span>
                              <p className="text-sm font-semibold text-cyber-cyan flex-1">{vuln.type}</p>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{vuln.description}</p>
                            <div className="flex items-start gap-1">
                              <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-green-400">{vuln.recommendation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

export default APIScanner;
