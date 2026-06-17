import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

type Platform = "android" | "ios";
type RiskLevel = "critical" | "high" | "medium" | "low" | "info";

interface PermissionInfo {
  description: string;
  risk: RiskLevel;
  category: string;
}

const ANDROID_PERMISSIONS: Record<string, PermissionInfo> = {
  "READ_SMS": { description: "Read SMS messages", risk: "critical", category: "Messaging" },
  "SEND_SMS": { description: "Send SMS messages (may incur charges)", risk: "critical", category: "Messaging" },
  "RECEIVE_SMS": { description: "Receive incoming SMS messages", risk: "high", category: "Messaging" },
  "READ_CALL_LOG": { description: "Read call history", risk: "high", category: "Phone" },
  "CAMERA": { description: "Access the device camera", risk: "high", category: "Hardware" },
  "READ_CONTACTS": { description: "Read all contact data", risk: "high", category: "Personal Data" },
  "WRITE_CONTACTS": { description: "Modify or delete contacts", risk: "high", category: "Personal Data" },
  "ACCESS_FINE_LOCATION": { description: "Precise GPS location", risk: "high", category: "Location" },
  "ACCESS_COARSE_LOCATION": { description: "Approximate network location", risk: "medium", category: "Location" },
  "RECORD_AUDIO": { description: "Record audio via microphone", risk: "critical", category: "Hardware" },
  "READ_PHONE_STATE": { description: "Access phone state, IMEI, network info", risk: "high", category: "Phone" },
  "CALL_PHONE": { description: "Make phone calls without user interaction", risk: "critical", category: "Phone" },
  "READ_EXTERNAL_STORAGE": { description: "Read files on external storage", risk: "medium", category: "Storage" },
  "WRITE_EXTERNAL_STORAGE": { description: "Write to external storage", risk: "medium", category: "Storage" },
  "INTERNET": { description: "Full internet access", risk: "low", category: "Network" },
  "RECEIVE_BOOT_COMPLETED": { description: "Start automatically at boot", risk: "medium", category: "System" },
  "FOREGROUND_SERVICE": { description: "Run visible foreground service", risk: "low", category: "System" },
  "REQUEST_INSTALL_PACKAGES": { description: "Install other APKs", risk: "critical", category: "System" },
  "BIND_DEVICE_ADMIN": { description: "Device administrator capabilities", risk: "critical", category: "System" },
  "CHANGE_NETWORK_STATE": { description: "Change Wi-Fi/network connectivity", risk: "medium", category: "Network" },
  "ACCESS_WIFI_STATE": { description: "Read Wi-Fi connection info", risk: "low", category: "Network" },
  "BLUETOOTH": { description: "Pair and connect to Bluetooth devices", risk: "medium", category: "Hardware" },
  "BLUETOOTH_SCAN": { description: "Scan for nearby Bluetooth devices", risk: "medium", category: "Hardware" },
  "USE_BIOMETRIC": { description: "Use fingerprint/face biometric auth", risk: "low", category: "Hardware" },
  "BODY_SENSORS": { description: "Access heart rate and other body sensors", risk: "medium", category: "Health" },
};

const IOS_PERMISSIONS: Record<string, PermissionInfo> = {
  "NSCameraUsageDescription": { description: "Camera access", risk: "high", category: "Hardware" },
  "NSMicrophoneUsageDescription": { description: "Microphone access", risk: "critical", category: "Hardware" },
  "NSLocationWhenInUseUsageDescription": { description: "Location while app is in use", risk: "medium", category: "Location" },
  "NSLocationAlwaysUsageDescription": { description: "Background location tracking", risk: "high", category: "Location" },
  "NSLocationAlwaysAndWhenInUseUsageDescription": { description: "Always-on location tracking", risk: "high", category: "Location" },
  "NSContactsUsageDescription": { description: "Access to contacts", risk: "high", category: "Personal Data" },
  "NSCalendarsUsageDescription": { description: "Read/write calendar events", risk: "medium", category: "Personal Data" },
  "NSRemindersUsageDescription": { description: "Read/write reminders", risk: "low", category: "Personal Data" },
  "NSPhotoLibraryUsageDescription": { description: "Read photo library", risk: "high", category: "Storage" },
  "NSPhotoLibraryAddUsageDescription": { description: "Save photos to library", risk: "medium", category: "Storage" },
  "NSMotionUsageDescription": { description: "Accelerometer and motion data", risk: "medium", category: "Hardware" },
  "NSHealthShareUsageDescription": { description: "Read health data", risk: "critical", category: "Health" },
  "NSHealthUpdateUsageDescription": { description: "Write health data", risk: "critical", category: "Health" },
  "NSFaceIDUsageDescription": { description: "Face ID biometric authentication", risk: "medium", category: "Biometrics" },
  "NSSpeechRecognitionUsageDescription": { description: "Speech recognition (audio to text)", risk: "high", category: "Hardware" },
  "NSBluetoothAlwaysUsageDescription": { description: "Always-on Bluetooth access", risk: "medium", category: "Hardware" },
  "NSLocalNetworkUsageDescription": { description: "Access local network devices", risk: "medium", category: "Network" },
};

// Dangerous combinations
const DANGEROUS_COMBOS: { perms: string[]; description: string; severity: RiskLevel }[] = [
  { perms: ["RECORD_AUDIO", "INTERNET"], description: "Microphone + Internet = possible audio surveillance/exfiltration", severity: "critical" },
  { perms: ["CAMERA", "INTERNET"], description: "Camera + Internet = possible visual surveillance", severity: "critical" },
  { perms: ["ACCESS_FINE_LOCATION", "INTERNET"], description: "Precise location + Internet = real-time location tracking", severity: "high" },
  { perms: ["READ_SMS", "INTERNET"], description: "SMS read + Internet = SMS exfiltration / 2FA bypass", severity: "critical" },
  { perms: ["READ_CONTACTS", "INTERNET"], description: "Contacts + Internet = contact database exfiltration", severity: "high" },
  { perms: ["CAMERA", "RECORD_AUDIO"], description: "Camera + Microphone = full audiovisual capture capability", severity: "critical" },
  { perms: ["REQUEST_INSTALL_PACKAGES", "INTERNET"], description: "APK install + Internet = malware dropper capability", severity: "critical" },
];

