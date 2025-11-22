import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface ScanResult {
  port: number;
  status: "open" | "closed" | "filtered";
  service: string;
}

const PortScanner = () => {
  const [target, setTarget] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);

  const handleScan = async () => {
    if (!target) return;

    setIsScanning(true);
    setResults([]);

    // Simulate scanning
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockResults: ScanResult[] = [
      { port: 22, status: "open", service: "SSH" },
      { port: 80, status: "open", service: "HTTP" },
      { port: 443, status: "open", service: "HTTPS" },
      { port: 3306, status: "filtered", service: "MySQL" },
      { port: 8080, status: "open", service: "HTTP-Proxy" },
    ];

    setResults(mockResults);
    setIsScanning(false);
  };

  return (
    <CyberpunkCard title="PORT SCANNER">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              TARGET IP/HOSTNAME
            </label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="192.168.1.1 or example.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || !target}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                SCANNING...
              </>
            ) : (
              "INITIATE SCAN"
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="border-t border-cyber-red/30 pt-6">
            <h3 className="text-lg font-bold text-cyber-cyan mb-4 tracking-wide">
              SCAN RESULTS
            </h3>
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.port}
                  className="flex items-center justify-between p-3 bg-black/30 rounded hover:bg-black/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-cyber-red font-mono font-bold">
                      {result.port}
                    </span>
                    <span className="text-gray-400">{result.service}</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      result.status === "open"
                        ? "bg-green-500/20 text-green-400"
                        : result.status === "filtered"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {result.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PortScanner;
