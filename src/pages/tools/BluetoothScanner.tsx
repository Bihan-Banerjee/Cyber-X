import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bluetooth, BluetoothSearching, Info } from "lucide-react";

interface BTDevice {
  name: string;
  id: string;
  services: string[];
}

const BluetoothScanner = () => {
  const [devices, setDevices] = useState<BTDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isWebBluetoothSupported = () =>
    typeof navigator !== "undefined" && "bluetooth" in navigator;

  const isBrave = () =>
    typeof (navigator as any).brave !== "undefined";

  const isChromiumBrowser = () => {
    const ua = navigator.userAgent;
    return /Chrome|Chromium|Edge/.test(ua) && !/Firefox|Safari\//.test(ua);
  };

  const scanBluetooth = async () => {
    setError(null);
    setInfo(null);
    setIsScanning(true);

    if (!isWebBluetoothSupported()) {
      setError("Web Bluetooth API is not supported in this browser. Use Chrome, Edge, or Chromium-based browsers.");
      setIsScanning(false);
      return;
    }

    try {
      // @ts-ignore - Web Bluetooth API
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [],
      });

      const newDevice: BTDevice = {
        name: device.name || "Unknown Device",
        id: device.id || "N/A",
        services: [],
      };

      // Try to get services
      try {
        // @ts-ignore
        const server = await device.gatt?.connect();
        if (server) {
          // @ts-ignore
          const services = await server.getPrimaryServices();
          newDevice.services = services.map((s: any) => s.uuid);
          server.disconnect();
        }
      } catch {
        // Services not accessible
      }

      setDevices((prev) => {
        const exists = prev.find((d) => d.id === newDevice.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });
      setInfo(`Device "${newDevice.name}" added. Click scan again to add more devices.`);
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        setInfo("No device selected. User cancelled the pairing dialog.");
      } else if (err.name === "SecurityError") {
        if (isBrave()) {
          setError("Bluetooth blocked by Brave. Enable it at brave://flags/#enable-experimental-web-platform-features then relaunch.");
        } else {
          setError("Bluetooth permission denied. Please allow Bluetooth access in browser settings.");
        }
      } else if (err.name === "NotSupportedError") {
        setError("Web Bluetooth is not supported or is disabled in this browser.");
      } else {
        setError(err.message || "Bluetooth scan failed.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const clearDevices = () => setDevices([]);

  return (
    <CyberpunkCard title="BLUETOOTH SCANNER">
      <div className="space-y-6">
        {/* Browser Compatibility Warning */}
        {!isWebBluetoothSupported() && isBrave() && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Brave: Web Bluetooth is disabled by default</p>
              <p className="text-xs mt-1">
                Go to <span className="font-mono">brave://flags/#enable-experimental-web-platform-features</span>, enable the flag, and relaunch Brave.
              </p>
            </div>
          </div>
        )}
        {!isWebBluetoothSupported() && !isBrave() && !isChromiumBrowser() && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Browser Compatibility Warning</p>
              <p className="text-xs mt-1">Web Bluetooth API requires Chrome, Edge, or another Chromium-based browser. Firefox and Safari are not supported.</p>
            </div>
          </div>
        )}

        {/* Permission Note */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Browser Permission Required</p>
            <p className="text-xs mt-1">Clicking Scan will open the browser's built-in Bluetooth device picker. You must select a device to pair with it. Bluetooth must be enabled on your system.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={scanBluetooth}
            disabled={isScanning}
            className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
          >
            {isScanning ? (
              <><BluetoothSearching className="mr-2 h-4 w-4 animate-pulse" />SCANNING...</>
            ) : (
              <><Bluetooth className="mr-2 h-4 w-4" />SCAN FOR DEVICES</>
            )}
          </Button>
          {devices.length > 0 && (
            <Button
              onClick={clearDevices}
              className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
            >
              CLEAR
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {info && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
            <Info className="w-4 h-4 shrink-0" />
            {info}
          </div>
        )}

        {devices.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-cyber-cyan font-bold tracking-wide">DISCOVERED DEVICES ({devices.length})</h3>
            {devices.map((device, idx) => (
              <div key={idx} className="glass-panel rounded p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Bluetooth className="w-5 h-5 text-cyber-cyan" />
                  <div>
                    <p className="text-cyber-cyan font-bold">{device.name}</p>
                    <p className="text-gray-400 text-xs font-mono">ID: {device.id}</p>
                  </div>
                </div>

                {device.services.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">GATT Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {device.services.map((svc, si) => (
                        <span key={si} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs font-mono">
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {device.services.length === 0 && (
                  <p className="text-gray-500 text-xs">No GATT services enumerated</p>
                )}
              </div>
            ))}
          </div>
        )}

        {devices.length === 0 && !error && !info && (
          <div className="glass-panel rounded p-8 text-center">
            <Bluetooth className="w-12 h-12 text-cyber-cyan/30 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No devices scanned yet.</p>
            <p className="text-gray-600 text-xs mt-1">Click "Scan for Devices" to open the browser Bluetooth picker.</p>
          </div>
        )}

        {/* Info Panel */}
        <div className="glass-panel rounded p-4">
          <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">HOW WEB BLUETOOTH WORKS</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <p>• Uses the <span className="text-cyber-cyan">Web Bluetooth API</span> — only available in Chromium-based browsers</p>
            <p>• Each click of Scan opens the browser's native device picker dialog</p>
            <p>• Device must be in pairing/discoverable mode to appear in the list</p>
            <p>• GATT services are enumerated if the device supports connection</p>
            <p>• No background scanning — browser policy requires user interaction per device</p>
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default BluetoothScanner;
