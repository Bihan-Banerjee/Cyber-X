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
import { usePolling } from "@/hooks/usePolling";
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

// A/B sweep aggregate written by run_sweep.py --compare (arms = e.g. pfsp vs
// uniform). def_gap is the defender's exploitability gap — LOWER is better.
interface SweepStat {
  mean: number | null; iqm?: number | null; std?: number | null;
  ci95?: { lo: number | null; hi: number | null };
}
interface SweepArmAgg {
  tag: string; n_runs?: number;
  def_win_rate?: SweepStat; att_win_rate?: SweepStat;
  def_gap?: SweepStat; att_gap?: SweepStat; nashconv?: SweepStat;
  // Trailing-plateau (honest) estimators + probe provenance, added by run_sweep.
  def_gap_tail?: SweepStat; att_gap_tail?: SweepStat; nashconv_tail?: SweepStat;
  probe_converged_all?: boolean | null; br_iterations?: number | null;
}
interface SweepComparison { arms: SweepArmAgg[]; illustrative?: boolean; }

// N x N cross-play matrix + empirical Nash written by crossplay.py. matrix[r][c]
// is the attacker (row r) win rate vs the defender (col c). A Nash support wider
// than one agent, or any transitivity violation, means the population is
// non-transitive — a single "best" checkpoint (and Elo) is misleading.
interface CrossPlayReport {
  row_labels: string[]; col_labels: string[]; matrix: number[][];
  episodes_per_cell?: number;
  nash: {
    value_att_win_rate: number;
    attacker_support: Record<string, number>;
    defender_support: Record<string, number>;
  };
  transitivity?: { violations: number; pairs_compared: number; violation_rate: number };
  note?: string; illustrative?: boolean;
}

