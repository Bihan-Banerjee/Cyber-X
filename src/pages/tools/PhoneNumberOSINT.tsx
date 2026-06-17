import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Phone } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PhoneResult {
  number: string;
  formatted: string;
  valid: boolean;
  country: string;
  countryCode: string;
  carrier: string;
  lineType: "mobile" | "landline" | "voip" | "unknown";
  timezone: string;
  location: string;
}

const LINE_TYPE_COLORS: Record<string, string> = {
  mobile: "bg-green-500/20 text-green-400",
  landline: "bg-blue-500/20 text-blue-400",
  voip: "bg-purple-500/20 text-purple-400",
  unknown: "bg-gray-500/20 text-gray-400",
};

const PhoneNumberOSINT = () => {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PhoneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!phone.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/phone-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Lookup failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Failed to lookup phone number");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="PHONE NUMBER OSINT">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="+1 234 567 8900"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            disabled={isLoading} />
          <Button onClick={handleLookup} disabled={isLoading || !phone.trim()}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold px-6">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-gray-500">Use international format with country code: +1 (US), +44 (UK), +91 (India), etc.</p>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="glass-panel rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-cyber-cyan font-mono">{result.formatted || result.number}</p>
                  {result.formatted !== result.number && (
                    <p className="text-sm text-gray-400 font-mono">{result.number}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded text-sm font-bold ${result.valid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {result.valid ? "VALID" : "INVALID"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Country", value: result.country },
                  { label: "Country Code", value: `+${result.countryCode}` },
                  { label: "Location", value: result.location || "Unknown" },
                  { label: "Timezone", value: result.timezone || "Unknown" },
                  { label: "Carrier", value: result.carrier || "Unknown" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm text-cyber-cyan">{value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-gray-400 mb-1">Line Type</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${LINE_TYPE_COLORS[result.lineType]}`}>
                    {result.lineType.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PhoneNumberOSINT;
