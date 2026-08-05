"""
export_artifacts.py  –  Snapshot trained-run results into public/rl-artifacts/
==============================================================================
The RL Flask API and the honeypot Docker/ES stack only run locally (GPU +
containers). The hosted CyberX site (Vercel frontend + Express tools backend)
has no Flask, so the RL dashboards must fall back to committed JSON/PNG
snapshots. This script generates those snapshots from a real training run.

The frontend tries the live `/api/rl/*` endpoints first and falls back to
`/rl-artifacts/<file>` when the live stack is absent (see src/lib/rlData.ts).

Usage (from anywhere):
    venv/Scripts/python.exe src/server/rl/export_artifacts.py
    venv/Scripts/python.exe src/server/rl/export_artifacts.py --run run_four_b

Outputs (under public/rl-artifacts/):
    metrics_history.json   – parallel-array training history (charts)
    exploitability.json    – aggregated NashConv / best-response summary
    leaderboard.json        – Elo leaderboard ({leaderboard: [{agent, elo}]})
    training_curves.png    – the 6-panel results figure
    demo_episode.json      – recorded best-vs-best episode      (--demo / --all)
    shadow_eval.json       – shadow-mode evaluation report      (--shadow / --all)
    copilot_sample.json    – recorded Copilot suggestions       (--shadow / --all)
    manifest.json          – provenance, timestamp, sha256 per file

`--all` regenerates everything. Partial regeneration is how the committed set
drifted: shadow_eval.json and copilot_sample.json were produced by hand or by a
separate script and appeared in no manifest, so nothing could tell which run
they came from.
"""

import argparse
import glob
import hashlib
import json
import os
import shutil
import statistics
from datetime import datetime, timezone

_SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT   = os.path.abspath(os.path.join(_SCRIPT_DIR, "..", "..", ".."))
_RESULTS_DIR = os.path.join(_SCRIPT_DIR, "models", "cyberx_marl", "results")
_PUBLIC_DIR  = os.path.join(_REPO_ROOT, "public", "rl-artifacts")


def _mean_std(values: list) -> dict:
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None}
    return {
        "mean": round(statistics.fmean(vals), 3),
        "std":  round(statistics.pstdev(vals), 3) if len(vals) > 1 else 0.0,
    }


def aggregate_exploitability() -> dict:
    """Mirror of api.py:_aggregate_exploitability so the snapshot matches the
    live endpoint's shape exactly."""
    reports = sorted(glob.glob(
        os.path.join(_RESULTS_DIR, "**", "exploitability_report.json"),
        recursive=True))
    runs, nashconv, att_e, att_g, def_e, def_g = [], [], [], [], [], []
    for path in reports:
        try:
            with open(path) as f:
                r = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        att = r.get("attacker_exploitability", {}) or {}
        dfd = r.get("defender_exploitability", {}) or {}
        nashconv.append(r.get("nashconv"))
        att_e.append(att.get("exploitability"))
        att_g.append(att.get("gap_over_equilibrium"))
        def_e.append(dfd.get("exploitability"))
        def_g.append(dfd.get("gap_over_equilibrium"))
        runs.append({
            "run":      os.path.basename(os.path.dirname(path)),
            "nashconv": r.get("nashconv"),
            "att_exploitability": att.get("exploitability"),
            "att_gap":  att.get("gap_over_equilibrium"),
            "def_exploitability": dfd.get("exploitability"),
            "def_gap":  dfd.get("gap_over_equilibrium"),
            "equilibrium": r.get("equilibrium"),
        })
    return {
        "n_runs":   len(runs),
        "nashconv": _mean_std(nashconv),
        "attacker": {"exploitability": _mean_std(att_e), "gap": _mean_std(att_g)},
        "defender": {"exploitability": _mean_std(def_e), "gap": _mean_std(def_g)},
        "runs":     runs,
    }


