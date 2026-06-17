import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Globe, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface SecurityHeaderCheck {
  name: string;
  present: boolean;
  value?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  recommendation: string;
}

interface HeaderAnalysisResult {
  url: string;
  statusCode: number;
  responseTime: number;
  headers: Record<string, string>;
  securityHeaders: SecurityHeaderCheck[];
  overallScore: number;
  grade: string;
  scanDuration: number;
}

const HTTPHeaderAnalyzer = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HeaderAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/http-headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), timeoutMs: 10000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Scan failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to HTTP header analyzer service");
    } finally {
      setIsLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade === "A+" || grade === "A") return "text-green-400";
    if (grade === "B") return "text-yellow-400";
    if (grade === "C") return "text-orange-400";
    return "text-red-400";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

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

  const getHeaderCardColor = (check: SecurityHeaderCheck) => {
    if (check.present && check.severity === "info") return "border-green-500/30 bg-green-500/5";
    if (!check.present || check.severity === "critical" || check.severity === "high")
      return "border-red-500/30 bg-red-500/5";
    if (check.severity === "medium") return "border-yellow-500/30 bg-yellow-500/5";
    return "border-blue-500/30 bg-blue-500/5";
  };

  return (
    <CyberpunkCard title="HTTP HEADER ANALYZER">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="https://example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !url.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
            ) : (
              <><Globe className="w-4 h-4 mr-2" />Analyze</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className={`text-3xl font-bold ${getGradeColor(result.grade)}`}>{result.grade}</p>
                <p className="text-xs text-gray-400">Security Grade</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className={`text-2xl font-bold ${getScoreColor(result.overallScore)}`}>{result.overallScore}/100</p>
                <p className="text-xs text-gray-400">Score</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.statusCode}</p>
                <p className="text-xs text-gray-400">HTTP Status</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.responseTime}ms</p>
                <p className="text-xs text-gray-400">Response Time</p>
              </div>
            </div>

            {/* Two-panel layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Raw headers */}
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">
                  RAW HEADERS ({Object.keys(result.headers).length})
                </h3>
                <pre className="bg-black/50 border border-cyber-cyan/20 rounded p-3 text-xs font-mono text-gray-300 overflow-y-auto max-h-96 whitespace-pre-wrap">
                  {Object.entries(result.headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")}
                </pre>
              </div>

              {/* Security audit */}
              <div>
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">
                  SECURITY AUDIT
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {result.securityHeaders.map((check, i) => (
                    <div key={i} className={`p-3 rounded border ${getHeaderCardColor(check)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {check.present && check.severity === "info" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        ) : !check.present ? (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        )}
                        <span className="text-sm font-bold text-gray-200">{check.name}</span>
                        {!check.present && (
                          <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-bold border ${getSeverityColor(check.severity)}`}>
                            MISSING
                          </span>
                        )}
                      </div>
                      {check.value && (
                        <p className="text-xs font-mono text-cyber-cyan ml-6 mb-1 break-all">{check.value}</p>
                      )}
                      {(!check.present || check.severity !== "info") && (
                        <p className="text-xs text-gray-400 ml-6">{check.recommendation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default HTTPHeaderAnalyzer;
