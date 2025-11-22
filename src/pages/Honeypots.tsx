import { useEffect, useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Activity, Shield, AlertTriangle, Globe } from "lucide-react";

interface ThreatEvent {
  id: string;
  timestamp: string;
  sourceIp: string;
  targetPort: number;
  attackType: string;
  severity: "high" | "medium" | "low";
}

const Honeypots = () => {
  const [stats, setStats] = useState({
    activeHoneypots: 8,
    attacksLogged: 142,
    uniqueIPs: 67,
    criticalThreats: 12,
  });

  const [threats, setThreats] = useState<ThreatEvent[]>([
    {
      id: "1",
      timestamp: new Date().toISOString(),
      sourceIp: "192.168.1.100",
      targetPort: 22,
      attackType: "SSH Brute Force",
      severity: "high",
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      sourceIp: "10.0.0.45",
      targetPort: 3389,
      attackType: "RDP Connection Attempt",
      severity: "medium",
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 600000).toISOString(),
      sourceIp: "172.16.0.88",
      targetPort: 80,
      attackType: "SQL Injection Probe",
      severity: "high",
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        attacksLogged: prev.attacksLogged + Math.floor(Math.random() * 2),
      }));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
    <div className="glass-panel rounded p-4 hover:scale-105 transition-transform">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-cyber-red cyber-glow-red">{value}</div>
          <div className="text-xs text-gray-400 tracking-wide">{label}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Shield}
          label="ACTIVE HONEYPOTS"
          value={stats.activeHoneypots}
          color="bg-cyber-cyan/20"
        />
        <StatCard
          icon={Activity}
          label="ATTACKS LOGGED"
          value={stats.attacksLogged}
          color="bg-cyber-red/20"
        />
        <StatCard
          icon={Globe}
          label="UNIQUE IPs"
          value={stats.uniqueIPs}
          color="bg-purple-500/20"
        />
        <StatCard
          icon={AlertTriangle}
          label="CRITICAL THREATS"
          value={stats.criticalThreats}
          color="bg-yellow-500/20"
        />
      </div>

      {/* Threat Log */}
      <CyberpunkCard title="RECENT THREAT EVENTS">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {threats.map((threat) => (
            <div
              key={threat.id}
              className="p-4 bg-black/30 rounded hover:bg-black/50 transition-colors border-l-4"
              style={{
                borderLeftColor:
                  threat.severity === "high"
                    ? "#ef4444"
                    : threat.severity === "medium"
                    ? "#f59e0b"
                    : "#3b82f6",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-cyber-cyan tracking-wide">
                  {threat.attackType}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    threat.severity === "high"
                      ? "bg-red-500/20 text-red-400"
                      : threat.severity === "medium"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {threat.severity.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-400">
                <div>
                  <span className="text-xs text-gray-500">Source IP:</span>
                  <p className="font-mono text-cyber-red">{threat.sourceIp}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Target Port:</span>
                  <p className="font-mono">{threat.targetPort}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Time:</span>
                  <p className="font-mono">
                    {new Date(threat.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CyberpunkCard>
    </div>
  );
};

export default Honeypots;
