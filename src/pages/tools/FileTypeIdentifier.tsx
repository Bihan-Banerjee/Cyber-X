import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, CheckCircle, XCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface FileTypeResult {
  filename: string;
  detectedType: string;
  mimeType: string;
  extension: string;
  confidence: number;
  magicBytes: string;
  extensionMatches: boolean;
  warning?: string;
}

const FileTypeIdentifier = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FileTypeResult | null>(null);
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
      const response = await fetch(`${API_BASE_URL}/api/scan/file-type`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to identify file type");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="FILE TYPE IDENTIFIER">
      <div className="space-y-5">
        <div className="flex gap-3 items-center">
          <input ref={fileInputRef} type="file" className="hidden" id="ft-file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          <label htmlFor="ft-file"
            className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded transition-colors text-sm">
            <Upload className="w-4 h-4" />
            {selectedFile ? selectedFile.name : "Choose File"}
          </label>
          <Button onClick={handleUpload} disabled={!selectedFile || isLoading}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Identifying...</> : "Identify"}
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
            {result.warning && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Extension Mismatch Detected</p>
                  <p>{result.warning}</p>
                </div>
              </div>
            )}

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-4">DETECTION RESULT</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Detected Type</p>
                  <p className="text-xl font-bold text-cyber-cyan">{result.detectedType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/40 rounded-full h-3">
                      <div className={`h-3 rounded-full ${
                        result.confidence > 80 ? "bg-green-500" :
                        result.confidence > 50 ? "bg-yellow-500" : "bg-orange-500"
                      }`} style={{ width: `${result.confidence}%` }} />
                    </div>
                    <span className="text-sm font-bold text-cyber-cyan">{result.confidence}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">MIME Type</p>
                  <p className="text-sm text-cyber-cyan font-mono">{result.mimeType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Extension Match</p>
                  <div className="flex items-center gap-2">
                    {result.extensionMatches ? (
                      <><CheckCircle className="w-5 h-5 text-green-400" /><span className="text-green-400 font-bold">MATCHES</span></>
                    ) : (
                      <><XCircle className="w-5 h-5 text-red-400" /><span className="text-red-400 font-bold">MISMATCH</span></>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">File Extension</p>
                  <p className="text-sm text-cyber-cyan font-mono">{result.extension || "(none)"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Magic Bytes (hex)</p>
                  <code className="text-sm text-yellow-400 font-mono">{result.magicBytes}</code>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default FileTypeIdentifier;
