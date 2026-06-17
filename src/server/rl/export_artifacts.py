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
    manifest.json          – provenance + generation timestamp
"""

import argparse
import glob
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
    args = parser.parse_args()

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

    # 6. manifest / provenance
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_run":   args.run,
        "n_iterations": len(history.get("iterations", [])),
        "nashconv":     exploit["nashconv"],
        "note": ("Baked snapshot of a real CyberX MARL run for the hosted "
                 "site / replay mode. Regenerate with export_artifacts.py."),
    }
    with open(os.path.join(_PUBLIC_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Wrote artifacts to {_PUBLIC_DIR}")
    for name in sorted(os.listdir(_PUBLIC_DIR)):
        print("  -", name)


if __name__ == "__main__":
    main()
