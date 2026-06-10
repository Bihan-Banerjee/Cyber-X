import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PasteResult {
  id: string;
  title?: string;
  date: string;
  snippet: string;
  url: string;
  hasCredentials: boolean;
}

interface PasteSearchResult {
  results: PasteResult[];
  total: number;
}

const PastebinMonitor = () => {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("keyword");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PasteSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/pastebin-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), type }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Search failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Pastebin search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const highlight = (text: string, term: string) => {
    if (!term) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-400/30 text-yellow-300">{text.slice(idx, idx + term.length)}</mark>
        {text.slice(idx + term.length)}
      </>
    );
  };

  return (
    <CyberpunkCard title="PASTEBIN MONITOR">
      <div className="space-y-6">
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm w-36"
            disabled={isLoading}
          >
            <option value="keyword">Keyword</option>
            <option value="email">Email</option>
            <option value="domain">Domain</option>
          </select>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={type === "email" ? "user@example.com" : type === "domain" ? "example.com" : "search term"}
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Search className="w-4 h-4 mr-2" />Search</>}
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Found <span className="text-cyber-cyan font-bold">{result.total}</span> results</p>
              {result.results.some((r) => r.hasCredentials) && (
                <div className="flex items-center gap-1 text-red-400 text-xs font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  Credentials detected
                </div>
              )}
            </div>

            <div className="space-y-3">
              {result.results.map((paste, i) => (
                <div key={i} className={`glass-panel rounded p-4 border ${paste.hasCredentials ? "border-red-500/40 bg-red-500/5" : "border-cyber-cyan/10"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {paste.title && <p className="text-sm font-bold text-cyber-cyan">{paste.title}</p>}
                      <p className="text-xs text-gray-400">{paste.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {paste.hasCredentials && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          CREDENTIALS
                        </span>
                      )}
                      <a href={paste.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyber-cyan hover:underline font-mono">
                        {paste.id}
                      </a>
                    </div>
                  </div>
                  <pre className="text-xs font-mono text-gray-300 bg-black/40 p-2 rounded max-h-24 overflow-auto whitespace-pre-wrap break-all">
                    {highlight(paste.snippet, query)}
                  </pre>
                </div>
              ))}
              {result.results.length === 0 && (
                <p className="text-center text-gray-500 py-8">No results found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PastebinMonitor;
