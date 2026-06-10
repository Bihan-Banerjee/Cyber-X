import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, HardDrive, AlertTriangle, CheckCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface Partition {
  index: number;
  status: string;
  type: string;
  typeName: string;
  lbaStart: number;
  lbaSize: number;
  sizeBytes: number;
  sizeHuman: string;
  active: boolean;
}

interface DiskImageResult {
  filename: string;
  size: number;
  mbrValid: boolean;
  mbrSignature: string;
  partitions: Partition[];
  fileSystem?: string;
  volumeLabel?: string;
  anomalies: string[];
}

const DiskImageAnalyzer = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiskImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const analyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/scan/disk-analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to analyze disk image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPartitionTypeColor = (typeName: string) => {
    if (typeName.includes("NTFS") || typeName.includes("FAT")) return "text-blue-400";
    if (typeName.includes("Linux")) return "text-orange-400";
    if (typeName.includes("Swap")) return "text-yellow-400";
    if (typeName.includes("EFI") || typeName.includes("GPT")) return "text-green-400";
    if (typeName.includes("Hidden")) return "text-red-400";
    return "text-gray-400";
  };

  return (
    <CyberpunkCard title="DISK IMAGE ANALYZER">
      <div className="space-y-6">
        <div className="glass-panel rounded p-4 space-y-3">
          <label className="block text-sm text-cyber-cyan tracking-wide">UPLOAD DISK IMAGE</label>
          <div
            className="border-2 border-dashed border-cyber-cyan/30 rounded p-6 text-center cursor-pointer hover:border-cyber-cyan/60 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <HardDrive className="w-8 h-8 text-cyber-cyan/50 mx-auto mb-2" />
            <p className="text-cyber-cyan text-sm">
              {selectedFile ? selectedFile.name : "Click to select disk image (.img, .dd, .iso, .bin)"}
            </p>
            {selectedFile && (
              <p className="text-gray-500 text-xs mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".img,.dd,.iso,.bin,.raw" className="hidden" onChange={handleFileSelect} />
          <p className="text-gray-500 text-xs">Note: Only the first 512 bytes are parsed for MBR analysis. Large files will be truncated server-side.</p>

          <Button
            onClick={analyze}
            disabled={isAnalyzing || !selectedFile}
            className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            {isAnalyzing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />ANALYZING...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" />ANALYZE DISK IMAGE</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* MBR Status */}
            <div className={`p-4 rounded border ${result.mbrValid ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className="flex items-center gap-3">
                {result.mbrValid ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <p className={`font-bold ${result.mbrValid ? "text-green-400" : "text-red-400"}`}>
                    MBR {result.mbrValid ? "VALID" : "INVALID"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Signature: <code className="font-mono">{result.mbrSignature}</code>
                    {result.mbrValid && " (0x55AA — correct)"}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">IMAGE INFO</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">File:</span> <span className="text-cyber-cyan font-mono text-xs">{result.filename}</span></div>
                <div><span className="text-gray-400">Size:</span> <span className="text-cyber-cyan font-mono">{(result.size / 1024 / 1024).toFixed(2)} MB</span></div>
                {result.fileSystem && (
                  <div><span className="text-gray-400">Filesystem:</span> <span className="text-cyber-cyan font-mono">{result.fileSystem}</span></div>
                )}
                {result.volumeLabel && (
                  <div><span className="text-gray-400">Volume Label:</span> <span className="text-cyber-cyan font-mono">{result.volumeLabel}</span></div>
                )}
              </div>
            </div>

            {/* Anomalies */}
            {result.anomalies.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-yellow-400 font-bold tracking-wide text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  ANOMALIES ({result.anomalies.length})
                </h3>
                {result.anomalies.map((anomaly, i) => (
                  <div key={i} className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
                    {anomaly}
                  </div>
                ))}
              </div>
            )}

            {/* Partition Table */}
            <div>
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">PARTITION TABLE ({result.partitions.length} entries)</h3>
              {result.partitions.length === 0 ? (
                <p className="text-gray-500 text-sm">No valid partition entries found.</p>
              ) : (
                <div className="space-y-2">
                  {result.partitions.map((partition) => (
                    <div key={partition.index} className={`p-3 glass-panel rounded border ${partition.active ? "border-green-500/30" : "border-cyber-cyan/20"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm font-bold">Partition {partition.index}</span>
                          {partition.active && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold">ACTIVE/BOOTABLE</span>
                          )}
                        </div>
                        <span className="text-cyber-cyan font-bold text-sm">{partition.sizeHuman}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500">Type</p>
                          <p className={`font-mono font-bold ${getPartitionTypeColor(partition.typeName)}`}>{partition.type}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Filesystem</p>
                          <p className={getPartitionTypeColor(partition.typeName)}>{partition.typeName}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">LBA Start</p>
                          <p className="text-gray-300 font-mono">{partition.lbaStart}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">LBA Size</p>
                          <p className="text-gray-300 font-mono">{partition.lbaSize}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default DiskImageAnalyzer;
