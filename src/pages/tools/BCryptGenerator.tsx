import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Hash, CheckCircle, XCircle, Copy, Check } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface HashResult {
  hash: string;
  algorithm: string;
  rounds?: number;
  timeTaken: number;
}

interface VerifyResult {
  match: boolean;
  algorithm: string;
}

const TABS = ["bcrypt", "SHA-256", "SHA-512", "MD5"] as const;
type Tab = typeof TABS[number];

const ALGO_MAP: Record<Tab, string> = {
  bcrypt: "bcrypt",
  "SHA-256": "sha256",
  "SHA-512": "sha512",
  MD5: "md5",
};

const BCryptGenerator = () => {
  const [tab, setTab] = useState<Tab>("bcrypt");
  const [input, setInput] = useState("");
  const [rounds, setRounds] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HashResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [verifyInput, setVerifyInput] = useState("");
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/hash-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, algorithm: ALGO_MAP[tab], rounds: tab === "bcrypt" ? rounds : undefined }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Hash generation failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Hash generation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyInput.trim() || !verifyHash.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    setVerifyError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/hash-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: verifyInput, algorithm: ALGO_MAP[tab], verify: verifyHash }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Verification failed");
      }
      setVerifyResult(await response.json());
    } catch (err: any) {
      setVerifyError(err.message || "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyHash = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <CyberpunkCard title="HASH GENERATOR / VERIFIER">
      <div className="space-y-6">
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
          <span className="font-bold">SECURITY:</span>
          <span>Store the hash, never the plaintext password.</span>
        </div>

        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setResult(null); setError(null); }}
              className={`px-4 py-2 rounded text-sm font-bold transition-colors ${tab === t ? "bg-cyber-red text-white" : "bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 border border-cyber-cyan/30"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="glass-panel rounded p-4 space-y-3">
          <h3 className="text-cyber-cyan font-bold tracking-wide">GENERATE HASH</h3>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter plaintext to hash"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
          {tab === "bcrypt" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rounds (cost factor): {rounds}</label>
              <input
                type="range"
                min={4}
                max={14}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="w-full accent-cyber-red"
              />
            </div>
          )}
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !input.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Hashing...</> : <><Hash className="w-4 h-4 mr-2" />Generate Hash</>}
          </Button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{result.algorithm.toUpperCase()} hash — {result.timeTaken}ms</span>
                <Button onClick={copyHash} size="sm" className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30">
                  {copied ? <><Check className="w-3 h-3 mr-1" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                </Button>
              </div>
              <pre className="bg-black/60 border border-cyber-cyan/20 rounded p-3 text-xs font-mono text-cyber-cyan break-all whitespace-pre-wrap">
                {result.hash}
              </pre>
            </div>
          )}
        </div>

        <div className="glass-panel rounded p-4 space-y-3">
          <h3 className="text-cyber-cyan font-bold tracking-wide">VERIFY HASH</h3>
          <Input
            value={verifyInput}
            onChange={(e) => setVerifyInput(e.target.value)}
            placeholder="Enter plaintext"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
          />
          <Input
            value={verifyHash}
            onChange={(e) => setVerifyHash(e.target.value)}
            placeholder="Paste hash to verify against"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
          />
          <Button
            onClick={handleVerify}
            disabled={verifyLoading || !verifyInput.trim() || !verifyHash.trim()}
            className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 font-bold"
          >
            {verifyLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Verify"}
          </Button>

          {verifyError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          {verifyResult && (
            <div className={`flex items-center gap-2 p-3 rounded border text-sm font-bold ${verifyResult.match ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              {verifyResult.match ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {verifyResult.match ? "MATCH — Hash is valid" : "NO MATCH — Hash does not match"}
            </div>
          )}
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default BCryptGenerator;
