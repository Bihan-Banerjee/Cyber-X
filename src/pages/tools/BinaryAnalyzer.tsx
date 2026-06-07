import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface BinarySection {
  name: string;
  virtualAddress: string;
  size: number;
  entropy: number;
  characteristics: string;
}

interface BinaryResult {
  filename: string;
  format: string;
  architecture: string;
  bitness: number;
  imports: string[];
  exports: string[];
  sections: BinarySection[];
  entropy: number;
  packed: boolean;
  isSigned: boolean;
  anomalies: string[];
}

const BinaryAnalyzer = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BinaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "imports" | "exports" | "sections">("overview");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/scan/binary-analyze`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Binary analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const entropyColor = (e: number) => e > 7.2 ? "text-red-400" : e > 6 ? "text-yellow-400" : "text-green-400";

  return (
    <CyberpunkCard title="BINARY ANALYZER">
      <div className="space-y-6">
        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <label
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-cyber-cyan/30 rounded cursor-pointer hover:bg-cyber-cyan/5 transition-colors ${isLoading ? "pointer-events-none opacity-50" : ""}`}
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin text-cyber-cyan" /><span className="text-cyber-cyan">Analyzing binary...</span></>
            ) : (
              <><Upload className="w-5 h-5 text-cyber-cyan" /><span className="text-cyber-cyan">Upload binary (PE/ELF/Mach-O)</span></>
            )}
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-cyber-cyan/20 border border-cyber-cyan/30 rounded text-cyber-cyan text-sm font-bold">{result.format}</span>
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400 text-sm font-bold">{result.architecture}</span>
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 text-sm font-bold">{result.bitness}-bit</span>
              {result.packed && <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm font-bold">PACKED</span>}
              {result.isSigned && <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-sm font-bold">SIGNED</span>}
            </div>

            <div className="flex gap-1">
              {(["overview", "imports", "exports", "sections"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded text-xs font-bold ${activeTab === t ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30"}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="glass-panel rounded p-4">
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">ENTROPY</h3>
                  <div className="flex items-center gap-4">
                    <p className={`text-3xl font-bold ${entropyColor(result.entropy)}`}>{result.entropy.toFixed(3)}</p>
                    <div className="flex-1">
                      <div className="w-full bg-black/40 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${result.entropy > 7.2 ? "bg-red-400" : result.entropy > 6 ? "bg-yellow-400" : "bg-green-400"}`}
                          style={{ width: `${(result.entropy / 8) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {result.packed ? "High entropy — likely packed/encrypted" : result.entropy > 6 ? "Moderate entropy" : "Normal entropy"}
                      </p>
                    </div>
                  </div>
                  {result.packed && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      Entropy &gt; 7.2 — binary is likely packed or encrypted
                    </div>
                  )}
                </div>

                {result.anomalies.length > 0 && (
                  <div className="glass-panel rounded p-4">
                    <h3 className="text-red-400 font-bold tracking-wide mb-3">ANOMALIES</h3>
                    <ul className="space-y-1">
                      {result.anomalies.map((a, i) => (
                        <li key={i} className="text-sm text-orange-400 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === "imports" && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">IMPORTS ({result.imports.length})</h3>
                <div className="max-h-64 overflow-auto space-y-1">
                  {result.imports.map((imp, i) => (
                    <div key={i} className="text-xs font-mono text-cyber-cyan bg-black/40 px-2 py-1 rounded">{imp}</div>
                  ))}
                  {result.imports.length === 0 && <p className="text-gray-500 text-sm">No imports found</p>}
                </div>
              </div>
            )}

            {activeTab === "exports" && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">EXPORTS ({result.exports.length})</h3>
                <div className="max-h-64 overflow-auto space-y-1">
                  {result.exports.map((exp, i) => (
                    <div key={i} className="text-xs font-mono text-cyber-cyan bg-black/40 px-2 py-1 rounded">{exp}</div>
                  ))}
                  {result.exports.length === 0 && <p className="text-gray-500 text-sm">No exports found</p>}
                </div>
              </div>
            )}

            {activeTab === "sections" && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">SECTIONS ({result.sections.length})</h3>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-cyber-cyan/20">
                        <th className="text-left text-cyber-cyan py-2 pr-3">Name</th>
                        <th className="text-left text-cyber-cyan py-2 pr-3">VA</th>
                        <th className="text-left text-cyber-cyan py-2 pr-3">Size</th>
                        <th className="text-left text-cyber-cyan py-2 pr-3">Entropy</th>
                        <th className="text-left text-cyber-cyan py-2">Characteristics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.sections.map((s, i) => (
                        <tr key={i} className="border-b border-cyber-cyan/5">
                          <td className="py-1.5 pr-3 font-mono text-cyber-cyan">{s.name}</td>
                          <td className="py-1.5 pr-3 font-mono text-gray-300">{s.virtualAddress}</td>
                          <td className="py-1.5 pr-3 text-gray-300">{s.size}</td>
                          <td className={`py-1.5 pr-3 font-bold ${entropyColor(s.entropy)}`}>{s.entropy.toFixed(2)}</td>
                          <td className="py-1.5 text-gray-400 text-xs">{s.characteristics}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default BinaryAnalyzer;
