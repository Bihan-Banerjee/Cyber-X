import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Globe, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface Technology {
  name: string;
  category: string;
  version?: string;
  confidence: number;
}

interface TechFingerprintResult {
  url: string;
  technologies: Technology[];
  server?: string;
  cms?: string;
  frameworks: string[];
  analytics: string[];
  cdn?: string;
  waf?: string;
  headers: Record<string, string>;
  scanDuration: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "CMS": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "JavaScript Framework": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Analytics": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "CDN": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Web Server": "bg-green-500/20 text-green-400 border-green-500/30",
  "Programming Language": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Security": "bg-red-500/20 text-red-400 border-red-500/30",
  "Hosting": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

const WebsiteTechFingerprinter = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TechFingerprintResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/tech-fingerprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), timeoutMs: 10000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Scan failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to tech fingerprinter service");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResults = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tech_fingerprint_${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Group technologies by category
  const grouped = result
    ? result.technologies.reduce((acc, tech) => {
        if (!acc[tech.category]) acc[tech.category] = [];
        acc[tech.category].push(tech);
        return acc;
      }, {} as Record<string, Technology[]>)
    : {};

  const categoryOrder = ["CMS", "JavaScript Framework", "Web Server", "Programming Language", "Analytics", "CDN", "Security", "Hosting"];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (categoryOrder.indexOf(a) !== -1 ? categoryOrder.indexOf(a) : 99) - (categoryOrder.indexOf(b) !== -1 ? categoryOrder.indexOf(b) : 99)
  );

  return (
    <CyberpunkCard title="WEBSITE TECH FINGERPRINTER">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="https://example.com"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          <Button
            onClick={handleScan}
            disabled={isLoading || !url.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fingerprinting...</>
            ) : (
              <><Globe className="w-4 h-4 mr-2" />Fingerprint</>
            )}
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
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              {result.server && (
                <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400">
                  Server: {result.server}
                </span>
              )}
              {result.cms && (
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-400">
                  CMS: {result.cms}
                </span>
              )}
              {result.cdn && (
                <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-xs text-cyan-400">
                  CDN: {result.cdn}
                </span>
              )}
              {result.waf && (
                <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400">
                  WAF: {result.waf}
                </span>
              )}
              <span className="px-3 py-1 bg-cyber-cyan/20 border border-cyber-cyan/30 rounded text-xs text-cyber-cyan ml-auto">
                {result.technologies.length} technologies detected
              </span>
            </div>

            {/* Category groups */}
            {sortedCategories.length > 0 ? (
              <div className="space-y-4">
                {sortedCategories.map((category) => (
                  <div key={category} className="glass-panel rounded p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${CATEGORY_COLORS[category] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                        {category}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {grouped[category].map((tech, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-black/20 rounded border border-cyber-cyan/10">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-cyber-cyan">
                              {tech.name}
                              {tech.version && <span className="text-gray-400 font-normal ml-1 text-xs">v{tech.version}</span>}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-black/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${tech.confidence >= 80 ? "bg-green-500" : tech.confidence >= 50 ? "bg-yellow-500" : "bg-orange-500"}`}
                                style={{ width: `${tech.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{tech.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No technologies detected. The site may use obfuscation or custom stack.</p>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-cyber-cyan/10">
              <span className="text-xs text-gray-500">Scan completed in {result.scanDuration}s</span>
              <Button onClick={downloadResults} className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default WebsiteTechFingerprinter;
