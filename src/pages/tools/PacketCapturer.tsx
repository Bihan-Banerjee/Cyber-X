import { useState, useRef, useEffect } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Radio, Square, Download, Trash2, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface NetworkInterface {
  name: string;
  description: string;
  addresses: string[];
}

interface CapturedPacket {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
}

interface CaptureSession {
  isCapturing: boolean;
  interfaceName: string;
  startTime: string;
  packetCount: number;
  totalBytes: number;
  duration: number;
}

const PacketCapturer = () => {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>("");
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  const [packets, setPackets] = useState<CapturedPacket[]>([]);
  const [isLoadingInterfaces, setIsLoadingInterfaces] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadInterfaces();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const loadInterfaces = async () => {
    setIsLoadingInterfaces(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/network-interfaces`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load interfaces");
      }

      const data = await response.json();
      setInterfaces(data.interfaces);
      
      if (data.interfaces.length > 0) {
        setSelectedInterface(data.interfaces[0].name);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load network interfaces");
    } finally {
      setIsLoadingInterfaces(false);
    }
  };

  const startCapture = async () => {
    if (!selectedInterface) return;

    setError(null);
    setPackets([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/start-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfaceName: selectedInterface,
          filter: filter || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start capture");
      }

      const data = await response.json();
      setCaptureSession(data.session);

      // Start polling for packets
      intervalRef.current = setInterval(fetchPackets, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to start packet capture");
    }
  };

  const stopCapture = async () => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const response = await fetch(`${API_BASE_URL}/api/scan/stop-capture`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to stop capture");
      }

      setCaptureSession(null);
    } catch (err: any) {
      setError(err.message || "Failed to stop packet capture");
    }
  };

  const fetchPackets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/capture-packets`);

      if (!response.ok) return;

      const data = await response.json();
      
      if (data.packets) {
        setPackets(data.packets);
      }
      
      if (data.session) {
        setCaptureSession(data.session);
      }
    } catch (err) {
      console.error("Failed to fetch packets:", err);
    }
  };

  const downloadPcap = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/download-pcap`);

      if (!response.ok) {
        throw new Error("Failed to download PCAP file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capture_${Date.now()}.pcap`;
      a.click();
    } catch (err: any) {
      setError(err.message || "Failed to download PCAP file");
    }
  };

  const clearPackets = () => {
    setPackets([]);
  };

  const getProtocolColor = (protocol: string) => {
    const colors: Record<string, string> = {
      TCP: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      UDP: "bg-green-500/20 text-green-400 border-green-500/50",
      HTTP: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      HTTPS: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      DNS: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      ICMP: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      ARP: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    };
    return colors[protocol] || "bg-gray-500/20 text-gray-400 border-gray-500/50";
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <CyberpunkCard title="PACKET CAPTURER">
      <div className="space-y-6">
        {/* Interface Selection */}
        <div className="glass-panel rounded p-6">
          <h3 className="text-lg font-bold text-cyber-cyan mb-4">NETWORK INTERFACE</h3>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={selectedInterface}
                  onValueChange={setSelectedInterface}
                  disabled={!!captureSession?.isCapturing || isLoadingInterfaces}
                >
                  <SelectTrigger className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan">
                    <SelectValue placeholder="Select network interface" />
                  </SelectTrigger>
                  <SelectContent>
                    {interfaces.map((iface) => (
                      <SelectItem key={iface.name} value={iface.name}>
                        {iface.name} - {iface.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={loadInterfaces}
                disabled={isLoadingInterfaces || !!captureSession?.isCapturing}
                className="px-4 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30"
              >
                {isLoadingInterfaces ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div>
              <label className="block text-xs text-cyber-cyan mb-2 tracking-wide">
                CAPTURE FILTER (BPF Syntax)
              </label>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="tcp port 80 or udp port 53"
                disabled={!!captureSession?.isCapturing}
                className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan px-3 py-2 rounded text-sm font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Examples: "tcp", "port 443", "host 192.168.1.1"
              </p>
            </div>

            <div className="flex gap-2">
              {!captureSession?.isCapturing ? (
                <Button
                  onClick={startCapture}
                  disabled={!selectedInterface}
                  className="flex-1 bg-cyber-red hover:bg-cyber-deepRed text-white font-bold"
                >
                  <Radio className="w-4 h-4 mr-2" />
                  START CAPTURE
                </Button>
              ) : (
                <Button
                  onClick={stopCapture}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold"
                >
                  <Square className="w-4 h-4 mr-2" />
                  STOP CAPTURE
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Capture Statistics */}
        {captureSession && (
          <div className="glass-panel rounded p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <h3 className="text-lg font-bold text-cyber-cyan">CAPTURE IN PROGRESS</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{captureSession.packetCount}</p>
                <p className="text-xs text-cyber-cyan">Packets</p>
              </div>
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                <p className="text-2xl font-bold text-green-400">{formatBytes(captureSession.totalBytes)}</p>
                <p className="text-xs text-green-400">Total Size</p>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded text-center">
                <p className="text-2xl font-bold text-purple-400">{formatDuration(captureSession.duration)}</p>
                <p className="text-xs text-purple-400">Duration</p>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                <p className="text-2xl font-bold text-yellow-400">{captureSession.interfaceName}</p>
                <p className="text-xs text-yellow-400">Interface</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Packet List */}
        {packets.length > 0 && (
          <div className="glass-panel rounded p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-cyber-cyan">CAPTURED PACKETS ({packets.length})</h3>
              <div className="flex gap-2">
                <Button
                  onClick={downloadPcap}
                  className="px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs"
                  size="sm"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download PCAP
                </Button>
                <Button
                  onClick={clearPackets}
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 text-xs"
                  size="sm"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {packets.map((packet) => (
                <div
                  key={packet.id}
                  className="p-3 bg-black/30 rounded hover:bg-black/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">#{packet.id}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getProtocolColor(packet.protocol)}`}>
                        {packet.protocol}
                      </span>
                      <span className="text-xs text-gray-400">{packet.length} bytes</span>
                    </div>
                    <span className="text-xs text-gray-500">{packet.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-cyan-400 font-mono">{packet.source}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-purple-400 font-mono">{packet.destination}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{packet.info}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="text-xs text-gray-500 p-3 bg-black/30 rounded">
          <p className="font-semibold text-cyber-cyan mb-1">ℹ️ Packet Capture</p>
          <p>Captures live network packets from selected interface. Supports BPF filters for targeted capture. Download as PCAP file for analysis in Wireshark or other tools. Requires appropriate network permissions.</p>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default PacketCapturer;
