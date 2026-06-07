import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from "lucide-react";

const URLEncoder = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const operations: { label: string; key: string; fn: (s: string) => string }[] = [
    { label: "URL Encode", key: "url-encode", fn: (s) => encodeURIComponent(s) },
    { label: "URL Decode", key: "url-decode", fn: (s) => { try { return decodeURIComponent(s); } catch { return s; } } },
    {
      label: "Double URL Encode", key: "double-url-encode",
      fn: (s) => encodeURIComponent(encodeURIComponent(s)),
    },
    {
      label: "HTML Entity Encode", key: "html-encode",
      fn: (s) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
    },
    {
      label: "HTML Entity Decode", key: "html-decode",
      fn: (s) =>
        s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    },
    {
      label: "Unicode Escape", key: "unicode-escape",
      fn: (s) => Array.from(s).map((c) => {
        const code = c.codePointAt(0)!;
        return code > 127 ? `\\u${code.toString(16).padStart(4, "0")}` : c;
      }).join(""),
    },
    {
      label: "Unicode Unescape", key: "unicode-unescape",
      fn: (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16))),
    },
  ];

  const handleOperation = (op: (typeof operations)[0]) => {
    setActiveOp(op.key);
    setOutput(op.fn(input));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSwap = () => {
    setInput(output);
    setOutput("");
    setActiveOp(null);
  };

  const getDiff = () => {
    if (!input || !output || input === output) return null;
    const result: { char: string; changed: boolean; inputChar: string }[] = [];
    const maxLen = Math.max(input.length, output.length);
    for (let i = 0; i < Math.min(maxLen, 200); i++) {
      const ic = input[i] ?? "";
      const oc = output[i] ?? "";
      result.push({ char: oc, changed: ic !== oc, inputChar: ic });
    }
    return result;
  };

  const diff = getDiff();

  return (
    <CyberpunkCard title="URL ENCODER / DECODER">
      <div className="space-y-6">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">INPUT</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text to encode or decode..."
            rows={5}
            className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-y focus:outline-none focus:border-cyber-cyan/60"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {operations.map((op) => (
            <Button
              key={op.key}
              onClick={() => handleOperation(op)}
              disabled={!input}
              className={
                activeOp === op.key
                  ? "bg-cyber-red hover:bg-cyber-red/80 text-white font-bold text-xs"
                  : "bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
              }
              size="sm"
            >
              {op.label}
            </Button>
          ))}
        </div>

        {output && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-cyber-cyan tracking-wider">OUTPUT</label>
                <div className="flex gap-2">
                  <Button onClick={handleSwap} size="sm"
                    className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
                    <RefreshCw className="w-3 h-3 mr-1" />Swap to Input
                  </Button>
                  <Button onClick={handleCopy} size="sm"
                    className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
                    <Copy className="w-3 h-3 mr-1" />{copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
              <textarea
                readOnly
                value={output}
                rows={5}
                className="w-full bg-black/50 border border-cyber-cyan/30 text-green-400 rounded p-3 text-sm font-mono resize-y focus:outline-none"
              />
            </div>

            {diff && (
              <div className="glass-panel rounded p-4">
                <p className="text-xs text-cyber-cyan tracking-wider mb-2">CHARACTER DIFF (first 200 chars)</p>
                <div className="font-mono text-xs flex flex-wrap gap-0 break-all">
                  {diff.map((d, i) => (
                    <span
                      key={i}
                      className={d.changed ? "bg-yellow-500/30 text-yellow-300" : "text-gray-400"}
                      title={d.changed ? `Input: "${d.inputChar}" → Output: "${d.char}"` : undefined}
                    >
                      {d.char || " "}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <span className="inline-block w-3 h-3 bg-yellow-500/30 mr-1" />= changed characters
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default URLEncoder;
