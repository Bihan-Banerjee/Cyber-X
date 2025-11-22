import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const HashTool = () => {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState({
    md5: "",
    sha1: "",
    sha256: "",
    sha512: "",
  });

  const generateHashes = async () => {
    if (!input) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Simple hash simulation (in production, use proper crypto library)
    const hash = async (algorithm: string) => {
      const buffer = await crypto.subtle.digest(algorithm, data);
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    };

    try {
      const [sha1, sha256, sha512] = await Promise.all([
        hash("SHA-1"),
        hash("SHA-256"),
        hash("SHA-512"),
      ]);

      setHashes({
        md5: "MD5 not available in WebCrypto",
        sha1,
        sha256,
        sha512,
      });
    } catch (error) {
      toast.error("Error generating hashes");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <CyberpunkCard title="HASH TOOL">
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
            INPUT TEXT
          </label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text to hash..."
            className="bg-black/50 border-cyber-red/30 text-cyber-cyan min-h-[120px] font-mono"
          />
        </div>

        <Button
          onClick={generateHashes}
          disabled={!input}
          className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
        >
          GENERATE HASHES
        </Button>

        {hashes.sha256 && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-cyber-cyan mb-4 tracking-wide">HASHES</h3>
            {Object.entries(hashes).map(([algorithm, hash]) => (
              <div key={algorithm} className="space-y-2">
                <label className="block text-xs text-cyber-cyan tracking-wider">
                  {algorithm.toUpperCase()}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-black/50 rounded font-mono text-xs text-gray-400 break-all">
                    {hash}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(hash)}
                    className="border-cyber-cyan/30 hover:bg-cyber-cyan/10 text-cyber-cyan"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default HashTool;
