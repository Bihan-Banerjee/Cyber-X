import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";

interface HashMatch {
  algorithm: string;
  probability: number;
  description: string;
  notes?: string;
}

const identify = (hash: string): HashMatch[] => {
  const h = hash.trim();
  if (!h) return [];

  const len = h.length;
  const isHex = /^[0-9a-fA-F]+$/.test(h);
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(h);
  const results: HashMatch[] = [];

  if (h.startsWith("$argon2")) {
    results.push({ algorithm: "Argon2", probability: 99, description: "Memory-hard password hashing algorithm (Argon2i/Argon2id/Argon2d)", notes: "PHC string format" });
  }
  if (h.startsWith("$2a$") || h.startsWith("$2b$") || h.startsWith("$2y$")) {
    results.push({ algorithm: "bcrypt", probability: 99, description: "Adaptive password hashing function", notes: `Cost factor: ${h.split("$")[2]}` });
  }
  if (h.startsWith("$sha1$")) {
    results.push({ algorithm: "SHA1Crypt", probability: 95, description: "SHA-1 based crypt" });
  }
  if (h.startsWith("$5$")) {
    results.push({ algorithm: "SHA-256 Crypt", probability: 95, description: "Linux shadow password (sha256crypt)" });
  }
  if (h.startsWith("$6$")) {
    results.push({ algorithm: "SHA-512 Crypt", probability: 95, description: "Linux shadow password (sha512crypt)" });
  }
  if (h.startsWith("$1$")) {
    results.push({ algorithm: "MD5 Crypt", probability: 95, description: "Linux shadow password (md5crypt)" });
  }
  if (h.startsWith("$P$") || h.startsWith("$H$")) {
    results.push({ algorithm: "phpBB / WordPress MD5", probability: 95, description: "Portable PHP password hash" });
  }

  if (isHex) {
    if (len === 32) {
      results.push({ algorithm: "MD5", probability: 85, description: "128-bit hash (widely used, cryptographically broken)" });
      results.push({ algorithm: "NTLM", probability: 80, description: "Windows NT LAN Manager hash" });
      results.push({ algorithm: "MD4", probability: 50, description: "128-bit hash (predecessor of MD5)" });
    }
    if (len === 40) {
      results.push({ algorithm: "SHA-1", probability: 90, description: "160-bit hash (deprecated for security use)" });
      results.push({ algorithm: "HmacSHA1", probability: 40, description: "SHA-1 HMAC" });
    }
    if (len === 48) {
      results.push({ algorithm: "SHA-1 salted (Tiger192)", probability: 50, description: "Tiger 192-bit hash" });
    }
    if (len === 56) {
      results.push({ algorithm: "SHA-224", probability: 85, description: "224-bit SHA-2 family hash" });
    }
    if (len === 64) {
      results.push({ algorithm: "SHA-256", probability: 90, description: "256-bit SHA-2 hash (widely recommended)" });
      results.push({ algorithm: "SHA3-256", probability: 70, description: "256-bit SHA-3 (Keccak) hash" });
      results.push({ algorithm: "BLAKE2s-256", probability: 30, description: "BLAKE2 256-bit hash" });
    }
    if (len === 96) {
      results.push({ algorithm: "SHA-384", probability: 85, description: "384-bit SHA-2 hash" });
      results.push({ algorithm: "SHA3-384", probability: 70, description: "384-bit SHA-3 hash" });
    }
    if (len === 128) {
      results.push({ algorithm: "SHA-512", probability: 90, description: "512-bit SHA-2 hash" });
      results.push({ algorithm: "SHA3-512", probability: 70, description: "512-bit SHA-3 hash" });
      results.push({ algorithm: "Whirlpool", probability: 40, description: "512-bit Whirlpool hash" });
      results.push({ algorithm: "BLAKE2b-512", probability: 30, description: "BLAKE2 512-bit hash" });
    }
  }

  if (isBase64 && !isHex) {
    if (len === 24) {
      results.push({ algorithm: "MD5 (base64)", probability: 60, description: "MD5 hash encoded as base64" });
    }
    if (len === 28) {
      results.push({ algorithm: "SHA-1 (base64)", probability: 60, description: "SHA-1 hash encoded as base64" });
    }
    if (len === 44) {
      results.push({ algorithm: "SHA-256 (base64)", probability: 60, description: "SHA-256 hash encoded as base64" });
    }
  }

  return results.sort((a, b) => b.probability - a.probability);
};

const HashIdentifier = () => {
  const [hash, setHash] = useState("");
  const matches = identify(hash);

  return (
    <CyberpunkCard title="HASH IDENTIFIER">
      <div className="space-y-5">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">HASH STRING</label>
          <Input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder="Paste a hash to identify..."
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
          />
          {hash && (
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>Length: <span className="text-cyber-cyan">{hash.trim().length}</span></span>
              <span>Charset: <span className="text-cyber-cyan">
                {/^[0-9a-fA-F]+$/.test(hash.trim()) ? "Hexadecimal" :
                 /^[A-Za-z0-9+/=]+$/.test(hash.trim()) ? "Base64" : "Mixed/Special"}
              </span></span>
            </div>
          )}
        </div>

        {hash && matches.length === 0 && (
          <div className="glass-panel rounded p-4 text-center">
            <p className="text-gray-400 text-sm">No matches found. This may be a custom hash, partial hash, or non-standard format.</p>
          </div>
        )}

        {matches.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">
              IDENTIFIED ALGORITHMS ({matches.length})
            </h3>
            {matches.map((m, i) => (
              <div key={i} className={`glass-panel rounded p-4 ${i === 0 ? "border border-cyber-cyan/30" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30 font-bold">
                        BEST MATCH
                      </span>
                    )}
                    <span className="font-bold text-cyber-cyan">{m.algorithm}</span>
                    {m.notes && <span className="text-xs text-gray-500">({m.notes})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-black/40 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          m.probability > 80 ? "bg-green-500" :
                          m.probability > 60 ? "bg-yellow-500" : "bg-orange-500"
                        }`}
                        style={{ width: `${m.probability}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{m.probability}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{m.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="glass-panel rounded p-4">
          <h3 className="text-cyber-cyan font-bold tracking-wide text-sm mb-3">IDENTIFICATION GUIDE</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
            {[
              ["MD5", "32 hex"],
              ["SHA-1", "40 hex"],
              ["SHA-256", "64 hex"],
              ["SHA-512", "128 hex"],
              ["bcrypt", "60 chars, $2a/$2b/$2y$"],
              ["Argon2", "starts with $argon2"],
              ["NTLM", "32 hex"],
              ["SHA-384", "96 hex"],
              ["SHA-224", "56 hex"],
            ].map(([algo, hint]) => (
              <div key={algo} className="flex justify-between gap-2">
                <span className="text-cyber-cyan">{algo}</span>
                <span className="text-gray-500">{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default HashIdentifier;
