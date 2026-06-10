import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, AlertTriangle, Plus, Trash2, ShieldOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CredentialResult {
  username: string;
  success: boolean;
  statusCode?: number;
  responseTime?: number;
}

interface CheckResult {
  target: string;
  results: CredentialResult[];
  tested: number;
  found: number;
}

const CredentialChecker = () => {
  const [agreed, setAgreed] = useState(false);
  const [target, setTarget] = useState("");
  const [loginPath, setLoginPath] = useState("/login");
  const [credentials, setCredentials] = useState([{ username: "", password: "" }]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => setCredentials([...credentials, { username: "", password: "" }]);
  const removeRow = (i: number) => setCredentials(credentials.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: "username" | "password", val: string) => {
    const rows = [...credentials];
    rows[i] = { ...rows[i], [field]: val };
    setCredentials(rows);
  };

  const handleCheck = async () => {
    if (!target.trim() || !agreed) return;
    const validCreds = credentials.filter((c) => c.username.trim() && c.password.trim());
    if (validCreds.length === 0) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/credential-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: validCreds, target: target.trim(), loginPath }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Check failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Credential check failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="CREDENTIAL CHECKER">
      <div className="space-y-6">
        <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold text-sm">AUTHORIZED USE ONLY</p>
              <p className="text-red-300 text-xs mt-1">
                This tool is exclusively for authorized penetration testing. Unauthorized credential testing is illegal under computer fraud laws globally.
                You must have written authorization from the system owner before proceeding.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 accent-red-400"
            />
            <span className="text-red-300 text-sm font-bold">I own this system or have explicit written authorization to test it</span>
          </label>
        </div>

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
          Rate limiting is enforced server-side. Excessive requests will be blocked automatically.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">TARGET URL</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://example.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={!agreed || isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">LOGIN PATH</label>
            <Input
              value={loginPath}
              onChange={(e) => setLoginPath(e.target.value)}
              placeholder="/login"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={!agreed || isLoading}
            />
          </div>
        </div>

        <div className={`space-y-3 ${!agreed ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-cyber-cyan font-bold tracking-wide">CREDENTIALS</h3>
            <Button onClick={addRow} size="sm" className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30">
              <Plus className="w-3 h-3 mr-1" />Add
            </Button>
          </div>
          {credentials.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={row.username}
                onChange={(e) => updateRow(i, "username", e.target.value)}
                placeholder="username"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs"
                disabled={isLoading}
              />
              <Input
                type="password"
                value={row.password}
                onChange={(e) => updateRow(i, "password", e.target.value)}
                placeholder="password"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs"
                disabled={isLoading}
              />
              <Button onClick={() => removeRow(i)} size="sm" className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2" disabled={credentials.length <= 1}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          onClick={handleCheck}
          disabled={isLoading || !agreed || !target.trim() || credentials.every((c) => !c.username.trim())}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing Credentials...</> : <><ShieldOff className="w-4 h-4 mr-2" />Test Credentials</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.tested}</p>
                <p className="text-xs text-gray-400 mt-1">Tested</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.found > 0 ? "text-red-400" : "text-green-400"}`}>{result.found}</p>
                <p className="text-xs text-gray-400 mt-1">Valid Credentials</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.tested - result.found}</p>
                <p className="text-xs text-gray-400 mt-1">Failed</p>
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RESULTS</h3>
              <div className="space-y-2">
                {result.results.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded border ${r.success ? "bg-red-500/10 border-red-500/30" : "bg-gray-500/5 border-gray-500/20"}`}>
                    <span className={`font-mono text-sm ${r.success ? "text-red-400 font-bold" : "text-gray-400"}`}>{r.username}</span>
                    <div className="flex items-center gap-3">
                      {r.responseTime && <span className="text-xs text-gray-500">{r.responseTime}ms</span>}
                      {r.statusCode && <span className="text-xs font-mono text-gray-400">{r.statusCode}</span>}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${r.success ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}>
                        {r.success ? "VALID" : "FAILED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CredentialChecker;
