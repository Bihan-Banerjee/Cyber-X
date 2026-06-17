import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, FileText, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PDFResult {
  filename: string;
  metadata: Record<string, string>;
  pages: number;
  objects: number;
  javascript: boolean;
  embeddedFiles: string[];
  urls: string[];
  anomalies: string[];
  suspiciousFeatures: Array<{ feature: string; severity: "critical" | "high" | "medium" | "low" }>;
}

const PDFForensics = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PDFResult | null>(null);
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
      const response = await fetch(`${API_BASE_URL}/api/scan/pdf-forensics`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "PDF forensics failed");
    } finally {
      setIsLoading(false);
    }
  };

  const severityColor = (s: string) => ({
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
    high: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    low: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  }[s] ?? "text-gray-400 border-gray-500/30 bg-gray-500/10");

  return (
    <CyberpunkCard title="PDF FORENSICS">
      <div className="space-y-6">
        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <label
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:bg-cyber-cyan/5 transition-colors ${isLoading ? "pointer-events-none opacity-50" : ""}`}
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin text-cyber-cyan" /><span className="text-cyber-cyan">Analyzing...</span></>
            ) : (
              <><Upload className="w-5 h-5 text-cyber-cyan" /><span className="text-cyber-cyan">Upload PDF for forensic analysis</span></>
            )}
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.pages}</p>
                <p className="text-xs text-gray-400 mt-1">Pages</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.objects}</p>
                <p className="text-xs text-gray-400 mt-1">Objects</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.javascript ? "text-red-400" : "text-green-400"}`}>
                  {result.javascript ? "YES" : "NO"}
                </p>
                <p className="text-xs text-gray-400 mt-1">JavaScript</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.suspiciousFeatures.length > 0 ? "text-red-400" : "text-green-400"}`}>
                  {result.suspiciousFeatures.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">Suspicious</p>
              </div>
            </div>

            {result.suspiciousFeatures.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-red-400 font-bold tracking-wide mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  SUSPICIOUS FEATURES
                </h3>
                <div className="space-y-2">
                  {result.suspiciousFeatures.map((f, i) => (
                    <div key={i} className={`px-3 py-2 rounded border text-sm font-bold ${severityColor(f.severity)}`}>
                      <span className={`text-xs uppercase border px-1 py-0.5 rounded mr-2 ${severityColor(f.severity)}`}>{f.severity}</span>
                      {f.feature}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">METADATA</h3>
              <div className="space-y-2">
                {Object.entries(result.metadata).map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-sm py-1 border-b border-cyber-cyan/10 last:border-0">
                    <span className="text-gray-400 w-32 flex-shrink-0">{k}:</span>
                    <span className="text-cyber-cyan font-mono break-all">{v}</span>
                  </div>
                ))}
                {Object.keys(result.metadata).length === 0 && <p className="text-gray-500 text-sm">No metadata found</p>}
              </div>
            </div>

            {result.javascript && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>JavaScript detected in PDF — potential exploit vector</span>
              </div>
            )}

            {result.embeddedFiles.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-orange-400 font-bold tracking-wide mb-3">EMBEDDED FILES</h3>
                {result.embeddedFiles.map((f, i) => (
                  <p key={i} className="text-orange-400 font-mono text-sm">{f}</p>
                ))}
              </div>
            )}

            {result.urls.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">EXTRACTED URLs ({result.urls.length})</h3>
                <div className="max-h-32 overflow-auto space-y-1">
                  {result.urls.map((u, i) => (
                    <p key={i} className="text-cyber-cyan font-mono text-xs">{u}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PDFForensics;
