import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Cloud } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CloudAsset {
  provider: string;
  name: string;
  url: string;
  status: "public" | "exists" | "private" | "not found";
  details?: string;
}

interface CloudResult {
  assets: CloudAsset[];
}

const STATUS_COLORS: Record<string, string> = {
  public: "bg-red-500/20 text-red-400 border-red-500/30",
  exists: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  private: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "not found": "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const PROVIDER_COLORS: Record<string, string> = {
  AWS: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Azure: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  GCP: "bg-green-500/20 text-green-400 border-green-500/30",
  Firebase: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const CloudAssetEnumerator = () => {
  const [domain, setDomain] = useState("");
  const [organization, setOrganization] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CloudResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/cloud-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), organization: organization.trim() || undefined }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Enumeration failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Cloud asset enumeration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const providers = result ? [...new Set(result.assets.map((a) => a.provider))] : [];

  return (
    <CyberpunkCard title="CLOUD ASSET ENUMERATOR">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">DOMAIN</label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">ORGANIZATION (optional)</label>
            <Input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="mycompany"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !domain.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enumerating...</> : <><Cloud className="w-4 h-4 mr-2" />Enumerate Assets</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {["public", "exists", "private", "not found"].map((s) => (
                <div key={s} className="glass-panel rounded p-3 text-center">
                  <p className={`text-xl font-bold ${STATUS_COLORS[s]?.split(" ").find((c) => c.startsWith("text-")) ?? "text-gray-400"}`}>
                    {result.assets.filter((a) => a.status === s).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{s}</p>
                </div>
              ))}
            </div>

            {providers.map((provider) => (
              <div key={provider} className="glass-panel rounded p-4">
                <h3 className={`font-bold tracking-wide mb-3 flex items-center gap-2 ${PROVIDER_COLORS[provider]?.split(" ").find((c) => c.startsWith("text-")) ?? "text-cyber-cyan"}`}>
                  <span className={`px-2 py-0.5 rounded text-xs border ${PROVIDER_COLORS[provider] ?? "bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/30"}`}>{provider}</span>
                  Assets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.assets.filter((a) => a.provider === provider).map((asset, i) => (
                    <div key={i} className={`p-3 rounded border ${STATUS_COLORS[asset.status] ?? ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">{asset.name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${STATUS_COLORS[asset.status]}`}>{asset.status}</span>
                      </div>
                      <p className="text-xs font-mono text-gray-400 truncate">{asset.url}</p>
                      {asset.details && <p className="text-xs mt-1">{asset.details}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CloudAssetEnumerator;
