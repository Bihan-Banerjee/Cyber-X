import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ShieldAlert, CheckCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface SSRFResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  successfulPayloads: string[];
  internalResponseDetected: boolean;
  recommendations: string[];
  scanDuration: number;
}

const PAYLOAD_LIBRARY = [
  { category: "Internal Network", payloads: ["http://127.0.0.1/", "http://localhost/", "http://0.0.0.0/", "http://192.168.0.1/", "http://10.0.0.1/"] },
  { category: "Cloud Metadata", payloads: ["http://169.254.169.254/latest/meta-data/", "http://169.254.169.254/latest/meta-data/iam/security-credentials/", "http://metadata.google.internal/computeMetadata/v1/"] },
  { category: "IPv6 Variants", payloads: ["http://[::1]/", "http://[0:0:0:0:0:0:0:1]/", "http://[::ffff:127.0.0.1]/"] },
  { category: "URL Scheme Variants", payloads: ["http://2130706433/", "http://0177.0.0.1/", "file:///etc/passwd", "gopher://127.0.0.1:25/"] },
];

const SSRFTester = () => {
  const [url, setUrl] = useState("");
  const [parameter, setParameter] = useState("url");
  const [tab, setTab] = useState<"scan" | "payloads">("scan");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SSRFResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!url.trim() || !parameter.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/ssrf-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), parameter: parameter.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Test failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to test for SSRF");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="SSRF TESTER">
      <div className="space-y-5">
        <div className="flex gap-2">
          {(["scan", "payloads"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-sm font-bold transition-colors uppercase ${
                tab === t ? "bg-cyber-red text-white" : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30"
              }`}>
              {t === "scan" ? "Active Scan" : "Payload Library"}
            </button>
          ))}
        </div>

        {tab === "scan" && (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TARGET URL</label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/fetch"
                  className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan" disabled={isLoading} />
              </div>
              <div>
                <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PARAMETER NAME</label>
                <Input value={parameter} onChange={(e) => setParameter(e.target.value)}
                  placeholder="url"
                  className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan" disabled={isLoading} />
              </div>
              <Button onClick={handleTest} disabled={isLoading || !url.trim()}
                className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Testing...</> : "Test for SSRF"}
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
                <div className={`glass-panel rounded p-6 text-center ${result.vulnerable ? "border border-red-500/50" : "border border-green-500/30"}`}>
                  {result.vulnerable ? (
                    <><ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-400">VULNERABLE</p>
                    <p className="text-sm text-gray-400 mt-1">SSRF vulnerability detected</p></>
                  ) : (
                    <><CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">NOT DETECTED</p>
                    <p className="text-sm text-gray-400 mt-1">No SSRF signals found with tested payloads</p></>
                  )}
                </div>
                {result.successfulPayloads.length > 0 && (
                  <div className="glass-panel rounded p-4">
                    <h3 className="text-red-400 font-bold tracking-wide mb-2 text-sm">SUCCESSFUL PAYLOADS</h3>
                    {result.successfulPayloads.map((p, i) => (
                      <code key={i} className="block text-xs text-red-300 font-mono bg-red-500/10 rounded p-2 mb-1">{p}</code>
                    ))}
                  </div>
                )}
                {result.recommendations.length > 0 && (
                  <div className="glass-panel rounded p-4">
                    <h3 className="text-cyber-cyan font-bold tracking-wide mb-2 text-sm">RECOMMENDATIONS</h3>
                    {result.recommendations.map((r, i) => (
                      <p key={i} className="text-sm text-gray-300 mb-1">• {r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "payloads" && (
          <div className="space-y-4">
            {PAYLOAD_LIBRARY.map((group) => (
              <div key={group.category} className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-2 text-sm">{group.category}</h3>
                {group.payloads.map((p) => (
                  <div key={p} className="flex items-center justify-between py-1">
                    <code className="text-xs text-green-400 font-mono">{p}</code>
                    <button onClick={() => navigator.clipboard.writeText(p)}
                      className="text-xs text-cyber-cyan/50 hover:text-cyber-cyan ml-2 px-2 py-0.5 rounded border border-cyber-cyan/20 hover:bg-cyber-cyan/10">
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default SSRFTester;
