import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface GCPBucket {
  name: string;
  url: string;
  exists: boolean;
  accessible: boolean;
  isPublic: boolean;
  findings: string[];
  riskLevel: "critical" | "high" | "medium" | "low" | "safe";
}

interface GCPBucketResult {
  keyword: string;
  buckets: GCPBucket[];
  total: number;
  found: number;
  public: number;
  scanDuration: number;
}

const GCPBucketFinder = () => {
  const [keyword, setKeyword] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<GCPBucketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNotFound, setShowNotFound] = useState(false);

  const scan = async () => {
    if (!keyword) return;
    setIsScanning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/gcp-bucket-find`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Scan failed");
      }

      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to connect to scanner service");
    } finally {
      setIsScanning(false);
    }
  };

  const getRiskColor = (risk: string) => {
    if (risk === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (risk === "high") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (risk === "medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (risk === "low") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  };

  const visibleBuckets = result?.buckets.filter((b) => showNotFound || b.exists) ?? [];

  return (
    <CyberpunkCard title="GCP BUCKET FINDER">
      <div className="space-y-6">
        <div className="glass-panel rounded p-4 space-y-3">
          <label className="block text-sm text-cyber-cyan tracking-wide">ORGANIZATION / KEYWORD</label>
          <div className="flex gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. mycompany, projectname"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isScanning}
              onKeyDown={(e) => e.key === "Enter" && !isScanning && scan()}
            />
            <Button
              onClick={scan}
              disabled={isScanning || !keyword}
              className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold shrink-0"
            >
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                <p className="text-xl font-bold text-cyber-cyan">{result.total}</p>
                <p className="text-xs text-gray-400">Tested</p>
              </div>
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded text-center">
                <p className="text-xl font-bold text-orange-400">{result.found}</p>
                <p className="text-xs text-gray-400">Found</p>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-center">
                <p className="text-xl font-bold text-red-400">{result.public}</p>
                <p className="text-xs text-gray-400">Public</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-cyber-cyan font-bold tracking-wide">GCS BUCKETS</h3>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={showNotFound} onChange={(e) => setShowNotFound(e.target.checked)} className="w-3 h-3" />
                Show not-found
              </label>
            </div>

            <div className="space-y-2">
              {visibleBuckets.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No GCS buckets found.</p>
              )}
              {visibleBuckets.map((bucket, i) => (
                <div key={i} className={`p-3 rounded border ${bucket.exists ? getRiskColor(bucket.riskLevel) : "bg-gray-500/5 border-gray-500/10"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRiskColor(bucket.riskLevel)}`}>
                        {bucket.exists ? bucket.riskLevel.toUpperCase() : "NOT FOUND"}
                      </span>
                      <span className="text-sm font-mono">{bucket.name}</span>
                    </div>
                    {bucket.exists && (
                      <a href={bucket.url} target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:text-cyber-cyan/70">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {bucket.findings.map((f, fi) => (
                    <p key={fi} className="text-xs opacity-70 mt-1">{f}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default GCPBucketFinder;
