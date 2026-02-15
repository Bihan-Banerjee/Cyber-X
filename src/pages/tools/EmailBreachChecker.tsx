import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Mail, ShieldAlert, Calendar, Database, ExternalLink, Download } from "lucide-react";

interface Breach {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  addedDate: string;
  modifiedDate: string;
  pwnCount: number;
  description: string;
  dataClasses: string[];
  isVerified: boolean;
  isFabricated: boolean;
  isSensitive: boolean;
  isRetired: boolean;
  isSpamList: boolean;
  logoPath?: string;
}

interface BreachCheckResult {
  email: string;
  isBreached: boolean;
  totalBreaches: number;
  breaches: Breach[];
  riskScore: number;
  dataClassSummary: Record<string, number>;
  oldestBreach?: string;
  newestBreach?: string;
}

type SortField = "date" | "name" | "pwnCount";
type SortDirection = "asc" | "desc";

const BREACHES_PER_PAGE = 10;

const EmailBreachChecker = () => {
  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<BreachCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [nameFilter, setNameFilter] = useState("");
  const [dataClassFilters, setDataClassFilters] = useState<Set<string>>(new Set());

  const handleCheck = async () => {
    if (!email) return;

    setIsChecking(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:5000/api/scan/breach-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Check failed");
      }

      const data = await response.json();
      setResult(data);
      
      // Initialize data class filters with all found classes
      if (data.dataClassSummary) {
        const classes = new Set(Object.keys(data.dataClassSummary));
        setDataClassFilters(classes);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to breach checker service");
    } finally {
      setIsChecking(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-400";
    if (score >= 60) return "text-orange-400";
    if (score >= 40) return "text-yellow-400";
    return "text-green-400";
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "Breach Name,Domain,Breach Date,Compromised Accounts,Data Exposed",
      ...result.breaches.map(b => 
        `"${b.title}",${b.domain},${b.breachDate},${b.pwnCount},"${b.dataClasses.join(', ')}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breach_report_${email}_${Date.now()}.csv`;
    a.click();
  };

  const toggleDataClassFilter = (dataClass: string) => {
    const newFilters = new Set(dataClassFilters);
    if (newFilters.has(dataClass)) {
      newFilters.delete(dataClass);
    } else {
      newFilters.add(dataClass);
    }
    setDataClassFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const getProcessedBreaches = (): Breach[] => {
    if (!result) return [];

    let breaches = [...result.breaches];

    // Filter by name
    if (nameFilter) {
      breaches = breaches.filter((b) =>
        b.title.toLowerCase().includes(nameFilter.toLowerCase()) ||
        b.domain.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Filter by data class
    if (dataClassFilters.size > 0) {
      breaches = breaches.filter((b) =>
        b.dataClasses.some(dc => dataClassFilters.has(dc))
      );
    }

    // Sort breaches
    breaches.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = new Date(a.breachDate).getTime() - new Date(b.breachDate).getTime();
          break;
        case "name":
          comparison = a.title.localeCompare(b.title);
          break;
        case "pwnCount":
          comparison = a.pwnCount - b.pwnCount;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return breaches;
  };

  const processedBreaches = getProcessedBreaches();
  const totalPages = Math.ceil(processedBreaches.length / BREACHES_PER_PAGE);
  const startIndex = (currentPage - 1) * BREACHES_PER_PAGE;
  const endIndex = startIndex + BREACHES_PER_PAGE;
  const paginatedBreaches = processedBreaches.slice(startIndex, endIndex);

  const topDataClasses = result ? 
    Object.entries(result.dataClassSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => key) : [];

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
    <CyberpunkCard title="EMAIL BREACH CHECKER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              EMAIL ADDRESS
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="[email protected]"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isChecking}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            />
          </div>

          <Button
            onClick={handleCheck}
            disabled={isChecking || !email}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                CHECKING BREACHES...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                CHECK FOR BREACHES
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
            {/* Status Summary */}
            <div className={`glass-panel rounded p-6 ${
              result.isBreached ? 'border-2 border-red-500/50' : 'border-2 border-green-500/50'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className={`w-8 h-8 ${result.isBreached ? 'text-red-400' : 'text-green-400'}`} />
                  <div>
                    <h3 className="text-xl font-bold text-cyber-cyan">{email}</h3>
                    <p className={`text-sm font-semibold ${result.isBreached ? 'text-red-400' : 'text-green-400'}`}>
                      {result.isBreached ? '⚠️ COMPROMISED' : '✓ NO BREACHES FOUND'}
                    </p>
                  </div>
                </div>
                {result.isBreached && (
                  <div className="text-right">
                    <p className={`text-4xl font-bold ${getRiskColor(result.riskScore)}`}>
                      {result.riskScore}
                    </p>
                    <p className="text-xs text-gray-400">Risk Score</p>
                    <p className={`text-sm font-bold ${getRiskColor(result.riskScore)}`}>
                      {getRiskLevel(result.riskScore)}
                    </p>
                  </div>
                )}
              </div>

              {result.isBreached && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                    <p className="text-2xl font-bold text-red-400">{result.totalBreaches}</p>
                    <p className="text-xs text-red-400">Total Breaches</p>
                  </div>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded text-center">
                    <p className="text-2xl font-bold text-orange-400">{Object.keys(result.dataClassSummary).length}</p>
                    <p className="text-xs text-orange-400">Data Types Exposed</p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                    <p className="text-sm font-bold text-yellow-400">{result.oldestBreach}</p>
                    <p className="text-xs text-yellow-400">Oldest Breach</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                    <p className="text-sm font-bold text-blue-400">{result.newestBreach}</p>
                    <p className="text-xs text-blue-400">Latest Breach</p>
                  </div>
                </div>
              )}

              {result.isBreached && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded">
                  <p className="text-sm text-red-400 font-semibold mb-2">⚠️ Recommended Actions:</p>
                  <ul className="text-xs text-gray-400 space-y-1 ml-4">
                    <li>• Change your password immediately on all affected services</li>
                    <li>• Enable two-factor authentication (2FA) where available</li>
                    <li>• Monitor your accounts for suspicious activity</li>
                    <li>• Use unique passwords for each service</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Breaches Section */}
            {result.isBreached && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                    BREACH DETAILS ({processedBreaches.length})
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
                      onClick={() => handleSort("date")}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === "date"
                          ? "bg-cyber-cyan text-black font-bold"
                          : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      Date{getSortIcon("date")}
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
                      onClick={() => handleSort("pwnCount")}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === "pwnCount"
                          ? "bg-cyber-cyan text-black font-bold"
                          : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      Impact{getSortIcon("pwnCount")}
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
                      placeholder="Filter by breach name or domain..."
                      className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                    />
                  </div>

                  {/* Data Class Filter */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-cyber-cyan tracking-wider">DATA EXPOSED:</span>
                    {topDataClasses.map((dataClass) => (
                      <button
                        key={dataClass}
                        onClick={() => toggleDataClassFilter(dataClass)}
                        className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                          dataClassFilters.has(dataClass)
                            ? "bg-red-500/20 text-red-400 border border-red-500/50"
                            : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                        }`}
                      >
                        {dataClass}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Breaches List */}
                <div className="space-y-3">
                  {paginatedBreaches.map((breach, idx) => (
                    <div
                      key={`${breach.name}-${startIndex + idx}`}
                      className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-lg font-bold text-cyber-cyan">{breach.title}</h4>
                            {breach.isVerified && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/50 rounded text-xs">
                                VERIFIED
                              </span>
                            )}
                            {breach.isSensitive && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/50 rounded text-xs">
                                SENSITIVE
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 text-sm text-gray-400 mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(breach.breachDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Database className="w-3 h-3" />
                              {breach.pwnCount.toLocaleString()} accounts
                            </span>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              {breach.domain}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-gray-400 mb-3" 
                         dangerouslySetInnerHTML={{ __html: breach.description.substring(0, 200) + '...' }} 
                      />

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Compromised Data:</p>
                        <div className="flex flex-wrap gap-1">
                          {breach.dataClasses.map((dataClass, dcIdx) => (
                            <span
                              key={dcIdx}
                              className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs"
                            >
                              {dataClass}
                            </span>
                          ))}
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
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default EmailBreachChecker;
