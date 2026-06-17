import { useState, useRef } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, AlertTriangle, CheckCircle, Wifi } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface WifiCrackResult {
  tried: number;
  found: boolean;
  password?: string;
  timeMs: number;
  ssid: string;
  note: string;
}

const PRESET_WORDLISTS = {
  "Common Passwords (10)": ["password", "12345678", "qwerty123", "admin123", "letmein1", "monkey12", "dragon99", "master12", "sunshine", "princess"],
  "WiFi Common (15)": ["password1", "12345678", "1234567890", "qwertyuiop", "iloveyou1", "admin1234", "123456789", "abc123456", "superman1", "batman123", "welcome1", "football", "michael1", "shadow123", "master123"],
};

const WifiHandshakeCracker = () => {
  const [ssid, setSsid] = useState("");
  const [targetPMK, setTargetPMK] = useState("");
  const [wordlist, setWordlist] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isCracking, setIsCracking] = useState(false);
  const [result, setResult] = useState<WifiCrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const crack = async () => {
    if (!ssid || !agreed) return;
    setIsCracking(true);
    setResult(null);
    setError(null);

    const words = wordlist.split("\n").filter((w) => w.trim());

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/wifi-crack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: ssid.trim(),
          wordlist: words,
          targetPMK: targetPMK.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Crack request failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to service");
    } finally {
      setIsCracking(false);
    }
  };

  const applyPreset = (name: string) => {
    const list = PRESET_WORDLISTS[name as keyof typeof PRESET_WORDLISTS];
    if (list) {
      setWordlist(list.join("\n"));
      setSelectedPreset(name);
    }
  };

  return (
    <CyberpunkCard title="WIFI HANDSHAKE CRACKER">
      <div className="space-y-6">
        {/* Legal Warning */}
        <div className="p-4 bg-red-500/10 border-2 border-red-500/50 rounded">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-400 font-bold">LEGAL WARNING</p>
              <p className="text-red-300 text-sm mt-1">
                Cracking Wi-Fi passwords on networks you do not own or have explicit permission to test is illegal in most jurisdictions. This tool is for authorized penetration testing and educational research only.
              </p>
              <p className="text-red-300 text-sm mt-1">
                This tool derives PMK values using PBKDF2-SHA1 for educational demonstration. It does NOT capture live handshakes.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-red-300 text-sm">I have authorization to test this network and understand the legal implications.</span>
          </label>
        </div>

        <div className="glass-panel rounded p-4 space-y-3">
          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">TARGET SSID *</label>
            <Input
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="NetworkName"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isCracking}
            />
          </div>

          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">TARGET PMK (hex, optional)</label>
            <Input
              value={targetPMK}
              onChange={(e) => setTargetPMK(e.target.value)}
              placeholder="64-char hex PMK from handshake analysis (hcxtools)"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
              disabled={isCracking}
            />
            <p className="text-gray-500 text-xs mt-1">Leave empty to just derive PMK values for all words.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-cyber-cyan tracking-wide">WORDLIST (one per line, max 1000)</label>
              <div className="flex gap-1 flex-wrap">
                {Object.keys(PRESET_WORDLISTS).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      selectedPreset === preset
                        ? "bg-cyber-cyan text-black font-bold"
                        : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="w-full h-32 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-2 text-sm font-mono resize-none"
              placeholder="password1&#10;12345678&#10;qwerty123"
              value={wordlist}
              onChange={(e) => setWordlist(e.target.value)}
              disabled={isCracking}
            />
            <p className="text-gray-500 text-xs mt-1">{wordlist.split("\n").filter((w) => w.trim()).length} words</p>
          </div>

          <Button
            onClick={crack}
            disabled={isCracking || !ssid || !agreed}
            className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            {isCracking ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />CRACKING...</>
            ) : (
              <><Wifi className="mr-2 h-4 w-4" />START CRACK</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {result.found ? (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="text-green-400 font-bold">PASSWORD FOUND!</p>
                </div>
                <div className="font-mono text-xl text-green-300 font-bold">{result.password}</div>
              </div>
            ) : (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
                Password not found in wordlist.
              </div>
            )}

            <div className="glass-panel rounded p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">SSID</span>
                <span className="text-cyber-cyan font-mono">{result.ssid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Passwords Tried</span>
                <span className="text-cyber-cyan font-mono">{result.tried}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Time</span>
                <span className="text-cyber-cyan font-mono">{result.timeMs}ms</span>
              </div>
              <p className="text-gray-500 text-xs pt-2 border-t border-gray-700">{result.note}</p>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default WifiHandshakeCracker;
