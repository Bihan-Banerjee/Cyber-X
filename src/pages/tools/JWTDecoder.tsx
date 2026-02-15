import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Key, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Copy, Check } from "lucide-react";

interface JWTAnalysisResult {
  valid: boolean;
  header: any;
  payload: any;
  signature: string;
  algorithm: string;
  issuer?: string;
  subject?: string;
  audience?: string;
  expiresAt?: number;
  issuedAt?: number;
  notBefore?: number;
  isExpired: boolean;
  timeUntilExpiry?: string;
  vulnerabilities: Array<{
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    recommendation: string;
  }>;
  securityScore: number;
  riskLevel: string;
}

const JWTDecoder = () => {
  const [token, setToken] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<JWTAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!token.trim()) return;

    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("http://localhost:5000/api/scan/jwt-decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to decode JWT");
    } finally {
      setIsAnalyzing(false);
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

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/50",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    };
    return colors[severity] || colors.low;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "text-red-400",
      HIGH: "text-orange-400",
      MEDIUM: "text-yellow-400",
      LOW: "text-green-400",
    };
    return colors[level] || "text-gray-400";
  };

  const formatJSON = (obj: any) => JSON.stringify(obj, null, 2);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <CyberpunkCard title="JWT DECODER & ANALYZER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              JWT TOKEN
            </label>
            <Textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono text-xs h-32"
              disabled={isAnalyzing}
            />
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !token.trim()}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ANALYZING JWT...
              </>
            ) : (
              <>
                <Key className="mr-2 h-4 w-4" />
                DECODE & ANALYZE JWT
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
            <p className="font-semibold text-cyber-cyan mb-1">ℹ️ JWT Security Analysis</p>
            <p>Decodes JSON Web Tokens and analyzes for security vulnerabilities including algorithm confusion, weak secrets, expired tokens, and misconfigurations.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-6">
            {/* Status Overview */}
            <div className="glass-panel rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {result.valid ? (
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-400" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-cyber-cyan">Token Analysis</h3>
                    <p className={`text-sm font-semibold ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                      {result.valid ? 'Valid JWT Structure' : 'Invalid JWT'}
                    </p>
                  </div>
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className={`p-3 rounded text-center ${result.isExpired ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  {result.isExpired ? (
                    <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  )}
                  <p className={`text-sm font-bold ${result.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                    {result.isExpired ? 'EXPIRED' : 'VALID'}
                  </p>
                  <p className="text-xs text-gray-400">Token Status</p>
                </div>
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                  <p className="text-sm font-bold text-cyber-cyan">{result.algorithm}</p>
                  <p className="text-xs text-gray-400">Algorithm</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                  <p className="text-sm font-bold text-purple-400">{result.vulnerabilities.length}</p>
                  <p className="text-xs text-gray-400">Vulnerabilities</p>
                </div>
              </div>

              {result.timeUntilExpiry && (
                <div className="mt-4 pt-4 border-t border-cyber-red/20 text-sm text-gray-400">
                  Time until expiry: <span className="text-cyber-cyan">{result.timeUntilExpiry}</span>
                </div>
              )}
            </div>

            {/* Header */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-cyber-cyan">HEADER</h3>
                <button
                  onClick={() => copyToClipboard(formatJSON(result.header), "header")}
                  className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                >
                  {copiedField === "header" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-cyber-cyan" />
                  )}
                </button>
              </div>
              <pre className="text-xs text-gray-400 bg-black/30 p-3 rounded overflow-x-auto font-mono">
                {formatJSON(result.header)}
              </pre>
            </div>

            {/* Payload */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-cyber-cyan">PAYLOAD</h3>
                <button
                  onClick={() => copyToClipboard(formatJSON(result.payload), "payload")}
                  className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                >
                  {copiedField === "payload" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-cyber-cyan" />
                  )}
                </button>
              </div>
              <pre className="text-xs text-gray-400 bg-black/30 p-3 rounded overflow-x-auto font-mono">
                {formatJSON(result.payload)}
              </pre>

              {/* Token Claims */}
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-bold text-cyber-cyan">Standard Claims:</h4>
                <div className="grid md:grid-cols-2 gap-2 text-xs">
                  {result.issuer && (
                    <div className="p-2 bg-black/30 rounded">
                      <span className="text-gray-500">Issuer (iss):</span>
                      <span className="text-cyber-cyan ml-2">{result.issuer}</span>
                    </div>
                  )}
                  {result.subject && (
                    <div className="p-2 bg-black/30 rounded">
                      <span className="text-gray-500">Subject (sub):</span>
                      <span className="text-cyber-cyan ml-2">{result.subject}</span>
                    </div>
                  )}
                  {result.audience && (
                    <div className="p-2 bg-black/30 rounded">
                      <span className="text-gray-500">Audience (aud):</span>
                      <span className="text-cyber-cyan ml-2">{result.audience}</span>
                    </div>
                  )}
                  {result.issuedAt && (
                    <div className="p-2 bg-black/30 rounded">
                      <span className="text-gray-500">Issued At (iat):</span>
                      <span className="text-cyber-cyan ml-2">{formatTimestamp(result.issuedAt)}</span>
                    </div>
                  )}
                  {result.expiresAt && (
                    <div className="p-2 bg-black/30 rounded">
                      <span className="text-gray-500">Expires At (exp):</span>
                      <span className="text-cyber-cyan ml-2">{formatTimestamp(result.expiresAt)}</span>
                    </div>
                  )}
                  {result.notBefore && (
                    <div className="p-2 bg-black/30 rounded">
                      <span className="text-gray-500">Not Before (nbf):</span>
                      <span className="text-cyber-cyan ml-2">{formatTimestamp(result.notBefore)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signature */}
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-cyber-cyan">SIGNATURE</h3>
                <button
                  onClick={() => copyToClipboard(result.signature, "signature")}
                  className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                >
                  {copiedField === "signature" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-cyber-cyan" />
                  )}
                </button>
              </div>
              <pre className="text-xs text-gray-400 bg-black/30 p-3 rounded overflow-x-auto font-mono break-all">
                {result.signature}
              </pre>
            </div>

            {/* Vulnerabilities */}
            {result.vulnerabilities.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-lg font-bold text-cyber-cyan mb-4">SECURITY VULNERABILITIES</h3>
                <div className="space-y-3">
                  {result.vulnerabilities.map((vuln, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-black/30 rounded hover:bg-black/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm font-bold text-cyber-cyan">{vuln.type}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(vuln.severity)}`}>
                              {vuln.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{vuln.description}</p>
                          <div className="flex items-start gap-1 p-2 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded">
                            <CheckCircle className="w-3 h-3 text-cyber-cyan mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-cyber-cyan">{vuln.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
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

export default JWTDecoder;
