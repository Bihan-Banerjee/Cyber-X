import { useState, useMemo } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

const QUICK_REF = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
  { label: "URL", pattern: "https?:\\/\\/[^\\s/$.?#].[^\\s]*" },
  { label: "Phone (US)", pattern: "\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}" },
  { label: "Date (YYYY-MM-DD)", pattern: "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])" },
  { label: "Hex Color", pattern: "#(?:[0-9a-fA-F]{3}){1,2}" },
  { label: "Credit Card", pattern: "\\b(?:\\d{4}[\\s-]?){3}\\d{4}\\b" },
  { label: "JWT Token", pattern: "ey[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+" },
  { label: "MD5 Hash", pattern: "\\b[0-9a-fA-F]{32}\\b" },
  { label: "Private Key Begin", pattern: "-----BEGIN [A-Z ]+-----" },
];

const RegexTester = () => {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [testString, setTestString] = useState("");

  const { matches, highlighted, groups, error } = useMemo(() => {
    if (!pattern) return { matches: [], highlighted: testString, groups: [], error: null };
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const matches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(testString)) !== null) {
        matches.push(m);
        if (!flags.includes("g")) break;
        if (m.index === re.lastIndex) re.lastIndex++;
        if (matches.length > 500) break;
      }

      // Build highlighted output
      let highlighted = "";
      let last = 0;
      const sortedMatches = [...matches].sort((a, b) => a.index - b.index);
      for (const match of sortedMatches) {
        highlighted += escapeHtml(testString.slice(last, match.index));
        highlighted += `<mark class="bg-cyber-cyan/20 text-cyber-cyan rounded px-0.5">${escapeHtml(match[0])}</mark>`;
        last = match.index + match[0].length;
      }
      highlighted += escapeHtml(testString.slice(last));

      // Capture groups
      const groups = matches.flatMap((m) =>
        m.slice(1).map((g, gi) => ({ match: m[0], group: gi + 1, value: g ?? "(no match)" }))
      );

      return { matches, highlighted, groups, error: null };
    } catch (e: any) {
      return { matches: [], highlighted: escapeHtml(testString), groups: [], error: e.message };
    }
  }, [pattern, flags, testString]);

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const applyQuickRef = (p: string) => {
    setPattern(p);
    if (!flags.includes("g")) setFlags("g");
  };

  return (
    <CyberpunkCard title="REGEX TESTER">
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PATTERN</label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="[a-z]+"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">FLAGS</label>
            <Input
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="gi"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TEST STRING</label>
          <textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="Enter text to test against your pattern..."
            rows={5}
            className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-y focus:outline-none focus:border-cyber-cyan/60"
          />
        </div>

        {testString && pattern && !error && (
          <>
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">HIGHLIGHTED MATCHES</h3>
                <span className={`text-sm font-bold ${matches.length > 0 ? "text-green-400" : "text-gray-500"}`}>
                  {matches.length} match{matches.length !== 1 ? "es" : ""}
                </span>
              </div>
              <div
                className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-all p-2 bg-black/40 rounded"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </div>

            {groups.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide text-sm mb-3">CAPTURE GROUPS</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-cyber-cyan/20">
                        <th className="text-left text-cyber-cyan tracking-wider py-1 pr-4">MATCH</th>
                        <th className="text-left text-cyber-cyan tracking-wider py-1 pr-4">GROUP</th>
                        <th className="text-left text-cyber-cyan tracking-wider py-1">VALUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.slice(0, 50).map((g, i) => (
                        <tr key={i} className="border-b border-cyber-cyan/10">
                          <td className="py-1 pr-4 text-yellow-400 font-mono">{g.match}</td>
                          <td className="py-1 pr-4 text-gray-400">{g.group}</td>
                          <td className="py-1 text-green-400 font-mono">{g.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <div className="glass-panel rounded p-4">
          <h3 className="text-cyber-cyan font-bold tracking-wide text-sm mb-3">QUICK REFERENCE PATTERNS</h3>
          <div className="flex flex-wrap gap-2">
            {QUICK_REF.map((ref) => (
              <button
                key={ref.label}
                onClick={() => applyQuickRef(ref.pattern)}
                className="px-3 py-1 rounded text-xs bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30 transition-colors font-mono"
              >
                {ref.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default RegexTester;
