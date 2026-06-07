import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Server } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface BannerEntry {
  port: number;
  service: string;
  banner: string;
  open: boolean;
}

interface BannerResult {
  target: string;
  results: BannerEntry[];
}

const SERVICE_COLORS: Record<string, string> = {
  HTTP: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  HTTPS: "bg-green-500/20 text-green-400 border-green-500/30",
  SSH: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  FTP: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  SMTP: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  UNKNOWN: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const BannerGrabber = () => {
  const [target, setTarget] = useState("");
  const [ports, setPorts] = useState("21,22,23,25,80,110,143,443,8080");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BannerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!target.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const portList = ports.split(",").map((p) => parseInt(p.trim())).filter((p) => !isNaN(p));
      const response = await fetch(`${API_BASE_URL}/api/scan/banner-grab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), ports: portList, timeoutMs: 10000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Grab failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Banner grab failed");
    } finally {
      setIsLoading(false);
    }
  };

  const openPorts = result?.results.filter((r) => r.open) ?? [];

  return (
    <CyberpunkCard title="BANNER GRABBER">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">TARGET</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="192.168.1.1 or example.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">PORTS (comma-separated)</label>
            <Input
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
              placeholder="21,22,23,25,80,443,8080"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !target.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Grabbing Banners...</> : <><Server className="w-4 h-4 mr-2" />Grab Banners</>}
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
                <p className="text-2xl font-bold text-green-400">{openPorts.length}</p>
                <p className="text-xs text-gray-400 mt-1">Open Ports</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.results.length}</p>
                <p className="text-xs text-gray-400 mt-1">Ports Scanned</p>
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">BANNERS</h3>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cyber-cyan/20">
                      <th className="text-left text-cyber-cyan py-2 pr-4 w-16">Port</th>
                      <th className="text-left text-cyber-cyan py-2 pr-4 w-28">Service</th>
                      <th className="text-left text-cyber-cyan py-2">Banner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((entry, i) => (
                      <tr key={i} className={`border-b border-cyber-cyan/5 ${entry.open ? "hover:bg-cyber-cyan/5" : "opacity-40"}`}>
                        <td className="py-2 pr-4 font-mono text-cyber-cyan">{entry.port}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${SERVICE_COLORS[entry.service] ?? SERVICE_COLORS.UNKNOWN}`}>
                            {entry.service}
                          </span>
                        </td>
                        <td className="py-2">
                          {entry.open && entry.banner ? (
                            <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap break-all max-w-md">{entry.banner}</pre>
                          ) : (
                            <span className="text-gray-500 text-xs">{entry.open ? "(no banner)" : "closed"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default BannerGrabber;
