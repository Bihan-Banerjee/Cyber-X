import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, FileText } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface LogAnomaly {
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  count?: number;
  sourceIP?: string;
}

interface LogResult {
  logType: string;
  totalLines: number;
  errorCount: number;
  warningCount: number;
  anomalies: LogAnomaly[];
  topIPs: Array<{ ip: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

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

const LogAnalyzer = () => {
  const [logType, setLogType] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("logType", logType);
      const response = await fetch(`${API_BASE_URL}/api/scan/log-analyze`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Log analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="LOG ANALYZER">
      <div className="space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">LOG TYPE</label>
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value)}
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm"
              disabled={isLoading}
            >
              {["auto", "apache", "nginx", "auth", "syslog", "iis"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".log,.txt,.gz"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <label
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-6 py-2 rounded cursor-pointer font-bold text-sm border transition-colors ${isLoading ? "opacity-50 pointer-events-none" : "bg-cyber-red hover:bg-cyber-red/80 text-white border-transparent"}`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isLoading ? "Analyzing..." : "Upload Log File"}
            </label>
          </div>
        </div>

        {fileName && !isLoading && !result && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FileText className="w-4 h-4" />
            {fileName}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.totalLines.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Total Lines</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{result.errorCount.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Errors</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">{result.warningCount.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Warnings</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.anomalies.length > 0 ? "text-orange-400" : "text-green-400"}`}>
                  {result.anomalies.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">Anomalies</p>
              </div>
            </div>

            <div className="glass-panel rounded p-2 text-center">
              <span className="text-xs text-gray-400">Detected format: </span>
              <span className="text-cyber-cyan font-bold text-xs uppercase">{result.logType}</span>
            </div>

            {result.anomalies.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">ANOMALIES ({result.anomalies.length})</h3>
                <div className="space-y-2">
                  {result.anomalies.map((a, i) => (
                    <div key={i} className={`p-3 rounded border ${getSeverityColor(a.severity)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(a.severity)}`}>
                          {a.severity.toUpperCase()}
                        </span>
                        <span className="text-sm font-bold">{a.type}</span>
                        {a.count && <span className="text-xs text-gray-400">({a.count}x)</span>}
                      </div>
                      <p className="text-xs text-gray-300">{a.description}</p>
                      {a.sourceIP && <p className="text-xs font-mono mt-1">Source: {a.sourceIP}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.topIPs.length > 0 && (
                <div className="glass-panel rounded p-4">
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">TOP IPs</h3>
                  <div className="space-y-1">
                    {result.topIPs.slice(0, 10).map((ip, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-0.5">
                        <span className="font-mono text-cyber-cyan">{ip.ip}</span>
                        <span className="text-gray-400">{ip.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.topPaths.length > 0 && (
                <div className="glass-panel rounded p-4">
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">TOP PATHS</h3>
                  <div className="space-y-1">
                    {result.topPaths.slice(0, 10).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-0.5">
                        <span className="font-mono text-cyber-cyan truncate max-w-[70%]">{p.path}</span>
                        <span className="text-gray-400">{p.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default LogAnalyzer;
