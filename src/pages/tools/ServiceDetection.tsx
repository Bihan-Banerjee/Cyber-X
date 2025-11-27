import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Activity, Database, Server, Shield } from "lucide-react";

interface ServiceInfo {
  port: number;
  protocol: string;
  service: string;
  version?: string;
  banner?: string;
  cpe?: string;
  confidence: number;
  vulnerabilities?: string[];
}

interface ServiceDetectionResult {
  target: string;
  totalServices: number;
  services: ServiceInfo[];
  scanDuration: number;
}

type SortField = "port" | "service" | "confidence";
type SortDirection = "asc" | "desc";

const SERVICES_PER_PAGE = 15;

const ServiceDetection = () => {
  const [target, setTarget] = useState("");
  const [ports, setPorts] = useState("21-25,53,80,110,143,443,445,3306,3389,5432,8080");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ServiceDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("port");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [serviceFilter, setServiceFilter] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);

  const handleScan = async () => {
    if (!target) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:3001/api/scan/service-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          ports,
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-400";
    if (confidence >= 70) return "text-cyan-400";
    if (confidence >= 50) return "text-yellow-400";
    return "text-orange-400";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return "bg-green-500/20 text-green-400 border-green-500/50";
    if (confidence >= 70) return "bg-cyan-500/20 text-cyan-400 border-cyan-500/50";
    if (confidence >= 50) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    return "bg-orange-500/20 text-orange-400 border-orange-500/50";
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
  const getProcessedServices = (): ServiceInfo[] => {
    if (!result) return [];

    let services = [...result.services];

    // Filter by service name/version
    if (serviceFilter) {
      services = services.filter(
        (s) =>
          s.service.toLowerCase().includes(serviceFilter.toLowerCase()) ||
          s.port.toString().includes(serviceFilter) ||
          (s.version && s.version.toLowerCase().includes(serviceFilter.toLowerCase()))
      );
    }

    // Filter by confidence
    if (minConfidence > 0) {
      services = services.filter((s) => s.confidence >= minConfidence);
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
        case "confidence":
          comparison = a.confidence - b.confidence;
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
    <CyberpunkCard title="SERVICE DETECTION">
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
              PORTS TO SCAN
            </label>
            <Input
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
              placeholder="21-25,80,443,3306"
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
                DETECTING SERVICES...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                DETECT SERVICES
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
                <Server className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
                <p className="text-2xl font-bold text-cyber-cyan">{result.totalServices}</p>
                <p className="text-xs text-gray-400">Services Found</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <Activity className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
                <p className="text-2xl font-bold text-cyber-cyan">{processedServices.length}</p>
                <p className="text-xs text-gray-400">Filtered Results</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <Database className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
                <p className="text-2xl font-bold text-cyber-cyan">{result.target}</p>
                <p className="text-xs text-gray-400">Target Host</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <Shield className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
                <p className="text-2xl font-bold text-cyber-cyan">{result.scanDuration}s</p>
                <p className="text-xs text-gray-400">Scan Duration</p>
              </div>
            </div>

            {/* Services Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  DETECTED SERVICES
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
                  <button
                    onClick={() => handleSort("confidence")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "confidence"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Confidence{getSortIcon("confidence")}
                  </button>
                </div>

                {/* Filter Controls */}
                <div className="grid md:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                    <Input
                      value={serviceFilter}
                      onChange={(e) => {
                        setServiceFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Filter by service, port, or version..."
                      className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cyber-cyan whitespace-nowrap">Min Confidence:</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={minConfidence}
                      onChange={(e) => {
                        setMinConfidence(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Services List */}
              <div className="space-y-3">
                {paginatedServices.map((service, idx) => (
                  <div
                    key={`${service.port}-${startIndex + idx}`}
                    className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyber-red/20 rounded">
                          <Server className="w-5 h-5 text-cyber-red" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-cyber-red font-mono font-bold text-lg">
                              Port {service.port}
                            </span>
                            <span className="text-xs px-2 py-1 bg-cyber-cyan/20 text-cyber-cyan rounded">
                              {service.protocol.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-cyber-cyan font-semibold">
                            {service.service}
                            {service.version && (
                              <span className="text-gray-400 ml-2 font-normal">v{service.version}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded text-xs font-bold border ${getConfidenceBadge(service.confidence)}`}>
                        {service.confidence}% Match
                      </div>
                    </div>

                    {service.banner && (
                      <div className="mt-3 p-3 bg-black/50 rounded">
                        <p className="text-xs text-gray-500 mb-1">Service Banner:</p>
                        <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
                          {service.banner}
                        </pre>
                      </div>
                    )}

                    {service.cpe && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">CPE:</span>
                        <span className="text-xs text-cyber-cyan font-mono">{service.cpe}</span>
                      </div>
                    )}

                    {service.vulnerabilities && service.vulnerabilities.length > 0 && (
                      <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded">
                        <p className="text-xs text-red-400 font-semibold mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Potential Vulnerabilities:
                        </p>
                        <ul className="text-xs text-red-400 space-y-1">
                          {service.vulnerabilities.map((vuln, i) => (
                            <li key={i} className="ml-4">• {vuln}</li>
                          ))}
                        </ul>
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

export default ServiceDetection;
