import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface Difference {
  field: string;
  valueA: string;
  valueB: string;
  severity: "critical" | "high" | "medium" | "info";
  explanation: string;
}

interface ComparisonResult {
  ssidMatch: boolean;
  bssidOuiMatch: boolean;
  differences: Difference[];
  riskScore: number;
  verdict: string;
}

const OUI_VENDORS: Record<string, string> = {
  "00:50:f2": "Microsoft",
  "00:0c:e7": "Cisco",
  "00:1a:2b": "Cisco",
  "00:23:eb": "Cisco",
  "b8:27:eb": "Raspberry Pi",
  "dc:a6:32": "Raspberry Pi",
  "e4:5f:01": "Raspberry Pi",
  "00:11:22": "Generic",
};

const getOUI = (bssid: string): string => {
  const normalized = bssid.toLowerCase().replace(/-/g, ":");
  const oui = normalized.slice(0, 8);
  return OUI_VENDORS[oui] || oui;
};

const homoglyphDetect = (a: string, b: string): boolean => {
  if (a === b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  // Compare char codes
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ca = a.charCodeAt(i) || 0;
    const cb = b.charCodeAt(i) || 0;
    if (ca !== cb) {
      // Check if visually similar (Cyrillic vs Latin)
      const visuallySimlar = [
        [0x61, 0x430], // a / а
        [0x65, 0x435], // e / е
        [0x6f, 0x43E], // o / о
        [0x63, 0x441], // c / с
        [0x70, 0x440], // p / р
        [0x78, 0x445], // x / х
        [0x79, 0x443], // y / у
      ];
      for (const [lat, cyr] of visuallySimlar) {
        if ((ca === lat && cb === cyr) || (ca === cyr && cb === lat)) {
          return true;
        }
      }
    }
  }
  return false;
};

