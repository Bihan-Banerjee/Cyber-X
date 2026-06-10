import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, AlertTriangle, ShieldOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface AWSMetaResult {
  url: string;
  vulnerable: boolean;
  successfulPayload?: string;
  sensitiveDataFound: boolean;
  credentialsExposed: boolean;
  payloadResults: Array<{ payload: string; reached: boolean; dataFound?: string }>;
  recommendations: string[];
}

const AWSMetadataTester = () => {
  const [url, setUrl] = useState("");
  const [parameter, setParameter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AWSMetaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!url.trim() || !parameter.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/aws-metadata`, {
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
      setError(err.message || "AWS metadata test failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="AWS METADATA TESTER">
      <div className="space-y-6">
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Only test systems you own or have explicit permission to test. SSRF attacks against production systems are illegal.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">TARGET URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/fetch"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">PARAMETER NAME</label>
            <Input
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              placeholder="url, endpoint, src"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !url.trim() || !parameter.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing IMDS Access...</> : <><ShieldOff className="w-4 h-4 mr-2" />Test AWS Metadata</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`glass-panel rounded p-6 text-center border-2 ${result.credentialsExposed ? "border-red-500/70 bg-red-500/10" : result.vulnerable ? "border-orange-500/50 bg-orange-500/5" : "border-green-500/50 bg-green-500/5"}`}>
              {result.credentialsExposed && (
                <div className="flex items-center justify-center gap-2 mb-2 text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                  <span className="text-sm font-bold">CREDENTIALS ENDPOINT REACHABLE</span>
                </div>
              )}
              <p className={`text-3xl font-bold tracking-widest ${result.credentialsExposed ? "text-red-400" : result.vulnerable ? "text-orange-400" : "text-green-400"}`}>
                {result.credentialsExposed ? "CRITICAL" : result.vulnerable ? "VULNERABLE" : "NOT VULNERABLE"}
              </p>
            </div>

            {result.successfulPayload && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-2">SUCCESSFUL PAYLOAD</h3>
                <pre className="text-xs font-mono text-red-400 bg-black/60 p-3 rounded">{result.successfulPayload}</pre>
              </div>
            )}

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">PAYLOAD RESULTS</h3>
              <div className="space-y-2">
                {result.payloadResults.map((pr, i) => (
                  <div key={i} className={`flex items-start gap-3 p-2 rounded border text-sm ${pr.reached ? "bg-red-500/10 border-red-500/30" : "bg-gray-500/5 border-gray-500/20"}`}>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0 ${pr.reached ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"}`}>
                      {pr.reached ? "HIT" : "MISS"}
                    </span>
                    <div>
                      <p className="font-mono text-xs text-cyber-cyan">{pr.payload}</p>
                      {pr.dataFound && <p className="text-xs text-orange-400 mt-1">{pr.dataFound}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {result.recommendations.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RECOMMENDATIONS</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 mt-0.5">→</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default AWSMetadataTester;
