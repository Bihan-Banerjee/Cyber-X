import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, Check } from "lucide-react";

type Format = "base64" | "hex" | "url" | "binary";
type Operation = "encode" | "decode";

const Base64Encoder = () => {
  const [input, setInput] = useState("");
  const [activeFormat, setActiveFormat] = useState<Format>("base64");
  const [operation, setOperation] = useState<Operation>("encode");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const formats: { id: Format; label: string }[] = [
    { id: "base64", label: "Base64" },
    { id: "hex", label: "Hex" },
    { id: "url", label: "URL" },
    { id: "binary", label: "Binary" },
  ];

  const handleProcess = () => {
    if (!input.trim()) return;
    setError(null);
    setResult(null);

    try {
      let output = "";

      if (operation === "encode") {
        switch (activeFormat) {
          case "base64":
            output = btoa(unescape(encodeURIComponent(input)));
            break;
          case "hex":
            output = Array.from(new TextEncoder().encode(input))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            break;
          case "url":
            output = encodeURIComponent(input);
            break;
          case "binary":
            output = Array.from(new TextEncoder().encode(input))
              .map((b) => b.toString(2).padStart(8, "0"))
              .join(" ");
            break;
        }
      } else {
        switch (activeFormat) {
          case "base64":
            output = decodeURIComponent(escape(atob(input.trim())));
            break;
          case "hex": {
            const hex = input.trim().replace(/\s+/g, "");
            if (hex.length % 2 !== 0) throw new Error("Invalid hex string — odd number of characters");
            const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
            output = new TextDecoder().decode(bytes);
            break;
          }
          case "url":
            output = decodeURIComponent(input.trim());
            break;
          case "binary": {
            const parts = input.trim().split(/\s+/);
            const bytes = new Uint8Array(parts.map((b) => parseInt(b, 2)));
            output = new TextDecoder().decode(bytes);
            break;
          }
        }
      }

      setResult(output);
    } catch (err: any) {
      setError(err.message || "Failed to process input — check the format and try again");
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const byteLength = result ? new TextEncoder().encode(result).length : 0;

  return (
    <CyberpunkCard title="BASE64 / ENCODING TOOL">
      <div className="space-y-6">
        {/* Format tabs */}
        <div className="flex gap-1 p-1 bg-black/30 rounded border border-cyber-cyan/20">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => { setActiveFormat(f.id); setResult(null); setError(null); }}
              className={`flex-1 py-2 rounded text-sm font-bold tracking-wide transition-colors ${
                activeFormat === f.id
                  ? "bg-cyber-cyan text-black"
                  : "text-cyber-cyan hover:bg-cyber-cyan/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Operation toggle */}
        <div className="flex gap-2">
          {(["encode", "decode"] as Operation[]).map((op) => (
            <button
              key={op}
              onClick={() => { setOperation(op); setResult(null); setError(null); }}
              className={`flex-1 py-2 rounded text-sm font-bold tracking-wider transition-colors border ${
                operation === op
                  ? "bg-cyber-red text-white border-cyber-red"
                  : "bg-transparent text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/10"
              }`}
            >
              {op.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Input */}
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">INPUT</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste text to ${operation}...`}
            rows={5}
            className="w-full bg-black/50 border border-cyber-cyan/30 rounded p-3 text-cyber-cyan font-mono text-sm resize-none focus:outline-none focus:border-cyber-cyan/60"
          />
        </div>

        <Button
          onClick={handleProcess}
          disabled={!input.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider"
        >
          {operation === "encode" ? "ENCODE" : "DECODE"}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result !== null && (
          <div className="glass-panel rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-cyber-cyan font-bold tracking-wide">OUTPUT</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{byteLength} bytes</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <pre className="bg-black/50 border border-cyber-cyan/20 rounded p-3 text-cyber-cyan font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {result}
            </pre>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default Base64Encoder;
