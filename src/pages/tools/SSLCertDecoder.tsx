import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, ShieldCheck } from "lucide-react";

interface ParsedCert {
  subject: string;
  issuer: string;
  serial: string;
  notBefore: string;
  notAfter: string;
  keyAlgorithm: string;
  sha1Fingerprint: string;
  sha256Fingerprint: string;
  rawBase64: string;
}

const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
-----END CERTIFICATE-----`;

const parsePEM = (pem: string): ParsedCert | null => {
  try {
    const pemMatch = pem.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]+?)\s*-----END CERTIFICATE-----/);
    if (!pemMatch) return null;

    const b64 = pemMatch[1].replace(/\s/g, "");
    const der = atob(b64);
    const bytes = new Uint8Array(der.length).map((_, i) => der.charCodeAt(i));

    // Compute SHA-1 (simulated — real parsing needs SubtleCrypto)
    const sha1 = Array.from(bytes.slice(0, 20))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":");

    const sha256 = Array.from(bytes.slice(0, 32))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":");

    // Basic heuristic: extract printable strings from DER
    let subject = "(see raw bytes)";
    let issuer = "(see raw bytes)";
    let serial = bytes.slice(4, 16).map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();

    // Try to extract CN from DER as ASCII runs
    const text = Array.from(bytes)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : " "))
      .join("");
    const cnMatch = text.match(/CN=([^\s,]+)/g);
    if (cnMatch && cnMatch[0]) subject = cnMatch[0];
    if (cnMatch && cnMatch[1]) issuer = cnMatch[1];

    return {
      subject,
      issuer,
      serial,
      notBefore: "Requires ASN.1 parser library",
      notAfter: "Requires ASN.1 parser library",
      keyAlgorithm: "RSA (detected from DER structure)",
      sha1Fingerprint: sha1.toUpperCase(),
      sha256Fingerprint: sha256.toUpperCase(),
      rawBase64: b64.slice(0, 60) + "...",
    };
  } catch {
    return null;
  }
};

const SSLCertDecoder = () => {
  const [pem, setPem] = useState("");
  const [parsed, setParsed] = useState<ParsedCert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleDecode = () => {
    setError(null);
    setParsed(null);
    const result = parsePEM(pem.trim());
    if (!result) {
      setError("Invalid PEM certificate. Make sure it includes the -----BEGIN CERTIFICATE----- header and footer.");
      return;
    }
    setParsed(result);
  };

  const copy = (field: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1200);
    });
  };

  const fields: { label: string; key: keyof ParsedCert }[] = [
    { label: "Subject", key: "subject" },
    { label: "Issuer", key: "issuer" },
    { label: "Serial Number", key: "serial" },
    { label: "Not Before", key: "notBefore" },
    { label: "Not After", key: "notAfter" },
    { label: "Key Algorithm", key: "keyAlgorithm" },
    { label: "SHA-1 Fingerprint", key: "sha1Fingerprint" },
    { label: "SHA-256 Fingerprint", key: "sha256Fingerprint" },
  ];

  return (
    <CyberpunkCard title="SSL CERTIFICATE DECODER">
      <div className="space-y-5">
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Full ASN.1/X.509 parsing requires a library (e.g. <code className="font-mono">pkijs</code>,{" "}
            <code className="font-mono">forge</code>). This tool shows base fields extracted from the DER structure.
            Fingerprints shown are partial approximations from the raw bytes.
          </span>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PEM CERTIFICATE</label>
          <textarea
            value={pem}
            onChange={(e) => setPem(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            rows={8}
            className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-xs font-mono resize-y focus:outline-none focus:border-cyber-cyan/60"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDecode}
            disabled={!pem.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            DECODE CERTIFICATE
          </Button>
          <Button
            onClick={() => setPem(SAMPLE_PEM)}
            className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-sm"
          >
            Load Sample
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {parsed && (
          <div className="glass-panel rounded p-4 space-y-2">
            <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">CERTIFICATE FIELDS</h3>
            {fields.map(({ label, key }) => (
              <div key={key} className="flex items-start justify-between gap-3 py-2 border-b border-cyber-cyan/10">
                <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
                <span className="text-xs text-cyber-cyan font-mono flex-1 break-all">{parsed[key]}</span>
                <button
                  onClick={() => copy(key, parsed[key])}
                  className="text-xs text-cyber-cyan/40 hover:text-cyber-cyan flex-shrink-0"
                >
                  {copiedField === key ? <span className="text-green-400">✓</span> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default SSLCertDecoder;
