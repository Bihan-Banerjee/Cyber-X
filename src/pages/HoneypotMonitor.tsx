import { useState, useEffect } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Activity, Shield, AlertTriangle, MapPin, Terminal, Play, Square } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
interface HoneypotStatus {
  name: string;
  type: string;
  status: "running" | "stopped" | "error";
  uptime: number;
  connections: number;
  attacks: number;
  ports: number[];
}

interface AttackEvent {
  timestamp: string;
  source_ip: string;
  destination_port: number;
  protocol: string;
  honeypot: string;
  event_type: string;
  details: any;
  geoip?: {
    country_name?: string;
    city_name?: string;
  };
}

const HoneypotMonitor = () => {
  const [honeypots, setHoneypots] = useState<HoneypotStatus[]>([]);
  const [recentAttacks, setRecentAttacks] = useState<AttackEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchHoneypotStatus();
    fetchRecentAttacks();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchHoneypotStatus();
        fetchRecentAttacks();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchHoneypotStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/honeypot/status`);
      const data = await response.json();
      setHoneypots(data.honeypots);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch honeypot status:", error);
    }
  };

  const fetchRecentAttacks = async () => {
    try {
      const response = await fetch("${API_BASE_URL}/api/honeypot/attacks/recent?limit=20");
      const data = await response.json();
      setRecentAttacks(data.attacks);
    } catch (error) {
      console.error("Failed to fetch recent attacks:", error);
    }
  };

  const startHoneypot = async (type: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/honeypot/start/${type}`, { method: "POST" });
      fetchHoneypotStatus();
    } catch (error) {
      console.error("Failed to start honeypot:", error);
    }
  };

  const stopHoneypot = async (type: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/honeypot/stop/${type}`, { method: "POST" });
      fetchHoneypotStatus();
    } catch (error) {
      console.error("Failed to stop honeypot:", error);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-green-400 bg-green-500/20 border-green-500/50";
      case "stopped":
        return "text-gray-400 bg-gray-500/20 border-gray-500/50";
      case "error":
        return "text-red-400 bg-red-500/20 border-red-500/50";
      default:
        return "text-gray-400 bg-gray-500/20 border-gray-500/50";
    }
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Shield}
          label="Active Honeypots"
          value={honeypots.filter((h) => h.status === "running").length}
          color="text-cyber-cyan"
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Attacks (24h)"
          value={honeypots.reduce((sum, h) => sum + h.attacks, 0)}
          color="text-cyber-red"
        />
        <StatCard
          icon={Activity}
          label="Active Connections"
          value={honeypots.reduce((sum, h) => sum + h.connections, 0)}
          color="text-yellow-400"
        />
      </div>

      {/* Honeypot Status Cards */}
      <CyberpunkCard title="HONEYPOT STATUS">
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading honeypots...</div>
          ) : (
            honeypots.map((honeypot) => (
              <div
                key={honeypot.type}
                className="glass-panel rounded p-4 hover:border-cyber-cyan transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded ${getStatusColor(honeypot.status)}`}>
                      <Terminal className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-cyber-cyan">{honeypot.name}</h3>
                      <div className="flex gap-4 text-sm text-gray-400 mt-1">
                        <span>Uptime: {formatUptime(honeypot.uptime)}</span>
                        <span>Connections: {honeypot.connections}</span>
                        <span>Attacks: {honeypot.attacks}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {honeypot.ports.map((port) => (
                          <span
                            key={port}
                            className="text-xs px-2 py-1 bg-cyber-cyan/20 text-cyber-cyan rounded"
                          >
                            Port {port}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {honeypot.status === "running" ? (
                      <button
                        onClick={() => stopHoneypot(honeypot.type)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors flex items-center gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => startHoneypot(honeypot.type)}
                        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CyberpunkCard>

      {/* Recent Attacks */}
      <CyberpunkCard title="RECENT ATTACKS">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentAttacks.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No attacks detected yet</div>
          ) : (
            recentAttacks.map((attack, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded bg-black/30 hover:bg-black/50 transition-colors"
              >
                <MapPin className="w-4 h-4 text-cyber-red flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-cyber-cyan font-mono text-sm">{attack.source_ip}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-400 text-sm">
                      Port {attack.destination_port}
                    </span>
                    <span className="text-xs px-2 py-1 bg-cyber-red/20 text-cyber-red rounded">
                      {attack.honeypot}
                    </span>
                    {attack.geoip && (
                      <span className="text-xs text-gray-500">
                        {attack.geoip.city_name}, {attack.geoip.country_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{attack.event_type}</div>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {new Date(attack.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </CyberpunkCard>

      {/* Auto-refresh Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 rounded font-mono text-sm transition-colors ${
            autoRefresh
              ? "bg-cyber-cyan text-black"
              : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
          }`}
        >
          {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
        </button>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) => (
  <div className="glass-panel rounded p-6">
    <div className="flex items-center justify-between mb-4">
      <Icon className={`w-8 h-8 ${color}`} />
    </div>
    <div className={`text-3xl font-bold ${color} cyber-glow-red`}>{value}</div>
    <div className="text-sm text-gray-400 tracking-wide mt-2">{label}</div>
  </div>
);

export default HoneypotMonitor;
