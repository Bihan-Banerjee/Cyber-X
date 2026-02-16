import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface ScanResult {
  port: number;
  protocol: "tcp" | "udp";
  state: "open" | "closed" | "filtered" | "open|filtered";
  reason: string;
  latencyMs: number | null;
}

type SortField = "port" | "protocol" | "state" | "latency";
type SortDirection = "asc" | "desc";

const RESULTS_PER_PAGE = 10;

const PortScanner = () => {
  const [target, setTarget] = useState("");
  const [ports, setPorts] = useState("20-25,80,443,3306,5432,8080");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("port");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [stateFilters, setStateFilters] = useState<Set<string>>(
    new Set(["open", "closed", "filtered", "open|filtered"])
  );
  const [showFilters, setShowFilters] = useState(false);

  const handleScan = async () => {
    if (!target) return;

    setIsScanning(true);
    setResults([]);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/ports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          ports,
          tcp: true,
          udp: false,
          timeoutMs: 3000,
          concurrency: 50,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to connect to scanning service");
    } finally {
      setIsScanning(false);
    }
  };

  const getServiceName = (port: number): string => {
    const services: Record<number, string> = {
      20: "FTP-Data", 21: "FTP", 22: "SSH", 23: "Telnet",
      25: "SMTP", 53: "DNS", 80: "HTTP", 110: "POP3",
      143: "IMAP", 443: "HTTPS", 3306: "MySQL", 3389: "RDP",
      5432: "PostgreSQL", 8080: "HTTP-Proxy", 27017: "MongoDB",
    };
    return services[port] || "Unknown";
  };

  // Toggle sort field or direction
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  // Toggle filter state
  const toggleFilter = (state: string) => {
    const newFilters = new Set(stateFilters);
    if (newFilters.has(state)) {
      newFilters.delete(state);
    } else {
      newFilters.add(state);
    }
    setStateFilters(newFilters);
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Apply filters and sorting
  const getProcessedResults = () => {
    // Filter results
    let processed = results.filter((result) => stateFilters.has(result.state));

    // Sort results
    processed.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "port":
          comparison = a.port - b.port;
          break;
        case "protocol":
          comparison = a.protocol.localeCompare(b.protocol);
          break;
        case "state":
          comparison = a.state.localeCompare(b.state);
          break;
        case "latency":
          const latencyA = a.latencyMs ?? Infinity;
          const latencyB = b.latencyMs ?? Infinity;
          comparison = latencyA - latencyB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return processed;
  };

  const processedResults = getProcessedResults();
  const totalPages = Math.ceil(processedResults.length / RESULTS_PER_PAGE);
  const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
  const endIndex = startIndex + RESULTS_PER_PAGE;
  const paginatedResults = processedResults.slice(startIndex, endIndex);

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
    <CyberpunkCard title="PORT SCANNER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET IP/HOSTNAME
            </label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="192.168.1.1 or example.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              PORTS (e.g., 80,443 or 1-1000)
            </label>
            <Input
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
              placeholder="80,443,8080 or 1-1024"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !target}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                SCANNING...
              </>
            ) : (
              "INITIATE SCAN"
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="border-t border-cyber-red/30 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                SCAN RESULTS ({processedResults.length} / {results.length} ports)
              </h3>
              {totalPages > 1 && (
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>

            {/* Sort & Filter Controls */}
            <div className="mb-4 space-y-3">
              {/* Sort Controls */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" />
                  SORT BY:
                </span>
                <button
                  onClick={() => handleSort("port")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    sortField === "port"
                      ? "bg-cyber-cyan text-black font-bold"
                      : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                  }`}
                >
                  Port{getSortIcon("port")}
                </button>
                <button
                  onClick={() => handleSort("protocol")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    sortField === "protocol"
                      ? "bg-cyber-cyan text-black font-bold"
                      : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                  }`}
                >
                  Protocol{getSortIcon("protocol")}
                </button>
                <button
                  onClick={() => handleSort("state")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    sortField === "state"
                      ? "bg-cyber-cyan text-black font-bold"
                      : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                  }`}
                >
                  Status{getSortIcon("state")}
                </button>
                <button
                  onClick={() => handleSort("latency")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    sortField === "latency"
                      ? "bg-cyber-cyan text-black font-bold"
                      : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                  }`}
                >
                  Latency{getSortIcon("latency")}
                </button>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1 hover:text-cyber-red transition-colors"
                >
                  <Filter className="w-3 h-3" />
                  FILTER STATUS:
                </button>
                <button
                  onClick={() => toggleFilter("open")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    stateFilters.has("open")
                      ? "bg-green-500/20 text-green-400 border border-green-500/50"
                      : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                  }`}
                >
                  OPEN
                </button>
                <button
                  onClick={() => toggleFilter("closed")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    stateFilters.has("closed")
                      ? "bg-red-500/20 text-red-400 border border-red-500/50"
                      : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                  }`}
                >
                  CLOSED
                </button>
                <button
                  onClick={() => toggleFilter("filtered")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    stateFilters.has("filtered")
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                  }`}
                >
                  FILTERED
                </button>
                <button
                  onClick={() => toggleFilter("open|filtered")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    stateFilters.has("open|filtered")
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                  }`}
                >
                  OPEN|FILTERED
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {paginatedResults.map((result, idx) => (
                <div
                  key={`${result.port}-${result.protocol}-${startIndex + idx}`}
                  className="flex items-center justify-between p-3 bg-black/30 rounded hover:bg-black/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-cyber-red font-mono font-bold">
                      {result.port}/{result.protocol.toUpperCase()}
                    </span>
                    <span className="text-gray-400">
                      {getServiceName(result.port)}
                    </span>
                    {result.latencyMs && (
                      <span className="text-xs text-gray-500">
                        {result.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      result.state === "open"
                        ? "bg-green-500/20 text-green-400"
                        : result.state === "filtered" || result.state === "open|filtered"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {result.state.toUpperCase()}
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
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PortScanner;
