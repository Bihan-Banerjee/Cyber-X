import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react";

interface AuthTest {
  category: string;
  test: string;
  status: "pass" | "fail" | "warning";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  recommendation: string;
  details?: string;
}

interface AuthCheckResult {
  target: string;
  overallScore: number;
  riskLevel: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  tests: AuthTest[];
  vulnerabilitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanDuration: number;
}

type SortField = "category" | "severity" | "status";
type SortDirection = "asc" | "desc";

const TESTS_PER_PAGE = 15;

const BrokenAuthChecker = () => {
  const [targetURL, setTargetURL] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<AuthCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(["fail", "warning", "pass"]));
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(["critical", "high", "medium", "low"]));

  const handleCheck = async () => {
    if (!targetURL) return;

    setIsChecking(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:5000/api/scan/auth-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetURL,
          username: username || undefined,
          password: password || undefined,
          timeoutMs: 15000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Check failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to authentication checker service");
    } finally {
      setIsChecking(false);
    }
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/50",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    };
    return badges[severity] || "bg-gray-500/20 text-gray-400 border-gray-500/50";
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "Category,Test,Status,Severity,Description",
      ...result.tests.map(t => 
        `"${t.category}","${t.test}",${t.status},${t.severity},"${t.description}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auth_security_report_${Date.now()}.csv`;
    a.click();
  };

  const toggleStatusFilter = (status: string) => {
    const newFilters = new Set(statusFilters);
    if (newFilters.has(status)) {
      newFilters.delete(status);
    } else {
      newFilters.add(status);
    }
    setStatusFilters(newFilters);
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
      setSortDirection(field === "severity" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const getProcessedTests = (): AuthTest[] => {
    if (!result) return [];

    let tests = [...result.tests];

    // Filter by category
    if (categoryFilter) {
      tests = tests.filter((t) =>
        t.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        t.test.toLowerCase().includes(categoryFilter.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilters.size > 0) {
      tests = tests.filter((t) => statusFilters.has(t.status));
    }

    // Filter by severity
    if (severityFilters.size > 0) {
      tests = tests.filter((t) => severityFilters.has(t.severity));
    }

    // Sort tests
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    tests.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "severity":
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return tests;
  };

  const processedTests = getProcessedTests();
  const totalPages = Math.ceil(processedTests.length / TESTS_PER_PAGE);
  const startIndex = (currentPage - 1) * TESTS_PER_PAGE;
  const endIndex = startIndex + TESTS_PER_PAGE;
  const paginatedTests = processedTests.slice(startIndex, endIndex);

  const categories = result ? Array.from(new Set(result.tests.map(t => t.category))).sort() : [];

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
    <CyberpunkCard title="BROKEN AUTHENTICATION CHECKER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET LOGIN URL
            </label>
            <Input
              value={targetURL}
              onChange={(e) => setTargetURL(e.target.value)}
              placeholder="https://example.com/login"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isChecking}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                USERNAME (Optional)
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="test user"
                className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
                disabled={isChecking}
              />
            </div>
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                PASSWORD (Optional)
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="test password"
                className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
                disabled={isChecking}
              />
            </div>
          </div>

          <Button
            onClick={handleCheck}
            disabled={isChecking || !targetURL}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                TESTING AUTHENTICATION...
              </>
            ) : (
              <>
                <ShieldAlert className="mr-2 h-4 w-4" />
                START AUTH SECURITY TEST
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">⚠️ Note:</p>
            <p>This tool tests for common authentication vulnerabilities. Credentials are optional but help test session management. Always test on systems you own or have permission to test.</p>
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
            {/* Security Overview */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan">AUTHENTICATION SECURITY OVERVIEW</h3>
                <div className="text-right">
                  <p className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
                    {result.overallScore}
                  </p>
                  <p className="text-xs text-gray-400">Security Score</p>
                  <p className={`text-sm font-bold ${getRiskColor(result.riskLevel)}`}>
                    {result.riskLevel} RISK
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-400">{result.passed}</p>
                  <p className="text-xs text-green-400">Passed</p>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                  <p className="text-xs text-red-400">Failed</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-yellow-400">{result.warnings}</p>
                  <p className="text-xs text-yellow-400">Warnings</p>
                </div>
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <ShieldAlert className="w-6 h-6 text-cyber-cyan mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyber-cyan">{result.scanDuration}s</p>
                  <p className="text-xs text-cyber-cyan">Scan Time</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-red/20 grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-sm font-bold text-red-400">{result.vulnerabilitySummary.critical}</p>
                  <p className="text-xs text-gray-400">Critical</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-orange-400">{result.vulnerabilitySummary.high}</p>
                  <p className="text-xs text-gray-400">High</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-yellow-400">{result.vulnerabilitySummary.medium}</p>
                  <p className="text-xs text-gray-400">Medium</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-400">{result.vulnerabilitySummary.low}</p>
                  <p className="text-xs text-gray-400">Low</p>
                </div>
              </div>
            </div>

            {/* Tests Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  SECURITY TEST RESULTS ({processedTests.length})
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
                    onClick={() => handleSort("category")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "category"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Category{getSortIcon("category")}
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

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by category or test name..."
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">STATUS:</span>
                  <button
                    onClick={() => toggleStatusFilter("fail")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      statusFilters.has("fail")
                        ? "bg-red-500/20 text-red-400 border border-red-500/50"
                        : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                    }`}
                  >
                    FAILED
                  </button>
                  <button
                    onClick={() => toggleStatusFilter("warning")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      statusFilters.has("warning")
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                        : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                    }`}
                  >
                    WARNING
                  </button>
                  <button
                    onClick={() => toggleStatusFilter("pass")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      statusFilters.has("pass")
                        ? "bg-green-500/20 text-green-400 border border-green-500/50"
                        : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                    }`}
                  >
                    PASSED
                  </button>
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
                          ? getSeverityBadge(severity)
                          : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                      }`}
                    >
                      {severity.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tests List */}
              <div className="space-y-3">
                {paginatedTests.map((test, idx) => (
                  <div
                    key={`${test.category}-${test.test}-${startIndex + idx}`}
                    className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {getStatusIcon(test.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-bold text-cyber-cyan">{test.test}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityBadge(test.severity)}`}>
                            {test.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">• {test.category}</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">{test.description}</p>
                        {test.details && (
                          <div className="mb-2 p-2 bg-black/50 rounded">
                            <p className="text-xs text-gray-500 font-mono">{test.details}</p>
                          </div>
                        )}
                        <div className="flex items-start gap-1 p-2 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded">
                          <CheckCircle className="w-3 h-3 text-cyber-cyan mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-cyber-cyan">{test.recommendation}</p>
                        </div>
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

export default BrokenAuthChecker;
