import { useEffect, useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Activity, Shield, AlertTriangle, TrendingUp } from "lucide-react";

interface ToolActivity {
  toolName: string;
  timestamp: string;
  status: "success" | "warning" | "info";
  message: string;
}

interface SystemResources {
  cpu: number;
  memory: number;
  network: number;
  disk: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeSystems: 12,
    threatsDetected: 47,
    vulnerabilities: 8,
    uptime: 99.8,
  });

  const [recentTools, setRecentTools] = useState<ToolActivity[]>([]);
  const [systemResources, setSystemResources] = useState<SystemResources>({
    cpu: 0,
    memory: 0,
    network: 0,
    disk: 0,
  });
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Set component as active when mounted
    setIsActive(true);

    // Fetch initial data
    fetchRecentTools();
    fetchSystemResources();

    // Update stats periodically
    const statsInterval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        threatsDetected: prev.threatsDetected + Math.floor(Math.random() * 3),
      }));
    }, 5000);

    // Update recent tools every 5 seconds (only when active)
    const toolsInterval = setInterval(() => {
      if (isActive) {
        fetchRecentTools();
      }
    }, 5000);

    // Update system resources every 5 seconds (only when active)
    const resourcesInterval = setInterval(() => {
      if (isActive) {
        fetchSystemResources();
      }
    }, 5000);

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      setIsActive(false);
      clearInterval(statsInterval);
      clearInterval(toolsInterval);
      clearInterval(resourcesInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Update isActive state when component unmounts or remounts
  useEffect(() => {
    if (!isActive) return;

    // Fetch data when component becomes active again
    fetchRecentTools();
    fetchSystemResources();
  }, [isActive]);

  const fetchRecentTools = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/scan/recent-tools");
      if (response.ok) {
        const data = await response.json();
        setRecentTools(data.tools);
      }
    } catch (error) {
      console.error("Failed to fetch recent tools:", error);
    }
  };

  const fetchSystemResources = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/scan/system-resources");
      if (response.ok) {
        const data = await response.json();
        setSystemResources(data.resources);
      }
    } catch (error) {
      console.error("Failed to fetch system resources:", error);
    }
  };

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

  const getRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds} sec ago`;
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return new Date(timestamp).toLocaleDateString();
  };

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
              RECENT TOOL ACTIVITY
            </h3>
            <div className="space-y-2">
              {recentTools.length > 0 ? (
                recentTools.slice(0, 5).map((activity, idx) => (
                  <ActivityItem
                    key={idx}
                    status={activity.status}
                    message={activity.message}
                    time={getRelativeTime(activity.timestamp)}
                  />
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  No recent tool activity
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-cyber-cyan mb-3 tracking-wide">
              SYSTEM RESOURCES
            </h3>
            <div className="space-y-3">
              <HealthBar label="CPU USAGE" percentage={systemResources.cpu} />
              <HealthBar label="MEMORY" percentage={systemResources.memory} />
              <HealthBar label="NETWORK" percentage={systemResources.network} />
              <HealthBar label="DISK I/O" percentage={systemResources.disk} />
            </div>
            <div className="text-xs text-gray-500 mt-2 text-right">
              Updates every 5 seconds
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

const HealthBar = ({ label, percentage }: { label: string; percentage: number }) => {
  const getColor = (pct: number) => {
    if (pct >= 80) return "from-red-500 to-red-600";
    if (pct >= 60) return "from-yellow-500 to-orange-500";
    return "from-cyber-cyan to-cyan-400";
  };

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-black/50 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getColor(percentage)} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default Dashboard;
