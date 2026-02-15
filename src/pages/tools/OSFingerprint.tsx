import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Monitor } from "lucide-react";

interface OSResult {
  target: string;
  detectedOS: string;
  confidence: number;
  ttl: number;
  openPorts: number[];
  services: { port: number; service: string; banner?: string }[];
  tcpWindowSize?: number;
  fingerprint: string;
}

interface DetailedService {
  port: number;
  service: string;
  banner?: string;
}

type SortField = "port" | "service";
type SortDirection = "asc" | "desc";

const SERVICES_PER_PAGE = 20;

const OSFingerprint = () => {
  const [target, setTarget] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<OSResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("port");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [serviceFilter, setServiceFilter] = useState("");

  const handleScan = async () => {
    if (!target) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:5000/api/scan/os-fingerprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          timeoutMs: 5000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to scanning service");
    } finally {
      setIsScanning(false);
    }
  };

  const getOSIcon = (os: string) => {
    const osLower = os.toLowerCase();
    if (osLower.includes("windows")) return "🪟";
    if (osLower.includes("linux")) return "🐧";
    if (osLower.includes("unix") || osLower.includes("bsd")) return "🔧";
    if (osLower.includes("mac") || osLower.includes("darwin")) return "🍎";
    return "💻";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-400";
    if (confidence >= 60) return "text-yellow-400";
    if (confidence >= 40) return "text-orange-400";
    return "text-red-400";
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
  const getProcessedServices = (): DetailedService[] => {
    if (!result) return [];

    let services = [...result.services];

    // Filter by service name
    if (serviceFilter) {
      services = services.filter(
        (s) =>
          s.service.toLowerCase().includes(serviceFilter.toLowerCase()) ||
          s.port.toString().includes(serviceFilter)
      );
    }

    // Sort services
    services.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "port":
          comparison = a.port - b.port;
          break;
        case "service":
          comparison = a.service.localeCompare(b.service);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return services;
  };

  const processedServices = getProcessedServices();
  const totalPages = Math.ceil(processedServices.length / SERVICES_PER_PAGE);
  const startIndex = (currentPage - 1) * SERVICES_PER_PAGE;
  const endIndex = startIndex + SERVICES_PER_PAGE;
  const paginatedServices = processedServices.slice(startIndex, endIndex);

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
    <CyberpunkCard title="OS FINGERPRINTING">
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

          <Button
            onClick={handleScan}
            disabled={isScanning || !target}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                FINGERPRINTING...
              </>
            ) : (
              "INITIATE FINGERPRINT"
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
            {/* OS Detection Summary */}
            <div className="glass-panel rounded p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Monitor className="w-6 h-6 text-cyber-cyan" />
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  DETECTED OPERATING SYSTEM
                </h3>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-4xl">{getOSIcon(result.detectedOS)}</span>
                    <div>
                      <p className="text-2xl font-bold text-cyber-cyan">
                        {result.detectedOS}
                      </p>
                      <p className={`text-sm font-mono ${getConfidenceColor(result.confidence)}`}>
                        Confidence: {result.confidence}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">TTL Value:</span>
                    <span className="text-cyber-cyan font-mono">{result.ttl}</span>
                  </div>
                  {result.tcpWindowSize && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">TCP Window:</span>
                      <span className="text-cyber-cyan font-mono">{result.tcpWindowSize}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Open Ports:</span>
                    <span className="text-cyber-cyan font-mono">{result.openPorts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Services:</span>
                    <span className="text-cyber-cyan font-mono">{result.services.length}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-cyber-red/20">
                <p className="text-xs text-gray-500 font-mono">
                  Fingerprint: {result.fingerprint}
                </p>
              </div>
            </div>

            {/* Services Section */}
            {result.services.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                    DETECTED SERVICES ({processedServices.length} / {result.services.length})
                  </h3>
                  {totalPages > 1 && (
                    <span className="text-sm text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
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
                      onClick={() => handleSort("service")}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        sortField === "service"
                          ? "bg-cyber-cyan text-black font-bold"
                          : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                      }`}
                    >
                      Service{getSortIcon("service")}
                    </button>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3 text-cyber-cyan" />
                    <Input
                      value={serviceFilter}
                      onChange={(e) => {
                        setServiceFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Filter by service or port..."
                      className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                    />
                  </div>
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  {paginatedServices.map((service, idx) => (
                    <div
                      key={`${service.port}-${startIndex + idx}`}
                      className="p-4 bg-black/30 rounded hover:bg-black/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-cyber-red font-mono font-bold">
                              Port {service.port}
                            </span>
                            <span className="px-2 py-1 bg-cyber-cyan/20 text-cyber-cyan text-xs rounded">
                              {service.service}
                            </span>
                          </div>
                          {service.banner && (
                            <div className="text-sm text-gray-400 font-mono mt-2 p-2 bg-black/50 rounded overflow-x-auto">
                                <pre className="whitespace-pre-wrap break-all text-xs">
                                {service.banner}
                                </pre>
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
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default OSFingerprint;
