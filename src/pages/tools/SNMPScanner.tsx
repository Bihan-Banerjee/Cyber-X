import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Radio } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface SNMPResult {
  target: string;
  community: string;
  reachable: boolean;
  systemInfo: Record<string, string>;
  oids: Array<{ oid: string; value: string }>;
  vulnerabilities: Array<{ severity: string; description: string }>;
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

const SNMPScanner = () => {
  const [target, setTarget] = useState("");
  const [community, setCommunity] = useState("public");
  const [version, setVersion] = useState("2c");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SNMPResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!target.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/snmp-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), community, version, timeoutMs: 10000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Scan failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "SNMP scan failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="SNMP SCANNER">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">TARGET</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="192.168.1.1"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">COMMUNITY STRING</label>
            <Input
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              placeholder="public"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">SNMP VERSION</label>
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm"
              disabled={isLoading}
            >
              <option value="1">v1</option>
              <option value="2c">v2c</option>
              <option value="3">v3</option>
            </select>
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !target.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</> : <><Radio className="w-4 h-4 mr-2" />Scan SNMP</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.reachable ? "text-green-400" : "text-red-400"}`}>
                  {result.reachable ? "REACHABLE" : "UNREACHABLE"}
                </p>
                <p className="text-xs text-gray-400 mt-1">SNMP Status</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.vulnerabilities.length > 0 ? "text-red-400" : "text-green-400"}`}>
                  {result.vulnerabilities.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">Vulnerabilities</p>
              </div>
            </div>

            {community === "public" && (
              <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded text-orange-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Default community string "public" detected — this is a known vulnerability.</span>
              </div>
            )}

            {Object.keys(result.systemInfo).length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">DEVICE INFORMATION</h3>
                <div className="space-y-2">
                  {Object.entries(result.systemInfo).map(([key, value]) => (
                    <div key={key} className="flex gap-3 text-sm py-1 border-b border-cyber-cyan/10 last:border-0">
                      <span className="text-gray-400 w-32 flex-shrink-0">{key}:</span>
                      <span className="text-cyber-cyan font-mono break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.vulnerabilities.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">VULNERABILITIES</h3>
                <div className="space-y-2">
                  {result.vulnerabilities.map((v, i) => (
                    <div key={i} className={`p-3 rounded border ${getSeverityColor(v.severity)}`}>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border mr-2 ${getSeverityColor(v.severity)}`}>
                        {v.severity.toUpperCase()}
                      </span>
                      {v.description}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.oids.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">OID VALUES ({result.oids.length})</h3>
                <div className="max-h-48 overflow-auto space-y-1">
                  {result.oids.map((oid, i) => (
                    <div key={i} className="flex gap-2 text-xs font-mono py-0.5 border-b border-cyber-cyan/5 last:border-0">
                      <span className="text-gray-400 w-48 flex-shrink-0 truncate">{oid.oid}</span>
                      <span className="text-cyber-cyan">{oid.value}</span>
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

export default SNMPScanner;
