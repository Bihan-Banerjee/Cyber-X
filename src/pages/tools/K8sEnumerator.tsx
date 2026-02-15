import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Box, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Download, Lock, Unlock } from "lucide-react";

interface K8sResource {
  type: string;
  name: string;
  namespace: string;
  status: string;
  issues: string[];
  severity: "critical" | "high" | "medium" | "low" | "info";
}

interface K8sMisconfiguration {
  category: string;
  issue: string;
  severity: "critical" | "high" | "medium" | "low";
  resource: string;
  description: string;
  recommendation: string;
}

interface K8sEnumerationResult {
  clusterName: string;
  version: string;
  totalResources: number;
  namespaces: string[];
  resources: K8sResource[];
  misconfigurations: K8sMisconfiguration[];
  securityScore: number;
  riskLevel: string;
  findings: {
    privilegedPods: number;
    exposedSecrets: number;
    publicServices: number;
    missingRBAC: number;
    insecureConfigs: number;
  };
  scanDuration: number;
}

type SortField = "severity" | "type" | "namespace";
type SortDirection = "asc" | "desc";
type TabType = "resources" | "misconfigs";

const ITEMS_PER_PAGE = 5;

const K8sEnumerator = () => {
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<K8sEnumerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>("misconfigs");
  
  // Sort & Filter states
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(["critical", "high", "medium", "low"]));

  const handleScan = async () => {
    if (!apiEndpoint) return;

    setIsScanning(true);
    setResult(null);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await fetch("http://localhost:5000/api/scan/k8s-enum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiEndpoint,
          token: token || undefined,
          timeoutMs: 30000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to K8s enumeration service");
    } finally {
      setIsScanning(false);
    }
  };

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/50",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      info: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return colors[severity] || colors.info;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getRiskColor = (level: string): string => {
    const colors: Record<string, string> = {
      CRITICAL: "text-red-400",
      HIGH: "text-orange-400",
      MEDIUM: "text-yellow-400",
      LOW: "text-green-400",
    };
    return colors[level] || "text-gray-400";
  };

  const downloadResults = (): void => {
    if (!result) return;

    const csv = [
      "Category,Issue,Severity,Resource,Description",
      ...result.misconfigurations.map(m => 
        `"${m.category}","${m.issue}",${m.severity},"${m.resource}","${m.description}"`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `k8s_security_scan_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleSeverityFilter = (severity: string): void => {
    const newFilters = new Set(severityFilters);
    if (newFilters.has(severity)) {
      newFilters.delete(severity);
    } else {
      newFilters.add(severity);
    }
    setSeverityFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "severity" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const getProcessedItems = (): (K8sResource | K8sMisconfiguration)[] => {
    if (!result) return [];

    let items: (K8sResource | K8sMisconfiguration)[] =
      activeTab === "resources"
        ? result.resources 
        : result.misconfigurations;

    // Filter by type/category
    if (typeFilter) {
      items = items.filter((item) => {
        const typeOrCategory = 'type' in item ? item.type : 'category' in item ? item.category : '';
        const nameOrIssue = 'name' in item ? item.name : 'issue' in item ? item.issue : '';
        
        return typeOrCategory.toLowerCase().includes(typeFilter.toLowerCase()) ||
               nameOrIssue.toLowerCase().includes(typeFilter.toLowerCase());
      });
    }

    // Filter by severity
    if (severityFilters.size > 0) {
      items = items.filter((item) => severityFilters.has(item.severity));
    }

    // Sort
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    items.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "severity":
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case "type": {
          const aType = 'type' in a ? a.type : 'category' in a ? a.category : '';
          const bType = 'type' in b ? b.type : 'category' in b ? b.category : '';
          comparison = aType.localeCompare(bType);
          break;
        }
        case "namespace": {
          const aNamespace = 'namespace' in a ? a.namespace : '';
          const bNamespace = 'namespace' in b ? b.namespace : '';
          comparison = aNamespace.localeCompare(bNamespace);
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return items;
  };

  const processedItems = getProcessedItems();
  const totalPages = Math.ceil(processedItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = processedItems.slice(startIndex, endIndex);

  const goToNextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPrevPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const goToPage = (page: number): void => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getPageNumbers = (): (number | string)[] => {
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

  const getSortIcon = (field: SortField): JSX.Element | null => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-cyber-red">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  const isMisconfiguration = (item: K8sResource | K8sMisconfiguration): item is K8sMisconfiguration => {
    return 'category' in item;
  };

  const isResource = (item: K8sResource | K8sMisconfiguration): item is K8sResource => {
    return 'type' in item && 'namespace' in item;
  };

  return (
    <CyberpunkCard title="KUBERNETES ENUMERATOR">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              API ENDPOINT
            </label>
            <Input
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://k8s-api.example.com:6443"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              SERVICE ACCOUNT TOKEN (Optional)
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token or service account token"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
              disabled={isScanning}
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !apiEndpoint}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ENUMERATING CLUSTER...
              </>
            ) : (
              <>
                <Box className="mr-2 h-4 w-4" />
                START K8S ENUMERATION
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Kubernetes Security Scan</p>
            <p>Enumerates Kubernetes cluster resources, detects misconfigurations, and identifies security risks. Tests for RBAC issues, exposed secrets, privileged pods, and insecure configurations.</p>
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
            {/* Cluster Info & Score */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-cyber-cyan mb-1">{result.clusterName}</h3>
                  <p className="text-sm text-gray-400">Version: {result.version}</p>
                  <p className="text-sm text-gray-400">{result.namespaces.length} namespaces</p>
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

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                  <Unlock className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-red-400">{result.findings.privilegedPods}</p>
                  <p className="text-xs text-red-400">Privileged Pods</p>
                </div>
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded text-center">
                  <Lock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-orange-400">{result.findings.exposedSecrets}</p>
                  <p className="text-xs text-orange-400">Exposed Secrets</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-yellow-400">{result.findings.publicServices}</p>
                  <p className="text-xs text-yellow-400">Public Services</p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                  <ShieldAlert className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-400">{result.findings.missingRBAC}</p>
                  <p className="text-xs text-blue-400">RBAC Issues</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                  <XCircle className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-purple-400">{result.findings.insecureConfigs}</p>
                  <p className="text-xs text-purple-400">Insecure Configs</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-red/20 text-sm text-gray-400">
                <p>Scan duration: {result.scanDuration}s • Total resources: {result.totalResources}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-cyber-red/30">
              <button
                onClick={() => { setActiveTab("misconfigs"); setCurrentPage(1); }}
                className={`px-4 py-2 font-bold tracking-wide transition-colors ${
                  activeTab === "misconfigs"
                    ? "text-cyber-cyan border-b-2 border-cyber-cyan"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                MISCONFIGURATIONS ({result.misconfigurations.length})
              </button>
              <button
                onClick={() => { setActiveTab("resources"); setCurrentPage(1); }}
                className={`px-4 py-2 font-bold tracking-wide transition-colors ${
                  activeTab === "resources"
                    ? "text-cyber-cyan border-b-2 border-cyber-cyan"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                RESOURCES ({result.resources.length})
              </button>
            </div>

            {/* Results Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                  {activeTab === "misconfigs" ? "SECURITY MISCONFIGURATIONS" : "CLUSTER RESOURCES"} ({processedItems.length})
                </h3>
                <div className="flex gap-2">
                  {activeTab === "misconfigs" && (
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

              {/* Controls */}
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    SORT BY:
                  </span>
                  <button
                    onClick={() => handleSort("severity")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "severity" ? "bg-cyber-cyan text-black font-bold" : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    Severity{getSortIcon("severity")}
                  </button>
                  <button
                    onClick={() => handleSort("type")}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sortField === "type" ? "bg-cyber-cyan text-black font-bold" : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                    }`}
                  >
                    {activeTab === "resources" ? "Type" : "Category"}{getSortIcon("type")}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-cyber-cyan flex-shrink-0" />
                  <Input
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                    placeholder={`Filter by ${activeTab === "resources" ? "type or name" : "category or issue"}...`}
                    className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
                  />
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-cyber-cyan tracking-wider">SEVERITY:</span>
                  {["critical", "high", "medium", "low"].map((severity) => (
                    <button
                      key={severity}
                      onClick={() => toggleSeverityFilter(severity)}
                      className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                        severityFilters.has(severity) ? getSeverityColor(severity) : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                      }`}
                    >
                      {severity.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {paginatedItems.map((item, idx) => {
                  const itemKey = isMisconfiguration(item) 
                    ? `misconfig-${item.category}-${item.issue}-${idx}`
                    : `resource-${item.type}-${item.name}-${idx}`;

                  if (isMisconfiguration(item)) {
                    return (
                      <div key={itemKey} className="glass-panel rounded p-4 hover:bg-black/40 transition-colors">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-sm font-bold text-cyber-cyan">{item.issue}</h4>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(item.severity)}`}>
                                {item.severity.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">• {item.category}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-1">Resource: <span className="text-cyber-cyan font-mono">{item.resource}</span></p>
                            <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                            <div className="flex items-start gap-1 p-2 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded">
                              <CheckCircle className="w-3 h-3 text-cyber-cyan mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-cyber-cyan">{item.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={itemKey} className="glass-panel rounded p-4 hover:bg-black/40 transition-colors">
                        <div className="flex items-start gap-3">
                          <Box className="w-5 h-5 text-cyber-cyan flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-sm font-bold text-cyber-cyan">{item.name}</h4>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(item.severity)}`}>
                                {item.severity.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">• {item.type}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">
                              Namespace: <span className="text-cyber-cyan">{item.namespace}</span> • Status: <span className="text-green-400">{item.status}</span>
                            </p>
                            {item.issues.length > 0 && (
                              <div className="p-2 bg-red-500/5 border border-red-500/20 rounded">
                                <p className="text-xs text-red-400 font-semibold mb-1">Issues:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {item.issues.map((issue, iIdx) => (
                                    <li key={iIdx} className="text-xs text-gray-400">{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-cyber-red/20">
                  <Button onClick={goToPrevPage} disabled={currentPage === 1} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-1">
                    {getPageNumbers().map((page, idx) => (
                      <button
                        key={idx}
                        onClick={() => typeof page === "number" && goToPage(page)}
                        disabled={page === "..."}
                        className={`px-3 py-1 min-w-[2.5rem] rounded text-sm font-mono transition-colors ${
                          page === currentPage ? "bg-cyber-red text-white font-bold" : page === "..." ? "text-gray-500 cursor-default" : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <Button onClick={goToNextPage} disabled={currentPage === totalPages} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed" size="sm">
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

export default K8sEnumerator;