import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, Check, Minimize2, Maximize2, AlertCircle } from "lucide-react";

type Mode = "json" | "xml";

function formatXML(xml: string): string {
  const PADDING = "  ";
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;
  const formatted = xml.replace(reg, "$1\n$2$3");
  return formatted
    .split("\n")
    .map((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/) && pad !== 0) {
        pad -= 1;
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }
      const result = PADDING.repeat(pad) + node;
      pad += indent;
      return result;
    })
    .join("\n");
}

function minifyXML(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

const JSONBeautifier = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("json");
  const [minified, setMinified] = useState(false);
  const [copied, setCopied] = useState(false);

  const detect = (val: string): Mode => {
    const trimmed = val.trim();
    if (trimmed.startsWith("<")) return "xml";
    return "json";
  };

  const process = (val: string, forceMode?: Mode, forceMinify?: boolean) => {
    const currentMode = forceMode ?? detect(val);
    const currentMinify = forceMinify ?? minified;
    setMode(currentMode);
    setError(null);

    if (!val.trim()) {
      setOutput("");
      return;
    }

    try {
      if (currentMode === "json") {
        const parsed = JSON.parse(val);
        setOutput(currentMinify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2));
      } else {
        const parser = new DOMParser();
        const doc = parser.parseFromString(val, "text/xml");
        const parseError = doc.querySelector("parseerror");
        if (parseError) throw new Error("Invalid XML: " + parseError.textContent);
        const serialized = new XMLSerializer().serializeToString(doc);
        setOutput(currentMinify ? minifyXML(serialized) : formatXML(serialized));
      }
    } catch (err: any) {
      setError(err.message || "Parse error");
      setOutput("");
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    process(val);
  };

  const handleMinifyToggle = () => {
    const next = !minified;
    setMinified(next);
    process(input, undefined, next);
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <CyberpunkCard title="JSON / XML BEAUTIFIER">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Detected:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
              mode === "json"
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-purple-500/20 text-purple-400 border-purple-500/30"
            }`}>
              {mode.toUpperCase()}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleMinifyToggle}
              className="flex items-center gap-1 px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors"
            >
              {minified ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              {minified ? "Beautify" : "Minify"}
            </button>
            {output && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy Output"}
              </button>
            )}
          </div>
        </div>

        {/* Split panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">INPUT</label>
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={'Paste JSON or XML here...\n{\n  "key": "value"\n}'}
              rows={20}
              className="w-full bg-black/50 border border-cyber-cyan/30 rounded p-3 text-cyber-cyan font-mono text-xs resize-none focus:outline-none focus:border-cyber-cyan/60"
            />
          </div>

          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">
              OUTPUT {output && <span className="text-gray-500 ml-1">({output.length.toLocaleString()} chars)</span>}
            </label>
            {error ? (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm h-full">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-mono text-xs break-all">{error}</span>
              </div>
            ) : (
              <textarea
                value={output}
                readOnly
                rows={20}
                placeholder="Formatted output will appear here..."
                className="w-full bg-black/30 border border-cyber-cyan/20 rounded p-3 text-green-400 font-mono text-xs resize-none focus:outline-none"
              />
            )}
          </div>
        </div>

        {!error && input && output && (
          <div className="flex justify-end">
            <Button
              onClick={handleCopy}
              className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
              size="sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Output
            </Button>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default JSONBeautifier;
