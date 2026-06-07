import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ChevronDown, ChevronRight, Search } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface ASNResult {
  asn: string;
  name: string;
  country: string;
  description: string;
  prefixes: string[];
  peers: string[];
  upstreams: string[];
  downstreams: string[];
  abuseContact?: string;
}

const CollapsibleTable = ({ title, items }: { title: string; items: string[] }) => {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="glass-panel rounded overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-cyber-cyan hover:bg-black/40 transition-colors">
        <span className="font-bold tracking-wide text-sm">{title} ({items.length})</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="border-t border-cyber-cyan/20 p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-48 overflow-y-auto">
            {items.map((item, i) => (
              <code key={i} className="text-xs text-green-400 font-mono truncate">{item}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BGPASNLookup = () => {
  const [target, setTarget] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ASNResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!target.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/asn-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Lookup failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to lookup ASN");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="BGP / ASN LOOKUP">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Input value={target} onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="IP address (1.2.3.4) or ASN (AS15169)"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            disabled={isLoading} />
          <Button onClick={handleLookup} disabled={isLoading || !target.trim()}
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
            <div className="glass-panel rounded p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">ASN</p>
                  <p className="text-2xl font-bold text-cyber-cyan font-mono">{result.asn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Country</p>
                  <p className="text-xl font-bold text-cyber-cyan">{result.country}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Name / Organization</p>
                  <p className="text-lg font-bold text-cyber-cyan">{result.name}</p>
                </div>
                {result.description && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Description</p>
                    <p className="text-sm text-gray-300">{result.description}</p>
                  </div>
                )}
                {result.abuseContact && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Abuse Contact</p>
                    <p className="text-sm text-orange-400">{result.abuseContact}</p>
                  </div>
                )}
              </div>
            </div>

            <CollapsibleTable title="PREFIXES" items={result.prefixes} />
            <CollapsibleTable title="PEERS" items={result.peers} />
            <CollapsibleTable title="UPSTREAMS" items={result.upstreams} />
            <CollapsibleTable title="DOWNSTREAMS" items={result.downstreams} />
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default BGPASNLookup;
