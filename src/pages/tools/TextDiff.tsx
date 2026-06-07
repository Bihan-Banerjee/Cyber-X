import { useState, useCallback } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";

type DiffMode = "line" | "word" | "char";

interface DiffLine {
  type: "same" | "added" | "removed";
  content: string;
  lineNumA?: number;
  lineNumB?: number;
}

const TextDiff = () => {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [mode, setMode] = useState<DiffMode>("line");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple LCS-based diff
  const computeDiff = useCallback((): DiffLine[] => {
    const split = (text: string): string[] => {
      if (mode === "line") return text.split("\n");
      if (mode === "word") return text.match(/\S+|\s+/g) || [];
      return text.split("");
    };

    const aTokens = split(textA);
    const bTokens = split(textB);

    // Build LCS table
    const m = aTokens.length;
    const n = bTokens.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (aTokens[i - 1] === bTokens[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack
    const result: DiffLine[] = [];
    let i = m, j = n;
    let lineNumA = m, lineNumB = n;

    const backtrack: DiffLine[] = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && aTokens[i - 1] === bTokens[j - 1]) {
        backtrack.push({ type: "same", content: aTokens[i - 1], lineNumA: i, lineNumB: j });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        backtrack.push({ type: "added", content: bTokens[j - 1], lineNumB: j });
        j--;
      } else {
        backtrack.push({ type: "removed", content: aTokens[i - 1], lineNumA: i });
        i--;
      }
    }

    return backtrack.reverse();
  }, [textA, textB, mode]);

  const diffLines = (textA || textB) ? computeDiff() : [];

  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  const generateUnifiedPatch = (): string => {
    const lines = textA.split("\n");
    const bLines = textB.split("\n");
    let patch = "--- a/text\n+++ b/text\n";

    const diff = computeDiff();
    let hunk = "@@ -1 +1 @@\n";
    diff.forEach((d) => {
      if (d.type === "same") hunk += ` ${d.content}\n`;
      else if (d.type === "removed") hunk += `-${d.content}\n`;
      else if (d.type === "added") hunk += `+${d.content}\n`;
    });
    return patch + hunk;
  };

  const modeClass = (m: DiffMode) =>
    `px-3 py-1 text-xs font-bold rounded border transition-colors ${
      mode === m
        ? "bg-cyber-red text-white border-cyber-red"
        : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"
    }`;

  return (
    <CyberpunkCard title="TEXT DIFF">
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-cyber-cyan text-xs tracking-wide">DIFF MODE:</span>
          <button className={modeClass("line")} onClick={() => setMode("line")}>LINE</button>
          <button className={modeClass("word")} onClick={() => setMode("word")}>WORD</button>
          <button className={modeClass("char")} onClick={() => setMode("char")}>CHARACTER</button>
        </div>

        {/* Input areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">ORIGINAL TEXT</label>
            <textarea
              className="w-full h-48 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-none"
              placeholder="Paste original text here..."
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">MODIFIED TEXT</label>
            <textarea
              className="w-full h-48 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-none"
              placeholder="Paste modified text here..."
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
            />
          </div>
        </div>

        {/* Stats */}
        {(textA || textB) && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold">
              +{addedCount} added
            </span>
            <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-bold">
              -{removedCount} removed
            </span>
            <span className="text-gray-500 text-xs">
              {diffLines.filter((l) => l.type === "same").length} unchanged
            </span>
            <div className="ml-auto">
              <Button
                size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
                onClick={() => copyToClipboard(generateUnifiedPatch())}
              >
                {copied ? <><CheckCircle className="w-3 h-3 mr-1" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy as Unified Patch</>}
              </Button>
            </div>
          </div>
        )}

        {/* Diff Output */}
        {diffLines.length > 0 && (
          <div className="glass-panel rounded p-4">
            <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">DIFF RESULT</h3>
            <div className="font-mono text-sm overflow-x-auto">
              {mode === "line" ? (
                <div className="space-y-0.5">
                  {diffLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-0.5 rounded ${
                        line.type === "added"
                          ? "bg-green-500/10 text-green-400"
                          : line.type === "removed"
                          ? "bg-red-500/10 text-red-400"
                          : "text-gray-400"
                      }`}
                    >
                      <span className="mr-2 text-xs opacity-50 select-none w-4 inline-block">
                        {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{line.content}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-all">
                  {diffLines.map((token, idx) => (
                    <span
                      key={idx}
                      className={
                        token.type === "added"
                          ? "bg-green-500/20 text-green-400"
                          : token.type === "removed"
                          ? "bg-red-500/20 text-red-400 line-through"
                          : "text-gray-300"
                      }
                    >
                      {token.content}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!textA && !textB && (
          <div className="glass-panel rounded p-8 text-center">
            <p className="text-gray-500 text-sm">Enter text in both panels to see the diff.</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default TextDiff;
