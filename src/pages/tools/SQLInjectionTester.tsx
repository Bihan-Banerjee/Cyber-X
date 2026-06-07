import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck, Database } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface SQLiResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  injectionType?: "error-based" | "boolean-blind" | "time-based";
  payloadUsed?: string;
  dbType?: string;
  recommendations: string[];
  scanDuration: number;
}

const SQLInjectionTester = () => {
  const [url, setUrl] = useState("");
  const [parameter, setParameter] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SQLiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!url.trim() || !parameter.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/sqli-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), parameter: parameter.trim(), method, timeoutMs: 12000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Test failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to SQL injection tester service");
    } finally {
      setIsLoading(false);
    }
  };

  const injectionTypeLabel: Record<string, string> = {
    "error-based": "Error-Based",
    "boolean-blind": "Boolean Blind",
    "time-based": "Time-Based",
  };

  return (
    <CyberpunkCard title="SQL INJECTION TESTER">
      <div className="space-y-6">
        {/* Warning */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
          ⚠ Only test applications you own or have explicit written permission to test.
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TARGET URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page.php"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PARAMETER TO TEST</label>
            <Input
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              placeholder="id"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">HTTP METHOD</label>
            <div className="flex gap-2">
              {(["GET", "POST"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  disabled={isLoading}
                  className={`flex-1 py-2 rounded text-sm font-bold tracking-wider transition-colors border ${
                    method === m
                      ? "bg-cyber-cyan text-black border-cyber-cyan"
                      : "bg-transparent text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleTest}
            disabled={isLoading || !url.trim() || !parameter.trim()}
            className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing (may take up to 30s)...</>
            ) : (
              <><Database className="w-4 h-4 mr-2" />RUN SQL INJECTION TEST</>
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
            {/* Verdict */}
            <div className={`flex items-center gap-4 p-6 rounded border ${
              result.vulnerable
                ? "bg-red-500/20 border-red-500/30 text-red-400"
                : "bg-green-500/20 border-green-500/30 text-green-400"
            }`}>
              {result.vulnerable ? (
                <ShieldAlert className="w-10 h-10 flex-shrink-0" />
              ) : (
                <ShieldCheck className="w-10 h-10 flex-shrink-0" />
              )}
              <div>
                <p className="text-2xl font-bold tracking-widest">
                  {result.vulnerable ? "VULNERABLE" : "NOT DETECTED"}
                </p>
                <p className="text-sm opacity-80 mt-0.5">
                  {result.vulnerable
                    ? `SQL injection detected in parameter "${result.parameter}"`
                    : "No SQL injection vulnerability detected with tested payloads"}
                </p>
              </div>
            </div>

            {/* Injection details */}
            {result.vulnerable && (
              <div className="glass-panel rounded p-4 space-y-3">
                <h3 className="text-cyber-cyan font-bold tracking-wide">VULNERABILITY DETAILS</h3>
                <div className="space-y-2">
                  {[
                    { label: "Injection Type", value: result.injectionType ? injectionTypeLabel[result.injectionType] : undefined },
                    { label: "Database Type", value: result.dbType },
                    { label: "Payload Used", value: result.payloadUsed },
                    { label: "Parameter", value: result.parameter },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex gap-3 text-sm">
                      <span className="text-gray-400 w-32 flex-shrink-0">{label}:</span>
                      <span className="text-red-400 font-mono break-all">{value}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RECOMMENDATIONS</h3>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">✓</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-gray-500 text-right">Scan duration: {result.scanDuration}s</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default SQLInjectionTester;