def record_demo(run_dir: str, n_episodes: int = 1) -> dict:
    """Play best-attacker vs best-defender and capture the per-step events in
    the same shape api.py:/demo/stream emits, so the RL Arena demo replay can
    animate a real episode with no live backend. Heavy (loads torch); lazy."""
    import numpy as np  # noqa: PLC0415
    from sb3_contrib import RecurrentPPO  # noqa: PLC0415
    from shared_honeypot_env import (  # noqa: PLC0415
        ATT_ACTION_NAMES, DEF_ACTION_NAMES, SharedHoneypotEnv, StatefulOpponent,
    )

    att_path = os.path.join(run_dir, "attacker_best.zip")
    def_path = os.path.join(run_dir, "defender_best.zip")
    attacker = RecurrentPPO.load(att_path, device="cpu")
    defender = RecurrentPPO.load(def_path, device="cpu")
    env = SharedHoneypotEnv(
        mode="attacker",
        opponent_model=StatefulOpponent(defender),
        curriculum_level=2,
    )
    env.reset(seed=7)

    events: list = []
    for ep in range(1, n_episodes + 1):
        obs, _ = env.reset()
        lstm_state, done, info = None, False, {}
        events.append({"type": "episode_start", "episode": ep,
                       "max_steps": env.max_steps})
        while not done:
            action, lstm_state = attacker.predict(
                np.asarray(obs, dtype=np.float32).reshape(1, -1),
                state=lstm_state, deterministic=True)
            obs, _, term, trunc, info = env.step(int(np.asarray(action).flat[0]))
            done = term or trunc
            events.append({
                "type": "step", "episode": ep, "step": info["step"],
                "att_action": info["att_action"],
                "att_action_name": ATT_ACTION_NAMES[info["att_action"]],
                "def_action": info["def_action"],
                "def_action_name": DEF_ACTION_NAMES[info["def_action"]],
                "stage": info["stage"], "suspicion": info["suspicion"],
                "evidence": info["evidence"], "egress_volume": info["egress_volume"],
                "decoys_deployed": info["decoys_deployed"],
                "att_reward": round(info["att_step_reward"], 2),
                "def_reward": round(info["def_step_reward"], 2),
            })
        events.append({
            "type": "episode_end", "episode": ep,
            "attacker_win": bool(info.get("attacker_win", False)),
            "defender_win": bool(info.get("defender_win", False)),
            "ep_att_return": round(info.get("ep_att_return", 0.0), 2),
            "ep_def_return": round(info.get("ep_def_return", 0.0), 2),
            "first_detection_step": info.get("first_detection_step"),
            "false_positives": info.get("false_positives", 0),
        })
    events.append({"type": "done"})
    return {"note": "Recorded best-vs-best episode for RL Arena demo replay "
                    "(no live backend needed).", "events": events}


def record_shadow_eval(run_dir: str, n_events: int = 400) -> dict:
    """Run the shadow-mode evaluation and return the report, including the
    frozen-state baseline so the before/after stays auditable in one file."""
    import shadow_eval  # noqa: PLC0415
    from soc_state import SocState  # noqa: PLC0415
    from telemetry_adapter import DefenderAdvisor, TelemetryAdapter  # noqa: PLC0415

    model_path = os.path.join(run_dir, "defender_best.zip")
    advisor = DefenderAdvisor(model_path)
    adapter = TelemetryAdapter()
    events  = shadow_eval._synthetic_events(n_events)

    result = shadow_eval.evaluate(
        events, advisor, adapter, SocState(),
        window_size=20, episode_windows=7, frozen_state=False)
    baseline = shadow_eval.evaluate(
        events, advisor, adapter, SocState(),
        window_size=20, episode_windows=10 ** 9, frozen_state=True)
    baseline.pop("rows", None)
    baseline["note"] = ("Original harness: SOC posture frozen at zero and one "
                        "unbroken LSTM rollout over every window.")

    return {
        "model": model_path,
        "n_events": len(events),
        "window_size": 20,
        "synthetic": True,
        "note": ("Shadow-mode eval: trained-in-sim defender over honeypot "
                 "telemetry vs a documented analyst heuristic (proxy ground "
                 "truth). Controlled evaluation, not a deployment claim."),
        **result,
        "frozen_baseline": baseline,
    }


def record_copilot_sample(run_dir: str, n_events: int = 400) -> dict:
    """Record real Defender Copilot suggestions for the replay fallback.

    The previous sample was hand-authored: the summary/action pairs were
    plausible but never came from the policy, so the hosted site's "trained RL
    defender" card was showing invented output. These are the model's actual
    responses, produced through the same SocState loop the live SSE uses.
    """
    import shadow_eval  # noqa: PLC0415
    from soc_state import SocState  # noqa: PLC0415
    from telemetry_adapter import DefenderAdvisor, TelemetryAdapter  # noqa: PLC0415

    advisor = DefenderAdvisor(os.path.join(run_dir, "defender_best.zip"))
    adapter = TelemetryAdapter()
    soc     = SocState()
    events  = shadow_eval._synthetic_events(n_events)

    suggestions = []
    for i, start in enumerate(range(0, len(events), 20)):
        summary = adapter.summarize(events[start:start + 20])
        soc.decay()
        obs = adapter.build_observation(
            defense_state=soc.as_defense_state(), step_fraction=0.5,
            summary=summary)
        result  = advisor.suggest(obs)
        outcome = soc.advance(result["action"], summary)
        suggestions.append({
            "type": "suggestion",
            "events_summary": summary,
            "action":         result["action"],
            "action_name":    result["action_name"],
            "soc_state":      soc.as_defense_state(),
            "outcome":        outcome,
        })

    # Keep a spread of distinct actions so the cycling card isn't monotonous.
    seen, picked = set(), []
    for s in suggestions:
        if s["action_name"] not in seen:
            seen.add(s["action_name"])
            picked.append(s)
    picked += [s for s in suggestions if s not in picked][:max(0, 6 - len(picked))]

    return {
        "note": ("Recorded Defender Copilot suggestions — real outputs of the "
                 "trained defender over synthetic honeypot telemetry, replayed "
                 "when no live Flask/ES stack is present. Cycled client-side."),
        "source_model": os.path.join(run_dir, "defender_best.zip"),
        "suggestions": picked,
    }


