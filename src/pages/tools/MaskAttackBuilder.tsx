import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, Trash2 } from "lucide-react";

const CHAR_CLASSES: { symbol: string; name: string; size: number; chars: string }[] = [
  { symbol: "?l", name: "lowercase", size: 26, chars: "abcdefghijklmnopqrstuvwxyz" },
  { symbol: "?u", name: "uppercase", size: 26, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { symbol: "?d", name: "digits", size: 10, chars: "0123456789" },
  { symbol: "?s", name: "special", size: 33, chars: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" },
  { symbol: "?a", name: "all printable", size: 95, chars: "all printable ASCII" },
];

const PRESETS = [
  { label: "Title+3digits", mask: "?u?l?l?l?l?d?d?d" },
  { label: "Lower+special", mask: "?l?l?l?l?l?l?s" },
  { label: "8-char mixed", mask: "?u?l?l?l?d?d?d?s" },
  { label: "6-digit PIN", mask: "?d?d?d?d?d?d" },
  { label: "Word+year", mask: "?u?l?l?l?l?d?d?d?d" },
  { label: "All lower 8", mask: "?l?l?l?l?l?l?l?l" },
];

const calcKeyspace = (mask: string): number => {
  const tokens = mask.match(/\?[luds a]/g) || [];
  return tokens.reduce((acc, token) => {
    const cls = CHAR_CLASSES.find((c) => c.symbol === token);
    return acc * (cls?.size ?? 1);
  }, 1);
};

const formatBig = (n: number): string => {
  if (n < 1e6) return n.toLocaleString();
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M`;
  if (n < 1e12) return `${(n / 1e9).toFixed(2)}B`;
  if (n < 1e15) return `${(n / 1e12).toFixed(2)}T`;
  return n.toExponential(2);
};

const formatTime = (seconds: number): string => {
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds < 86400 * 365) return `${(seconds / 86400).toFixed(1)}d`;
  return `${(seconds / (86400 * 365)).toExponential(2)} years`;
};

const MaskAttackBuilder = () => {
  const [mask, setMask] = useState("?u?l?l?l?d?d?d?d");
  const [hashType, setHashType] = useState("0");
  const [wordlistPath, setWordlistPath] = useState("hash.txt");
  const [copied, setCopied] = useState(false);

  const keyspace = calcKeyspace(mask);

  const addChar = (symbol: string) => setMask((m) => m + symbol);
  const clearMask = () => setMask("");

  const command = `hashcat -a 3 -m ${hashType} ${wordlistPath} ${mask}`;

  const copy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const speeds = [
    { label: "1M/s", rate: 1e6 },
    { label: "1G/s", rate: 1e9 },
    { label: "100G/s", rate: 1e11 },
  ];

  const tokenList = mask.match(/\?[luds a]/g) || [];

  return (
    <CyberpunkCard title="MASK ATTACK BUILDER">
      <div className="space-y-5">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">MASK PATTERN</label>
          <div className="flex gap-2">
            <input
              value={mask}
              onChange={(e) => setMask(e.target.value)}
              placeholder="?u?l?l?l?d?d?d?d"
              className="flex-1 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-2 text-lg font-mono focus:outline-none focus:border-cyber-cyan/60"
            />
            <Button onClick={clearMask} size="sm"
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {CHAR_CLASSES.map((cls) => (
              <button
                key={cls.symbol}
                onClick={() => addChar(cls.symbol)}
                className="px-3 py-1.5 rounded text-sm font-mono font-bold bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/40 transition-colors"
                title={`${cls.name} (${cls.size} chars)`}
              >
                {cls.symbol}
                <span className="text-xs text-gray-400 ml-1">({cls.name})</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PRESET MASKS</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setMask(p.mask)}
                className="px-3 py-1 rounded text-xs bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 hover:bg-cyber-cyan/20 transition-colors font-mono"
              >
                {p.label}: <span className="text-yellow-400">{p.mask}</span>
              </button>
            ))}
          </div>
        </div>

        {mask && (
          <>
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">MASK VISUALIZATION</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {tokenList.map((tok, i) => {
                  const cls = CHAR_CLASSES.find((c) => c.symbol === tok);
                  return (
                    <div key={i} className="text-center">
                      <div className="w-10 h-10 rounded bg-cyber-cyan/20 border border-cyber-cyan/40 flex items-center justify-center font-mono text-cyber-cyan font-bold text-sm">
                        {tok}
                      </div>
                      <span className="text-xs text-gray-500 block mt-1">{cls?.size ?? "?"}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-cyber-cyan font-mono">{tokenList.length}</p>
                  <p className="text-xs text-gray-400">Length</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-cyber-cyan font-mono">{formatBig(keyspace)}</p>
                  <p className="text-xs text-gray-400">Keyspace</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-cyber-cyan font-mono">{keyspace.toExponential(1)}</p>
                  <p className="text-xs text-gray-400">Scientific</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">CRACK TIME ESTIMATES</h3>
              <div className="space-y-2">
                {speeds.map(({ label, rate }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-mono font-bold text-cyber-cyan">{formatTime(keyspace / rate)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">HASHCAT COMMAND</h3>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Hash Type (-m)</label>
                  <input
                    value={hashType}
                    onChange={(e) => setHashType(e.target.value)}
                    className="w-full bg-black/50 border border-cyber-cyan/20 text-cyber-cyan rounded p-1.5 text-xs font-mono focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Hash file</label>
                  <input
                    value={wordlistPath}
                    onChange={(e) => setWordlistPath(e.target.value)}
                    className="w-full bg-black/50 border border-cyber-cyan/20 text-cyber-cyan rounded p-1.5 text-xs font-mono focus:outline-none"
                    placeholder="hash.txt"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between bg-black/40 rounded p-3">
                <code className="text-xs text-green-400 font-mono break-all flex-1">{command}</code>
                <Button onClick={copy} size="sm"
                  className="ml-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs flex-shrink-0">
                  <Copy className="w-3 h-3 mr-1" />{copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Common hash modes: 0=MD5, 100=SHA1, 1400=SHA256, 3200=bcrypt, 1000=NTLM</p>
            </div>
          </>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default MaskAttackBuilder;