const EvilTwinDetector = () => {
  const [ssidA, setSsidA] = useState("");
  const [bssidA, setBssidA] = useState("");
  const [ssidB, setSsidB] = useState("");
  const [bssidB, setBssidB] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const compare = () => {
    const differences: Difference[] = [];

    // SSID comparison
    if (ssidA && ssidB) {
      if (ssidA === ssidB) {
        differences.push({
          field: "SSID",
          valueA: ssidA,
          valueB: ssidB,
          severity: "critical",
          explanation: "Identical SSID — Evil Twin likely. Both networks advertise the same name.",
        });
      } else if (ssidA.toLowerCase() === ssidB.toLowerCase()) {
        differences.push({
          field: "SSID (Case)",
          valueA: ssidA,
          valueB: ssidB,
          severity: "high",
          explanation: "SSIDs differ only in case — possible evil twin with case manipulation.",
        });
      } else if (homoglyphDetect(ssidA, ssidB)) {
        differences.push({
          field: "SSID (Homoglyph)",
          valueA: ssidA,
          valueB: ssidB,
          severity: "critical",
          explanation: "SSIDs contain visually identical Unicode characters — likely homoglyph substitution attack.",
        });
      }
    }

    // BSSID comparison
    if (bssidA && bssidB) {
      const ouiA = getOUI(bssidA);
      const ouiB = getOUI(bssidB);
      if (bssidA.toLowerCase() === bssidB.toLowerCase()) {
        differences.push({
          field: "BSSID",
          valueA: bssidA,
          valueB: bssidB,
          severity: "info",
          explanation: "Identical BSSID — this is the same physical device, not an evil twin.",
        });
      } else if (ouiA !== ouiB && !ouiA.includes(":") && !ouiB.includes(":")) {
        differences.push({
          field: "BSSID OUI / Vendor",
          valueA: `${bssidA} (${ouiA})`,
          valueB: `${bssidB} (${ouiB})`,
          severity: "medium",
          explanation: "Different hardware vendors. Legitimate access points from the same organization usually share vendor prefix.",
        });
      }

      // Check if BSSIDs are very similar (1-2 bytes off)
      const bytesA = bssidA.toLowerCase().split(/[:-]/);
      const bytesB = bssidB.toLowerCase().split(/[:-]/);
      if (bytesA.length === 6 && bytesB.length === 6) {
        const diffs = bytesA.filter((b, i) => b !== bytesB[i]).length;
        if (diffs >= 1 && diffs <= 2) {
          differences.push({
            field: "BSSID Similarity",
            valueA: bssidA,
            valueB: bssidB,
            severity: "high",
            explanation: `BSSIDs differ by only ${diffs} byte(s) — attacker may be spoofing MAC address with minor modification.`,
          });
        }
      }
    }

    const criticalCount = differences.filter((d) => d.severity === "critical").length;
    const highCount = differences.filter((d) => d.severity === "high").length;
    const score = criticalCount * 40 + highCount * 20 + differences.filter((d) => d.severity === "medium").length * 10;
    const riskScore = Math.min(100, score);

    let verdict = "Low Risk";
    if (riskScore >= 80) verdict = "LIKELY EVIL TWIN — Extreme caution advised";
    else if (riskScore >= 50) verdict = "Suspicious — Possible evil twin attack";
    else if (riskScore >= 20) verdict = "Moderate suspicion — Investigate further";
    else if (differences.some((d) => d.field === "BSSID" && d.explanation.includes("same physical"))) verdict = "Same device (identical BSSID)";

    setResult({
      ssidMatch: ssidA === ssidB,
      bssidOuiMatch: getOUI(bssidA) === getOUI(bssidB),
      differences,
      riskScore,
      verdict,
    });
  };

  const getSeverityColor = (s: string) => {
    if (s === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (s === "high") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (s === "medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  return (
    <CyberpunkCard title="EVIL TWIN DETECTOR">
      <div className="space-y-6">
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-xs">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Educational tool. Compare two Wi-Fi networks to identify potential evil twin attacks. Enter details from both the legitimate AP and the suspicious AP.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AP A */}
          <div className="glass-panel rounded p-4 space-y-3">
            <h3 className="text-green-400 font-bold tracking-wide text-sm">LEGITIMATE AP (A)</h3>
            <div>
              <label className="block text-xs text-cyber-cyan mb-1">SSID</label>
              <Input value={ssidA} onChange={(e) => setSsidA(e.target.value)} placeholder="MyNetwork" className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan" />
            </div>
            <div>
              <label className="block text-xs text-cyber-cyan mb-1">BSSID (MAC)</label>
              <Input value={bssidA} onChange={(e) => setBssidA(e.target.value)} placeholder="00:11:22:33:44:55" className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" />
            </div>
          </div>

          {/* AP B */}
          <div className="glass-panel rounded p-4 space-y-3">
            <h3 className="text-red-400 font-bold tracking-wide text-sm">SUSPICIOUS AP (B)</h3>
            <div>
              <label className="block text-xs text-cyber-cyan mb-1">SSID</label>
              <Input value={ssidB} onChange={(e) => setSsidB(e.target.value)} placeholder="MyNetwork" className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan" />
            </div>
            <div>
              <label className="block text-xs text-cyber-cyan mb-1">BSSID (MAC)</label>
              <Input value={bssidB} onChange={(e) => setBssidB(e.target.value)} placeholder="00:11:22:33:44:66" className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono" />
            </div>
          </div>
        </div>

        <Button
          className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold w-full"
          onClick={compare}
          disabled={!ssidA && !bssidA}
        >
          ANALYZE FOR EVIL TWIN
        </Button>

        {result && (
          <div className="space-y-4">
            {/* Verdict */}
            <div className={`p-4 rounded border ${result.riskScore >= 50 ? "bg-red-500/10 border-red-500/30" : result.riskScore >= 20 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-green-500/10 border-green-500/30"}`}>
              <div className="flex items-center gap-3">
                {result.riskScore >= 50 ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
                <div>
                  <p className={`font-bold ${result.riskScore >= 50 ? "text-red-400" : result.riskScore >= 20 ? "text-yellow-400" : "text-green-400"}`}>
                    {result.verdict}
                  </p>
                  <p className="text-xs text-gray-400">Risk Score: {result.riskScore}/100</p>
                </div>
              </div>
            </div>

            {/* Differences */}
            {result.differences.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-cyber-cyan font-bold tracking-wide">FINDINGS</h3>
                {result.differences.map((diff, i) => (
                  <div key={i} className={`p-3 rounded border ${getSeverityColor(diff.severity)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(diff.severity)}`}>
                        {diff.severity.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold">{diff.field}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2">
                      <div><span className="text-gray-500">A: </span><span className="text-white">{diff.valueA}</span></div>
                      <div><span className="text-gray-500">B: </span><span className="text-white">{diff.valueB}</span></div>
                    </div>
                    <p className="text-xs opacity-80">{diff.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
                No significant anomalies detected.
              </div>
            )}

            {/* Detection Checklist */}
            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">EVIL TWIN DETECTION CHECKLIST</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <p>• Identical SSID with different BSSID = primary indicator</p>
                <p>• Unusually strong signal from unknown device = suspicious</p>
                <p>• Certificate mismatch on HTTPS = MITM in progress</p>
                <p>• Open network claiming to be the same as known secured network</p>
                <p>• DHCP assigned gateway IP differs from known gateway</p>
                <p>• DNS responses resolve to unexpected IPs</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default EvilTwinDetector;
