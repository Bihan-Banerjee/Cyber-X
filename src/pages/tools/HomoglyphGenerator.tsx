import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle } from "lucide-react";

type Tab = "homoglyph" | "typosquatting";

interface HomoglyphVariant {
  original: string;
  lookalike: string;
  codePoint: string;
  script: string;
}

interface TypoVariant {
  domain: string;
  type: string;
}

const HOMOGLYPH_MAP: Record<string, { char: string; code: string; script: string }[]> = {
  a: [
    { char: "а", code: "U+0430", script: "Cyrillic" },
    { char: "α", code: "U+03B1", script: "Greek" },
    { char: "ɑ", code: "U+0251", script: "Latin IPA" },
  ],
  e: [
    { char: "е", code: "U+0435", script: "Cyrillic" },
    { char: "ε", code: "U+03B5", script: "Greek" },
  ],
  o: [
    { char: "о", code: "U+043E", script: "Cyrillic" },
    { char: "ο", code: "U+03BF", script: "Greek" },
    { char: "0", code: "U+0030", script: "Digit" },
  ],
  c: [
    { char: "с", code: "U+0441", script: "Cyrillic" },
    { char: "ϲ", code: "U+03F2", script: "Greek" },
  ],
  p: [
    { char: "р", code: "U+0440", script: "Cyrillic" },
    { char: "ρ", code: "U+03C1", script: "Greek" },
  ],
  x: [
    { char: "х", code: "U+0445", script: "Cyrillic" },
    { char: "χ", code: "U+03C7", script: "Greek" },
  ],
  i: [
    { char: "і", code: "U+0456", script: "Cyrillic" },
    { char: "ι", code: "U+03B9", script: "Greek" },
    { char: "1", code: "U+0031", script: "Digit" },
    { char: "l", code: "U+006C", script: "Latin l" },
  ],
  l: [
    { char: "ӏ", code: "U+04CF", script: "Cyrillic" },
    { char: "1", code: "U+0031", script: "Digit" },
    { char: "I", code: "U+0049", script: "Latin I" },
  ],
  n: [
    { char: "п", code: "U+043F", script: "Cyrillic" },
    { char: "η", code: "U+03B7", script: "Greek" },
  ],
  m: [
    { char: "м", code: "U+043C", script: "Cyrillic" },
  ],
  s: [
    { char: "ѕ", code: "U+0455", script: "Cyrillic" },
    { char: "ƨ", code: "U+01A8", script: "Latin" },
  ],
  b: [
    { char: "б", code: "U+0431", script: "Cyrillic" },
    { char: "ƅ", code: "U+0185", script: "Latin" },
  ],
  g: [
    { char: "ɡ", code: "U+0261", script: "Latin IPA" },
  ],
  k: [
    { char: "κ", code: "U+03BA", script: "Greek" },
  ],
  u: [
    { char: "υ", code: "U+03C5", script: "Greek" },
    { char: "ü", code: "U+00FC", script: "Latin" },
  ],
  v: [
    { char: "ν", code: "U+03BD", script: "Greek" },
  ],
  y: [
    { char: "у", code: "U+0443", script: "Cyrillic" },
    { char: "γ", code: "U+03B3", script: "Greek" },
  ],
  h: [
    { char: "հ", code: "U+0570", script: "Armenian" },
  ],
  t: [
    { char: "τ", code: "U+03C4", script: "Greek" },
  ],
};

const ADJACENT_KEYS: Record<string, string[]> = {
  a: ["q", "w", "s", "z"],
  b: ["v", "g", "h", "n"],
  c: ["x", "d", "f", "v"],
  d: ["s", "e", "r", "f", "c", "x"],
  e: ["w", "r", "d", "s"],
  f: ["d", "r", "t", "g", "v", "c"],
  g: ["f", "t", "y", "h", "b", "v"],
  h: ["g", "y", "u", "j", "n", "b"],
  i: ["u", "o", "j", "k"],
  j: ["h", "u", "i", "k", "n", "m"],
  k: ["j", "i", "o", "l", "m"],
  l: ["k", "o", "p"],
  m: ["n", "j", "k"],
  n: ["b", "h", "j", "m"],
  o: ["i", "p", "k", "l"],
  p: ["o", "l"],
  q: ["w", "a"],
  r: ["e", "t", "d", "f"],
  s: ["a", "w", "e", "d", "z", "x"],
  t: ["r", "y", "f", "g"],
  u: ["y", "i", "h", "j"],
  v: ["c", "f", "g", "b"],
  w: ["q", "e", "a", "s"],
  x: ["z", "s", "d", "c"],
  y: ["t", "u", "g", "h"],
  z: ["a", "s", "x"],
};

const TLDS = [".com", ".net", ".org", ".io", ".co", ".info", ".biz", ".us"];

