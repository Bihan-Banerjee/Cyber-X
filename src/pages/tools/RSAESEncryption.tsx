import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Key, Lock, Unlock, Copy, Check, Download, RefreshCw } from "lucide-react";

interface EncryptionResult {
  algorithm: string;
  operation: string;
  input: string;
  output: string;
  key?: string;
  publicKey?: string;
  privateKey?: string;
  iv?: string;
  keySize?: number;
  processingTime: number;
}

const RSAESEncryption = () => {
  const [algorithm, setAlgorithm] = useState<"aes" | "rsa">("aes");
  const [operation, setOperation] = useState<"encrypt" | "decrypt">("encrypt");
  const [aesKeySize, setAesKeySize] = useState<"128" | "192" | "256">("256");
  const [rsaKeySize, setRsaKeySize] = useState<"1024" | "2048" | "4096">("2048");
  const [inputText, setInputText] = useState("");
  const [key, setKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EncryptionResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("http://localhost:5000/api/scan/crypto-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm,
          operation,
          input: inputText,
          aesKeySize: algorithm === "aes" ? parseInt(aesKeySize) : undefined,
          rsaKeySize: algorithm === "rsa" ? parseInt(rsaKeySize) : undefined,
          key: algorithm === "aes" ? key : undefined,
          publicKey: algorithm === "rsa" && operation === "encrypt" ? publicKey : undefined,
          privateKey: algorithm === "rsa" && operation === "decrypt" ? privateKey : undefined,
        }),
      });

      if (!response.ok) throw new Error("Processing failed");
      const data = await response.json();
      setResult(data);

      // Auto-fill keys for convenience
      if (data.key && algorithm === "aes") setKey(data.key);
      if (data.publicKey) setPublicKey(data.publicKey);
      if (data.privateKey) setPrivateKey(data.privateKey);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateKeys = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("http://localhost:5000/api/scan/crypto-generate-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm,
          keySize: algorithm === "aes" ? parseInt(aesKeySize) : parseInt(rsaKeySize),
        }),
      });

      if (!response.ok) throw new Error("Key generation failed");
      const data = await response.json();

      if (algorithm === "aes") {
        setKey(data.key);
      } else {
        setPublicKey(data.publicKey);
        setPrivateKey(data.privateKey);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadKeys = () => {
    if (!result) return;

    let content = `Algorithm: ${algorithm.toUpperCase()}\n`;
    content += `Operation: ${operation}\n`;
    content += `Key Size: ${result.keySize} bits\n\n`;

    if (algorithm === "aes" && result.key) {
      content += `AES Key:\n${result.key}\n\n`;
      if (result.iv) content += `IV:\n${result.iv}\n`;
    } else if (algorithm === "rsa") {
      if (result.publicKey) content += `Public Key:\n${result.publicKey}\n\n`;
      if (result.privateKey) content += `Private Key:\n${result.privateKey}\n`;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${algorithm}_keys_${Date.now()}.txt`;
    a.click();
  };

  return (
    <CyberpunkCard title="RSA/AES ENCRYPTION">
      <div className="space-y-6">
        {/* Algorithm & Operation Selection */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              ALGORITHM
            </label>
            <Select value={algorithm} onValueChange={(v: any) => setAlgorithm(v)}>
              <SelectTrigger className="bg-black/50 border-cyber-red/30 text-cyber-cyan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aes">AES (Symmetric)</SelectItem>
                <SelectItem value="rsa">RSA (Asymmetric)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              OPERATION
            </label>
            <Select value={operation} onValueChange={(v: any) => setOperation(v)}>
              <SelectTrigger className="bg-black/50 border-cyber-red/30 text-cyber-cyan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encrypt">Encrypt</SelectItem>
                <SelectItem value="decrypt">Decrypt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key Size Selection */}
        <div>
          <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
            KEY SIZE
          </label>
          {algorithm === "aes" ? (
            <Select value={aesKeySize} onValueChange={(v: any) => setAesKeySize(v)}>
              <SelectTrigger className="bg-black/50 border-cyber-red/30 text-cyber-cyan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">128 bits</SelectItem>
                <SelectItem value="192">192 bits</SelectItem>
                <SelectItem value="256">256 bits (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select value={rsaKeySize} onValueChange={(v: any) => setRsaKeySize(v)}>
              <SelectTrigger className="bg-black/50 border-cyber-red/30 text-cyber-cyan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1024">1024 bits (Fast, Less Secure)</SelectItem>
                <SelectItem value="2048">2048 bits (Recommended)</SelectItem>
                <SelectItem value="4096">4096 bits (Most Secure)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Input Text */}
        <div>
          <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
            INPUT TEXT
          </label>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={operation === "encrypt" ? "Enter plaintext to encrypt..." : "Enter ciphertext to decrypt..."}
            className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono h-32"
            disabled={isProcessing}
          />
        </div>

        {/* Keys Input */}
        {algorithm === "aes" ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-cyber-cyan tracking-wide">
                AES SECRET KEY (Hex)
              </label>
              <Button
                onClick={handleGenerateKeys}
                disabled={isProcessing}
                className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                size="sm"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Generate
              </Button>
            </div>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Leave empty to auto-generate"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono text-xs"
              disabled={isProcessing}
            />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-cyber-cyan tracking-wide">
                  RSA KEY PAIR
                </label>
                <Button
                  onClick={handleGenerateKeys}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                  size="sm"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Generate Keys
                </Button>
              </div>
              <Textarea
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="Public Key (PEM format)"
                className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono text-xs h-24 mb-2"
                disabled={isProcessing}
              />
              <Textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Private Key (PEM format)"
                className="bg-black/50 border-cyber-red/30 text-cyber-cyan font-mono text-xs h-24"
                disabled={isProcessing}
              />
            </div>
          </>
        )}

        {/* Process Button */}
        <Button
          onClick={handleProcess}
          disabled={isProcessing || !inputText.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              PROCESSING...
            </>
          ) : operation === "encrypt" ? (
            <>
              <Lock className="mr-2 h-4 w-4" />
              ENCRYPT DATA
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              DECRYPT DATA
            </>
          )}
        </Button>

        {/* Info Box */}
        <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
          <p className="font-semibold text-cyber-cyan mb-1">ℹ️ {algorithm.toUpperCase()} Encryption</p>
          {algorithm === "aes" ? (
            <p>AES is a symmetric algorithm using the same key for encryption/decryption. Fast and efficient for large data. Supports 128/192/256-bit keys.</p>
          ) : (
            <p>RSA is an asymmetric algorithm using public/private key pairs. Public key encrypts, private key decrypts. Slower but ideal for secure key exchange.</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="border-t border-cyber-red/30 pt-6 space-y-4">
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-cyber-cyan">
                  {operation === "encrypt" ? "ENCRYPTED OUTPUT" : "DECRYPTED OUTPUT"}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(result.output, "output")}
                    className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                  >
                    {copiedField === "output" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyber-cyan" />
                    )}
                  </button>
                  {(result.key || result.publicKey || result.privateKey) && (
                    <button
                      onClick={downloadKeys}
                      className="p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                    >
                      <Download className="w-4 h-4 text-cyber-cyan" />
                    </button>
                  )}
                </div>
              </div>

              <pre className="text-xs text-gray-400 bg-black/30 p-3 rounded overflow-x-auto font-mono break-all whitespace-pre-wrap">
                {result.output}
              </pre>

              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <div className="p-2 bg-black/30 rounded">
                  <p className="text-xs text-gray-500">Algorithm:</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.algorithm.toUpperCase()}</p>
                </div>
                <div className="p-2 bg-black/30 rounded">
                  <p className="text-xs text-gray-500">Key Size:</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.keySize} bits</p>
                </div>
                <div className="p-2 bg-black/30 rounded md:col-span-2">
                  <p className="text-xs text-gray-500">Processing Time:</p>
                  <p className="text-sm text-cyber-cyan font-semibold">{result.processingTime}ms</p>
                </div>
              </div>
            </div>

            {/* Generated Keys */}
            {result.key && (
              <div className="glass-panel rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-cyber-cyan">AES KEY</h3>
                  <button
                    onClick={() => copyToClipboard(result.key!, "key")}
                    className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                  >
                    {copiedField === "key" ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                    )}
                  </button>
                </div>
                <pre className="text-xs text-gray-400 bg-black/30 p-2 rounded overflow-x-auto font-mono break-all">
                  {result.key}
                </pre>
                {result.iv && (
                  <>
                    <div className="flex items-center justify-between mb-2 mt-3">
                      <h3 className="text-sm font-bold text-cyber-cyan">INITIALIZATION VECTOR (IV)</h3>
                      <button
                        onClick={() => copyToClipboard(result.iv!, "iv")}
                        className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                      >
                        {copiedField === "iv" ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                        )}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-400 bg-black/30 p-2 rounded overflow-x-auto font-mono break-all">
                      {result.iv}
                    </pre>
                  </>
                )}
              </div>
            )}

            {result.publicKey && result.privateKey && (
              <div className="glass-panel rounded p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-cyber-cyan">PUBLIC KEY</h3>
                    <button
                      onClick={() => copyToClipboard(result.publicKey!, "publicKey")}
                      className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                    >
                      {copiedField === "publicKey" ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                      )}
                    </button>
                  </div>
                  <pre className="text-xs text-gray-400 bg-black/30 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap break-all max-h-32">
                    {result.publicKey}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-red-400">PRIVATE KEY (Keep Secret!)</h3>
                    <button
                      onClick={() => copyToClipboard(result.privateKey!, "privateKey")}
                      className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 rounded transition-colors"
                    >
                      {copiedField === "privateKey" ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-cyber-cyan" />
                      )}
                    </button>
                  </div>
                  <pre className="text-xs text-gray-400 bg-black/30 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap break-all max-h-32">
                    {result.privateKey}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default RSAESEncryption;
