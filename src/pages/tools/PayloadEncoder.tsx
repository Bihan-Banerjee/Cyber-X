import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";

interface EncodedOutput {
  label: string;
  value: string;
  key: string;
}

const PayloadEncoder = () => {
  const [rawInput, setRawInput] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "hex">("text");
  const [xorKey, setXorKey] = useState("0x41");
  const [outputs, setOutputs] = useState<EncodedOutput[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const parseInput = (): Uint8Array | null => {
    if (!rawInput.trim()) return null;
    if (inputMode === "hex") {
      const cleaned = rawInput.replace(/\s+/g, "").replace(/0x/gi, "").replace(/\\x/gi, "");
      if (cleaned.length % 2 !== 0) return null;
      const bytes = new Uint8Array(cleaned.length / 2);
      for (let i = 0; i < cleaned.length; i += 2) {
        bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
      }
      return bytes;
    } else {
      return new TextEncoder().encode(rawInput);
    }
  };

  const encode = () => {
    const bytes = parseInput();
    if (!bytes) return;

    const xorKeyVal = parseInt(xorKey, 16) & 0xff;

    // Base64
    let b64 = "";
    try {
      b64 = btoa(String.fromCharCode(...bytes));
    } catch {
      b64 = "Error encoding to Base64";
    }

    // Hex string
    const hexStr = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // URL encoded
    const urlEncoded = Array.from(bytes)
      .map((b) => "%" + b.toString(16).padStart(2, "0").toUpperCase())
      .join("");

    // XOR
    const xored = Array.from(bytes).map((b) => b ^ xorKeyVal);
    const xorHex = xored.map((b) => "\\x" + b.toString(16).padStart(2, "0")).join("");

    // PowerShell base64
    const psB64 = btoa(String.fromCharCode(...Array.from(rawInput).flatMap((c) => [c.charCodeAt(0), 0])));
    const psCmd = `powershell -EncodedCommand ${psB64}`;

    // Python byte array
    const pyBytes = "b'" + Array.from(bytes).map((b) => "\\x" + b.toString(16).padStart(2, "0")).join("") + "'";

    setOutputs([
      { label: "Base64", value: b64, key: "b64" },
      { label: "Hex String", value: hexStr, key: "hex" },
      { label: "URL Encoded", value: urlEncoded, key: "url" },
      { label: `XOR (key=${xorKey})`, value: xorHex, key: "xor" },
      { label: "PowerShell Base64 Command", value: psCmd, key: "ps" },
      { label: "Python Byte Array", value: pyBytes, key: "py" },
    ]);
  };

  return (
    <CyberpunkCard title="PAYLOAD ENCODER">
      <div className="space-y-6">
        <div className="glass-panel rounded p-4 space-y-3">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setInputMode("text")}
              className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                inputMode === "text"
                  ? "bg-cyber-red text-white border-cyber-red"
                  : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"
              }`}
            >
              TEXT INPUT
            </button>
            <button
              onClick={() => setInputMode("hex")}
              className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                inputMode === "hex"
                  ? "bg-cyber-red text-white border-cyber-red"
                  : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"
              }`}
            >
              HEX INPUT
            </button>
          </div>

          <div>
            <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">
              {inputMode === "hex" ? "HEX PAYLOAD (e.g. \\x41\\x42\\x43 or 414243)" : "RAW PAYLOAD / SHELLCODE TEXT"}
            </label>
            <textarea
              className="w-full h-32 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-none"
              placeholder={inputMode === "hex" ? "\\x90\\x90\\xcc or 9090cc" : "Enter payload text..."}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-cyber-cyan tracking-wide shrink-0">XOR KEY (hex):</label>
            <Input
              value={xorKey}
              onChange={(e) => setXorKey(e.target.value)}
              placeholder="0x41"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono w-32"
            />
          </div>

          <Button
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold w-full"
            onClick={encode}
            disabled={!rawInput.trim()}
          >
            ENCODE PAYLOAD
          </Button>
        </div>

        {outputs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-cyber-cyan font-bold tracking-wide">ENCODED OUTPUTS</h3>
            {outputs.map((out) => (
              <div key={out.key} className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-cyber-cyan font-bold tracking-wide">{out.label}</span>
                  <Button
                    size="sm"
                    className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
                    onClick={() => copyToClipboard(out.value, out.key)}
                  >
                    {copied === out.key ? <><CheckCircle className="w-3 h-3 mr-1" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                  </Button>
                </div>
                <code className="block text-green-400 font-mono text-xs bg-black/50 rounded p-2 break-all whitespace-pre-wrap">
                  {out.value}
                </code>
                <p className="text-gray-500 text-xs mt-1">{out.value.length} characters</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PayloadEncoder;
