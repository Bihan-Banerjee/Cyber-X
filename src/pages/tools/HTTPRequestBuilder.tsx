import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Plus, Trash2, Send } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface HttpResponse {
  statusCode: number;
  statusText: string;
  responseTime: number;
  headers: Record<string, string>;
  body: string;
  size: number;
  redirectChain?: string[];
}

const HTTPRequestBuilder = () => {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headerRows, setHeaderRows] = useState([{ key: "", value: "" }]);
  const [body, setBody] = useState("");
  const [followRedirects, setFollowRedirects] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HttpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addHeader = () => setHeaderRows([...headerRows, { key: "", value: "" }]);
  const removeHeader = (i: number) => setHeaderRows(headerRows.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const rows = [...headerRows];
    rows[i] = { ...rows[i], [field]: val };
    setHeaderRows(rows);
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      headerRows.forEach(({ key, value }) => { if (key.trim()) headers[key.trim()] = value; });
      const response = await fetch(`${API_BASE_URL}/api/scan/http-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, url: url.trim(), headers, body: body || undefined, timeoutMs: 15000, followRedirects }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Request failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "HTTP request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const statusColor = (code: number) => code < 300 ? "text-green-400 bg-green-500/10 border-green-500/30" : code < 400 ? "text-blue-400 bg-blue-500/10 border-blue-500/30" : code < 500 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" : "text-red-400 bg-red-500/10 border-red-500/30";

  return (
    <CyberpunkCard title="HTTP REQUEST BUILDER">
      <div className="space-y-6">
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-sm font-bold w-28"
            disabled={isLoading}
          >
            {["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/api/endpoint"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !url.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-4"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        <div className="glass-panel rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-cyber-cyan font-bold tracking-wide">HEADERS</h3>
            <Button onClick={addHeader} size="sm" className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30">
              <Plus className="w-3 h-3 mr-1" />Add
            </Button>
          </div>
          <div className="space-y-2">
            {headerRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                  placeholder="Header name"
                  className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs"
                />
                <Input
                  value={row.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                  placeholder="Header value"
                  className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs"
                />
                <Button onClick={() => removeHeader(i)} size="sm" className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {["POST", "PUT", "PATCH"].includes(method) && (
          <div className="glass-panel rounded p-4">
            <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">BODY</h3>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"key": "value"}'
              rows={6}
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-xs font-mono resize-y"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={followRedirects}
              onChange={(e) => setFollowRedirects(e.target.checked)}
              className="accent-cyber-red"
            />
            <span className="text-sm text-gray-400">Follow Redirects</span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <span className={`px-3 py-1.5 rounded border font-bold text-lg ${statusColor(result.statusCode)}`}>
                {result.statusCode} {result.statusText}
              </span>
              <span className="px-3 py-1.5 rounded bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm">
                {result.responseTime}ms
              </span>
              <span className="px-3 py-1.5 rounded bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm">
                {(result.size / 1024).toFixed(1)} KB
              </span>
            </div>

            {result.redirectChain && result.redirectChain.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-2">REDIRECT CHAIN</h3>
                {result.redirectChain.map((r, i) => (
                  <p key={i} className="text-xs font-mono text-cyber-cyan">{i + 1}. {r}</p>
                ))}
              </div>
            )}

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RESPONSE HEADERS</h3>
              <div className="max-h-32 overflow-auto space-y-1">
                {Object.entries(result.headers).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono py-0.5 border-b border-cyber-cyan/5 last:border-0">
                    <span className="text-gray-400 w-40 flex-shrink-0">{k}:</span>
                    <span className="text-cyber-cyan break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">RESPONSE BODY</h3>
              <pre className="bg-black/60 border border-cyber-cyan/20 rounded p-3 text-xs font-mono text-cyber-cyan overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {result.body || "(empty body)"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default HTTPRequestBuilder;
