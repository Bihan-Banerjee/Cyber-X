#!/usr/bin/env python3
"""
run_experiment.py  –  One-command PFSP before/after experiment (single machine)
================================================================================
The full headline result is a sequence of commands — train the uniform-league
control, train the PFSP arm, probe each run's exploitability, compare the two,
refresh the dashboard artifacts, and (optionally) run the out-of-class LLM
probe. On one GPU that is an overnight job that a crash or a reboot can
interrupt halfway.

This driver runs the whole sequence in order, sequentially (two runs will not
fit in 8 GB at once), and is RESUMABLE: every training seed is skipped if it
already finished (run_sweep --skip-done), and each later stage is idempotent, so
re-running after an interruption picks up where it stopped. Everything shells out
to the existing scripts, so the crash-restart supervisor and worker cleanup in
run_training.py still apply to each seed.

Usage (from src/server/rl):
  python run_experiment.py --seeds 1 2 3 --iterations 30
  python run_experiment.py --seeds 1 2 3 --iterations 30 --llm --llm-model qwen2.5:3b
  python run_experiment.py --seeds 1 2 3 --dry-run        # print the plan only
  python run_experiment.py --skip-training                # just re-probe/compare/export

Outputs:
  models/cyberx_marl/results/{uniform,pfsp}_seed<N>/   per-run models + reports
  models/cyberx_marl/results/sweep_comparison.json     the before/after (with CIs)
  public/rl-artifacts/sweep_comparison.json            dashboard copy (RL Arena)
  public/rl-artifacts/red_team_probe.json              dashboard copy (Red vs Blue)
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_RL_DIR      = os.path.dirname(os.path.abspath(__file__))
_RESULTS_DIR = os.path.join(_RL_DIR, "models", "cyberx_marl", "results")
_REPO_ROOT   = os.path.abspath(os.path.join(_RL_DIR, "..", "..", ".."))
_PUBLIC_DIR  = os.path.join(_REPO_ROOT, "public", "rl-artifacts")

ARMS = [("uniform", "--no-pfsp"), ("pfsp", "--pfsp")]


def _run(cmd: list, dry: bool) -> int:
    print(f"\n$ {' '.join(cmd)}", flush=True)
    if dry:
        return 0
    return subprocess.call(cmd, cwd=_RL_DIR)


def run_dir(tag: str, seed: int) -> str:
    return os.path.join(_RESULTS_DIR, f"{tag}_seed{seed}")


def main() -> None:
    p = argparse.ArgumentParser(description="One-command PFSP before/after experiment")
    p.add_argument("--seeds", type=int, nargs="+", default=[1, 2, 3])
    p.add_argument("--iterations", type=int, default=30)
    p.add_argument("--timesteps", type=int, default=None,
                   help="override timesteps/iter (default: config.json). Lower "
                        "(e.g. 30000) for a faster first signal.")
    p.add_argument("--skip-training", action="store_true",
                   help="skip the training arms; just probe/compare/export existing runs")
    p.add_argument("--no-exploitability", action="store_true",
                   help="skip the per-run best-response probe (compare then has no def_gap)")
    p.add_argument("--br-iterations", type=int, default=12,
                   help="best-response iterations for the exploitability probe")
    p.add_argument("--llm", action="store_true",
                   help="also run the out-of-class LLM probe on the first PFSP run")
    p.add_argument("--llm-provider", default="ollama")
    p.add_argument("--llm-model", default="qwen2.5:3b")
    p.add_argument("--dry-run", action="store_true", help="print the plan, run nothing")
    args = p.parse_args()

    py = sys.executable
    seeds_str = [str(s) for s in args.seeds]

    print("=" * 70)
    print("  PFSP BEFORE/AFTER EXPERIMENT")
    print(f"  seeds={args.seeds}  iterations={args.iterations}"
          f"  timesteps={args.timesteps or 'config'}")
    print(f"  arms={[a for a, _ in ARMS]}  exploitability={not args.no_exploitability}"
          f"  llm_probe={args.llm}")
    print("=" * 70)

    # ── 1. Train both arms (resumable: run_sweep skips finished seeds) ──────────
    if not args.skip_training:
        for tag, flag in ARMS:
            cmd = [py, os.path.join(_RL_DIR, "run_sweep.py"),
                   "--tag", tag, flag, "--seeds", *seeds_str,
                   "--iterations", str(args.iterations), "--skip-done"]
            if args.timesteps:
                cmd += ["--timesteps", str(args.timesteps)]
            rc = _run(cmd, args.dry_run)
            if rc != 0:
                print(f"  WARNING: {tag} arm exited rc={rc}; continuing")

    # ── 2. Per-run exploitability probe (fills def_gap for the comparison) ──────
    if not args.no_exploitability:
        for tag, _ in ARMS:
            for seed in args.seeds:
                d = run_dir(tag, seed)
                if not args.dry_run and not os.path.isdir(d):
                    print(f"  skip probe: {d} missing")
                    continue
                out = os.path.join(d, "exploitability_report.json")
                if not args.dry_run and os.path.exists(out):
                    print(f"  skip probe (exists): {out}")
                    continue
                _run([py, os.path.join(_RL_DIR, "exploitability.py"),
                      "--run-dir", d, "--side", "both",
                      "--br-iterations", str(args.br_iterations),
                      "--out", out], args.dry_run)

    # ── 3. Compare the arms → results dir + dashboard copy ─────────────────────
    cmp_out = os.path.join(_RESULTS_DIR, "sweep_comparison.json")
    _run([py, os.path.join(_RL_DIR, "run_sweep.py"),
          "--compare", "pfsp", "uniform", "--seeds", *seeds_str,
          "--out", cmp_out], args.dry_run)
    if not args.dry_run and os.path.exists(cmp_out):
        os.makedirs(_PUBLIC_DIR, exist_ok=True)
        shutil.copy(cmp_out, os.path.join(_PUBLIC_DIR, "sweep_comparison.json"))
        print(f"  dashboard copy → {os.path.join(_PUBLIC_DIR, 'sweep_comparison.json')}")

    # ── 4. Refresh the dashboard artifacts from the first PFSP run ──────────────
    first = f"pfsp_seed{args.seeds[0]}"
    if args.dry_run or os.path.isdir(run_dir("pfsp", args.seeds[0])):
        _run([py, os.path.join(_RL_DIR, "export_artifacts.py"),
              "--run", first, "--all"], args.dry_run)

    # ── 5. Optional out-of-class LLM probe on the first PFSP run ────────────────
    if args.llm:
        d = run_dir("pfsp", args.seeds[0])
        probe_out = os.path.join(_PUBLIC_DIR, "red_team_probe.json")
        cmd = [py, "-m", "red_team.probe", "--run-dir", d,
               "--episodes", "50", "--llm",
               "--provider", args.llm_provider, "--model", args.llm_model,
               "--out", probe_out]
        _run(cmd, args.dry_run)

    print("\n" + "=" * 70)
    print("  DONE. Open the dashboards:")
    print("    RL Arena     /rl-arena     → PFSP vs UNIFORM before/after card")
    print("    Red vs Blue  /red-vs-blue  → out-of-class exploitability card")
    print("  Start the live stack (python api.py) to serve results, or the baked")
    print("  public/rl-artifacts copies render on the cold site.")
    print("=" * 70)


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
