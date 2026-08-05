/**
 * RLArena.tsx — research showcase for the CyberX MARL stack.
 *
 * Surfaces the data the Flask API / baked artifacts expose: convergence curves,
 * the Elo leaderboard, the exploitability / NashConv result (the headline
 * research metric), and an animated best-vs-best demo replay. Live-first with
 * artifact fallback (see src/lib/rlData.ts) so it works on the hosted site too.
 */
import { useEffect, useRef, useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend,
} from "chart.js";
import {
  Activity, Brain, Crosshair, Play, ShieldCheck, Swords, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import {
  fetchRL, rlArtifactPlotUrl, rlPlotUrl,
  type ExploitabilityReport, type LeaderboardEntry, type MetricsHistory,
  type RLSource, type ShadowArm, type ShadowEvalReport,
} from "@/lib/rlData";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PCT = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(0)}%`;

const SourceBadge = ({ source }: { source: RLSource }) => (
  <span
    className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${
      source === "live"
        ? "text-green-400 border-green-500/40"
        : "text-yellow-400 border-yellow-500/40"
    }`}
  >
    {source === "live" ? "LIVE" : "REPLAY"}
  </span>
);

const RLArena = () => {
  const [history, setHistory] = useState<MetricsHistory | null>(null);
  const [exploit, setExploit] = useState<ExploitabilityReport | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [shadow, setShadow] = useState<ShadowEvalReport | null>(null);
  const [source, setSource] = useState<RLSource>("replay");

  useEffect(() => {
    (async () => {
      try {
        const h = await fetchRL<MetricsHistory>(
          "/api/rl/metrics/history", "metrics_history.json");
        setHistory(h.data);
        setSource(h.source);
      } catch { /* leave empty */ }
      try {
        const e = await fetchRL<ExploitabilityReport>(
          "/api/rl/exploitability", "exploitability.json");
        setExploit(e.data);
      } catch { /* leave empty */ }
      try {
        const l = await fetchRL<{ leaderboard: LeaderboardEntry[] }>(
          "/api/rl/leaderboard", "leaderboard.json");
        setBoard(l.data.leaderboard || []);
      } catch { /* leave empty */ }
      try {
        const s = await fetchRL<ShadowEvalReport>(
          "/api/rl/shadow_eval", "shadow_eval.json");
        setShadow(s.data);
      } catch { /* leave empty */ }
    })();
  }, []);

  const lastAtt = history?.att_win_rates?.slice(-1)[0];
  const lastDef = history?.def_win_rates?.slice(-1)[0];

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-cyber-red cyber-glow-red tracking-wide">
          RL ARENA
        </h1>
        <SourceBadge source={source} />
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Crosshair} label="NashConv (5 runs)"
          value={exploit?.nashconv.mean != null ? exploit.nashconv.mean.toFixed(2) : "—"}
          sub={exploit?.nashconv.std != null ? `± ${exploit.nashconv.std.toFixed(2)}` : ""}
          color="text-cyber-red" />
        <StatCard icon={Swords} label="Attacker Win (last)"
          value={PCT(lastAtt)} color="text-red-400" />
        <StatCard icon={ShieldCheck} label="Defender Win (last)"
          value={PCT(lastDef)} color="text-cyber-cyan" />
        <StatCard icon={Brain} label="Iterations"
          value={history?.iterations?.length ?? 0} color="text-gray-300" />
      </div>

      <TrainingControl source={source} />

      {/* Convergence curves */}
      <CyberpunkCard title="CONVERGENCE">
        {history && history.iterations.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72">
              <Line data={winRateData(history)} options={chartOpts("Win Rate")} />
            </div>
            <div className="h-72">
              <Line data={eloData(history)} options={chartOpts("Elo")} />
            </div>
          </div>
        ) : (
          <Empty msg="No training history yet." />
        )}
      </CyberpunkCard>

      {/* Exploitability */}
      <CyberpunkCard title="EXPLOITABILITY / NASHCONV">
        {exploit ? (
          <ExploitabilityPanel report={exploit} />
        ) : (
          <Empty msg="No exploitability report available." />
        )}
      </CyberpunkCard>

      {/* Shadow-mode evaluation (Phase D) */}
      <CyberpunkCard title="SHADOW-MODE EVALUATION">
        {shadow ? (
          <ShadowPanel report={shadow} />
        ) : (
          <Empty msg="No shadow evaluation available." />
        )}
      </CyberpunkCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <CyberpunkCard title="ELO LEADERBOARD">
          {board.length ? (
            <div className="space-y-1">
              {board.map((e, i) => (
                <div key={e.agent}
                  className="flex items-center justify-between glass-panel rounded px-3 py-2">
                  <span className="flex items-center gap-3">
                    <span className="text-gray-500 font-mono w-6">{i + 1}</span>
                    <span className={e.agent.startsWith("attacker")
                      ? "text-red-400" : "text-cyber-cyan"}>{e.agent}</span>
                  </span>
                  <span className="font-mono text-gray-200">{e.elo}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty msg="No leaderboard yet." />
          )}
        </CyberpunkCard>

        {/* Demo replay */}
        <DemoPlayer source={source} />
      </div>

      {/* Full training plot */}
      <CyberpunkCard title="FULL TRAINING PROGRESS">
        <img
          src={source === "live" ? rlPlotUrl() : rlArtifactPlotUrl()}
          alt="Training progress"
          className="w-full rounded"
          onError={(ev) => {
            (ev.currentTarget as HTMLImageElement).src = rlArtifactPlotUrl();
          }}
        />
      </CyberpunkCard>
    </div>
  );
};

// ── Training control ──────────────────────────────────────────────────────

const TrainingControl = ({ source }: { source: RLSource }) => {
  const [status, setStatus] = useState<string>("idle");

  // Reconcile with the backend rather than trusting local optimism: the button
  // used to report "training" even when the server had rejected the request.
  useEffect(() => {
    if (source !== "live") return;
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/rl/status`);
        const d = await r.json();
        setStatus(d.is_training ? "training" : "idle");
      } catch { setStatus("unavailable"); }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [source]);

  const start = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/rl/train/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iterations: 10, timesteps: 50000 }),
      });
      if (r.status === 409) { setStatus("already running"); return; }
      if (!r.ok) { setStatus(`error ${r.status}`); return; }
      setStatus("training");
    } catch { setStatus("unavailable"); }
  };
  const stop = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/rl/train/stop`, { method: "POST" });
      setStatus(r.ok ? "stopping" : `error ${r.status}`);
    } catch { setStatus("unavailable"); }
  };

  return (
    <CyberpunkCard title="TRAINING CONTROL">
      {source === "replay" ? (
        <p className="text-sm text-gray-400">
          Viewing a baked snapshot. Start the local RL stack
          (<code className="text-cyber-cyan">python api.py</code>) to control training live.
        </p>
      ) : (
        <div className="flex gap-3 items-center">
          <button onClick={start}
            className="px-5 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded flex items-center gap-2">
            <Play className="w-4 h-4" /> Start Training
          </button>
          <button onClick={stop}
            className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded">
            Stop
          </button>
          <span className="text-xs text-gray-400">status: {status}</span>
        </div>
      )}
    </CyberpunkCard>
  );
};

