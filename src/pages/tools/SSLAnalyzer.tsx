import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ShieldCheck, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface SSLVulnerability {
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  recommendation: string;
}

interface SSLScanResult {
  domain: string;
  certificate: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    daysRemaining: number;
    selfSigned: boolean;
    sans: string[];
    serialNumber: string;
    signatureAlgorithm: string;
  };
  cipherSuites: string[];
  protocolVersions: string[];
  hstsEnabled: boolean;
  hstsMaxAge: number | null;
  vulnerabilities: SSLVulnerability[];
  overallGrade: string;
  scanDuration: number;
}

const SSLAnalyzer = () => {
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SSLScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/ssl-analyzer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), timeoutMs: 15000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Scan failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to SSL analyzer service");
    } finally {
      setIsLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade === "A+" || grade === "A") return "text-green-400";
    if (grade === "B+" || grade === "B") return "text-yellow-400";
    if (grade === "C") return "text-orange-400";
    return "text-red-400";
  };

  const getGradeBg = (grade: string) => {
    if (grade === "A+" || grade === "A") return "bg-green-500/20 border-green-500/50";
    if (grade === "B+" || grade === "B") return "bg-yellow-500/20 border-yellow-500/50";
    if (grade === "C") return "bg-orange-500/20 border-orange-500/50";
    return "bg-red-500/20 border-red-500/50";
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

  const downloadResults = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ssl_analysis_${result.domain}_${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <CyberpunkCard title="SSL / TLS ANALYZER">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !domain.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
            ) : (
              <><ShieldCheck className="w-4 h-4 mr-2" />Scan</>
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
            {/* Grade + summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`glass-panel rounded p-4 text-center border ${getGradeBg(result.overallGrade)}`}>
                <p className={`text-4xl font-bold ${getGradeColor(result.overallGrade)}`}>
                  {result.overallGrade}
                </p>
                <p className="text-xs text-gray-400 mt-1">Overall Grade</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.certificate.daysRemaining > 30 ? "text-green-400" : result.certificate.daysRemaining > 7 ? "text-yellow-400" : "text-red-400"}`}>
                  {result.certificate.daysRemaining}
                </p>
                <p className="text-xs text-gray-400 mt-1">Days Remaining</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.hstsEnabled ? "text-green-400" : "text-red-400"}`}>
                  {result.hstsEnabled ? "YES" : "NO"}
                </p>
                <p className="text-xs text-gray-400 mt-1">HSTS Enabled</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.vulnerabilities.length === 0 ? "text-green-400" : "text-red-400"}`}>
                  {result.vulnerabilities.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">Issues Found</p>
              </div>
            </div>

            {/* Certificate details */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">CERTIFICATE DETAILS</h3>
              <div className="space-y-2">
                {[
                  { label: "Subject", value: result.certificate.subject },
                  { label: "Issuer", value: result.certificate.issuer },
                  { label: "Valid From", value: result.certificate.validFrom },
                  { label: "Valid To", value: result.certificate.validTo },
                  { label: "Self-Signed", value: result.certificate.selfSigned ? "Yes (⚠ Untrusted)" : "No" },
                  { label: "Signature Algorithm", value: result.certificate.signatureAlgorithm },
                  { label: "Serial Number", value: result.certificate.serialNumber },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 text-sm py-1 border-b border-cyber-cyan/10 last:border-0">
                    <span className="text-gray-400 w-36 flex-shrink-0">{label}:</span>
                    <span className="text-cyber-cyan font-mono break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SANs */}
            {result.certificate.sans.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">
                  SUBJECT ALTERNATIVE NAMES ({result.certificate.sans.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.certificate.sans.map((san, i) => (
                    <span key={i} className="px-2 py-1 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-xs text-cyber-cyan font-mono">
                      {san}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Protocol & cipher */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-2">PROTOCOL</h3>
                {result.protocolVersions.map((p, i) => (
                  <span key={i} className={`px-2 py-1 rounded text-xs font-bold border ${
                    p === "TLSv1.3" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                    p === "TLSv1.2" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                    "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}>{p}</span>
                ))}
              </div>
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-2">CIPHER SUITE</h3>
                {result.cipherSuites.map((c, i) => (
                  <p key={i} className="text-cyber-cyan font-mono text-xs">{c}</p>
                ))}
              </div>
            </div>

            {/* Vulnerabilities */}
            {result.vulnerabilities.length > 0 && (
              <div>
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">
                  VULNERABILITIES ({result.vulnerabilities.length})
                </h3>
                <div className="space-y-2">
                  {result.vulnerabilities.map((v, i) => (
                    <div key={i} className={`p-3 rounded border ${getSeverityColor(v.severity)}`}>
                      <div className="flex items-start gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 ${getSeverityColor(v.severity)}`}>
                          {v.severity.toUpperCase()}
                        </span>
                        <p className="text-sm text-gray-200">{v.description}</p>
                      </div>
                      <p className="text-xs text-green-400 ml-14">↳ {v.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.vulnerabilities.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>No vulnerabilities detected. SSL/TLS configuration looks good!</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-cyber-cyan/10">
              <span>Scan duration: {result.scanDuration}s</span>
              <Button onClick={downloadResults} className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default SSLAnalyzer;
