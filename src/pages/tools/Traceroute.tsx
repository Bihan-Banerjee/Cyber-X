import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Network } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface Hop {
  hop: number;
  ip?: string;
  hostname?: string;
  rtt: number[];
  status: "success" | "timeout" | "unreachable";
}

interface TracerouteResult {
  target: string;
  hops: Hop[];
  totalHops: number;
  reachedTarget: boolean;
  totalRtt: number;
}

const Traceroute = () => {
  const [target, setTarget] = useState("");
  const [maxHops, setMaxHops] = useState("30");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TracerouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrace = async () => {
    if (!target.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/traceroute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), maxHops: parseInt(maxHops) || 30 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Traceroute failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to run traceroute");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="TRACEROUTE">
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TARGET</label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrace()}
              placeholder="example.com or 1.2.3.4"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan" disabled={isLoading} />
          </div>
          <div className="w-24">
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">MAX HOPS</label>
            <Input value={maxHops} onChange={(e) => setMaxHops(e.target.value)}
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleTrace} disabled={isLoading || !target.trim()}
              className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="glass-panel rounded p-4 text-center">
            <Loader2 className="w-6 h-6 text-cyber-cyan animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">Running traceroute — this may take 30-60 seconds...</p>
          </div>
        )}

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
                <p className="text-2xl font-bold text-cyber-cyan">{result.totalHops}</p>
                <p className="text-xs text-gray-400">Total Hops</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className={`text-2xl font-bold ${result.reachedTarget ? "text-green-400" : "text-red-400"}`}>
                  {result.reachedTarget ? "YES" : "NO"}
                </p>
                <p className="text-xs text-gray-400">Target Reached</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.totalRtt}ms</p>
                <p className="text-xs text-gray-400">Total RTT</p>
              </div>
            </div>

            <div className="glass-panel rounded overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-cyber-cyan/20 bg-black/40">
                    <th className="text-left text-cyber-cyan tracking-wider py-2 px-3 w-12">HOP</th>
                    <th className="text-left text-cyber-cyan tracking-wider py-2 px-3">IP / HOSTNAME</th>
                    <th className="text-left text-cyber-cyan tracking-wider py-2 px-3">RTT</th>
                    <th className="text-left text-cyber-cyan tracking-wider py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {result.hops.map((hop) => (
                    <tr key={hop.hop} className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5">
                      <td className="py-2 px-3 text-gray-400">{hop.hop}</td>
                      <td className="py-2 px-3">
                        {hop.status === "timeout" ? (
                          <span className="text-gray-600">* * *</span>
                        ) : (
                          <span className="text-cyber-cyan">
                            {hop.hostname && hop.hostname !== hop.ip ? (
                              <>{hop.hostname} <span className="text-gray-500">({hop.ip})</span></>
                            ) : (hop.ip || "*")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {hop.status === "timeout" ? (
                          <span className="text-gray-600">* * *</span>
                        ) : (
                          <span className={hop.rtt[0] > 100 ? "text-orange-400" : "text-green-400"}>
                            {hop.rtt.map((r) => `${r}ms`).join(" / ")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          hop.status === "success" ? "bg-green-500/20 text-green-400" :
                          hop.status === "timeout" ? "bg-gray-500/20 text-gray-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {hop.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default Traceroute;
