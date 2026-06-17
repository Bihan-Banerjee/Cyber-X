import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldAlert, ShieldCheck, Mail } from "lucide-react";

interface HopInfo {
  index: number;
  from: string;
  by: string;
  timestamp: string;
  delay: number | null;
}

interface AuthStatus {
  spf: "pass" | "fail" | "neutral" | "unknown";
  dkim: "pass" | "fail" | "unknown";
  dmarc: "pass" | "fail" | "unknown";
}

interface EmailHeaderResult {
  hops: HopInfo[];
  originatingIP: string;
  auth: AuthStatus;
  spoofingRisk: "low" | "medium" | "high";
  subject: string;
  from: string;
  to: string;
  date: string;
  messageId: string;
}

function parseEmailHeaders(raw: string): EmailHeaderResult {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  // Unfold headers
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.match(/^[ \t]/) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += " " + line.trim();
    } else {
      unfolded.push(line);
    }
  }

  const getHeader = (name: string): string => {
    const re = new RegExp(`^${name}:\\s*(.*)`, "i");
    for (const l of unfolded) {
      const m = l.match(re);
      if (m) return m[1].trim();
    }
    return "";
  };

  // Parse Received headers (in reverse for hop chain)
  const receivedLines = unfolded
    .filter((l) => /^Received:\s*/i.test(l))
    .map((l) => l.replace(/^Received:\s*/i, ""));

  const hops: HopInfo[] = receivedLines.map((line, i) => {
    const fromMatch = line.match(/from\s+([^\s(;]+)/i);
    const byMatch = line.match(/by\s+([^\s(;]+)/i);
    const tsMatch = line.match(/;\s*(.+)$/);

    const from = fromMatch ? fromMatch[1] : "unknown";
    const by = byMatch ? byMatch[1] : "unknown";
    const timestamp = tsMatch ? tsMatch[1].trim() : "";

    let delay: number | null = null;
    if (i > 0 && timestamp && receivedLines[i - 1]) {
      const prevMatch = receivedLines[i - 1].match(/;\s*(.+)$/);
      if (prevMatch) {
        const t1 = new Date(prevMatch[1].trim()).getTime();
        const t2 = new Date(timestamp).getTime();
        if (!isNaN(t1) && !isNaN(t2)) {
          delay = Math.round((t1 - t2) / 1000);
        }
      }
    }

    return { index: i + 1, from, by, timestamp, delay };
  });

  // Originating IP from last received header
  const lastReceived = receivedLines[receivedLines.length - 1] || "";
  const ipMatch = lastReceived.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);
  const originatingIP = ipMatch ? ipMatch[1] : "unknown";

  // Authentication-Results parsing
  const authResults = unfolded
    .filter((l) => /^Authentication-Results:/i.test(l))
    .map((l) => l.replace(/^Authentication-Results:\s*/i, ""))
    .join(" ");

  const parseStatus = (key: string): "pass" | "fail" | "neutral" | "unknown" => {
    const re = new RegExp(`${key}=(\\w+)`, "i");
    const m = authResults.match(re);
    if (!m) return "unknown";
    if (m[1].toLowerCase() === "pass") return "pass";
    if (m[1].toLowerCase() === "fail") return "fail";
    if (m[1].toLowerCase() === "neutral") return "neutral";
    return "unknown";
  };

  const spf = parseStatus("spf") as "pass" | "fail" | "neutral" | "unknown";
  const dkim = parseStatus("dkim") as "pass" | "fail" | "unknown";
  const dmarc = parseStatus("dmarc") as "pass" | "fail" | "unknown";

  let spoofingRisk: "low" | "medium" | "high" = "low";
  if (dmarc === "unknown" || dmarc === "fail") {
    spoofingRisk = spf === "fail" ? "high" : "medium";
  } else if (spf === "fail" || dkim === "fail") {
    spoofingRisk = "medium";
  }

  return {
    hops,
    originatingIP,
    auth: { spf, dkim, dmarc },
    spoofingRisk,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date"),
    messageId: getHeader("Message-ID"),
  };
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pass: "bg-green-500/20 text-green-400 border-green-500/30",
    fail: "bg-red-500/20 text-red-400 border-red-500/30",
    neutral: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return map[status] || map.unknown;
};

