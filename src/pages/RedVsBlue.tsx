/**
 * RedVsBlue.tsx — the autonomous Red-vs-Blue arena.
 *
 * Watch the autonomous LLM red-team attacker play the trained RL defender step
 * by step: the attacker's action + MITRE ATT&CK technique + reasoning on the
 * red side, the defender's RL-chosen response + MITRE D3FEND + CyberX tool
 * deep-link on the blue side, with live kill-chain / suspicion / evidence.
 *
 * Live mode:   SSE from /api/rl/redteam/stream (Express → Flask).
 * Replay mode: falls back to public/rl-artifacts/red_vs_blue.json and animates
 *              it, so the page works with no backend (hosted site / cold laptop).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend,
} from "chart.js";
import CyberpunkCard from "@/components/CyberpunkCard";
import { API_BASE_URL } from "@/lib/api";
import { defenderAction } from "@/data/defenderActionMap";
import {
  ArrowRight, Radio, ShieldAlert, Skull, Shield, Crosshair, Flag,
  Activity, Zap, Eye, Timer,
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface AttackerMove {
  action_name: string; technique_id: string; technique: string;
  tactic: string; reasoning: string; source: string;
}
interface DefenderMove { action: number | null; action_name: string; }
interface Step {
  episode: number; step: number;
  attacker: AttackerMove; attacker_success: boolean;
  defender: DefenderMove; stage: number; suspicion: number; evidence: number;
}
interface Meta { attacker_kind: string; defender_model: string; }
interface Result { episode: number; outcome: string; steps: number; }
interface ProbeResult {
  attacker_kind?: string; llm?: boolean; episodes?: number;
  llm_attacker_win_rate?: number;
  cotrained_attacker_win_rate?: number;
  ppo_best_response_win_rate?: number;
  out_of_class_delta?: number;
  illustrative?: boolean;
}

type Source = "connecting" | "live" | "replay";

const STAGES = ["Recon", "Foothold", "Privileged", "Objective"];
const REPLAY_STEP_MS = 1100;

const prettify = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function countBy(items: string[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) || 0) + 1);
  return [...m.entries()].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

const RedVsBlue = () => {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [source, setSource] = useState<Source>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);

  const sawLive = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startReplay = async () => {
      if (cancelled || sawLive.current) return;
      try {
        const res = await fetch("/rl-artifacts/red_vs_blue.json");
        if (!res.ok) throw new Error("no sample");
        const data = await res.json();
        const list: Step[] = data.steps || [];
        if (!list.length || cancelled) return;
        setSource("replay");
        setError(null);
        setMeta(data.meta || null);
        let i = 0;
        let pausing = false;
        const tick = () => {
          if (cancelled || pausing) return;
          if (i < list.length) {
            const s = list[i];              // capture BEFORE incrementing —
            i++;                            // the setState updater runs later,
            setSteps((prev) => [...prev, s]); // so it must not read the mutated i
          } else {
            if (data.result) setResults([data.result]);
            pausing = true;                 // brief pause, then loop the demo
            setTimeout(() => {
              if (cancelled) return;
              setSteps([]); setResults([]); i = 0; pausing = false;
            }, 2500);
          }
        };
        replayTimer.current = setInterval(tick, REPLAY_STEP_MS);
      } catch {
        if (!cancelled) setError("No live match and no replay sample available.");
      }
    };

    const es = new EventSource(`${API_BASE_URL}/api/rl/redteam/stream?episodes=3&delay=0.8`);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "error") { es.close(); startReplay(); return; }
        if (data.type === "meta") {
          sawLive.current = true; setSource("live"); setError(null);
          setMeta({ attacker_kind: data.attacker_kind, defender_model: data.defender_model });
          setSteps([]); setResults([]);
        } else if (data.type === "step") {
          sawLive.current = true; setSource("live");
          setSteps((prev) => [...prev, data as Step]);
        } else if (data.type === "result") {
          setResults((prev) => [...prev, data as Result]);
        } else if (data.type === "done") {
          es.close();
        }
      } catch { /* ignore malformed frame */ }
    };

    es.onerror = () => {
      if (!sawLive.current) { es.close(); startReplay(); }
    };

    return () => {
      cancelled = true;
      es.close();
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, []);

  // Out-of-class probe headline: the LLM attacker's win rate against the frozen
  // RL defender, next to the PPO best-response and the co-trained equilibrium.
  // Read from the exported artifact (produced by `python -m red_team.probe
  // --out public/rl-artifacts/red_team_probe.json`); absent until a run exists.
  useEffect(() => {
    let cancelled = false;
    fetch("/rl-artifacts/red_team_probe.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setProbe(d); })
      .catch(() => { /* no probe artifact yet — card stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  const safeSteps = steps.filter(Boolean);
  const latest = safeSteps.length ? safeSteps[safeSteps.length - 1] : null;
  const info = latest ? defenderAction(latest.defender.action_name) : undefined;
  const attWins = results.filter((r) => r.outcome === "attacker_win").length;
  const defWins = results.filter((r) => r.outcome === "defender_win").length;
  const draws = results.filter((r) => r.outcome === "draw").length;

  // ── Derived visuals ──────────────────────────────────────────────────────
  // Keep only the current episode's steps for the per-step charts.
  const curEp = latest?.episode ?? 0;
  const epSteps = safeSteps.filter((s) => s.episode === curEp);

  const detectionChart = {
    labels: epSteps.map((s) => `t${s.step}`),
    datasets: [
      { label: "Attacker suspicion", data: epSteps.map((s) => s.suspicion),
        borderColor: "#ff2e63", backgroundColor: "rgba(255,46,99,0.15)",
        fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 },
      { label: "Defender evidence", data: epSteps.map((s) => s.evidence),
        borderColor: "#00e5ff", backgroundColor: "rgba(0,229,255,0.12)",
        fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 },
      { label: "Isolate threshold", data: epSteps.map(() => 3),
        borderColor: "rgba(0,229,255,0.4)", borderDash: [4, 4], fill: false,
        pointRadius: 0, borderWidth: 1 },
      { label: "Hard-block threshold", data: epSteps.map(() => 6),
        borderColor: "rgba(0,229,255,0.6)", borderDash: [2, 4], fill: false,
        pointRadius: 0, borderWidth: 1 },
    ],
  };
  const detectionOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 } as const,
    scales: {
      x: { ticks: { color: "#9ca3af", font: { size: 9 } }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#9ca3af", font: { size: 9 } }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
    },
    plugins: { legend: { labels: { color: "#9ca3af", boxWidth: 10, font: { size: 10 } } } },
  };

  const tacticCounts = countBy(epSteps.map((s) => s.attacker.tactic).filter((t) => t && t !== "—"));
  const defenderCounts = countBy(epSteps.map((s) => prettify(s.defender.action_name)));
  const detected = latest ? latest.evidence >= 3 : false;
  const successRate = epSteps.length
    ? Math.round((epSteps.filter((s) => s.attacker_success).length / epSteps.length) * 100)
    : 0;

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-cyber-red cyber-glow-red tracking-wide">
          RED vs BLUE
        </h1>
        <div className="flex items-center gap-3">
          {meta && (
            <span className="text-[11px] text-gray-400">
              attacker: <span className="text-red-400">{meta.attacker_kind}</span>
              {" · "}defender: <span className="text-cyber-cyan">{meta.defender_model}</span>
            </span>
          )}
          <SourceBadge source={source} />
        </div>
      </div>

      <p className="text-sm text-gray-400 max-w-3xl">
        An autonomous red-team attacker (LLM, or scripted fallback) plays the
        simulator-trained RL defender. Red picks a technique and narrates why;
        blue's RL policy chooses a SOC response mapped to MITRE D3FEND and a
        CyberX tool. An out-of-policy-class attacker that still wins is the
        strongest evidence of the defender's exploitability.
      </p>

      {probe && <OutOfClassCard probe={probe} />}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-4">
        <ScoreTile label="Attacker wins" value={attWins} tone="red" icon={Skull} />
        <ScoreTile label="Draws" value={draws} tone="gray" icon={Flag} />
        <ScoreTile label="Defender wins" value={defWins} tone="cyan" icon={Shield} />
      </div>

      {results.length > 0 && <EpisodeStrip results={results} />}

      {/* Live status strip */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat icon={Crosshair} label="Current tactic" tone="red"
            value={latest.attacker.tactic !== "—" ? latest.attacker.tactic : "Dwell"} />
          <MiniStat icon={Eye} label="Detection" tone={detected ? "cyan" : "gray"}
            value={detected ? "DETECTED" : "undetected"} pulse={detected} />
          <MiniStat icon={Zap} label="Attacker success" tone="red" value={`${successRate}%`} />
          <MiniStat icon={Timer} label="Step (this episode)" tone="gray"
            value={`t${latest.step}`} />
        </div>
      )}

      {/* Live match state */}
      {latest && (
        <>
          <KillChain stage={latest.stage} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MeterBar label="Attacker suspicion (heat)" value={latest.suspicion} max={30} tone="red" />
            <MeterBar label="Defender evidence" value={latest.evidence} max={12} tone="cyan" />
          </div>
        </>
      )}

      {/* Detection race chart */}
      {epSteps.length > 1 && (
        <CyberpunkCard title="DETECTION RACE">
          <p className="text-xs text-gray-400 mb-3">
            The core cat-and-mouse: the attacker's <span className="text-red-400">suspicion</span> (noise it
            generates) vs the defender's <span className="text-cyber-cyan">evidence</span>. The defender can
            isolate at evidence ≥ 3 and hard-block at ≥ 6 (dashed lines).
          </p>
          <div className="h-64">
            <Line data={detectionChart} options={detectionOpts} />
          </div>
        </CyberpunkCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RED */}
        <div className="glass-panel rounded p-5 border border-red-500/30">
          <div className="flex items-center gap-2 mb-3 text-red-400">
            <Skull className="w-5 h-5" />
            <span className="uppercase tracking-widest text-sm font-bold">Red — Attacker</span>
          </div>
          {latest ? (
            <>
              <div className="text-2xl font-bold text-red-400">{prettify(latest.attacker.action_name)}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Tag>{latest.attacker.technique_id} · {latest.attacker.technique}</Tag>
                <Tag>{latest.attacker.tactic}</Tag>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                  latest.attacker.source === "llm"
                    ? "text-fuchsia-300 border-fuchsia-500/40" : "text-gray-400 border-gray-500/40"}`}>
                  {latest.attacker.source === "llm" ? "LLM" : "scripted"}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-3 italic">“{latest.attacker.reasoning}”</p>
              <div className="text-xs mt-3">
                {latest.attacker_success
                  ? <span className="text-red-300">✓ action succeeded</span>
                  : <span className="text-gray-500">✗ action failed / blocked</span>}
              </div>
            </>
          ) : <Waiting />}
        </div>

        {/* BLUE */}
        <div className="glass-panel rounded p-5 border border-cyber-cyan/30">
          <div className="flex items-center gap-2 mb-3 text-cyber-cyan">
            <Shield className="w-5 h-5" />
            <span className="uppercase tracking-widest text-sm font-bold">Blue — RL Defender</span>
          </div>
          {latest ? (
            <>
              <div className={`text-2xl font-bold ${info?.tone === "red" ? "text-red-400" : "text-cyber-cyan"}`}>
                {info?.label || prettify(latest.defender.action_name)}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {info?.d3fend && <Tag>D3FEND · {info.d3fend}</Tag>}
              </div>
              {info?.description && <p className="text-sm text-gray-300 mt-3">{info.description}</p>}
              {info?.tool && (
                <Link to={info.tool.path}
                  className="flex items-center justify-between gap-2 mt-4 p-3 rounded border border-cyber-cyan/30 bg-black/30 hover:bg-cyber-cyan/10 transition-colors group">
                  <span className="text-sm">
                    <span className="text-gray-400">Run in CyberX: </span>
                    <span className="text-cyber-cyan font-bold">{info.tool.name}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-cyber-cyan group-hover:translate-x-1 transition-transform shrink-0" />
                </Link>
              )}
            </>
          ) : <Waiting />}
        </div>
      </div>

      {/* Breakdowns */}
      {epSteps.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Breakdown title="Attacker tactics (ATT&CK)" data={tacticCounts} tone="red" icon={Skull} />
          <Breakdown title="Defender responses" data={defenderCounts} tone="cyan" icon={Shield} />
        </div>
      )}

      {/* Step log */}
      <CyberpunkCard title="MATCH LOG">
        {safeSteps.length ? (
          <div className="max-h-96 overflow-y-auto space-y-1 font-mono text-xs">
            {safeSteps.slice().reverse().map((s, idx) => (
              <div key={`${s.episode}-${s.step}-${idx}`}
                className="flex items-center gap-3 glass-panel rounded px-3 py-2">
                <span className="text-gray-500 w-14 shrink-0">e{s.episode}·t{s.step}</span>
                <span className="text-red-400 w-40 shrink-0 truncate" title={s.attacker.action_name}>
                  <Crosshair className="w-3 h-3 inline mr-1" />{prettify(s.attacker.action_name)}
                </span>
                <span className="text-gray-600 shrink-0">{s.attacker.technique_id}</span>
                <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                <span className="text-cyber-cyan truncate" title={s.defender.action_name}>
                  <Shield className="w-3 h-3 inline mr-1" />{prettify(s.defender.action_name)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-8">Waiting for the match to start…</div>
        )}
      </CyberpunkCard>
    </div>
  );
};

// ── Small components ─────────────────────────────────────────────────────────

const MiniStat = ({ icon: Icon, label, value, tone, pulse }: {
  icon: any; label: string; value: string; tone: "red" | "cyan" | "gray"; pulse?: boolean;
}) => {
  const color = tone === "red" ? "text-red-400" : tone === "cyan" ? "text-cyber-cyan" : "text-gray-300";
  return (
    <div className="glass-panel rounded p-3 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color} shrink-0 ${pulse ? "animate-pulse" : ""}`} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
        <div className={`text-sm font-bold truncate ${color}`}>{value}</div>
      </div>
    </div>
  );
};

const Breakdown = ({ title, data, tone, icon: Icon }: {
  title: string; data: { label: string; count: number }[]; tone: "red" | "cyan"; icon: any;
}) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  const bar = tone === "red" ? "bg-red-500/70" : "bg-cyber-cyan/70";
  const color = tone === "red" ? "text-red-400" : "text-cyber-cyan";
  return (
    <div className="glass-panel rounded p-5">
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="uppercase tracking-widest text-xs font-bold">{title}</span>
      </div>
      {data.length ? (
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.label}>
              <div className="flex justify-between text-[11px] text-gray-300 mb-0.5">
                <span className="truncate pr-2">{d.label}</span>
                <span className="font-mono text-gray-400">{d.count}</span>
              </div>
              <div className="h-1.5 rounded bg-black/40 overflow-hidden">
                <div className={`h-full ${bar} transition-all duration-500`}
                  style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : <div className="text-gray-500 text-sm">No moves yet.</div>}
    </div>
  );
};

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-gray-500/40 text-gray-300">
    {children}
  </span>
);

