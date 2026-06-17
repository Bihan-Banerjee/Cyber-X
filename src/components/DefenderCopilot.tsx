/**
 * DefenderCopilot.tsx — the hero integration: the simulator-trained RL defender
 * watches live honeypot telemetry and recommends the next defensive move, deep-
 * linked to the matching CyberX tool.
 *
 * Live mode:   subscribes to /api/rl/telemetry/stream (SSE) via the Express proxy.
 * Replay mode: if no live Flask/ES backend answers, falls back to a committed
 *              sample (public/rl-artifacts/copilot_sample.json) and cycles it.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CyberpunkCard from "@/components/CyberpunkCard";
import { API_BASE_URL } from "@/lib/api";
import { defenderAction } from "@/data/defenderActionMap";
import { ArrowRight, Brain, Radio, ShieldAlert } from "lucide-react";

interface Suggestion {
  action_name: string;
  action?: number;
  events_summary?: Record<string, number>;
  time?: string;
}

type Source = "connecting" | "live" | "replay";

const REPLAY_CYCLE_MS = 6000;

const DefenderCopilot = () => {
  const [current, setCurrent] = useState<Suggestion | null>(null);
  const [source, setSource] = useState<Source>("connecting");
  const [error, setError] = useState<string | null>(null);

  const sawLive = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startReplay = async () => {
      if (cancelled || sawLive.current) return;
      try {
        const res = await fetch("/rl-artifacts/copilot_sample.json");
        if (!res.ok) throw new Error("no sample");
        const data = await res.json();
        const list: Suggestion[] = data.suggestions || [];
        if (!list.length || cancelled) return;
        setSource("replay");
        setError(null);
        let i = 0;
        setCurrent(list[0]);
        replayTimer.current = setInterval(() => {
          i = (i + 1) % list.length;
          setCurrent(list[i]);
        }, REPLAY_CYCLE_MS);
      } catch {
        if (!cancelled) setError("No live telemetry and no replay sample available.");
      }
    };

    const es = new EventSource(`${API_BASE_URL}/api/rl/telemetry/stream`);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ping) return;
        if (data.type === "error") {
          es.close();
          startReplay();
          return;
        }
        if (data.type === "suggestion") {
          sawLive.current = true;
          setSource("live");
          setError(null);
          setCurrent(data);
        }
      } catch {
        /* ignore malformed frame */
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; if we never got live data, the backend
      // isn't there (hosted site) — stop retrying and fall back to replay.
      if (!sawLive.current) {
        es.close();
        startReplay();
      }
    };

    return () => {
      cancelled = true;
      es.close();
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, []);

  const info = current ? defenderAction(current.action_name) : undefined;

  return (
    <CyberpunkCard title="DEFENDER COPILOT">
      <div className="space-y-4">
        {/* status line */}
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-gray-400">
            <Brain className="w-4 h-4 text-cyber-cyan" />
            Trained RL defender · shadow mode
          </span>
          <SourceBadge source={source} />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!error && !current && (
          <div className="glass-panel rounded p-6 text-center text-gray-500 text-sm">
            Waiting for the defender's first recommendation…
          </div>
        )}

        {current && (
          <>
            {/* recommended action */}
            <div
              className={`rounded p-4 border ${
                info?.tone === "red"
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-cyber-cyan/10 border-cyber-cyan/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest text-gray-400">
                  Recommended action
                </span>
                {info?.d3fend && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-cyber-cyan/30 text-cyber-cyan">
                    D3FEND · {info.d3fend}
                  </span>
                )}
              </div>
              <div
                className={`text-2xl font-bold tracking-wide ${
                  info?.tone === "red" ? "text-red-400" : "text-cyber-cyan"
                }`}
              >
                {info?.label || current.action_name}
              </div>
              {info?.description && (
                <p className="text-sm text-gray-300 mt-1">{info.description}</p>
              )}
            </div>

            {/* run-in-cyberx link */}
            {info?.tool && (
              <Link
                to={info.tool.path}
                className="flex items-center justify-between gap-2 p-3 rounded border border-cyber-cyan/30 bg-black/30 hover:bg-cyber-cyan/10 transition-colors group"
              >
                <span className="text-sm">
                  <span className="text-gray-400">Run in CyberX: </span>
                  <span className="text-cyber-cyan font-bold">{info.tool.name}</span>
                  {info.toolRationale && (
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {info.toolRationale}
                    </span>
                  )}
                </span>
                <ArrowRight className="w-4 h-4 text-cyber-cyan group-hover:translate-x-1 transition-transform shrink-0" />
              </Link>
            )}

            {/* telemetry that triggered it */}
            {current.events_summary && (
              <div>
                <p className="text-xs text-gray-400 mb-2 tracking-wide">
                  TRIGGERING TELEMETRY
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(current.events_summary).map(([k, v]) => (
                    <div
                      key={k}
                      className="glass-panel rounded px-3 py-2 flex items-center justify-between"
                    >
                      <span className="text-[11px] text-gray-400">
                        {k.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm font-mono text-cyber-cyan">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CyberpunkCard>
  );
};

const SourceBadge = ({ source }: { source: Source }) => {
  const map = {
    connecting: { text: "CONNECTING", cls: "text-gray-400 border-gray-500/40" },
    live: { text: "LIVE", cls: "text-green-400 border-green-500/40" },
    replay: { text: "REPLAY", cls: "text-yellow-400 border-yellow-500/40" },
  }[source];
  return (
    <span
      className={`flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${map.cls}`}
    >
      <Radio className="w-3 h-3" />
      {map.text}
    </span>
  );
};

export default DefenderCopilot;
