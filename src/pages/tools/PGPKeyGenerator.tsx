import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Copy, Key } from "lucide-react";

const PGPKeyGenerator = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [keyType, setKeyType] = useState<"RSA-4096" | "Curve25519">("RSA-4096");
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedPriv, setCopiedPriv] = useState(false);

  const handleGenerate = () => {
    setPublicKey("");
    setPrivateKey("");
    setMessage(
      "PGP key generation requires the openpgp library (openpgp npm package). " +
        "To enable full key generation, install openpgp: npm install openpgp, then integrate it here. " +
        `The configured parameters are: Name="${name}", Email="${email}", Type=${keyType}, Passphrase=${passphrase ? "(set)" : "(none)"}. ` +
        "This UI is ready — only the cryptographic backend needs to be wired up."
    );
    // Stub placeholder keys so UI is visible
    setPublicKey(
      `-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n[Generated ${keyType} public key for ${name} <${email}> would appear here\nonce the openpgp library is integrated.]\n\n-----END PGP PUBLIC KEY BLOCK-----`
    );
    setPrivateKey(
      `-----BEGIN PGP PRIVATE KEY BLOCK-----\n\n[Generated ${keyType} private key${passphrase ? " (passphrase-protected)" : ""} would appear here\nonce the openpgp library is integrated.]\n\n-----END PGP PRIVATE KEY BLOCK-----`
    );
  };

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <CyberpunkCard title="PGP KEY GENERATOR">
      <div className="space-y-5">
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            This is a UI stub. Full key generation requires the <code className="font-mono">openpgp</code> npm
            package. Install it and replace the stub handler with real key generation.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">NAME</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">EMAIL</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">KEY TYPE</label>
          <div className="flex gap-2">
            {(["RSA-4096", "Curve25519"] as const).map((kt) => (
              <button
                key={kt}
                onClick={() => setKeyType(kt)}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  keyType === kt
                    ? "bg-cyber-red text-white"
                    : "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/30"
                }`}
              >
                {kt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PASSPHRASE (optional)</label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase to protect private key"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan pr-16"
            />
            <button
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyber-cyan/60 hover:text-cyber-cyan"
            >
              {showPass ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!name || !email}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          <Key className="w-4 h-4 mr-2" />
          GENERATE KEY PAIR
        </Button>

        {message && (
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {publicKey && (
          <div className="glass-panel rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">PUBLIC KEY</h3>
              <Button onClick={() => copy(publicKey, setCopiedPub)} size="sm"
                className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
                <Copy className="w-3 h-3 mr-1" />{copiedPub ? "Copied!" : "Copy"}
              </Button>
            </div>
            <textarea readOnly value={publicKey} rows={6}
              className="w-full bg-black/40 border border-cyber-cyan/20 text-green-400 rounded p-2 text-xs font-mono resize-y" />
          </div>
        )}

        {privateKey && (
          <div className="glass-panel rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-red-400 font-bold tracking-wide text-sm">PRIVATE KEY</h3>
              <Button onClick={() => copy(privateKey, setCopiedPriv)} size="sm"
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs">
                <Copy className="w-3 h-3 mr-1" />{copiedPriv ? "Copied!" : "Copy"}
              </Button>
            </div>
            <textarea readOnly value={privateKey} rows={6}
              className="w-full bg-black/40 border border-red-500/20 text-red-300 rounded p-2 text-xs font-mono resize-y" />
            <p className="text-xs text-red-400/70 mt-2">Never share your private key. Store it securely.</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PGPKeyGenerator;
