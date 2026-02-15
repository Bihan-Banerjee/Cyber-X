import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Hash, CheckCircle, XCircle, Clock, Download, Copy, Check } from "lucide-react";

interface HashResult {
  hash: string;
  identifiedType: string;
  possibleTypes: string[];
  cracked: boolean;
  plaintext?: string;
  crackedTime?: number;
  attempts?: number;
}

interface CrackResult {
  totalHashes: number;
  crackedCount: number;
  failedCount: number;
  results: HashResult[];
  totalTime: number;
  attackMethod: string;
}

type SortField = "hash" | "type" | "status" | "time";
type SortDirection = "asc" | "desc";

const RESULTS_PER_PAGE = 15;

const HashCracker = () => {
  const [hashes, setHashes] = useState("");
  const [isCracking, setIsCracking] = useState(false);
  const [result, setResult] = useState<CrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(["cracked", "failed"]));

  const handleCrack = async () => {
    if (!hashes.trim()) return;

    setIsCracking(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:5000/api/scan/hash-crack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashes: hashes.split('\n').filter(h => h.trim()),
          timeoutMs: 30000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Cracking failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to hash cracker service");
    } finally {
      setIsCracking(false);
    }
  };

  const copyToClipboard = async (text: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      "Hash,Type,Status,Plaintext,Attempts,Time (ms)",
      ...result.results.map(r => 
        `"${r.hash}",${r.identifiedType},${r.cracked ? 'Cracked' : 'Failed'},"${r.plaintext || 'N/A'}",${r.attempts || 0},${r.crackedTime || 0}`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hash_crack_results_${Date.now()}.csv`;
    a.click();
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'MD5': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'SHA-1': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      'SHA-256': 'bg-green-500/20 text-green-400 border-green-500/50',
      'SHA-512': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
      'bcrypt': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      'NTLM': 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const getProcessedResults = (): HashResult[] => {
    if (!result) return [];

    let results = [...result.results];

    // Filter by type
    if (typeFilter) {
      results = results.filter((r) =>
        r.identifiedType.toLowerCase().includes(typeFilter.toLowerCase()) ||
        r.possibleTypes.some(t => t.toLowerCase().includes(typeFilter.toLowerCase()))
      );
    }

    // Filter by status
    if (statusFilters.size > 0) {
      results = results.filter((r) => 
        statusFilters.has(r.cracked ? "cracked" : "failed")
      );
    }

    // Sort results
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "hash":
          comparison = a.hash.localeCompare(b.hash);
          break;
        case "type":
          comparison = a.identifiedType.localeCompare(b.identifiedType);
          break;
        case "status":
          comparison = (a.cracked ? 1 : 0) - (b.cracked ? 1 : 0);
          break;
        case "time":
          comparison = (a.crackedTime || 0) - (b.crackedTime || 0);
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

  const availableTypes = result ? Array.from(new Set(result.results.map(r => r.identifiedType))).sort() : [];

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
    <CyberpunkCard title="HASH CRACKER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              HASHES (One per line)
            </label>
            <Textarea
              value={hashes}
              onChange={(e) => setHashes(e.target.value)}
              placeholder="5f4dcc3b5aa765d61d8327deb882cf99&#10;5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8&#10;ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono text-xs h-40"
              disabled={isCracking}
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports: MD5, SHA-1, SHA-256, SHA-512, NTLM, bcrypt
            </p>
          </div>

          <Button
            onClick={handleCrack}
            disabled={isCracking || !hashes.trim()}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isCracking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                CRACKING HASHES...
              </>
            ) : (
              <>
                <Hash className="mr-2 h-4 w-4" />
                START CRACKING
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">⚠️ Educational Purpose Only</p>
            <p>This tool uses dictionary attacks with common passwords. Only crack hashes you own or have permission to test. Uses ~10,000 common passwords.</p>
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
              <h3 className="text-lg font-bold text-cyber-cyan mb-4">CRACKING SUMMARY</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <Hash className="w-6 h-6 text-cyber-cyan mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyber-cyan">{result.totalHashes}</p>
                  <p className="text-xs text-cyber-cyan">Total Hashes</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                  <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-400">{result.crackedCount}</p>
                  <p className="text-xs text-green-400">Cracked</p>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-400">{result.failedCount}</p>
                  <p className="text-xs text-red-400">Failed</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-yellow-400">{result.totalTime}s</p>
                  <p className="text-xs text-yellow-400">Total Time</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-red/20">
                <p className="text-sm text-gray-400">
                  <span className="font-semibold text-cyber-cyan">Attack Method:</span> {result.attackMethod}
                </p>
                <p className="text-sm text-gray-400">
                  <span className="font-semibold text-cyber-cyan">Success Rate:</span> {result.totalHashes > 0 ? Math.round((result.crackedCount / result.totalHashes) * 100) : 0}%
                </p>
              </div>
            </div>

            {/* Results Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  CRACK RESULTS ({processedResults.length})
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
                    onClick={() => handleSort("time")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "time"
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Time{getSortIcon("time")}
                  </button>
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <input
                    type="text"
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by hash type..."
                    className="flex-1 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan text-xs h-8 px-3 rounded"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">STATUS:</span>
                  <button
                    onClick={() => toggleStatusFilter("cracked")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      statusFilters.has("cracked")
                        ? "bg-green-500/20 text-green-400 border border-green-500/50"
                        : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                    }`}
                  >
                    CRACKED
                  </button>
                  <button
                    onClick={() => toggleStatusFilter("failed")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      statusFilters.has("failed")
                        ? "bg-red-500/20 text-red-400 border border-red-500/50"
                        : "bg-gray-500/10 text-gray-500 border border-gray-500/30 line-through"
                    }`}
                  >
                    FAILED
                  </button>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-3">
                {paginatedResults.map((hashResult, idx) => (
                  <div
                    key={`${hashResult.hash}-${startIndex + idx}`}
                    className="glass-panel rounded p-4 hover:bg-black/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {hashResult.cracked ? (
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-bold border ${getTypeColor(hashResult.identifiedType)}`}>
                            {hashResult.identifiedType}
                          </span>
                          {hashResult.possibleTypes.length > 1 && (
                            <span className="text-xs text-gray-500">
                              (or {hashResult.possibleTypes.filter(t => t !== hashResult.identifiedType).join(', ')})
                            </span>
                          )}
                        </div>
                        
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Hash:</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-400 font-mono break-all flex-1">
                              {hashResult.hash}
                            </p>
                            <button
                              onClick={() => copyToClipboard(hashResult.hash, hashResult.hash)}
                              className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors flex-shrink-0"
                            >
                              {copiedHash === hashResult.hash ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-cyber-cyan" />
                              )}
                            </button>
                          </div>
                        </div>

                        {hashResult.cracked && hashResult.plaintext && (
                          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-green-400 font-semibold">✓ CRACKED</p>
                              <div className="flex gap-3 text-xs text-green-400">
                                <span>⏱️ {hashResult.crackedTime}ms</span>
                                <span>🔄 {hashResult.attempts} attempts</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-green-400 font-mono font-bold flex-1 break-all">
                                {hashResult.plaintext}
                              </p>
                              <button
                                onClick={() => copyToClipboard(hashResult.plaintext!, `${hashResult.hash}-plaintext`)}
                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded transition-colors flex-shrink-0"
                              >
                                {copiedHash === `${hashResult.hash}-plaintext` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-green-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {!hashResult.cracked && (
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                            <p className="text-xs text-red-400">
                              ✗ Could not crack with dictionary attack. Try larger wordlists or brute force tools.
                            </p>
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

export default HashCracker;
