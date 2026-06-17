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

    # 5. manifest / provenance
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
