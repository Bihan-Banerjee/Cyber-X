import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, AlertCircle } from "lucide-react";

type Tab = "js-minify" | "js-obfuscate" | "css-minify";

const CodeObfuscator = () => {
  const [activeTab, setActiveTab] = useState<Tab>("js-minify");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ before: number; after: number } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jsMinify = (code: string): string => {
    return code
      // Remove single-line comments (not inside strings)
      .replace(/\/\/[^\n]*/g, "")
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      // Remove spaces around operators/punctuation
      .replace(/\s*([{}();,=+\-*/<>!&|?:])\s*/g, "$1")
      // Remove trailing/leading spaces
      .trim();
  };

  const jsObfuscate = (code: string): string => {
    // Basic: minify first
    let result = jsMinify(code);

    // Variable renaming: find var/let/const declarations
    const varMap: Record<string, string> = {};
    let counter = 0;

    const genName = () => {
      const chars = "abcdefghijklmnopqrstuvwxyz";
      let name = "_0x";
      let n = counter++;
      do {
        name += chars[n % chars.length];
        n = Math.floor(n / chars.length);
      } while (n > 0);
      return name;
    };

    // Find variable declarations
    result = result.replace(/\b(var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (match, keyword, varName) => {
      if (!["undefined", "null", "true", "false", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "delete", "typeof", "instanceof", "this", "class", "extends", "super", "import", "export", "default", "try", "catch", "finally", "throw", "yield", "async", "await"].includes(varName)) {
        if (!varMap[varName]) {
          varMap[varName] = genName();
        }
        return `${keyword} ${varMap[varName]}`;
      }
      return match;
    });

    // Replace usages
    for (const [original, renamed] of Object.entries(varMap)) {
      const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      result = result.replace(regex, renamed);
    }

    // Encode string literals to hex
    result = result.replace(/"([^"\\]*)"|'([^'\\]*)'/g, (match, d, s) => {
      const str = d ?? s;
      if (str.length === 0) return match;
      const hex = Array.from(str)
        .map((c) => "\\x" + (c as string).charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
      return `"${hex}"`;
    });

    return result;
  };

  const cssMinify = (code: string): string => {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>~+])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  };

  const process = () => {
    if (!input.trim()) return;
    let result = "";
    if (activeTab === "js-minify") result = jsMinify(input);
    else if (activeTab === "js-obfuscate") result = jsObfuscate(input);
    else result = cssMinify(input);

    setOutput(result);
    setStats({ before: input.length, after: result.length });
  };

  const reduction = stats ? Math.round(((stats.before - stats.after) / stats.before) * 100) : 0;

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-bold tracking-wide transition-colors rounded ${
      activeTab === t
        ? "bg-cyber-red text-white"
        : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
    }`;

  return (
    <CyberpunkCard title="CODE OBFUSCATOR">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button className={tabClass("js-minify")} onClick={() => { setActiveTab("js-minify"); setOutput(""); setStats(null); }}>JS MINIFIER</button>
          <button className={tabClass("js-obfuscate")} onClick={() => { setActiveTab("js-obfuscate"); setOutput(""); setStats(null); }}>JS OBFUSCATOR</button>
          <button className={tabClass("css-minify")} onClick={() => { setActiveTab("css-minify"); setOutput(""); setStats(null); }}>CSS MINIFIER</button>
        </div>

        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Basic implementation. JS obfuscation renames variables and encodes strings. Not suitable for production security-critical use.</p>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">INPUT CODE</label>
          <textarea
            className="w-full h-48 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-none"
            placeholder={activeTab === "css-minify" ? "Paste CSS here..." : "Paste JavaScript here..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <p className="text-gray-500 text-xs mt-1">{input.length} characters</p>
        </div>

        <Button
          className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold w-full"
          onClick={process}
          disabled={!input.trim()}
        >
          {activeTab === "js-obfuscate" ? "OBFUSCATE" : "MINIFY"}
        </Button>

        {output && (
          <div className="space-y-3">
            {stats && (
              <div className="flex gap-3 flex-wrap">
                <div className="p-2 bg-black/50 border border-cyber-cyan/20 rounded text-center">
                  <p className="text-cyber-cyan font-mono font-bold">{stats.before}</p>
                  <p className="text-xs text-gray-500">Before</p>
                </div>
                <div className="p-2 bg-black/50 border border-cyber-cyan/20 rounded text-center">
                  <p className="text-cyber-cyan font-mono font-bold">{stats.after}</p>
                  <p className="text-xs text-gray-500">After</p>
                </div>
                <div className={`p-2 border rounded text-center ${reduction > 0 ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  <p className={`font-mono font-bold ${reduction > 0 ? "text-green-400" : "text-red-400"}`}>{reduction}%</p>
                  <p className="text-xs text-gray-500">Reduction</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-cyber-cyan tracking-wide">OUTPUT</label>
                <Button
                  size="sm"
                  className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
                  onClick={() => copyToClipboard(output)}
                >
                  {copied ? <><CheckCircle className="w-3 h-3 mr-1" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                </Button>
              </div>
              <textarea
                readOnly
                className="w-full h-48 bg-black/50 border border-green-500/30 text-green-400 rounded p-3 text-sm font-mono resize-none"
                value={output}
              />
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CodeObfuscator;
