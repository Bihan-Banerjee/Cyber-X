import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, CheckCircle, XCircle, Search } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CookieDetail {
  name: string;
  value?: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  expires: string;
  size: number;
  issues: string[];
}

interface CookieIssue {
  severity: string;
  description: string;
  cookie: string;
}

interface CookieAnalysisResult {
  url: string;
  cookies: CookieDetail[];
  issues: CookieIssue[];
  overallScore: number;
}

const getSeverityColor = (s: string) => ({
  critical: "bg-red-500/20 text-red-400 border-red-500/50",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  info: "bg-gray-500/20 text-gray-400 border-gray-500/50",
}[s] || "bg-gray-500/20 text-gray-400 border-gray-500/50");

const CookieAnalyzer = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CookieAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/cookie-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to analyze cookies");
    } finally {
      setIsLoading(false);
    }
  };

  const Flag = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-1">
      {ok ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
      <span className={`text-xs ${ok ? "text-green-400" : "text-red-400"}`}>{label}</span>
    </div>
  );

  return (
    <CyberpunkCard title="COOKIE ANALYZER">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="https://example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading} />
          <Button onClick={handleAnalyze} disabled={isLoading || !url.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.cookies.length}</p>
                <p className="text-xs text-gray-400">Cookies Found</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{result.issues.length}</p>
                <p className="text-xs text-gray-400">Issues Found</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className={`text-2xl font-bold ${result.overallScore >= 80 ? "text-green-400" : result.overallScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {result.overallScore}/100
                </p>
                <p className="text-xs text-gray-400">Security Score</p>
              </div>
            </div>

            {result.issues.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">ISSUES</h3>
                {result.issues.map((issue, i) => (
                  <div key={i} className={`p-3 rounded border ${getSeverityColor(issue.severity)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">Cookie: <code className="font-mono">{issue.cookie}</code></span>
                    </div>
                    <p className="text-sm">{issue.description}</p>
                  </div>
                ))}
              </div>
            )}

            {result.cookies.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">COOKIES</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-cyber-cyan/20">
                        <th className="text-left text-cyber-cyan tracking-wider py-2 pr-3">NAME</th>
                        <th className="text-left text-cyber-cyan tracking-wider py-2 pr-3">HttpOnly</th>
                        <th className="text-left text-cyber-cyan tracking-wider py-2 pr-3">Secure</th>
                        <th className="text-left text-cyber-cyan tracking-wider py-2 pr-3">SameSite</th>
                        <th className="text-left text-cyber-cyan tracking-wider py-2">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.cookies.map((c, i) => (
                        <tr key={i} className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5">
                          <td className="py-2 pr-3 font-mono text-cyber-cyan">{c.name}</td>
                          <td className="py-2 pr-3"><Flag ok={c.httpOnly} label={c.httpOnly ? "Yes" : "No"} /></td>
                          <td className="py-2 pr-3"><Flag ok={c.secure} label={c.secure ? "Yes" : "No"} /></td>
                          <td className="py-2 pr-3">
                            <span className={`px-1 rounded ${c.sameSite === "Strict" ? "text-green-400" : c.sameSite === "Lax" ? "text-yellow-400" : "text-red-400"}`}>
                              {c.sameSite || "None"}
                            </span>
                          </td>
                          <td className="py-2 text-gray-400">{c.expires || "Session"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CookieAnalyzer;
