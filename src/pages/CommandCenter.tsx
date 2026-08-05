/**
 * CommandCenter.tsx — the unifying view that ties the three CyberX subsystems
 * together on one screen: the honeypot threat feed, the trained RL defender's
 * live recommendation (Defender Copilot), RL system health (training status +
 * NashConv), and recent CyberX tool activity.
 *
 * Live-first; degrades gracefully when the local Flask/honeypot stack is absent
 * (the Copilot and exploitability fall back to committed snapshots).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CyberpunkCard from "@/components/CyberpunkCard";
import DefenderCopilot from "@/components/DefenderCopilot";
import { API_BASE_URL } from "@/lib/api";
import { fetchRL, type ExploitabilityReport } from "@/lib/rlData";
import { Activity, AlertTriangle, Crosshair, MapPin, Radio, Wrench } from "lucide-react";

interface AttackEvent {
  timestamp: string;
  source_ip: string;
  destination_port: number;
  honeypot: string;
  event_type: string;
  geoip?: { country_name?: string; city_name?: string };
}
interface ToolActivity {
  toolName: string;
  timestamp: string;
  status: "success" | "warning" | "info";
  message: string;
}

const FAST_POLL_MS = 5_000;   // threat feed + RL status
const SLOW_POLL_MS = 30_000;  // tool activity (behind the /api/scan limiter)

const CommandCenter = () => {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [tools, setTools] = useState<ToolActivity[]>([]);
  const [nashconv, setNashconv] = useState<number | null>(null);
  const [training, setTraining] = useState<string>("unknown");
  const [toolsNote, setToolsNote] = useState<string | null>(null);

  // Fast lane: the threat feed and RL status are the live parts of the view.
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/honeypot/attacks/recent?limit=12`);
        const d = await r.json();
        setAttacks(d.attacks || []);
      } catch { /* honeypot stack offline */ }
      try {
        const r = await fetch(`${API_BASE_URL}/api/rl/status`);
        const d = await r.json();
        setTraining(d.is_training ? "training" : "idle");
      } catch { setTraining("offline"); }
    };
    poll();
    const id = setInterval(poll, FAST_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Slow lane: /api/scan is rate-limited (20 req / 15 min) because most of it
  // does real network work. Polling tool activity on the fast interval spent
  // the whole budget in ~100s and 429'd the panel for the rest of the window.
  useEffect(() => {
    const pollTools = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/scan/recent-tools`);
        if (r.status === 429) {
          setToolsNote("Rate-limited by the scan API — retrying shortly.");
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        setTools(d.tools || []);
        setToolsNote(null);
      } catch {
        setToolsNote("Backend offline — tool activity unavailable.");
      }
    };
    pollTools();
    const id = setInterval(pollTools, SLOW_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchRL<ExploitabilityReport>("/api/rl/exploitability", "exploitability.json")
      .then((e) => setNashconv(e.data.nashconv.mean))
      .catch(() => { /* none */ });
  }, []);

  return (
    <div className="w-full max-w-7xl space-y-6">
      <h1 className="text-3xl font-bold text-cyber-red cyber-glow-red tracking-wide">
        COMMAND CENTER
      </h1>

      {/* health row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Health icon={AlertTriangle} label="Live Attacks (feed)"
          value={attacks.length} color="text-cyber-red" />
        <Health icon={Crosshair} label="Defender NashConv"
          value={nashconv != null ? nashconv.toFixed(2) : "—"} color="text-yellow-400" />
        <Health icon={Radio} label="RL Training"
          value={training} color="text-cyber-cyan" />
        <Health icon={Wrench} label="Tool Activity"
          value={tools.length} color="text-gray-300" />
      </div>

      {/* threat feed + copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CyberpunkCard title="LIVE THREAT FEED">
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {attacks.length === 0 ? (
              <Empty msg="No live attacks. Start the honeypot stack to populate the feed." />
            ) : (
              attacks.map((a, i) => (
                <div key={i}
                  className="flex items-center gap-3 p-3 rounded bg-black/30 hover:bg-black/50 transition-colors">
                  <MapPin className="w-4 h-4 text-cyber-red shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-cyber-cyan font-mono text-sm">{a.source_ip}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-gray-400 text-sm">Port {a.destination_port}</span>
                      <span className="text-xs px-2 py-0.5 bg-cyber-red/20 text-cyber-red rounded">
                        {a.honeypot}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{a.event_type}</div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </CyberpunkCard>

        <DefenderCopilot />
      </div>

      {/* recent tool activity */}
      <CyberpunkCard title="RECENT TOOL ACTIVITY">
        {tools.length === 0 ? (
          <Empty msg={toolsNote ?? "No recent tool runs."} />
        ) : (
          <div className="space-y-1">
            {tools.slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-center justify-between glass-panel rounded px-3 py-2">
                <span className="flex items-center gap-3 min-w-0">
                  <Activity className={`w-4 h-4 shrink-0 ${
                    t.status === "success" ? "text-green-400"
                      : t.status === "warning" ? "text-yellow-400" : "text-cyber-cyan"}`} />
                  <span className="text-cyber-cyan text-sm">{t.toolName}</span>
                  <span className="text-gray-500 text-xs truncate">{t.message}</span>
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {new Date(t.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs">
          <Link to="/rl-arena" className="text-cyber-cyan hover:underline">RL Arena →</Link>
          <span className="mx-2 text-gray-600">·</span>
          <Link to="/honeypots" className="text-cyber-cyan hover:underline">Honeypots →</Link>
          <span className="mx-2 text-gray-600">·</span>
          <Link to="/tools" className="text-cyber-cyan hover:underline">Tools →</Link>
        </div>
      </CyberpunkCard>
    </div>
  );
};

const Health = ({ icon: Icon, label, value, color }:
  { icon: any; label: string; value: any; color: string }) => (
  <div className="glass-panel rounded p-5">
    <Icon className={`w-7 h-7 ${color} mb-3`} />
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-gray-400 tracking-wide mt-1">{label}</div>
  </div>
);

const Empty = ({ msg }: { msg: string }) => (
  <div className="glass-panel rounded p-8 text-center text-gray-500 text-sm">{msg}</div>
);

export default CommandCenter;
