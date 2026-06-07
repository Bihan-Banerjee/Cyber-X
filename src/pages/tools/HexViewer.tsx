import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface HexLine {
  offset: string;
  hex: string;
  ascii: string;
}

interface HexViewResult {
  filename: string;
  size: number;
  lines: HexLine[];
  entropy: number;
  mimeType: string;
}

const HexViewer = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HexViewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch(`${API_BASE_URL}/api/scan/hex-view`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Upload failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to process file");
    } finally {
      setIsLoading(false);
    }
  };

  const getEntropyColor = (e: number) => {
    if (e < 3) return "text-green-400";
    if (e < 5) return "text-yellow-400";
    if (e < 7) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <CyberpunkCard title="HEX VIEWER">
      <div className="space-y-5">
        <div className="flex gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            id="hex-file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="hex-file"
            className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded transition-colors text-sm">
            <Upload className="w-4 h-4" />
            {selectedFile ? selectedFile.name : "Choose File"}
          </label>
          <Button onClick={handleUpload} disabled={!selectedFile || isLoading}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing...</> : "Analyze"}
          </Button>
          {selectedFile && (
            <span className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</span>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-sm font-bold text-cyber-cyan truncate" title={result.filename}>{result.filename}</p>
                <p className="text-xs text-gray-400">Filename</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-xl font-bold text-cyber-cyan">{(result.size / 1024).toFixed(1)} KB</p>
                <p className="text-xs text-gray-400">File Size</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-xl font-bold text-cyber-cyan">{result.mimeType || "Unknown"}</p>
                <p className="text-xs text-gray-400">MIME Type</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className={`text-xl font-bold ${getEntropyColor(result.entropy)}`}>{result.entropy.toFixed(3)}</p>
                <p className="text-xs text-gray-400">Entropy</p>
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">HEX DUMP</h3>
                <div className="text-xs text-gray-400">
                  Showing {result.lines.length * 16} of {result.size} bytes
                  {result.size > 10240 && " (first 10KB)"}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-cyber-cyan/20">
                      <th className="text-left text-cyber-cyan/60 pr-4 pb-1 w-24">OFFSET</th>
                      <th className="text-left text-cyber-cyan/60 pr-4 pb-1">HEX</th>
                      <th className="text-left text-cyber-cyan/60 pb-1">ASCII</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((line, i) => (
                      <tr key={i} className="hover:bg-cyber-cyan/5">
                        <td className="text-cyber-cyan/60 pr-4 py-0.5 align-top">{line.offset}</td>
                        <td className="text-cyber-cyan pr-4 py-0.5 align-top tracking-wider">{line.hex}</td>
                        <td className="py-0.5 align-top">
                          {line.ascii.split("").map((c, ci) => (
                            <span key={ci} className={c === "." ? "text-gray-600" : "text-green-400"}>
                              {c}
                            </span>
                          ))}
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

export default HexViewer;