const MobilePermissionAuditor = () => {
  const [platform, setPlatform] = useState<Platform>("android");
  const [permInput, setPermInput] = useState("");
  const [results, setResults] = useState<{ perm: string; info: PermissionInfo; found: boolean }[]>([]);
  const [combos, setCombos] = useState<typeof DANGEROUS_COMBOS>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const analyze = () => {
    const permsDb = platform === "android" ? ANDROID_PERMISSIONS : IOS_PERMISSIONS;
    const lines = permInput
      .split(/[\n,;\s]+/)
      .map((l) => l.trim().replace(/^android\.permission\./, "").toUpperCase())
      .filter((l) => l.length > 0);

    const uniquePerms = Array.from(new Set(lines));
    const resultsList = uniquePerms.map((perm) => {
      const normalKey = platform === "android" ? perm : perm;
      const info = permsDb[normalKey] || permsDb[perm];
      return {
        perm: normalKey,
        info: info || { description: "Unknown permission", risk: "info" as RiskLevel, category: "Unknown" },
        found: !!info,
      };
    });

    // Find dangerous combos
    const foundCombos = DANGEROUS_COMBOS.filter((combo) =>
      combo.perms.every((p) => uniquePerms.includes(p))
    );

    setResults(resultsList);
    setCombos(foundCombos);
    setAnalyzed(true);
  };

  const getRiskColor = (risk: RiskLevel) => {
    if (risk === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (risk === "high") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (risk === "medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (risk === "low") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const riskCounts = analyzed ? {
    critical: results.filter((r) => r.info.risk === "critical").length,
    high: results.filter((r) => r.info.risk === "high").length,
    medium: results.filter((r) => r.info.risk === "medium").length,
    low: results.filter((r) => r.info.risk === "low").length,
  } : null;

  return (
    <CyberpunkCard title="MOBILE PERMISSION AUDITOR">
      <div className="space-y-6">
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-xs">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Client-side analysis only. Paste a list of permissions from an app manifest (one per line, or space/comma separated). Select the platform to see risk assessment.</p>
        </div>

        {/* Platform Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => { setPlatform("android"); setAnalyzed(false); }}
            className={`px-4 py-2 text-sm font-bold rounded border transition-colors ${platform === "android" ? "bg-cyber-red text-white border-cyber-red" : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"}`}
          >
            ANDROID
          </button>
          <button
            onClick={() => { setPlatform("ios"); setAnalyzed(false); }}
            className={`px-4 py-2 text-sm font-bold rounded border transition-colors ${platform === "ios" ? "bg-cyber-red text-white border-cyber-red" : "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/20"}`}
          >
            iOS
          </button>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan mb-1 tracking-wide">
            {platform === "android" ? "ANDROID PERMISSIONS (e.g. READ_SMS, CAMERA)" : "IOS PERMISSION KEYS (e.g. NSCameraUsageDescription)"}
          </label>
          <textarea
            className="w-full h-36 bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-sm font-mono resize-none"
            placeholder={platform === "android"
              ? "READ_SMS\nSEND_SMS\nCAMERA\nACCESS_FINE_LOCATION\nINTERNET"
              : "NSCameraUsageDescription\nNSMicrophoneUsageDescription\nNSLocationAlwaysUsageDescription"}
            value={permInput}
            onChange={(e) => setPermInput(e.target.value)}
          />
        </div>

        <Button
          className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold w-full"
          onClick={analyze}
          disabled={!permInput.trim()}
        >
          ANALYZE PERMISSIONS
        </Button>

        {analyzed && riskCounts && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-center">
                <p className="text-xl font-bold text-red-400">{riskCounts.critical}</p>
                <p className="text-xs text-red-400">Critical</p>
              </div>
              <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded text-center">
                <p className="text-xl font-bold text-orange-400">{riskCounts.high}</p>
                <p className="text-xs text-orange-400">High</p>
              </div>
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                <p className="text-xl font-bold text-yellow-400">{riskCounts.medium}</p>
                <p className="text-xs text-yellow-400">Medium</p>
              </div>
              <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                <p className="text-xl font-bold text-blue-400">{riskCounts.low}</p>
                <p className="text-xs text-blue-400">Low</p>
              </div>
            </div>

            {/* Dangerous Combos */}
            {combos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-red-400 font-bold tracking-wide text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  DANGEROUS PERMISSION COMBINATIONS
                </h3>
                {combos.map((combo, i) => (
                  <div key={i} className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-bold">
                        {combo.severity.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-red-300">{combo.perms.join(" + ")}</span>
                    </div>
                    <p className="text-xs text-gray-300">{combo.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Permission List */}
            <div className="space-y-2">
              <h3 className="text-cyber-cyan font-bold tracking-wide text-sm">PERMISSION RISK MATRIX</h3>
              {results.map((r, i) => (
                <div key={i} className={`p-3 rounded border ${getRiskColor(r.info.risk)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <code className="text-sm font-mono font-bold">{r.perm}</code>
                      <p className="text-xs opacity-80 mt-0.5">{r.info.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs opacity-70">{r.info.category}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRiskColor(r.info.risk)}`}>
                        {r.info.risk.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default MobilePermissionAuditor;