def leaderboard_from(run_dir: str) -> dict:
    elo_path = os.path.join(run_dir, "elo_ratings.json")
    if not os.path.exists(elo_path):
        return {"leaderboard": []}
    with open(elo_path) as f:
        ratings = json.load(f).get("ratings", {})
    board = sorted(ratings.items(), key=lambda kv: -kv[1])
    return {"leaderboard": [{"agent": k, "elo": round(v)} for k, v in board]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--run", default="run_four_a",
        help="results subdir to use for history/leaderboard/plot (default: run_four_a)")
    parser.add_argument(
        "--demo", action="store_true",
        help="also record a best-vs-best demo episode (loads torch; slower)")
    parser.add_argument(
        "--shadow", action="store_true",
        help="also record the shadow evaluation + Copilot sample (loads torch)")
    parser.add_argument(
        "--all", action="store_true",
        help="regenerate every artifact (implies --demo --shadow)")
    args = parser.parse_args()
    if args.all:
        args.demo = args.shadow = True

    run_dir = os.path.join(_RESULTS_DIR, args.run)
    if not os.path.isdir(run_dir):
        raise SystemExit(f"run dir not found: {run_dir}")

    os.makedirs(_PUBLIC_DIR, exist_ok=True)

    # 1. training history (charts)
    hist_src = os.path.join(run_dir, "training_history.json")
    with open(hist_src) as f:
        history = json.load(f)
    with open(os.path.join(_PUBLIC_DIR, "metrics_history.json"), "w") as f:
        json.dump(history, f, indent=2)

    # 2. exploitability (aggregated across all runs)
    exploit = aggregate_exploitability()
    with open(os.path.join(_PUBLIC_DIR, "exploitability.json"), "w") as f:
        json.dump(exploit, f, indent=2)

    # 3. leaderboard
    with open(os.path.join(_PUBLIC_DIR, "leaderboard.json"), "w") as f:
        json.dump(leaderboard_from(run_dir), f, indent=2)

    # 4. training curves plot
    plot_src = os.path.join(run_dir, "training_curves.png")
    if os.path.exists(plot_src):
        shutil.copy2(plot_src, os.path.join(_PUBLIC_DIR, "training_curves.png"))

    # 5. optional recorded demo episode (best vs best)
    if args.demo:
        try:
            demo = record_demo(run_dir, n_episodes=1)
            with open(os.path.join(_PUBLIC_DIR, "demo_episode.json"), "w") as f:
                json.dump(demo, f, indent=2)
        except Exception as exc:  # noqa: BLE001
            print(f"  (demo recording skipped: {exc})")

    # 6. optional shadow evaluation + recorded Copilot suggestions
    shadow = None
    if args.shadow:
        try:
            shadow = record_shadow_eval(run_dir)
            with open(os.path.join(_PUBLIC_DIR, "shadow_eval.json"), "w") as f:
                json.dump(shadow, f, indent=2)
            with open(os.path.join(_PUBLIC_DIR, "copilot_sample.json"), "w") as f:
                json.dump(record_copilot_sample(run_dir), f, indent=2)
        except Exception as exc:  # noqa: BLE001
            print(f"  (shadow recording skipped: {exc})")

    # 7. manifest / provenance — checksum every file so a stale or hand-edited
    #    artifact is detectable instead of silently shipping.
    files = {}
    for name in sorted(os.listdir(_PUBLIC_DIR)):
        if name == "manifest.json":
            continue
        path = os.path.join(_PUBLIC_DIR, name)
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        files[name] = {"sha256": digest, "bytes": os.path.getsize(path)}

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_run":   args.run,
        "n_iterations": len(history.get("iterations", [])),
        "nashconv":     exploit["nashconv"],
        "regenerated":  {"demo": bool(args.demo), "shadow": bool(args.shadow)},
        "files":        files,
        "note": ("Baked snapshot of a real CyberX MARL run for the hosted "
                 "site / replay mode. Regenerate with "
                 "`export_artifacts.py --all`."),
    }
    if shadow:
        manifest["shadow_eval"] = {
            "distinct_actions":    shadow["distinct_actions"],
            "action_entropy_bits": shadow["action_entropy_bits"],
            "exact_agreement":     shadow["exact_agreement"],
            "constant_policy":     shadow["constant_policy"],
        }
    with open(os.path.join(_PUBLIC_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Wrote artifacts to {_PUBLIC_DIR}")
    for name, meta in files.items():
        print(f"  - {name:24s} {meta['bytes']:>9,} B  {meta['sha256'][:12]}")


if __name__ == "__main__":
    main()