const EmailHeaderAnalyzer = () => {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<EmailHeaderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    if (!raw.trim()) return;
    setError(null);
    try {
      const parsed = parseEmailHeaders(raw);
      if (parsed.hops.length === 0 && !parsed.from && !parsed.subject) {
        throw new Error("No recognisable email headers found. Paste the full raw email headers.");
      }
      setResult(parsed);
    } catch (err: any) {
      setError(err.message || "Failed to parse headers");
    }
  };

  const riskColor = (risk: string) => {
    if (risk === "high") return "text-red-400 border-red-500/30 bg-red-500/10";
    if (risk === "medium") return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    return "text-green-400 border-green-500/30 bg-green-500/10";
  };

  return (
    <CyberpunkCard title="EMAIL HEADER ANALYZER">
      <div className="space-y-6">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">
            PASTE RAW EMAIL HEADERS
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"Received: from mail.example.com...\nFrom: sender@example.com\nTo: recipient@example.com\n..."}
            rows={10}
            className="w-full bg-black/50 border border-cyber-cyan/30 rounded p-3 text-cyber-cyan font-mono text-xs resize-none focus:outline-none focus:border-cyber-cyan/60"
          />
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={!raw.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider"
        >
          <Mail className="w-4 h-4 mr-2" />
          ANALYZE HEADERS
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Spoofing verdict */}
            <div className={`flex items-center gap-3 p-4 rounded border ${riskColor(result.spoofingRisk)}`}>
              {result.spoofingRisk === "low" ? (
                <ShieldCheck className="w-6 h-6 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold tracking-wide">
                  SPOOFING RISK: {result.spoofingRisk.toUpperCase()}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  {result.spoofingRisk === "high"
                    ? "SPF failed and DMARC is absent or failed — high probability of spoofing"
                    : result.spoofingRisk === "medium"
                    ? "Some authentication checks failed — possible spoofing attempt"
                    : "All authentication checks passed"}
                </p>
              </div>
            </div>

            {/* SPF / DKIM / DMARC */}
            <div className="grid grid-cols-3 gap-3">
              {(["spf", "dkim", "dmarc"] as const).map((key) => (
                <div key={key} className="glass-panel rounded p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1 tracking-wider">{key.toUpperCase()}</p>
                  <span className={`px-2 py-0.5 rounded border text-xs font-bold ${statusBadge(result.auth[key])}`}>
                    {result.auth[key].toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Email metadata */}
            <div className="glass-panel rounded p-4 space-y-2">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">EMAIL METADATA</h3>
              {[
                { label: "From", value: result.from },
                { label: "To", value: result.to },
                { label: "Subject", value: result.subject },
                { label: "Date", value: result.date },
                { label: "Originating IP", value: result.originatingIP },
                { label: "Message-ID", value: result.messageId },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex gap-3 text-sm">
                  <span className="text-gray-400 w-28 flex-shrink-0">{label}:</span>
                  <span className="text-cyber-cyan font-mono break-all">{value}</span>
                </div>
              ) : null)}
            </div>

            {/* Hop chain */}
            {result.hops.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-4">
                  HOP CHAIN ({result.hops.length} hops)
                </h3>
                <div className="space-y-2">
                  {result.hops.map((hop) => (
                    <div key={hop.index} className="relative pl-8">
                      {hop.index < result.hops.length && (
                        <div className="absolute left-3 top-8 bottom-0 w-px bg-cyber-cyan/20" />
                      )}
                      <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-cyber-cyan/20 border border-cyber-cyan/40 flex items-center justify-center text-xs text-cyber-cyan font-bold">
                        {hop.index}
                      </div>
                      <div className="glass-panel rounded p-3 mb-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span className="text-gray-400">From: <span className="text-cyber-cyan font-mono">{hop.from}</span></span>
                          <span className="text-gray-400">By: <span className="text-cyber-cyan font-mono">{hop.by}</span></span>
                          {hop.delay !== null && (
                            <span className={`font-bold ${hop.delay > 30 ? "text-yellow-400" : "text-green-400"}`}>
                              +{hop.delay}s delay
                            </span>
                          )}
                        </div>
                        {hop.timestamp && (
                          <p className="text-xs text-gray-500 mt-1">{hop.timestamp}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default EmailHeaderAnalyzer;