const RLArena = () => {
  const [history, setHistory] = useState<MetricsHistory | null>(null);
  const [exploit, setExploit] = useState<ExploitabilityReport | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [shadow, setShadow] = useState<ShadowEvalReport | null>(null);
  const [sweep, setSweep] = useState<SweepComparison | null>(null);
  const [crossplay, setCrossplay] = useState<CrossPlayReport | null>(null);
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
      try {
        const sw = await fetchRL<SweepComparison>(
          "/api/rl/sweep_comparison", "sweep_comparison.json");
        setSweep(sw.data);
      } catch { /* leave empty */ }
      try {
        const cp = await fetchRL<CrossPlayReport>(
          "/api/rl/crossplay", "crossplay.json");
        setCrossplay(cp.data);
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
      <CyberpunkCard maxWidth="max-w-none" title="CONVERGENCE">
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
      <CyberpunkCard maxWidth="max-w-none" title="EXPLOITABILITY / NASHCONV">
        {exploit ? (
          <ExploitabilityPanel report={exploit} />
        ) : (
          <Empty msg="No exploitability report available." />
        )}
      </CyberpunkCard>

      {/* PFSP vs uniform — the headline before/after */}
      {sweep && sweep.arms && sweep.arms.length >= 2 && (
        <CyberpunkCard maxWidth="max-w-none" title="PFSP vs UNIFORM — EXPLOITABILITY (BEFORE / AFTER)">
          <SweepComparisonPanel sweep={sweep} />
        </CyberpunkCard>
      )}

      {/* Cross-play matrix + empirical Nash — why Elo/single-best is misleading */}
      {crossplay && crossplay.matrix && crossplay.matrix.length > 0 && (
        <CyberpunkCard maxWidth="max-w-none" title="CROSS-PLAY MATRIX & EMPIRICAL NASH">
          <CrossPlayPanel cp={crossplay} />
        </CyberpunkCard>
      )}

      {/* Shadow-mode evaluation (Phase D) */}
      <CyberpunkCard maxWidth="max-w-none" title="SHADOW-MODE EVALUATION">
        {shadow ? (
          <ShadowPanel report={shadow} />
        ) : (
          <Empty msg="No shadow evaluation available." />
        )}
      </CyberpunkCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <CyberpunkCard maxWidth="max-w-none" title="ELO LEADERBOARD">
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
      <CyberpunkCard maxWidth="max-w-none" title="FULL TRAINING PROGRESS">
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
  // Only polls in live mode, and pauses while the tab is hidden (usePolling).
  usePolling(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/rl/status`);
      const d = await r.json();
      setStatus(d.is_training ? "training" : "idle");
    } catch { setStatus("unavailable"); }
  }, 5000, [source], source === "live");

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
    <CyberpunkCard maxWidth="max-w-none" title="TRAINING CONTROL">
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
    <CyberpunkCard maxWidth="max-w-none" title="BEST-VS-BEST DEMO">
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

const fmtStat = (s?: SweepStat) => {
  if (!s || s.mean == null) return "—";
  const std = s.std != null ? ` ± ${s.std.toFixed(2)}` : "";
  const iqm = s.iqm != null ? ` · IQM ${s.iqm.toFixed(2)}` : "";
  const ci = s.ci95 && s.ci95.lo != null && s.ci95.hi != null
    ? ` · CI [${s.ci95.lo.toFixed(2)}, ${s.ci95.hi.toFixed(2)}]` : "";
  return `${s.mean.toFixed(2)}${std}${iqm}${ci}`;
};

// CIs are disjoint when one interval's low exceeds the other's high (either way).
const ciSeparated = (a?: SweepStat, b?: SweepStat) => {
  const al = a?.ci95?.lo, ah = a?.ci95?.hi, bl = b?.ci95?.lo, bh = b?.ci95?.hi;
  if (al == null || ah == null || bl == null || bh == null) return false;
  return al > bh || bl > ah;
};
const deltaMean = (a?: SweepStat, b?: SweepStat) =>
  a?.mean != null && b?.mean != null ? a.mean - b.mean : null;

const SweepComparisonPanel = ({ sweep }: { sweep: SweepComparison }) => {
  const byTag = (t: string) => sweep.arms.find((a) => a.tag.toLowerCase().includes(t));
  const pfsp = byTag("pfsp") || sweep.arms[0];
  const uniform = byTag("uniform") || sweep.arms[1];
  const unconverged = pfsp?.probe_converged_all === false || uniform?.probe_converged_all === false;
  const br = pfsp?.br_iterations ?? uniform?.br_iterations ?? null;

  // Prefer the honest tail-mean gap; fall back to the max gap for older reports.
  const attTail = { u: uniform?.att_gap_tail, p: pfsp?.att_gap_tail };
  const defTail = { u: uniform?.def_gap_tail, p: pfsp?.def_gap_tail };
  const attDelta = deltaMean(attTail.p, attTail.u);
  const defDelta = deltaMean(defTail.p, defTail.u);
  const attSep = ciSeparated(attTail.p, attTail.u);
  const defSep = ciSeparated(defTail.p, defTail.u);

  // metric rows for the comparison table (lower gap = less exploitable = better)
  const rows: { label: string; u?: SweepStat; p?: SweepStat; max?: { u?: SweepStat; p?: SweepStat };
                lowerBetter: boolean }[] = [
    { label: "Attacker exploitability gap (tail)", u: attTail.u, p: attTail.p,
      max: { u: uniform?.att_gap, p: pfsp?.att_gap }, lowerBetter: true },
    { label: "Defender exploitability gap (tail)", u: defTail.u, p: defTail.p,
      max: { u: uniform?.def_gap, p: pfsp?.def_gap }, lowerBetter: true },
    { label: "NashConv (tail)", u: uniform?.nashconv_tail, p: pfsp?.nashconv_tail, lowerBetter: true },
    { label: "Defender win rate", u: uniform?.def_win_rate, p: pfsp?.def_win_rate, lowerBetter: false },
  ];

  return (
    <div className="space-y-4">
      {sweep.illustrative && (
        <div className="text-[11px] text-yellow-500/80 border border-yellow-500/30 rounded px-3 py-1.5">
          Illustrative sample — run both arms, then run_sweep.py --compare pfsp uniform for real numbers.
        </div>
      )}
      {unconverged && (
        <div className="text-[11px] text-orange-400/90 border border-orange-500/30 rounded px-3 py-1.5">
          Best-response probe UNCONVERGED (br={br ?? "?"}) — the gaps under-measure exploitability;
          read the tail-mean deltas as indicative, not final.
        </div>
      )}
      <p className="text-xs text-gray-400">
        Exploitability gap (lower = harder to exploit) for each side, PFSP vs the uniform-league
        control. The <span className="text-gray-300">tail-mean</span> is the honest last-k plateau
        estimator; the max gap is peak-biased and shown small for reference. IQM + 95% CIs
        {pfsp?.n_runs ? ` over ${pfsp.n_runs} seeds` : ""}.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-widest">
              <th className="text-left font-medium py-1">Metric</th>
              <th className="text-left font-medium py-1">uniform (before)</th>
              <th className="text-left font-medium py-1 text-fuchsia-300">pfsp (after)</th>
              <th className="text-left font-medium py-1">Δ (pfsp − uniform)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dm = deltaMean(r.p, r.u);
              const good = dm != null && (r.lowerBetter ? dm < 0 : dm > 0);
              return (
                <tr key={r.label} className="border-t border-white/5 align-top">
                  <td className="py-2 pr-3 text-gray-300">{r.label}</td>
                  <td className="py-2 pr-3 text-gray-200 font-mono text-xs">
                    {fmtStat(r.u)}
                    {r.max?.u?.mean != null && (
                      <span className="text-[10px] text-gray-500"> · max {r.max.u.mean.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-cyan-200 font-mono text-xs">
                    {fmtStat(r.p)}
                    {r.max?.p?.mean != null && (
                      <span className="text-[10px] text-gray-500"> · max {r.max.p.mean.toFixed(2)}</span>
                    )}
                  </td>
                  <td className={`py-2 font-mono text-xs font-bold ${dm == null ? "text-gray-500" : good ? "text-fuchsia-300" : "text-orange-400"}`}>
                    {dm == null ? "—" : `${dm >= 0 ? "+" : ""}${dm.toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Honest asymmetric verdict */}
      {(attDelta != null || defDelta != null) && (
        <div className="text-xs text-gray-300 space-y-1 glass-panel rounded p-3">
          {attDelta != null && (
            <div>
              <span className="font-bold text-fuchsia-300">Attacker: {attDelta >= 0 ? "+" : ""}{attDelta.toFixed(2)}</span>
              {attDelta < 0 ? " — PFSP lowered attacker exploitability" : " — attacker exploitability rose"}
              {attSep ? <span className="text-fuchsia-300"> (95% CIs disjoint)</span> : <span className="text-gray-500"> (CIs overlap)</span>}.
            </div>
          )}
          {defDelta != null && (
            <div>
              <span className={`font-bold ${defDelta < 0 ? "text-fuchsia-300" : "text-orange-400"}`}>Defender: {defDelta >= 0 ? "+" : ""}{defDelta.toFixed(2)}</span>
              {defDelta < 0 ? " — the defender got harder to exploit (the goal)" : " — the defender got more exploitable"}
              {defSep ? <span> (95% CIs disjoint)</span> : <span className="text-gray-500"> (CIs overlap)</span>}.
            </div>
          )}
          <div className="text-gray-500 pt-1">
            PFSP concentrates both agents on their hard opponents; here the effect is asymmetric.
          </div>
        </div>
      )}
    </div>
  );
};

// Diverging heatmap centred on an even game (0.5): red = attacker-favoured,
// cyan = defender-favoured; cells near 0.5 stay dark.
const cellBg = (w: number) =>
  w >= 0.5
    ? `rgba(239,68,68,${((w - 0.5) * 2 * 0.8).toFixed(3)})`
    : `rgba(34,211,238,${((0.5 - w) * 2 * 0.8).toFixed(3)})`;
const shortLabel = (l: string) => l.replace(/^(att|def)_/, "");

const CrossPlayPanel = ({ cp }: { cp: CrossPlayReport }) => {
  const t = cp.transitivity;
  const attSup = Object.entries(cp.nash?.attacker_support ?? {});
  const defSup = Object.entries(cp.nash?.defender_support ?? {});
  const mixed = attSup.length > 1 || defSup.length > 1;
  const nCols = cp.col_labels.length;
  return (
    <div className="space-y-4">
      {cp.illustrative && (
        <div className="text-[11px] text-yellow-500/80 border border-yellow-500/30 rounded px-3 py-1.5">
          Illustrative sample — run crossplay.py --run-dir &lt;run&gt; for real numbers.
        </div>
      )}
      <p className="text-xs text-gray-400">
        Attacker win rate for every archived attacker (rows) against every defender (cols).
        A Nash mixture wider than one agent, or any transitivity violation, means the
        population is non-transitive — a single "best" checkpoint (and Elo) is misleading.
      </p>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-px text-[10px] font-mono"
          style={{ gridTemplateColumns: `auto repeat(${nCols}, 2.2rem)` }}
        >
          <div />
          {cp.col_labels.map((c) => (
            <div key={c} className="text-gray-500 text-center pb-1" title={c}>
              {shortLabel(c)}
            </div>
          ))}
          {cp.matrix.flatMap((rowVals, ri) => [
            <div
              key={`r${ri}`}
              className="text-gray-500 pr-2 text-right self-center whitespace-nowrap"
              title={cp.row_labels[ri]}
            >
              {shortLabel(cp.row_labels[ri])}
            </div>,
            ...rowVals.map((w, ci) => (
              <div
                key={`c${ri}-${ci}`}
                className="h-8 flex items-center justify-center rounded-sm text-gray-100"
                style={{ background: cellBg(w) }}
                title={`${cp.row_labels[ri]} vs ${cp.col_labels[ci]}: ${(w * 100).toFixed(0)}% attacker win`}
              >
                {Math.round(w * 100)}
              </div>
            )),
          ])}
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <span className="text-cyber-cyan">defender wins</span>
        <span>0 — 50 — 100</span>
        <span className="text-red-400">attacker wins</span>
        <span className="ml-auto">{cp.episodes_per_cell ?? "?"} eps/cell</span>
      </div>

      {/* Empirical Nash + transitivity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel rounded p-4">
          <div className="text-[11px] text-gray-400 mb-2">
            Empirical Nash — attacker wins{" "}
            <span className="text-gray-200">
              {(cp.nash.value_att_win_rate * 100).toFixed(0)}%
            </span>{" "}
            at equilibrium
          </div>
          <div className="text-[10px] text-gray-500 mb-1">Attacker support</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {attSup.map(([k, v]) => (
              <span key={k}
                className="px-2 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px] font-mono">
                {shortLabel(k)} {(v * 100).toFixed(0)}%
              </span>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 mb-1">Defender support</div>
          <div className="flex flex-wrap gap-1">
            {defSup.map(([k, v]) => (
              <span key={k}
                className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-[10px] font-mono">
                {shortLabel(k)} {(v * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
        <div className="glass-panel rounded p-4">
          <div className="text-[11px] text-gray-400 mb-2">Transitivity</div>
          <div className="text-2xl font-bold text-fuchsia-300">
            {t ? `${t.violations}/${t.pairs_compared}` : "—"}
            {t && (
              <span className="text-sm text-gray-500 ml-1">
                ({(t.violation_rate * 100).toFixed(0)}%)
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            non-transitive pairs{" "}
            {mixed
              ? "— the Nash needs a mixture, so no single checkpoint is 'best'."
              : "— the population is essentially transitive here."}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RLArena;