// ── Exploitability panel ──────────────────────────────────────────────────

const ExploitabilityPanel = ({ report }: { report: ExploitabilityReport }) => {
  const bar = (label: string, ms: { mean: number | null }, tone: string) => (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-gray-200">{PCT(ms.mean)}</span>
      </div>
      <div className="h-2 bg-black/40 rounded overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${(ms.mean ?? 0) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-bold text-cyber-red cyber-glow-red">
          {report.nashconv.mean?.toFixed(2) ?? "—"}
        </span>
        <span className="text-gray-400 text-sm">
          NashConv ± {report.nashconv.std?.toFixed(2) ?? "—"} over {report.n_runs} runs
          <span className="ml-2 text-xs">(&lt;0.15 strong · 0.15–0.35 decent · &gt;0.5 brittle)</span>
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-red-400">Attacker</p>
          {bar("Best-response beats it", report.attacker.exploitability, "bg-red-500")}
          {bar("Gap over equilibrium", report.attacker.gap, "bg-red-400")}
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-cyber-cyan">Defender (weak link)</p>
          {bar("Best-response beats it", report.defender.exploitability, "bg-cyber-cyan")}
          {bar("Gap over equilibrium", report.defender.gap, "bg-cyan-400")}
        </div>
      </div>
      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer hover:text-gray-200">Per-run detail</summary>
        <table className="w-full mt-2 font-mono">
          <thead className="text-gray-500">
            <tr><th className="text-left">run</th><th>nashconv</th><th>att gap</th><th>def gap</th></tr>
          </thead>
          <tbody>
            {report.runs.map((r) => (
              <tr key={r.run} className="text-gray-300">
                <td className="text-left">{r.run}</td>
                <td className="text-center">{r.nashconv ?? "—"}</td>
                <td className="text-center">{r.att_gap ?? "—"}</td>
                <td className="text-center">{r.def_gap ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

// ── Shadow-mode evaluation ─────────────────────────────────────────────────

/**
 * Renders what the sim-trained defender actually does on honeypot telemetry.
 *
 * Action *entropy* is shown as prominently as the agreement scores on purpose.
 * The original harness scored 65% "reasonable agreement" while emitting a
 * single action for every window — the score was high precisely because one
 * action happened to sit in several permissive acceptable-sets. A degenerate
 * policy has to be legible as degenerate.
 */
const ShadowPanel = ({ report }: { report: ShadowEvalReport }) => {
  const acted = Object.entries(report.action_distribution)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(...acted.map(([, n]) => n), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${
          report.synthetic
            ? "text-yellow-400 border-yellow-500/40"
            : "text-green-400 border-green-500/40"}`}>
          {report.synthetic ? "SYNTHETIC TELEMETRY" : "RECORDED TELEMETRY"}
        </span>
        <span className="text-xs text-gray-500">
          {report.n_events} events · {report.n_windows} windows
        </span>
      </div>

      {report.constant_policy && (
        <div className="p-3 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-sm">
          The policy emitted a single action for every window — the agreement
          scores below do not reflect judgement.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Action entropy"
          value={`${report.action_entropy_bits.toFixed(2)} bits`}
          color={report.constant_policy ? "text-yellow-400" : "text-cyber-cyan"} />
        <MiniStat label="Distinct actions"
          value={report.distinct_actions} color="text-gray-200" />
        <MiniStat label="Exact agreement"
          value={PCT(report.exact_agreement)} color="text-gray-200" />
        <MiniStat label="Justified containments"
          value={report.containments} color="text-cyber-cyan" />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2 tracking-wide">ACTION DISTRIBUTION</p>
        <div className="space-y-1">
          {acted.map(([name, n]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-40 shrink-0">
                {name.replace(/_/g, " ")}
              </span>
              <div className="flex-1 h-2 bg-black/40 rounded overflow-hidden">
                <div className="h-full bg-cyber-cyan"
                  style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="font-mono text-xs text-gray-300 w-8 text-right">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {report.frozen_baseline && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-200">
            Compare with the frozen-posture baseline
          </summary>
          <p className="mt-2 text-gray-500">
            The original harness held the SOC's own state (evidence, alerts,
            decoys, containment) at zero, so most of the observation never moved.
          </p>
          <table className="w-full mt-2 font-mono">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left">config</th><th>entropy</th>
                <th>actions</th><th>exact</th><th>contain</th>
              </tr>
            </thead>
            <tbody>
              <ArmRow label="frozen (before)" arm={report.frozen_baseline} />
              <ArmRow label="closed loop (now)" arm={report} />
            </tbody>
          </table>
        </details>
      )}

      {report.note && <p className="text-xs text-gray-500">{report.note}</p>}
    </div>
  );
};

const ArmRow = ({ label, arm }: { label: string; arm: ShadowArm }) => (
  <tr className="text-gray-300">
    <td className="text-left">{label}</td>
    <td className="text-center">{arm.action_entropy_bits.toFixed(2)}</td>
    <td className="text-center">{arm.distinct_actions}</td>
    <td className="text-center">{PCT(arm.exact_agreement)}</td>
    <td className="text-center">{arm.containments}</td>
  </tr>
);

const MiniStat = ({ label, value, color }:
  { label: string; value: React.ReactNode; color: string }) => (
  <div className="glass-panel rounded p-3">
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    <div className="text-[11px] text-gray-400 mt-1">{label}</div>
  </div>
);

// ── Demo replay ────────────────────────────────────────────────────────────

interface DemoStep {
  type: string;
  step?: number;
  att_action_name?: string;
  def_action_name?: string;
  stage?: number;
  suspicion?: number;
  evidence?: number;
  attacker_win?: boolean;
  defender_win?: boolean;
}

const STAGES = ["RECON", "FOOTHOLD", "PRIVILEGED", "OBJECTIVE"];

const DemoPlayer = ({ source }: { source: RLSource }) => {
  const [events, setEvents] = useState<DemoStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"recorded" | "live">("recorded");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const loadRecorded = async () => {
    try {
      const res = await fetch("/rl-artifacts/demo_episode.json");
      const data = await res.json();
      setEvents(data.events || []);
      setIdx(0);
      setMode("recorded");
      setPlaying(true);
    } catch { /* none */ }
  };

  /** Run a fresh best-vs-best match on the live backend and stream it in.
   *  api.py has exposed /demo/start + /demo/stream all along; nothing called
   *  them, so the live match was unreachable from the UI. */
  const runLive = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/rl/demo/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodes: 1, step_delay: 0.1 }),
      });
      if (!r.ok) { await loadRecorded(); return; }

      setEvents([]);
      setIdx(0);
      setMode("live");
      setPlaying(false);   // the stream paces itself; no local timer

      esRef.current?.close();
      const es = new EventSource(`${API_BASE_URL}/api/rl/demo/stream`);
      esRef.current = es;
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.ping) return;
          if (data.type === "done" || data.type === "error") { es.close(); return; }
          setEvents((prev) => {
            setIdx(prev.length);
            return [...prev, data];
          });
        } catch { /* ignore malformed frame */ }
      };
      es.onerror = () => es.close();
    } catch { await loadRecorded(); }
  };

  useEffect(() => () => esRef.current?.close(), []);

  useEffect(() => {
    if (!playing || !events.length) return;
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= events.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 900);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, events]);

  const cur = events[idx];
  const steps = events.filter((e) => e.type === "step");
  const end = events.find((e) => e.type === "episode_end");

  return (
    <CyberpunkCard title="BEST-VS-BEST DEMO">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={loadRecorded}
            className="px-5 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan rounded flex items-center gap-2">
            <Play className="w-4 h-4" />
            {events.length && mode === "recorded" ? "Replay episode" : "Play recorded episode"}
          </button>
          {source === "live" && (
            <button onClick={runLive}
              className="px-5 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded flex items-center gap-2">
              <Play className="w-4 h-4" /> Run live match
            </button>
          )}
          {mode === "live" && (
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border text-green-400 border-green-500/40">
              live match
            </span>
          )}
        </div>

        {cur && cur.type === "step" && (
          <div className="glass-panel rounded p-4 space-y-3">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Step {cur.step}</span>
              <span>Stage: <span className="text-cyber-cyan">{STAGES[cur.stage ?? 0]}</span></span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded bg-red-500/10 border border-red-500/30 p-2">
                <p className="text-[10px] uppercase text-gray-400">Attacker</p>
                <p className="text-red-400 font-bold">{cur.att_action_name}</p>
              </div>
              <div className="rounded bg-cyber-cyan/10 border border-cyber-cyan/30 p-2">
                <p className="text-[10px] uppercase text-gray-400">Defender</p>
                <p className="text-cyber-cyan font-bold">{cur.def_action_name}</p>
              </div>
            </div>
            <Meter label="Suspicion" value={cur.suspicion ?? 0} max={10} tone="bg-red-500" />
            <Meter label="Evidence" value={cur.evidence ?? 0} max={10} tone="bg-cyber-cyan" />
          </div>
        )}

        {!playing && end && idx >= events.length - 1 && (
          <div className={`rounded p-3 text-center font-bold ${
            end.attacker_win ? "bg-red-500/10 text-red-400 border border-red-500/30"
              : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30"}`}>
            {end.attacker_win ? "ATTACKER WINS" : end.defender_win ? "DEFENDER WINS" : "DRAW"}
          </div>
        )}

        {events.length > 0 && (
          <div className="h-1 bg-black/40 rounded overflow-hidden">
            <div className="h-full bg-cyber-red transition-all"
              style={{ width: `${((idx + 1) / events.length) * 100}%` }} />
          </div>
        )}
        {!events.length && <Empty msg="Play to watch a recorded match." />}
        {steps.length > 0 && (
          <p className="text-xs text-gray-500">{steps.length} steps recorded</p>
        )}
      </div>
    </CyberpunkCard>
  );
};

// ── small helpers ───────────────────────────────────────────────────────────

const Meter = ({ label, value, max, tone }:
  { label: string; value: number; max: number; tone: string }) => (
  <div>
    <div className="flex justify-between text-[11px] text-gray-400 mb-0.5">
      <span>{label}</span><span className="font-mono">{value.toFixed(2)}</span>
    </div>
    <div className="h-1.5 bg-black/40 rounded overflow-hidden">
      <div className={`h-full ${tone}`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  </div>
);

const Empty = ({ msg }: { msg: string }) => (
  <div className="glass-panel rounded p-8 text-center text-gray-500 text-sm">{msg}</div>
);

const StatCard = ({ icon: Icon, label, value, sub, color }:
  { icon: LucideIcon; label: string; value: React.ReactNode;
    sub?: string; color: string }) => (
  <div className="glass-panel rounded p-5">
    <Icon className={`w-7 h-7 ${color} mb-3`} />
    <div className={`text-2xl font-bold ${color}`}>
      {value}{sub && <span className="text-sm text-gray-500 ml-1">{sub}</span>}
    </div>
    <div className="text-xs text-gray-400 tracking-wide mt-1">{label}</div>
  </div>
);

function winRateData(h: MetricsHistory) {
  return {
    labels: h.iterations,
    datasets: [
      { label: "Attacker", data: h.att_win_rates, borderColor: "rgb(239,68,68)",
        backgroundColor: "rgba(239,68,68,0.1)", tension: 0.3 },
      { label: "Defender", data: h.def_win_rates, borderColor: "rgb(34,211,238)",
        backgroundColor: "rgba(34,211,238,0.1)", tension: 0.3 },
    ],
  };
}
function eloData(h: MetricsHistory) {
  return {
    labels: h.iterations,
    datasets: [
      { label: "Attacker Elo", data: h.att_elo, borderColor: "rgb(239,68,68)",
        backgroundColor: "rgba(239,68,68,0.1)", tension: 0.3 },
      { label: "Defender Elo", data: h.def_elo, borderColor: "rgb(34,211,238)",
        backgroundColor: "rgba(34,211,238,0.1)", tension: 0.3 },
    ],
  };
}
function chartOpts(title: string) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top" as const, labels: { color: "#9ca3af" } },
      title: { display: true, text: title, color: "#9ca3af" } },
    scales: {
      x: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };
}

export default RLArena;
