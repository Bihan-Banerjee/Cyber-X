import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Network } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface DiscoveredHost {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  responseTime?: number;
}

interface DiscoveryResult {
  subnet: string;
  hostsUp: number;
  hostsDown: number;
  total: number;
  scanDuration: number;
  hosts: DiscoveredHost[];
}

const ARPHostDiscovery = () => {
  const [subnet, setSubnet] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!subnet.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/host-discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subnet: subnet.trim(), timeoutMs: 15000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Discovery failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Host discovery failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="ARP HOST DISCOVERY">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="192.168.1.0/24"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !subnet.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Discovering...</> : <><Network className="w-4 h-4 mr-2" />Discover</>}
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
            <div className="grid grid-cols-4 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.total}</p>
                <p className="text-xs text-gray-400 mt-1">Total Hosts</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{result.hostsUp}</p>
                <p className="text-xs text-gray-400 mt-1">Hosts Up</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{result.hostsDown}</p>
                <p className="text-xs text-gray-400 mt-1">Hosts Down</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.scanDuration}s</p>
                <p className="text-xs text-gray-400 mt-1">Duration</p>
              </div>
            </div>

            {result.hosts.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">DISCOVERED HOSTS ({result.hosts.length})</h3>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cyber-cyan/20">
                        <th className="text-left text-cyber-cyan py-2 pr-4">IP Address</th>
                        <th className="text-left text-cyber-cyan py-2 pr-4">MAC Address</th>
                        <th className="text-left text-cyber-cyan py-2 pr-4">Vendor</th>
                        <th className="text-left text-cyber-cyan py-2 pr-4">Hostname</th>
                        <th className="text-left text-cyber-cyan py-2">Response</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.hosts.map((host, i) => (
                        <tr key={i} className="border-b border-cyber-cyan/5 hover:bg-cyber-cyan/5">
                          <td className="py-2 pr-4 font-mono text-cyber-cyan">{host.ip}</td>
                          <td className="py-2 pr-4 font-mono text-gray-300">{host.mac || "—"}</td>
                          <td className="py-2 pr-4 text-gray-300">{host.vendor || "—"}</td>
                          <td className="py-2 pr-4 text-gray-300">{host.hostname || "—"}</td>
                          <td className="py-2 text-gray-300">{host.responseTime ? `${host.responseTime}ms` : "—"}</td>
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

export default ARPHostDiscovery;