const HomoglyphGenerator = () => {
  const [activeTab, setActiveTab] = useState<Tab>("homoglyph");
  const [domain, setDomain] = useState("");
  const [homoglyphVariants, setHomoglyphVariants] = useState<{ domain: string; variants: HomoglyphVariant[] }[]>([]);
  const [typoVariants, setTypoVariants] = useState<TypoVariant[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateHomoglyphs = () => {
    if (!domain) return;
    const parts = domain.toLowerCase().split(".");
    const name = parts[0];
    const tld = parts.slice(1).join(".");

    const perChar: { domain: string; variants: HomoglyphVariant[] }[] = [];

    for (let i = 0; i < name.length; i++) {
      const ch = name[i];
      const glyphs = HOMOGLYPH_MAP[ch];
      if (glyphs) {
        const charVariants: HomoglyphVariant[] = glyphs.map((g) => ({
          original: ch,
          lookalike: g.char,
          codePoint: g.code,
          script: g.script,
        }));

        // Build the lookalike domain with replaced char
        const variantDomains = glyphs.map((g) => {
          const newName = name.slice(0, i) + g.char + name.slice(i + 1);
          return tld ? `${newName}.${tld}` : newName;
        });

        perChar.push({
          domain: variantDomains[0],
          variants: charVariants,
        });
      }
    }

    setHomoglyphVariants(perChar);
  };

  const generateTyposquats = () => {
    if (!domain) return;
    const parts = domain.toLowerCase().split(".");
    const name = parts[0];
    const tld = parts.length > 1 ? "." + parts.slice(1).join(".") : ".com";
    const results: TypoVariant[] = [];
    const seen = new Set<string>();

    const add = (d: string, type: string) => {
      if (!seen.has(d) && d !== domain.toLowerCase()) {
        seen.add(d);
        results.push({ domain: d, type });
      }
    };

    // Adjacent key swaps
    for (let i = 0; i < name.length; i++) {
      const ch = name[i];
      const adj = ADJACENT_KEYS[ch] || [];
      for (const replacement of adj) {
        add(name.slice(0, i) + replacement + name.slice(i + 1) + tld, "Adjacent Key");
      }
    }

    // Doubled letters
    for (let i = 0; i < name.length; i++) {
      add(name.slice(0, i) + name[i] + name[i] + name.slice(i + 1) + tld, "Doubled Letter");
    }

    // Missing letters
    for (let i = 0; i < name.length; i++) {
      add(name.slice(0, i) + name.slice(i + 1) + tld, "Missing Letter");
    }

    // TLD swaps
    for (const newTld of TLDS) {
      if (newTld !== tld) {
        add(name + newTld, "TLD Swap");
      }
    }

    // Transpositions
    for (let i = 0; i < name.length - 1; i++) {
      const swapped = name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
      add(swapped + tld, "Transposition");
    }

    setTypoVariants(results.slice(0, 100));
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-bold tracking-wide transition-colors ${
      activeTab === t
        ? "bg-cyber-red text-white"
        : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"
    } rounded`;

  return (
    <CyberpunkCard title="HOMOGLYPH GENERATOR">
      <div className="space-y-6">
        <div className="flex gap-2 flex-wrap">
          <button className={tabClass("homoglyph")} onClick={() => setActiveTab("homoglyph")}>HOMOGLYPH VARIANTS</button>
          <button className={tabClass("typosquatting")} onClick={() => setActiveTab("typosquatting")}>TYPOSQUATTING</button>
        </div>

        <div className="glass-panel rounded p-4 space-y-3">
          <label className="block text-sm text-cyber-cyan tracking-wide">TARGET DOMAIN</label>
          <div className="flex gap-2">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. example.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            />
            <Button
              className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold shrink-0"
              onClick={() => {
                generateHomoglyphs();
                generateTyposquats();
              }}
              disabled={!domain}
            >
              GENERATE
            </Button>
          </div>
        </div>

        {activeTab === "homoglyph" && homoglyphVariants.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-cyber-cyan font-bold tracking-wide">LOOKALIKE VARIANTS ({homoglyphVariants.length} characters replaced)</h3>
              <Button
                size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
                onClick={() => copyToClipboard(homoglyphVariants.map((v) => v.domain).join("\n"), "all-homo")}
              >
                {copied === "all-homo" ? <><CheckCircle className="w-3 h-3 mr-1" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy All</>}
              </Button>
            </div>

            {homoglyphVariants.map((item, idx) => (
              <div key={idx} className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-cyber-cyan font-mono text-sm">{item.domain}</p>
                  <Button
                    size="sm"
                    className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
                    onClick={() => copyToClipboard(item.domain, `homo-${idx}`)}
                  >
                    {copied === `homo-${idx}` ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left pb-1">Original</th>
                      <th className="text-left pb-1">Lookalike</th>
                      <th className="text-left pb-1">Code Point</th>
                      <th className="text-left pb-1">Script</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.variants.map((v, vi) => (
                      <tr key={vi} className="border-t border-cyber-cyan/10">
                        <td className="py-1 text-white font-mono">{v.original}</td>
                        <td className="py-1 text-yellow-400 font-mono">{v.lookalike}</td>
                        <td className="py-1 text-gray-400 font-mono">{v.codePoint}</td>
                        <td className="py-1 text-gray-400">{v.script}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {activeTab === "typosquatting" && typoVariants.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-cyber-cyan font-bold tracking-wide">TYPOSQUATTING VARIANTS ({typoVariants.length})</h3>
              <Button
                size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
                onClick={() => copyToClipboard(typoVariants.map((v) => v.domain).join("\n"), "all-typo")}
              >
                {copied === "all-typo" ? <><CheckCircle className="w-3 h-3 mr-1" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy All</>}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-cyber-cyan/20">
                    <th className="text-left pb-2">Domain</th>
                    <th className="text-left pb-2">Type</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {typoVariants.map((v, i) => (
                    <tr key={i} className="border-b border-cyber-cyan/10 hover:bg-black/20">
                      <td className="py-1.5 text-cyber-cyan font-mono">{v.domain}</td>
                      <td className="py-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          v.type === "Adjacent Key" ? "bg-orange-500/20 text-orange-400" :
                          v.type === "TLD Swap" ? "bg-red-500/20 text-red-400" :
                          v.type === "Missing Letter" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>
                          {v.type}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <button
                          className="text-gray-400 hover:text-cyber-cyan"
                          onClick={() => copyToClipboard(v.domain, `typo-${i}`)}
                        >
                          {copied === `typo-${i}` ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default HomoglyphGenerator;
