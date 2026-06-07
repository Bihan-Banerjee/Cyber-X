import { useState, useCallback } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";

const computeEntropy = (s: string): number => {
  if (!s) return 0;
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  const len = s.length;
  return -Object.values(freq).reduce((acc, count) => {
    const p = count / len;
    return acc + p * Math.log2(p);
  }, 0);
};

const getCharFreq = (s: string): { char: string; count: number; pct: number }[] => {
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  const max = Math.max(...Object.values(freq));
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([char, count]) => ({ char, count, pct: (count / max) * 100 }));
};

const getVerdict = (entropy: number): { label: string; color: string; cases: string } => {
  if (entropy < 2) return { label: "VERY LOW", color: "text-blue-400", cases: "Simple/repetitive text, not random" };
  if (entropy < 3.5) return { label: "LOW", color: "text-blue-400", cases: "Human-readable text, passwords with patterns" };
  if (entropy < 5) return { label: "MEDIUM", color: "text-yellow-400", cases: "Mixed content, moderate randomness" };
  if (entropy < 6.5) return { label: "HIGH", color: "text-orange-400", cases: "Random strings, API keys, tokens" };
  return { label: "VERY HIGH", color: "text-red-400", cases: "Encrypted/compressed data, high randomness (possible obfuscation)" };
};

const EntropyAnalyzer = () => {
  const [input, setInput] = useState("");

  const entropy = input ? computeEntropy(input) : null;
  const freq = input ? getCharFreq(input) : [];
  const verdict = entropy !== null ? getVerdict(entropy) : null;

  const handleExample = useCallback(() => {
    setInput("Hello World! This is a sample text for entropy analysis. The quick brown fox jumps over the lazy dog.");
  }, []);

  const handleRandom = useCallback(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    setInput(Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  }, []);

  return (
    <CyberpunkCard title="ENTROPY ANALYZER">
      <div className="space-y-6">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">INPUT TEXT</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text, hash, token, encoded data, or any string to analyze..."
            rows={5}
            className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-y focus:outline-none focus:border-cyber-cyan/60"
          />
          <div className="flex gap-2 mt-2">
            <Button onClick={handleExample} size="sm"
              className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
              Load Example Text
            </Button>
            <Button onClick={handleRandom} size="sm"
              className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
              Load Random (High Entropy)
            </Button>
          </div>
        </div>

        {entropy !== null && verdict && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan font-mono">{entropy.toFixed(4)}</p>
                <p className="text-xs text-gray-400">Bits / Character</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan font-mono">{input.length}</p>
                <p className="text-xs text-gray-400">Characters</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-2xl font-bold text-cyber-cyan font-mono">
                  {new Set(input).size}
                </p>
                <p className="text-xs text-gray-400">Unique Chars</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className={`text-xl font-bold ${verdict.color}`}>{verdict.label}</p>
                <p className="text-xs text-gray-400">Entropy Level</p>
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-2">VERDICT</h3>
              <p className={`text-sm font-bold ${verdict.color}`}>{verdict.label} ENTROPY</p>
              <p className="text-sm text-gray-400 mt-1">{verdict.cases}</p>
              <div className="mt-3">
                <div className="w-full bg-black/40 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      entropy < 3.5 ? "bg-blue-500" :
                      entropy < 5 ? "bg-yellow-500" :
                      entropy < 6.5 ? "bg-orange-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min((entropy / 8) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0 (no entropy)</span>
                  <span>8 (max entropy)</span>
                </div>
              </div>
            </div>

            {freq.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">CHARACTER FREQUENCY (top 30)</h3>
                <div className="space-y-1">
                  {freq.map(({ char, count, pct }) => (
                    <div key={char} className="flex items-center gap-2">
                      <span className="w-8 text-xs text-yellow-400 font-mono text-right flex-shrink-0">
                        {char === " " ? "SPC" : char === "\n" ? "\\n" : char === "\t" ? "\\t" : char}
                      </span>
                      <div className="flex-1 bg-black/40 rounded h-4 overflow-hidden">
                        <div
                          className="h-full bg-cyber-cyan/40 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-gray-400 font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!input && (
          <div className="glass-panel rounded p-6 text-center">
            <p className="text-gray-500 text-sm">Enter text above to calculate Shannon entropy</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default EntropyAnalyzer;
