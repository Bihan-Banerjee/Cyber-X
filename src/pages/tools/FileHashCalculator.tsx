import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, Copy, Check, ExternalLink, FileDigit } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface FileHashResult {
  filename: string;
  size: number;
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
  mimeType: string;
  extension: string;
  scanDuration: number;
}

const FileHashCalculator = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FileHashResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleCalculate = async () => {
    if (!file) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/scan/file-hash`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Hash calculation failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to file hash service");
    } finally {
      setIsLoading(false);
    }
  };

  const copyHash = async (hash: string, label: string) => {
    await navigator.clipboard.writeText(hash);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const vtUrl = result
    ? `https://www.virustotal.com/gui/file/${result.sha256}`
    : null;

  const hashes = result
    ? [
        { label: "MD5", value: result.md5 },
        { label: "SHA-1", value: result.sha1 },
        { label: "SHA-256", value: result.sha256 },
        { label: "SHA-512", value: result.sha512 },
      ]
    : [];

  return (
    <CyberpunkCard title="FILE HASH CALCULATOR">
      <div className="space-y-6">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-cyber-cyan bg-cyber-cyan/10"
              : "border-cyber-cyan/30 hover:border-cyber-cyan/60 hover:bg-cyber-cyan/5"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-cyber-cyan/50 mx-auto mb-3" />
          {file ? (
            <div>
              <p className="text-cyber-cyan font-bold">{file.name}</p>
              <p className="text-sm text-gray-400">{formatSize(file.size)}</p>
            </div>
          ) : (
            <div>
              <p className="text-cyber-cyan">Drop a file here or click to browse</p>
              <p className="text-xs text-gray-500 mt-1">Any file type accepted</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        <Button
          onClick={handleCalculate}
          disabled={isLoading || !file}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculating Hashes...</>
          ) : (
            <><FileDigit className="w-4 h-4 mr-2" />CALCULATE HASHES</>
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* File info */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">FILE INFO</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-400">Filename:</span>
                <span className="text-cyber-cyan font-mono break-all">{result.filename}</span>
                <span className="text-gray-400">Size:</span>
                <span className="text-cyber-cyan font-mono">{formatSize(result.size)} ({result.size.toLocaleString()} bytes)</span>
                <span className="text-gray-400">MIME Type:</span>
                <span className="text-cyber-cyan font-mono">{result.mimeType}</span>
                <span className="text-gray-400">Extension:</span>
                <span className="text-cyber-cyan font-mono">.{result.extension}</span>
              </div>
            </div>

            {/* Hash table */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">HASHES</h3>
              <div className="space-y-3">
                {hashes.map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 tracking-wider font-bold">{label}</span>
                      <button
                        onClick={() => copyHash(value, label)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors"
                      >
                        {copied === label ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === label ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-cyber-cyan font-mono text-xs break-all bg-black/30 rounded p-2 border border-cyber-cyan/10">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* VirusTotal link */}
            {vtUrl && (
              <a
                href={vtUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 rounded text-cyber-cyan text-sm transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Search SHA-256 on VirusTotal
              </a>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default FileHashCalculator;
