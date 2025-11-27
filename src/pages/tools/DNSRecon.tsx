import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Server, Download, Copy, Check } from "lucide-react";

interface DNSRecord {
  type: string;
  name: string;
  value: string | string[];
  ttl?: number;
}

interface DNSReconResult {
  domain: string;
  totalRecords: number;
  records: DNSRecord[];
  nameServers?: string[];
  mailServers?: string[];
  zoneTransfer?: {
    attempted: boolean;
    successful: boolean;
    message?: string;
  };
  dnssec?: {
    enabled: boolean;
    algorithms?: string[];
  };
  scanDuration: number;
}

type SortField = "type" | "name";
type SortDirection = "asc" | "desc";

const RECORDS_PER_PAGE = 10;

const DNSRecon = () => {
  const [domain, setDomain] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<DNSReconResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("type");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [recordFilter, setRecordFilter] = useState("");
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());

  const handleScan = async () => {
    if (!domain) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:3001/api/scan/dns-recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          timeoutMs: 5000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
      
      // Initialize type filters with all found types
      const types = new Set(data.records.map((r: DNSRecord) => r.type));
      setTypeFilters(types);
    } catch (err: any) {
      setError(err.message || "Failed to connect to DNS recon service");
    } finally {
      setIsScanning(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "Type,Name,Value,TTL",
      ...result.records.map(r => {
        const value = Array.isArray(r.value) ? r.value.join('; ') : r.value;
        return `${r.type},${r.name},"${value}",${r.ttl || 'N/A'}`;
      })
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns_recon_${result.domain}_${Date.now()}.csv`;
    a.click();
  };

  const toggleTypeFilter = (type: string) => {
    const newFilters = new Set(typeFilters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    setTypeFilters(newFilters);
    setCurrentPage(1);
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
  const getProcessedRecords = (): DNSRecord[] => {
    if (!result) return [];

    let records = [...result.records];

    // Filter by record content
    if (recordFilter) {
      records = records.filter(
        (r) =>
          r.type.toLowerCase().includes(recordFilter.toLowerCase()) ||
          r.name.toLowerCase().includes(recordFilter.toLowerCase()) ||
          (Array.isArray(r.value) 
            ? r.value.some(v => v.toLowerCase().includes(recordFilter.toLowerCase()))
            : r.value.toLowerCase().includes(recordFilter.toLowerCase()))
      );
    }

    // Filter by type
    if (typeFilters.size > 0) {
      records = records.filter((r) => typeFilters.has(r.type));
    }

    // Sort records
    records.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return records;
  };

  const processedRecords = getProcessedRecords();
  const totalPages = Math.ceil(processedRecords.length / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const endIndex = startIndex + RECORDS_PER_PAGE;
  const paginatedRecords = processedRecords.slice(startIndex, endIndex);

  // Get unique record types for filter buttons
  const availableTypes = result ? Array.from(new Set(result.records.map(r => r.type))).sort() : [];

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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'AAAA': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'MX': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      'NS': 'bg-green-500/20 text-green-400 border-green-500/50',
      'TXT': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      'CNAME': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
      'SOA': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      'PTR': 'bg-pink-500/20 text-pink-400 border-pink-500/50',
      'SRV': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  return (
    <CyberpunkCard title="DNS RECONNAISSANCE">
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
                QUERYING DNS RECORDS...
              </>
            ) : (
              <>
                <Server className="mr-2 h-4 w-4" />
                START DNS RECON
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
            {/* Summary Section */}
            <div className="glass-panel rounded p-6">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
                <Server className="w-5 h-5" />
                DNS INFORMATION FOR {result.domain}
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Records:</span>
                    <span className="text-cyber-cyan font-mono font-bold">{result.totalRecords}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Scan Duration:</span>
                    <span className="text-cyber-cyan font-mono">{result.scanDuration}s</span>
                  </div>
                  {result.dnssec && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">DNSSEC:</span>
                      <span className={`font-mono ${result.dnssec.enabled ? 'text-green-400' : 'text-red-400'}`}>
                        {result.dnssec.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {result.nameServers && result.nameServers.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Name Servers:</p>
                      <div className="space-y-1">
                        {result.nameServers.slice(0, 3).map((ns, i) => (
                          <p key={i} className="text-xs text-cyber-cyan font-mono truncate">{ns}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {result.zoneTransfer && (
                <div className={`mt-4 p-3 rounded border ${
                  result.zoneTransfer.successful 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <p className="text-xs font-semibold mb-1">
                    {result.zoneTransfer.successful ? '⚠️ Zone Transfer: VULNERABLE' : 'Zone Transfer: Protected'}
                  </p>
                  {result.zoneTransfer.message && (
                    <p className="text-xs text-gray-400">{result.zoneTransfer.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* DNS Records Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  DNS RECORDS ({processedRecords.length})
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
                    onClick={() => handleSort("type")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "type"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Type{getSortIcon("type")}
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
                </div>

                {/* Search Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={recordFilter}
                    onChange={(e) => {
                      setRecordFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search records..."
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>

                {/* Type Filter Buttons */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">FILTER:</span>
                  {availableTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleTypeFilter(type)}
                      className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                        typeFilters.has(type)
                          ? getTypeColor(type)
                          : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Records List */}
              <div className="space-y-2">
                {paginatedRecords.map((record, idx) => (
                  <div
                    key={`${record.type}-${record.name}-${startIndex + idx}`}
                    className="p-4 bg-black/30 rounded hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getTypeColor(record.type)}`}>
                          {record.type}
                        </span>
                        <div>
                          <p className="text-cyber-cyan font-mono text-sm font-semibold">{record.name}</p>
                          {record.ttl && (
                            <p className="text-xs text-gray-500">TTL: {record.ttl}s</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(
                          Array.isArray(record.value) ? record.value.join(', ') : record.value,
                          `${record.type}-${idx}`
                        )}
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                      >
                        {copiedField === `${record.type}-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                        )}
                      </button>
                    </div>
                    <div className="pl-16">
                      {Array.isArray(record.value) ? (
                        <ul className="space-y-1">
                          {record.value.map((val, i) => (
                            <li key={i} className="text-sm text-gray-400 font-mono break-all">
                              • {val}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 font-mono break-all">{record.value}</p>
                      )}
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

export default DNSRecon;
