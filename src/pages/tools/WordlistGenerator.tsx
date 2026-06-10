import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Plus, X, Download, List } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface WordlistResult {
  words: string[];
  count: number;
  options: Record<string, unknown>;
  scanDuration: number;
}

const WordlistGenerator = () => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [includeLeet, setIncludeLeet] = useState(true);
  const [includeYears, setIncludeYears] = useState(true);
  const [includeSuffixes, setIncludeSuffixes] = useState(true);
  const [includeCapitalization, setIncludeCapitalization] = useState(true);
  const [minLength, setMinLength] = useState(4);
  const [maxLength, setMaxLength] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WordlistResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addKeyword = () => {
    const kw = inputValue.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setInputValue("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  // Estimate count
  const estimateCount = () => {
    let base = keywords.length;
    let multiplier = 1;
    if (includeCapitalization) multiplier += 2;
    if (includeLeet) multiplier += 1;
    multiplier += 1; // reversed
    if (includeYears) multiplier += 12; // 6 years × 2 positions
    if (includeSuffixes) multiplier += 13;
    return Math.min(base * multiplier, 50000);
  };

  const handleGenerate = async () => {
    if (keywords.length === 0) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/wordlist-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          includeLeet,
          includeYears,
          includeSuffixes,
          includeCapitalization,
          minLength,
          maxLength,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Generation failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to wordlist generator service");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const text = result.words.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wordlist_${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleOptions = [
    { key: "leet", label: "Leet (a→@, e→3)", value: includeLeet, set: setIncludeLeet },
    { key: "years", label: "Years (2020-2025)", value: includeYears, set: setIncludeYears },
    { key: "suffixes", label: "Suffixes (123, !, @)", value: includeSuffixes, set: setIncludeSuffixes },
    { key: "caps", label: "Capitalisation", value: includeCapitalization, set: setIncludeCapitalization },
  ];

  return (
    <CyberpunkCard title="WORDLIST GENERATOR">
      <div className="space-y-6">
        {/* Keyword input */}
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">KEYWORDS</label>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              placeholder="Type a keyword and press Enter"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
            <Button onClick={addKeyword} disabled={!inputValue.trim() || isLoading}
              className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Keyword chips */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {keywords.map((kw) => (
                <span key={kw} className="flex items-center gap-1 px-2 py-1 bg-cyber-cyan/20 border border-cyber-cyan/30 rounded text-xs text-cyber-cyan">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Toggle options */}
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TRANSFORMATIONS</label>
          <div className="grid grid-cols-2 gap-2">
            {toggleOptions.map(({ key, label, value, set }) => (
              <button
                key={key}
                onClick={() => set(!value)}
                disabled={isLoading}
                className={`py-2 px-3 rounded text-xs font-bold border transition-colors ${
                  value
                    ? "bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/50"
                    : "bg-transparent text-gray-500 border-gray-600 hover:border-gray-400"
                }`}
              >
                {value ? "✓ " : ""}{label}
              </button>
            ))}
          </div>
        </div>

        {/* Length filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">MIN LENGTH</label>
            <Input type="number" value={minLength} onChange={(e) => setMinLength(Number(e.target.value))} min={1} max={64} className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" disabled={isLoading} />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">MAX LENGTH</label>
            <Input type="number" value={maxLength} onChange={(e) => setMaxLength(Number(e.target.value))} min={1} max={128} className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" disabled={isLoading} />
          </div>
        </div>

        {/* Estimate */}
        {keywords.length > 0 && (
          <p className="text-sm text-gray-400">
            Estimated words: <span className="text-cyber-cyan font-bold">{estimateCount().toLocaleString()}</span>
            <span className="text-gray-500"> (capped at 50,000)</span>
          </p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isLoading || keywords.length === 0}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
          ) : (
            <><List className="w-4 h-4 mr-2" />GENERATE WORDLIST</>
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="glass-panel rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyber-cyan font-bold">{result.count.toLocaleString()} words generated</p>
                <p className="text-xs text-gray-500">Completed in {result.scanDuration}s</p>
              </div>
              <Button onClick={handleDownload} className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download .txt
              </Button>
            </div>

            {/* Preview */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Preview (first 20 words):</p>
              <pre className="bg-black/50 border border-cyber-cyan/20 rounded p-3 text-cyber-cyan font-mono text-xs max-h-48 overflow-y-auto">
                {result.words.slice(0, 20).join("\n")}
                {result.count > 20 && `\n... and ${result.count - 20} more`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default WordlistGenerator;
