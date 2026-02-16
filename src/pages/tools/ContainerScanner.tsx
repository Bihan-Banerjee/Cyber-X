import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Container, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Download, Package } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface Vulnerability {
  cve: string;
  severity: "critical" | "high" | "medium" | "low";
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
}

interface SecurityIssue {
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  recommendation: string;
}

interface ContainerScanResult {
  imageName: string;
  imageId: string;
  baseImage?: string;
  totalVulnerabilities: number;
  vulnerabilities: Vulnerability[];
  securityIssues: SecurityIssue[];
  securityScore: number;
  riskLevel: string;
  layers: number;
  size: string;
  created: string;
  vulnerabilityCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanDuration: number;
}

type SortField = "severity" | "package" | "cve";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 5;

const ContainerScanner = () => {
  const [imageName, setImageName] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ContainerScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"vulnerabilities" | "issues">("vulnerabilities");
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [packageFilter, setPackageFilter] = useState("");
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(["critical", "high", "medium", "low"]));

  const handleScan = async () => {
    if (!imageName) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/container-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageName,
          timeoutMs: 30000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to container scanner service");
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

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "text-red-400",
      HIGH: "text-orange-400",
      MEDIUM: "text-yellow-400",
      LOW: "text-green-400",
    };
    return colors[level] || "text-gray-400";
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "CVE,Severity,Package,Current Version,Fixed Version,Description",
      ...result.vulnerabilities.map(v => 
        `${v.cve},${v.severity},"${v.package}",${v.version},"${v.fixedVersion || 'N/A'}","${v.description}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `container_scan_${imageName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
    a.click();
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
      setSortDirection(field === "severity" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const getProcessedVulnerabilities = (): Vulnerability[] => {
    if (!result) return [];

    let vulns = [...result.vulnerabilities];

    // Filter by package
    if (packageFilter) {
      vulns = vulns.filter((v) =>
        v.package.toLowerCase().includes(packageFilter.toLowerCase()) ||
        v.cve.toLowerCase().includes(packageFilter.toLowerCase())
      );
    }

    // Filter by severity
    if (severityFilters.size > 0) {
      vulns = vulns.filter((v) => severityFilters.has(v.severity));
    }

    // Sort
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    vulns.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "severity":
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case "package":
          comparison = a.package.localeCompare(b.package);
          break;
        case "cve":
          comparison = a.cve.localeCompare(b.cve);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return vulns;
  };

  const processedVulns = getProcessedVulnerabilities();
  const processedIssues = result?.securityIssues || [];
  
  const activeItems = activeTab === "vulnerabilities" ? processedVulns : processedIssues;
  const totalPages = Math.ceil(activeItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = activeItems.slice(startIndex, endIndex);

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
    <CyberpunkCard title="CONTAINER SCANNER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              DOCKER IMAGE NAME
            </label>
            <Input
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="nginx:latest or ubuntu:22.04"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !imageName}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                SCANNING CONTAINER...
              </>
            ) : (
              <>
                <Container className="mr-2 h-4 w-4" />
                SCAN CONTAINER
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Container Security Scanning</p>
            <p>Scans Docker container images for known vulnerabilities (CVEs), misconfigurations, and security issues. Supports public images from Docker Hub.</p>
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
            {/* Image Info & Security Score */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-cyber-cyan mb-1">{result.imageName}</h3>
                  <p className="text-sm text-gray-400 font-mono">ID: {result.imageId}</p>
                  {result.baseImage && (
                    <p className="text-sm text-gray-400">Base: {result.baseImage}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-bold ${getScoreColor(result.securityScore)}`}>
                    {result.securityScore}
                  </p>
                  <p className="text-xs text-gray-400">Security Score</p>
                  <p className={`text-sm font-bold ${getRiskColor(result.riskLevel)}`}>
                    {result.riskLevel} RISK
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
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
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <p className="text-2xl font-bold text-cyber-cyan">{result.totalVulnerabilities}</p>
                  <p className="text-xs text-cyber-cyan">Total CVEs</p>
                </div>
              </div>

              <div className="pt-4 border-t border-cyber-red/20 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Layers:</span>
                  <span className="text-cyber-cyan ml-2 font-mono">{result.layers}</span>
                </div>
                <div>
                  <span className="text-gray-400">Size:</span>
                  <span className="text-cyber-cyan ml-2 font-mono">{result.size}</span>
                </div>
                <div>
                  <span className="text-gray-400">Scan Time:</span>
                  <span className="text-cyber-cyan ml-2 font-mono">{result.scanDuration}s</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-cyber-red/30">
              <button
                onClick={() => {
                  setActiveTab("vulnerabilities");
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 font-bold tracking-wide transition-colors ${
                  activeTab === "vulnerabilities"
                    ? "text-cyber-cyan border-b-2 border-cyber-cyan"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                VULNERABILITIES ({result.vulnerabilities.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("issues");
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 font-bold tracking-wide transition-colors ${
                  activeTab === "issues"
                    ? "text-cyber-cyan border-b-2 border-cyber-cyan"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                SECURITY ISSUES ({result.securityIssues.length})
              </button>
            </div>

            {/* Results Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  {activeTab === "vulnerabilities" ? "CVE VULNERABILITIES" : "SECURITY ISSUES"} ({activeItems.length})
                </h3>
                <div className="flex gap-2">
                  {activeTab === "vulnerabilities" && (
                    <Button
                      onClick={downloadResults}
                      className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                      size="sm"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Export CSV
                    </Button>
                  )}
                  {totalPages > 1 && (
                    <span className="text-sm text-gray-400 flex items-center">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </div>
              </div>

              {/* Controls (only for vulnerabilities) */}
              {activeTab === "vulnerabilities" && (
                <div className="mb-4 space-y-3">
                  {/* Sort Controls */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3" />
                      SORT BY:
                    </span>
                    <button
                      onClick={() => handleSort("severity")}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === "severity"
                          ? "bg-cyber-cyan text-black font-bold"
                          : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      Severity{getSortIcon("severity")}
                    </button>
                    <button
                      onClick={() => handleSort("package")}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === "package"
                          ? "bg-cyber-cyan text-black font-bold"
                          : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      Package{getSortIcon("package")}
                    </button>
                    <button
                      onClick={() => handleSort("cve")}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === "cve"
                          ? "bg-cyber-cyan text-black font-bold"
                          : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      CVE{getSortIcon("cve")}
                    </button>
                  </div>

                  {/* Package Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                    <Input
                      value={packageFilter}
                      onChange={(e) => {
                        setPackageFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Filter by package or CVE..."
                      className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                    />
                  </div>

                  {/* Severity Filter */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-cyber-cyan tracking-wider">SEVERITY:</span>
                    {["critical", "high", "medium", "low"].map((severity) => (
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
              )}

              {/* Items List */}
              <div className="space-y-3">
                {activeTab === "vulnerabilities" ? (
                  paginatedItems.map((item: any, idx) => (
                    <div
                      key={`${item.cve}-${startIndex + idx}`}
                      className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="text-sm font-bold text-cyber-cyan">{item.cve}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(item.severity)}`}>
                              {item.severity.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 mb-2 text-sm">
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-400">Package:</span>
                              <span className="text-cyber-cyan font-mono">{item.package}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Version:</span>
                              <span className="text-orange-400 font-mono ml-1">{item.version}</span>
                            </div>
                            {item.fixedVersion && (
                              <div>
                                <span className="text-gray-400">Fixed in:</span>
                                <span className="text-green-400 font-mono ml-1">{item.fixedVersion}</span>
                              </div>
                            )}
                          </div>

                          <p className="text-sm text-gray-400 mb-2">{item.description}</p>

                          {item.fixedVersion && (
                            <div className="flex items-start gap-1 p-2 bg-green-500/5 border border-green-500/20 rounded">
                              <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-green-400">
                                Update {item.package} to version {item.fixedVersion} to fix this vulnerability
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  paginatedItems.map((item: any, idx) => (
                    <div
                      key={`${item.type}-${startIndex + idx}`}
                      className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm font-bold text-cyber-cyan">{item.type}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(item.severity)}`}>
                              {item.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                          <div className="flex items-start gap-1 p-2 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded">
                            <CheckCircle className="w-3 h-3 text-cyber-cyan mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-cyber-cyan">{item.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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

export default ContainerScanner;