const Waiting = () => (
  <div className="text-gray-500 text-sm py-6">Waiting for the next move…</div>
);

const KillChain = ({ stage }: { stage: number }) => (
  <div className="flex items-center gap-2">
    {STAGES.map((name, i) => (
      <div key={name} className="flex-1 flex items-center gap-2">
        <div className={`flex-1 text-center text-xs py-2 rounded border ${
          i <= stage
            ? "border-red-500/50 bg-red-500/10 text-red-300"
            : "border-gray-600/40 bg-black/20 text-gray-500"}`}>
          {name}
        </div>
        {i < STAGES.length - 1 && <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />}
      </div>
    ))}
  </div>
);

const MeterBar = ({ label, value, max, tone }: {
  label: string; value: number; max: number; tone: "red" | "cyan";
}) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = tone === "red" ? "bg-red-500" : "bg-cyber-cyan";
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
        <span>{label}</span><span className="font-mono">{value.toFixed(1)} / {max}</span>
      </div>
      <div className="h-2 rounded bg-black/40 overflow-hidden">
        <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ScoreTile = ({ label, value, tone, icon: Icon }: {
  label: string; value: number; tone: "red" | "cyan" | "gray"; icon: any;
}) => {
  const color = tone === "red" ? "text-red-400" : tone === "cyan" ? "text-cyber-cyan" : "text-gray-300";
  return (
    <div className="glass-panel rounded p-4 flex items-center justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      </div>
      <Icon className={`w-8 h-8 ${color} opacity-60`} />
    </div>
  );
};

