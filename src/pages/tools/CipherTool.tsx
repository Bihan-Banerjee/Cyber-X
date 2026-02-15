import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Key, Lock, Unlock, BarChart3, Copy, Check, ArrowRightLeft } from "lucide-react";

interface CipherResult {
  cipherType: string;
  operation: string;
  input: string;
  output: string;
  key?: string | number;
  processingTime: number;
}

interface AnalysisResult {
  input: string;
  possibleCiphers: Array<{
    type: string;
    confidence: number;
    decrypted: string;
    key?: string | number;
  }>;
  frequencyAnalysis: Record<string, number>;
  statistics: {
    length: number;
    letters: number;
    uppercase: number;
    lowercase: number;
    digits: number;
    spaces: number;
    special: number;
  };
}

const CipherTool = () => {
  const [mode, setMode] = useState<"encode" | "decode" | "analyze">("encode");
  const [cipherType, setCipherType] = useState("caesar");
  const [inputText, setInputText] = useState("");
  const [key, setKey] = useState("");
  const [shift, setShift] = useState("3");
  const [result, setResult] = useState<CipherResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setResult(null);
    setAnalysis(null);

    try {
      if (mode === "analyze") {
        const response = await fetch("http://localhost:5000/api/scan/cipher-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: inputText }),
        });

        if (!response.ok) throw new Error("Analysis failed");
        const data = await response.json();
        setAnalysis(data);
      } else {
        const response = await fetch("http://localhost:5000/api/scan/cipher-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cipherType,
            operation: mode,
            input: inputText,
            key: cipherType === "caesar" || cipherType === "rot13" ? parseInt(shift) : key,
          }),
        });

        if (!response.ok) throw new Error("Processing failed");
        const data = await response.json();
        setResult(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const swapTexts = () => {
    if (result && mode !== "analyze") {
      setInputText(result.output);
      setMode(mode === "encode" ? "decode" : "encode");
      setResult(null);
    }
  };

  return (
    <CyberpunkCard title="CIPHER TOOL">
      <div className="space-y-6">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("encode");
              setResult(null);
              setAnalysis(null);
            }}
            className={`flex-1 px-4 py-2 rounded font-bold tracking-wide transition-colors ${
              mode === "encode"
                ? "bg-cyber-cyan text-black"
                : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30"
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            ENCODE
          </button>
          <button
            onClick={() => {
              setMode("decode");
              setResult(null);
              setAnalysis(null);
            }}
            className={`flex-1 px-4 py-2 rounded font-bold tracking-wide transition-colors ${
              mode === "decode"
                ? "bg-cyber-cyan text-black"
                : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30"
            }`}
          >
            <Unlock className="w-4 h-4 inline mr-2" />
            DECODE
          </button>
          <button
            onClick={() => {
              setMode("analyze");
              setResult(null);
              setAnalysis(null);
            }}
            className={`flex-1 px-4 py-2 rounded font-bold tracking-wide transition-colors ${
              mode === "analyze"
                ? "bg-cyber-cyan text-black"
                : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30"
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            ANALYZE
          </button>
        </div>

        {/* Cipher Selection (not for analyze mode) */}
        {mode !== "analyze" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                CIPHER TYPE
              </label>
              <Select value={cipherType} onValueChange={setCipherType}>
                <SelectTrigger className="bg-black/50 border-cyber-red/30 text-cyber-cyan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caesar">Caesar Cipher</SelectItem>
                  <SelectItem value="rot13">ROT13</SelectItem>
                  <SelectItem value="atbash">Atbash Cipher</SelectItem>
                  <SelectItem value="vigenere">Vigenère Cipher</SelectItem>
                  <SelectItem value="playfair">Playfair Cipher (Work in Progress)</SelectItem>
                  <SelectItem value="railfence">Rail Fence Cipher</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Key/Shift input based on cipher type */}
            {(cipherType === "caesar" || cipherType === "rot13") && (
              <div>
                <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                  SHIFT VALUE (1-25)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="25"
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
                  disabled={cipherType === "rot13"}
                />
              </div>
            )}

            {(cipherType === "vigenere" || cipherType === "playfair") && (
              <div>
                <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                  KEYWORD
                </label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Enter keyword"
                  className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
                />
              </div>
            )}

            {cipherType === "railfence" && (
              <div>
                <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
                  RAILS (2-10)
                </label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={key || "3"}
                  onChange={(e) => setKey(e.target.value)}
                  className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
                />
              </div>
            )}
          </div>
        )}

        {/* Input Text */}
        <div>
          <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
            INPUT TEXT
          </label>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={mode === "analyze" ? "Enter ciphertext to analyze..." : "Enter text to process..."}
            className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono h-32"
            disabled={isProcessing}
          />
        </div>

        {/* Process Button */}
        <Button
          onClick={handleProcess}
          disabled={isProcessing || !inputText.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              PROCESSING...
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              {mode === "analyze" ? "ANALYZE TEXT" : mode === "encode" ? "ENCODE TEXT" : "DECODE TEXT"}
            </>
          )}
        </Button>

        {/* Encode/Decode Result */}
        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-cyber-cyan">RESULT</h3>
                <div className="flex gap-2">
                  <button
                    onClick={swapTexts}
                    className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                    title="Swap input/output"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-cyber-cyan" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(result.output, "output")}
                    className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                  >
                    {copiedField === "output" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyber-cyan" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-400 mb-1">Cipher:</p>
                  <p className="text-cyber-cyan font-semibold">{result.cipherType}</p>
                </div>

                {result.key !== undefined && (
                  <div className="p-3 bg-black/30 rounded">
                    <p className="text-xs text-gray-400 mb-1">Key/Shift:</p>
                    <p className="text-cyber-cyan font-mono">{result.key}</p>
                  </div>
                )}

                <div className="p-3 bg-black/30 rounded">
                  <p className="text-xs text-gray-400 mb-1">Output:</p>
                  <p className="text-cyber-cyan font-mono break-all">{result.output}</p>
                </div>

                <div className="text-xs text-gray-400">
                  Processing time: {result.processingTime}ms
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Result */}
        {analysis && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-6">
            {/* Statistics */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-lg font-bold text-cyber-cyan mb-3">TEXT STATISTICS</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                <div className="p-2 bg-black/30 rounded text-center">
                  <p className="text-xl font-bold text-cyber-cyan">{analysis.statistics.length}</p>
                  <p className="text-xs text-gray-400">Total Chars</p>
                </div>
                <div className="p-2 bg-black/30 rounded text-center">
                  <p className="text-xl font-bold text-cyber-cyan">{analysis.statistics.letters}</p>
                  <p className="text-xs text-gray-400">Letters</p>
                </div>
                <div className="p-2 bg-black/30 rounded text-center">
                  <p className="text-xl font-bold text-cyber-cyan">{analysis.statistics.digits}</p>
                  <p className="text-xs text-gray-400">Digits</p>
                </div>
                <div className="p-2 bg-black/30 rounded text-center">
                  <p className="text-xl font-bold text-cyber-cyan">{analysis.statistics.spaces}</p>
                  <p className="text-xs text-gray-400">Spaces</p>
                </div>
              </div>
            </div>

            {/* Frequency Analysis */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-lg font-bold text-cyber-cyan mb-3">FREQUENCY ANALYSIS</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {Object.entries(analysis.frequencyAnalysis)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([char, count]) => (
                    <div key={char} className="flex items-center gap-2">
                      <span className="w-8 text-cyber-cyan font-mono font-bold">{char}:</span>
                      <div className="flex-1 bg-black/30 rounded h-6 relative">
                        <div
                          className="bg-cyber-cyan/30 h-full rounded"
                          style={{
                            width: `${(count / analysis.statistics.letters) * 100}%`,
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {count} ({((count / analysis.statistics.letters) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Possible Decryptions */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-lg font-bold text-cyber-cyan mb-3">POSSIBLE DECRYPTIONS</h3>
              <div className="space-y-3">
                {analysis.possibleCiphers.map((cipher, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-black/30 rounded hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-cyber-cyan">{cipher.type}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          cipher.confidence >= 70 ? "bg-green-500/20 text-green-400" :
                          cipher.confidence >= 50 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-orange-500/20 text-orange-400"
                        }`}>
                          {cipher.confidence}% confidence
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(cipher.decrypted, `decrypt-${idx}`)}
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                      >
                        {copiedField === `decrypt-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                        )}
                      </button>
                    </div>
                    {cipher.key !== undefined && (
                      <p className="text-xs text-gray-400 mb-1">Key: <span className="text-cyber-cyan font-mono">{cipher.key}</span></p>
                    )}
                    <p className="text-sm text-gray-400 font-mono break-all">{cipher.decrypted}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cipher Info */}
        <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
          <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Supported Ciphers</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Caesar:</strong> Shifts letters by a fixed number (e.g., shift 3: A→D)</li>
            <li><strong>ROT13:</strong> Caesar cipher with shift 13 (A→N)</li>
            <li><strong>Atbash:</strong> Reverses alphabet (A→Z, B→Y)</li>
            <li><strong>Vigenère:</strong> Uses repeating keyword for polyalphabetic substitution</li>
            <li><strong>Playfair:</strong> Digraph substitution using 5x5 grid</li>
            <li><strong>Rail Fence:</strong> Transposition cipher writing text in zigzag pattern</li>
          </ul>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default CipherTool;
