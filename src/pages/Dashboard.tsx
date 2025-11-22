import { useEffect, useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Activity, Shield, AlertTriangle, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeSystems: 12,
    threatsDetected: 47,
    vulnerabilities: 8,
    uptime: 99.8,
  });

  useEffect(() => {
    // Simulate live stats updates
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        threatsDetected: prev.threatsDetected + Math.floor(Math.random() * 3),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    trend,
  }: {
    icon: any;
    label: string;
    value: string | number;
    trend?: string;
  }) => (
    <div className="glass-panel rounded p-6 hover:scale-105 transition-transform">
      <div className="flex items-center justify-between mb-4">
        <Icon className="w-8 h-8 text-cyber-cyan" />
        {trend && <span className="text-xs text-green-400">{trend}</span>}
      </div>
      <div className="text-3xl font-bold text-cyber-red cyber-glow-red">{value}</div>
      <div className="text-sm text-gray-400 tracking-wide mt-2">{label}</div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Activity} label="ACTIVE SYSTEMS" value={stats.activeSystems} trend="+2" />
        <StatCard
          icon={AlertTriangle}
          label="THREATS DETECTED"
          value={stats.threatsDetected}
          trend="+5"
        />
        <StatCard icon={Shield} label="VULNERABILITIES" value={stats.vulnerabilities} />
        <StatCard icon={TrendingUp} label="UPTIME" value={`${stats.uptime}%`} trend="+0.1%" />
      </div>

      {/* Main Dashboard Card */}
      <CyberpunkCard title="SYSTEM OVERVIEW">
        <div className="space-y-6">
          <div className="border-b border-cyber-red/20 pb-4">
            <h3 className="text-lg font-bold text-cyber-cyan mb-3 tracking-wide">
              RECENT ACTIVITY
            </h3>
            <div className="space-y-2">
              <ActivityItem
                status="success"
                message="Port scan completed on 192.168.1.0/24"
                time="2 min ago"
              />
              <ActivityItem
                status="warning"
                message="Vulnerability detected on SSH service"
                time="5 min ago"
              />
              <ActivityItem
                status="info"
                message="Honeypot logged suspicious connection"
                time="12 min ago"
              />
              <ActivityItem
                status="success"
                message="Security patch applied successfully"
                time="1 hour ago"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-cyber-cyan mb-3 tracking-wide">
              SYSTEM HEALTH
            </h3>
            <div className="space-y-3">
              <HealthBar label="CPU USAGE" percentage={45} />
              <HealthBar label="MEMORY" percentage={62} />
              <HealthBar label="NETWORK" percentage={28} />
              <HealthBar label="DISK I/O" percentage={71} />
            </div>
          </div>
        </div>
      </CyberpunkCard>
    </div>
  );
};

const ActivityItem = ({
  status,
  message,
  time,
}: {
  status: "success" | "warning" | "info";
  message: string;
  time: string;
}) => {
  const colors = {
    success: "bg-green-500",
    warning: "bg-yellow-500",
    info: "bg-cyber-cyan",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded bg-black/30 hover:bg-black/50 transition-colors">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <div className="flex-1">
        <p className="text-gray-300 text-sm">{message}</p>
      </div>
      <span className="text-xs text-gray-500">{time}</span>
    </div>
  );
};

const HealthBar = ({ label, percentage }: { label: string; percentage: number }) => (
  <div>
    <div className="flex justify-between text-xs text-gray-400 mb-1">
      <span>{label}</span>
      <span>{percentage}%</span>
    </div>
    <div className="h-2 bg-black/50 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-cyber-red to-cyber-cyan transition-all duration-1000"
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

export default Dashboard;
