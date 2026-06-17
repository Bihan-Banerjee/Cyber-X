import { useState, useMemo, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Upload, Copy, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface ExtractedString {
  value: string;
  offset: number;
  encoding: "ascii" | "unicode";
  category: string;
}

interface StringCategory {
  name: string;
  count: number;
}

interface StringExtractResult {
  filename: string;
  totalStrings: number;
  strings: ExtractedString[];
  categories: StringCategory[];
}

const CATEGORY_COLORS: Record<string, string> = {
  URL: "bg-blue-500/20 text-blue-400",
  Email: "bg-green-500/20 text-green-400",
  IP: "bg-yellow-500/20 text-yellow-400",
  Path: "bg-orange-500/20 text-orange-400",
  Registry: "bg-purple-500/20 text-purple-400",
  Other: "bg-gray-500/20 text-gray-400",
};

const StringExtractor = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [minLength, setMinLength] = useState("4");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StringExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("minLength", minLength);
      const response = await fetch(`${API_BASE_URL}/api/scan/string-extract`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Extraction failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to extract strings");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!result) return [];
    return result.strings.filter((s) => {
      const matchCat = filterCategory === "All" || s.category === filterCategory;
      const matchSearch = !search || s.value.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [result, filterCategory, search]);

  const copyAll = () => {
    navigator.clipboard.writeText(filtered.map((s) => s.value).join("\n"));
  };

  const download = () => {
    const text = filtered.map((s) => s.value).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strings_${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <CyberpunkCard title="STRING EXTRACTOR">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <input ref={fileInputRef} type="file" className="hidden" id="str-file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            <label htmlFor="str-file"
              className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded transition-colors text-sm">
              <Upload className="w-4 h-4" />
              {selectedFile ? selectedFile.name : "Choose File"}
            </label>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Min Length</label>
            <Input value={minLength} onChange={(e) => setMinLength(e.target.value)}
              className="w-20 bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" />
          </div>
          <Button onClick={handleUpload} disabled={!selectedFile || isLoading}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Extracting...</> : "Extract Strings"}
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.totalStrings}</p>
                <p className="text-xs text-gray-400">Total Strings</p>
              </div>
              {result.categories.map((cat) => (
                <div key={cat.name} className="glass-panel rounded p-3 text-center">
                  <p className="text-2xl font-bold text-cyber-cyan">{cat.count}</p>
                  <p className="text-xs text-gray-400">{cat.name}s</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {["All", ...result.categories.map((c) => c.name)].map((cat) => (
                <button key={cat} onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    filterCategory === cat
                      ? "bg-cyber-red text-white font-bold"
                      : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search strings..."
                className="flex-1 bg-black/50 border-cyber-cyan/30 text-cyber-cyan" />
              <Button onClick={copyAll} size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
                <Copy className="w-3 h-3 mr-1" />Copy All ({filtered.length})
              </Button>
              <Button onClick={download} size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
                <Download className="w-3 h-3 mr-1" />Download
              </Button>
            </div>

            <div className="glass-panel rounded overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-black/80">
                    <tr className="border-b border-cyber-cyan/20">
                      <th className="text-left text-cyber-cyan tracking-wider py-2 px-3 w-24">OFFSET</th>
                      <th className="text-left text-cyber-cyan tracking-wider py-2 px-3 w-20">ENC</th>
                      <th className="text-left text-cyber-cyan tracking-wider py-2 px-3 w-24">CATEGORY</th>
                      <th className="text-left text-cyber-cyan tracking-wider py-2 px-3">STRING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 500).map((s, i) => (
                      <tr key={i} className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5">
                        <td className="py-1 px-3 text-gray-500 font-mono">{s.offset.toString(16).padStart(8, "0")}</td>
                        <td className="py-1 px-3">
                          <span className={`px-1 rounded text-xs ${s.encoding === "unicode" ? "bg-purple-500/20 text-purple-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                            {s.encoding}
                          </span>
                        </td>
                        <td className="py-1 px-3">
                          <span className={`px-1 rounded text-xs ${CATEGORY_COLORS[s.category] || CATEGORY_COLORS.Other}`}>
                            {s.category}
                          </span>
                        </td>
                        <td className="py-1 px-3 font-mono text-green-400 break-all">{s.value}</td>
                      </tr>
                    ))}
                    {filtered.length > 500 && (
                      <tr>
                        <td colSpan={4} className="py-2 px-3 text-gray-500 text-center">
                          {filtered.length - 500} more strings (download to see all)
                        </td>
                      </tr>
                    )}
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

export default StringExtractor;
