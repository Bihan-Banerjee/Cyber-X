import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, Shield, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface HardcodedString {
  type: string;
  value: string;
  severity: "critical" | "high" | "medium" | "low";
}

interface APKAnalysisResult {
  filename: string;
  fileSize: number;
  packageName: string;
  version: string;
  permissions: string[];
  activities: string[];
  services: string[];
  receivers: string[];
  hardcodedStrings: HardcodedString[];
  urls: string[];
  dangerousPermissions: string[];
  zipEntries: string[];
  analysisNotes: string[];
}

type Tab = "permissions" | "strings" | "components" | "files";

const APKAnalyzer = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<APKAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("permissions");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const analyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/scan/apk-analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze APK");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (s: string) => {
    if (s === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (s === "high") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (s === "medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  const tabClass = (t: Tab) =>
    `px-3 py-1.5 text-xs font-bold tracking-wide transition-colors rounded ${
      activeTab === t ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
    }`;

  return (
    <CyberpunkCard title="APK ANALYZER">
      <div className="space-y-6">
        <div className="glass-panel rounded p-4 space-y-3">
          <label className="block text-sm text-cyber-cyan tracking-wide">UPLOAD APK FILE</label>

          <div
            className="border-2 border-dashed border-cyber-cyan/30 rounded p-6 text-center cursor-pointer hover:border-cyber-cyan/60 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-cyber-cyan/50 mx-auto mb-2" />
            <p className="text-cyber-cyan text-sm">{selectedFile ? selectedFile.name : "Click to select APK file"}</p>
            {selectedFile && (
              <p className="text-gray-500 text-xs mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".apk"
            className="hidden"
            onChange={handleFileSelect}
          />

          <Button
            onClick={analyze}
            disabled={isAnalyzing || !selectedFile}
            className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            {isAnalyzing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />ANALYZING APK...</>
            ) : (
              <><Shield className="mr-2 h-4 w-4" />ANALYZE APK</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">ANALYSIS SUMMARY</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Package</p>
                  <p className="text-cyber-cyan font-mono text-xs break-all">{result.packageName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Version</p>
                  <p className="text-cyber-cyan font-mono">{result.version}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">File Size</p>
                  <p className="text-cyber-cyan font-mono">{(result.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">ZIP Entries</p>
                  <p className="text-cyber-cyan font-mono">{result.zipEntries.length}</p>
                </div>
              </div>

              {result.analysisNotes.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.analysisNotes.map((note, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dangerous Permissions Banner */}
            {result.dangerousPermissions.length > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                <p className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {result.dangerousPermissions.length} DANGEROUS PERMISSIONS DETECTED
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.dangerousPermissions.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-mono font-bold">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
              <button className={tabClass("permissions")} onClick={() => setActiveTab("permissions")}>
                PERMISSIONS ({result.permissions.length})
              </button>
              <button className={tabClass("strings")} onClick={() => setActiveTab("strings")}>
                STRINGS ({result.hardcodedStrings.length})
              </button>
              <button className={tabClass("components")} onClick={() => setActiveTab("components")}>
                COMPONENTS
              </button>
              <button className={tabClass("files")} onClick={() => setActiveTab("files")}>
                FILES ({result.zipEntries.length})
              </button>
            </div>

            {/* Permission tab */}
            {activeTab === "permissions" && (
              <div className="space-y-2">
                {result.permissions.length === 0 && <p className="text-gray-500 text-sm">No permissions extracted (binary manifest).</p>}
                {result.permissions.map((perm, i) => {
                  const isDangerous = result.dangerousPermissions.includes(perm);
                  return (
                    <div key={i} className={`p-2 rounded border flex items-center gap-2 ${isDangerous ? "bg-red-500/10 border-red-500/30" : "bg-gray-500/5 border-gray-500/20"}`}>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${isDangerous ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                        {isDangerous ? "DANGEROUS" : "NORMAL"}
                      </span>
                      <code className={`text-xs font-mono ${isDangerous ? "text-red-300" : "text-gray-300"}`}>{perm}</code>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Strings tab */}
            {activeTab === "strings" && (
              <div className="space-y-2">
                {result.hardcodedStrings.length === 0 && <p className="text-gray-500 text-sm">No hardcoded strings found.</p>}
                {result.hardcodedStrings.map((s, i) => (
                  <div key={i} className={`p-3 rounded border ${getSeverityColor(s.severity)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(s.severity)}`}>{s.severity.toUpperCase()}</span>
                      <span className="text-xs font-bold">{s.type}</span>
                    </div>
                    <code className="text-xs font-mono break-all opacity-80">{s.value}</code>
                  </div>
                ))}

                {result.urls.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-cyber-cyan font-bold text-xs tracking-wider mb-2">URLS FOUND ({result.urls.length})</h4>
                    {result.urls.map((url, i) => (
                      <div key={i} className="p-2 bg-blue-500/5 border border-blue-500/20 rounded mb-1">
                        <code className="text-blue-400 text-xs font-mono break-all">{url}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Components tab */}
            {activeTab === "components" && (
              <div className="space-y-4">
                {[
                  { label: "ACTIVITIES", items: result.activities },
                  { label: "SERVICES", items: result.services },
                  { label: "RECEIVERS", items: result.receivers },
                ].map(({ label, items }) => (
                  <div key={label}>
                    <h4 className="text-cyber-cyan font-bold text-xs tracking-wider mb-2">{label} ({items.length})</h4>
                    {items.length === 0 ? (
                      <p className="text-gray-500 text-xs">None detected</p>
                    ) : (
                      <div className="space-y-1">
                        {items.map((item, i) => (
                          <div key={i} className="p-2 bg-gray-500/5 border border-gray-500/20 rounded">
                            <code className="text-gray-300 text-xs font-mono">{item}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Files tab */}
            {activeTab === "files" && (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {result.zipEntries.map((entry, i) => (
                  <div key={i} className="px-3 py-1 hover:bg-black/20 rounded">
                    <code className="text-gray-300 text-xs font-mono">{entry}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default APKAnalyzer;