const SourceBadge = ({ source }: { source: Source }) => {
  const map = {
    connecting: { text: "CONNECTING", cls: "text-gray-400 border-gray-500/40" },
    live: { text: "LIVE", cls: "text-green-400 border-green-500/40" },
    replay: { text: "REPLAY", cls: "text-yellow-400 border-yellow-500/40" },
  }[source];
  return (
    <span className={`flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${map.cls}`}>
      <Radio className="w-3 h-3" /> {map.text}
    </span>
  );
};

// Headline: an out-of-policy-class LLM attacker's win rate vs the frozen RL
// defender, next to the same-class PPO best-response and the co-trained
// equilibrium. If the LLM (a different kind of adversary entirely) wins as much
// or more than the PPO best-response, the defender's exploitability is a far
// stronger claim than one same-class probe.
const OutOfClassCard = ({ probe }: { probe: ProbeResult }) => {
  const pct = (v?: number) => (v == null ? null : Math.round(v * 100));
  const rows = [
    { label: `LLM attacker${probe.llm ? "" : " (scripted fallback)"}`,
      v: pct(probe.llm_attacker_win_rate), tone: "fuchsia" as const },
    { label: "PPO best-response (same class)",
      v: pct(probe.ppo_best_response_win_rate), tone: "red" as const },
    { label: "Co-trained attacker (equilibrium)",
      v: pct(probe.cotrained_attacker_win_rate), tone: "gray" as const },
  ].filter((r) => r.v != null);
  const barColor = { fuchsia: "bg-fuchsia-500/70", red: "bg-red-500/70", gray: "bg-gray-500/60" };
  const txtColor = { fuchsia: "text-fuchsia-300", red: "text-red-400", gray: "text-gray-300" };
  const delta = probe.out_of_class_delta;
  return (
    <CyberpunkCard title="OUT-OF-CLASS EXPLOITABILITY">
      {probe.illustrative && (
        <div className="text-[11px] text-yellow-500/80 border border-yellow-500/30 rounded px-3 py-1.5 mb-3">
          Illustrative sample — run `python -m red_team.probe --run-dir &lt;best run&gt; --llm
          --provider ollama --model qwen2.5:3b` for the real number.
        </div>
      )}
      <p className="text-xs text-gray-400 mb-4">
        Win rate against the frozen RL defender, by adversary type
        {probe.episodes ? ` · ${probe.episodes} episodes each` : ""}. A non-PPO
        attacker matching or beating the PPO best-response is the strongest
        evidence the defender is exploitable, not just beaten by its own class.
      </p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-gray-300">{r.label}</span>
              <span className={`font-mono font-bold ${txtColor[r.tone]}`}>{r.v}%</span>
            </div>
            <div className="h-2.5 rounded bg-black/40 overflow-hidden">
              <div className={`h-full ${barColor[r.tone]} transition-all duration-700`}
                style={{ width: `${r.v}%` }} />
            </div>
          </div>
        ))}
      </div>
      {delta != null && (
        <div className={`mt-4 text-sm font-bold ${delta >= 0 ? "text-fuchsia-300" : "text-gray-400"}`}>
          Out-of-class delta: {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}%
          <span className="font-normal text-gray-400"> vs the co-trained attacker</span>
        </div>
      )}
      {!probe.llm && (
        <p className="mt-3 text-[11px] text-yellow-500/80">
          Scripted fallback — start Ollama and re-run the probe with --llm for the
          true out-of-class number.
        </p>
      )}
    </CyberpunkCard>
  );
};

const EpisodeStrip = ({ results }: { results: Result[] }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-[10px] uppercase tracking-wider text-gray-500 mr-1">Episodes</span>
    {results.map((r, i) => {
      const cls = r.outcome === "attacker_win" ? "bg-red-500/70 border-red-500/50"
        : r.outcome === "defender_win" ? "bg-cyber-cyan/60 border-cyber-cyan/50"
        : "bg-gray-500/40 border-gray-500/40";
      const title = `Episode ${r.episode}: ${prettify(r.outcome)} in ${r.steps} steps`;
      return <span key={`${r.episode}-${i}`} title={title}
        className={`w-4 h-4 rounded-sm border ${cls}`} />;
    })}
  </div>
);

export default RedVsBlue;
