import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Globe, Filter } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CrawlResult {
  url: string;
  pages: string[];
  links: string[];
  forms: string[];
  jsEndpoints: string[];
  emails: string[];
  totalPages: number;
  scanDuration: number;
}

const WebCrawler = () => {
  const [url, setUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"pages" | "forms" | "js" | "emails">("pages");

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/web-crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), maxDepth, maxPages, timeoutMs: 60000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Crawl failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Web crawl failed");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = (arr: string[]) =>
    filter ? arr.filter((u) => u.toLowerCase().includes(filter.toLowerCase())) : arr;

  return (
    <CyberpunkCard title="WEB CRAWLER">
      <div className="space-y-6">
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">TARGET URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Depth: {maxDepth}</label>
              <input type="range" min={1} max={10} value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} className="w-full accent-cyber-red" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Pages: {maxPages}</label>
              <input type="range" min={5} max={200} step={5} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} className="w-full accent-cyber-red" />
            </div>
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !url.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Crawling...</> : <><Globe className="w-4 h-4 mr-2" />Start Crawl</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Pages", value: result.totalPages, color: "text-cyber-cyan" },
                { label: "Links", value: result.links.length, color: "text-cyber-cyan" },
                { label: "Forms", value: result.forms.length, color: "text-yellow-400" },
                { label: "Emails", value: result.emails.length, color: "text-orange-400" },
              ].map((s) => (
                <div key={s.label} className="glass-panel rounded p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              {(["pages", "forms", "js", "emails"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded text-xs font-bold ${activeTab === t ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30"}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyber-cyan" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter URLs..."
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
              />
            </div>

            <div className="glass-panel rounded p-4">
              <div className="max-h-64 overflow-auto space-y-1">
                {(activeTab === "pages" ? filtered(result.pages) :
                  activeTab === "forms" ? filtered(result.forms) :
                  activeTab === "js" ? filtered(result.jsEndpoints) :
                  filtered(result.emails)).map((item, i) => (
                  <div key={i} className="text-xs font-mono text-cyber-cyan bg-black/40 px-2 py-1 rounded truncate">{item}</div>
                ))}
                {filtered(activeTab === "pages" ? result.pages : activeTab === "forms" ? result.forms : activeTab === "js" ? result.jsEndpoints : result.emails).length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No results</p>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500 text-right">Scan duration: {result.scanDuration}s</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default WebCrawler;
