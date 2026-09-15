#!/usr/bin/env python3
"""
run_sweep.py  –  Multi-seed sweeps and A/B arms, aggregated with CIs
=====================================================================
The five `run_four_{a..e}` runs were all launched at the default seed 42
(PROJECT_CONTEXT.md §15): they measure CUDA nondeterminism, not seed variance,
and a reviewer will read "5 seeds" as the latter. This script runs a real sweep
and aggregates it the way Agarwal et al. ("Deep RL at the Edge of the
Statistical Precipice", NeurIPS 2021) ask for — point estimate plus a bootstrap
confidence interval, not a bare mean.

Each run is a fresh `run_training.py` subprocess, so every run keeps the crash
supervisor and the worker-tree cleanup. Runs are sequential on purpose: two
concurrent runs would not fit in 8 GB of VRAM.

Usage
-----
  # 3 seeds of the PFSP arm and its uniform control, 30 iterations each
  python run_sweep.py --tag pfsp    --seeds 1 2 3 --iterations 30 --pfsp
  python run_sweep.py --tag uniform --seeds 1 2 3 --iterations 30 --no-pfsp

  # an ablation arm
  python run_sweep.py --tag no_bc --seeds 1 2 3 --iterations 25 --ablate bc

  # aggregate finished runs without training anything
  python run_sweep.py --tag pfsp --seeds 1 2 3 --aggregate-only
  python run_sweep.py --compare pfsp uniform

Results land in `models/cyberx_marl/results/<tag>_seed<N>/`, which is exactly
where api.py and export_artifacts.py already look for runs.
"""

import argparse
import json
import os
import random
import statistics
import subprocess
import sys
import time

from stats_util import iqm

_SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
_RESULTS_DIR = os.path.join(_SCRIPT_DIR, "models", "cyberx_marl", "results")


def run_dir_for(tag: str, seed: int) -> str:
    return os.path.join(_RESULTS_DIR, f"{tag}_seed{seed}")


def _run_complete(save_dir: str, n_iters: int) -> bool:
    """A run counts as done only when trainer_state.json says it advanced past
    the last iteration. Keying "done" on training_history.json (written every
    iteration) treats a seed stopped mid-run as finished and skips it forever —
    so a resumed sweep would silently leave a partial seed in the aggregate."""
    ts = os.path.join(save_dir, "trainer_state.json")
    if not os.path.exists(ts):
        return False
    try:
        with open(ts) as f:
            return int(json.load(f).get("next_iteration", 0)) > n_iters
    except (ValueError, OSError, json.JSONDecodeError):
        return False


def bootstrap_ci(values, n_boot: int = 10_000, alpha: float = 0.05, seed: int = 0):
    """Percentile bootstrap CI of the mean. With 3-5 seeds a normal-theory
    interval is not credible; resampling at least reports honest width."""
    vals = [v for v in values if v is not None]
    if len(vals) < 2:
        return {"lo": None, "hi": None}
    rng = random.Random(seed)
    means = []
    for _ in range(n_boot):
        sample = [vals[rng.randrange(len(vals))] for _ in range(len(vals))]
        means.append(statistics.fmean(sample))
    means.sort()
    return {"lo": round(means[int(n_boot * alpha / 2)], 4),
            "hi": round(means[int(n_boot * (1 - alpha / 2)) - 1], 4)}


def summarize(values, last_n: int = 10) -> dict:
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "iqm": None, "std": None, "n": 0,
                "ci95": {"lo": None, "hi": None}}
    iqm_val = iqm(vals)
    return {
        "mean": round(statistics.fmean(vals), 4),
        # IQM (mean of the middle 50%) is the robust central estimate Agarwal
        # et al. (2021) recommend for small-n RL sweeps — less swayed by a
        # single lucky/unlucky seed than the bare mean.
        "iqm":  round(iqm_val, 4) if iqm_val is not None else None,
        "std":  round(statistics.pstdev(vals), 4) if len(vals) > 1 else 0.0,
        "n":    len(vals),
        "ci95": bootstrap_ci(vals),
    }


def read_run(tag: str, seed: int, last_n: int = 10) -> dict:
    """Final-performance summary for one run: the mean over the last `last_n`
    iterations, which is the convention §15 already reports."""
    d = run_dir_for(tag, seed)
    hist_path = os.path.join(d, "training_history.json")
    if not os.path.exists(hist_path):
        return {"seed": seed, "dir": d, "found": False}
    with open(hist_path) as f:
        h = json.load(f)

    att = h.get("att_win_rates", [])[-last_n:]
    dfd = h.get("def_win_rates", [])[-last_n:]
    row = {
        "seed": seed, "dir": d, "found": True,
        "iterations": len(h.get("iterations", [])),
        "att_win_rate": round(statistics.fmean(att), 4) if att else None,
        "def_win_rate": round(statistics.fmean(dfd), 4) if dfd else None,
    }

    expl_path = os.path.join(d, "exploitability_report.json")
    if os.path.exists(expl_path):
        with open(expl_path) as f:
            e = json.load(f)
        ae = e.get("attacker_exploitability") or {}
        de = e.get("defender_exploitability") or {}
        row["nashconv"] = e.get("nashconv")
        row["nashconv_tail"] = e.get("nashconv_tail_mean")
        row["att_gap"] = ae.get("gap_over_equilibrium")
        row["def_gap"] = de.get("gap_over_equilibrium")
        # gap_over_equilibrium uses max(curve) and is peak-biased; the trailing
        # plateau mean is the honest estimator. Report both so an unconverged,
        # noisy probe cannot masquerade as a clean gap.
        row["att_gap_tail"] = ae.get("gap_tail_mean")
        row["def_gap_tail"] = de.get("gap_tail_mean")
        row["br_iterations"] = e.get("br_iterations")
        row["probe_converged"] = not e.get("unconverged_sides")
    return row


def aggregate(tag: str, seeds) -> dict:
    rows = [read_run(tag, s) for s in seeds]
    found = [r for r in rows if r.get("found")]
    missing = [r["seed"] for r in rows if not r.get("found")]
    agg = {"tag": tag, "seeds": list(seeds), "n_runs": len(found),
           "missing_seeds": missing, "runs": rows}
    for key in ("att_win_rate", "def_win_rate", "nashconv", "nashconv_tail",
                "att_gap", "def_gap", "att_gap_tail", "def_gap_tail"):
        agg[key] = summarize([r.get(key) for r in found])
    # Provenance for the honesty caveats: how deep the best-response probe ran
    # and whether every side converged. An unconverged probe under-measures the
    # gap, so the reader must be told before quoting a delta.
    probed = [r for r in found if r.get("probe_converged") is not None]
    agg["br_iterations"] = next((r.get("br_iterations") for r in probed), None)
    agg["probe_converged_all"] = (all(r.get("probe_converged") for r in probed)
                                  if probed else None)
    return agg


def train_one(tag: str, seed: int, args) -> bool:
    save_dir = run_dir_for(tag, seed)
    if args.skip_done and _run_complete(save_dir, args.iterations):
        print(f"  [{tag} seed {seed}] already complete ({args.iterations} iters) — skipping")
        return True

    cmd = [sys.executable, os.path.join(_SCRIPT_DIR, "run_training.py"),
           "--seed", str(seed), "--save-dir", save_dir,
           "--iterations", str(args.iterations)]
    if args.timesteps:
        cmd += ["--timesteps", str(args.timesteps)]
    if args.eval_episodes:
        cmd += ["--eval-episodes", str(args.eval_episodes)]
    if args.pfsp is True:
        cmd += ["--pfsp"]
    elif args.pfsp is False:
        cmd += ["--no-pfsp"]
    for a in args.ablate:
        cmd += ["--ablate", a]
    # An interrupted seed left a trainer_state.json but is not complete (checked
    # above): resume from its last checkpoint instead of restarting at iter 1.
    if os.path.exists(os.path.join(save_dir, "trainer_state.json")):
        cmd += ["--resume"]

    print(f"\n{'='*68}\n  {tag} · seed {seed}\n  {' '.join(cmd)}\n{'='*68}", flush=True)
    t0 = time.time()
    rc = subprocess.call(cmd, cwd=_SCRIPT_DIR)
    print(f"  [{tag} seed {seed}] exit={rc}  ({(time.time()-t0)/60:.1f} min)")
    return rc == 0


def print_agg(agg: dict) -> None:
    conv = agg.get("probe_converged_all")
    conv_note = ""
    if conv is not None:
        conv_note = (f", probe br={agg.get('br_iterations')} "
                     f"{'converged' if conv else 'UNCONVERGED - gaps under-measured'}")
    print(f"\n  {agg['tag']}  ({agg['n_runs']} runs"
          + (f", missing seeds {agg['missing_seeds']}" if agg["missing_seeds"] else "")
          + conv_note + ")")
    for key in ("att_win_rate", "def_win_rate", "nashconv", "nashconv_tail",
                "att_gap", "att_gap_tail", "def_gap", "def_gap_tail"):
        s = agg[key]
        if s["mean"] is None:
            continue
        ci = s["ci95"]
        span = f"  95% CI [{ci['lo']}, {ci['hi']}]" if ci["lo"] is not None else ""
        iqm_str = f"  IQM {s['iqm']:.3f}" if s.get("iqm") is not None else ""
        print(f"    {key:14s} {s['mean']:.3f} ± {s['std']:.3f}{iqm_str}{span}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--tag", help="arm name; runs go to results/<tag>_seed<N>/")
    p.add_argument("--seeds", type=int, nargs="+", default=[1, 2, 3])
    p.add_argument("--iterations", type=int, default=30)
    p.add_argument("--timesteps", type=int, default=None)
    p.add_argument("--eval-episodes", type=int, default=None)
    p.add_argument("--pfsp", dest="pfsp", action="store_true", default=None)
    p.add_argument("--no-pfsp", dest="pfsp", action="store_false")
    p.add_argument("--ablate", action="append", default=[])
    p.add_argument("--skip-done", action="store_true", default=True,
                   help="skip seeds whose run dir already has a history")
    p.add_argument("--aggregate-only", action="store_true")
    p.add_argument("--compare", nargs=2, metavar=("ARM_A", "ARM_B"),
                   help="aggregate two finished arms side by side")
    p.add_argument("--out", help="write the aggregate JSON here")
    args = p.parse_args()

    if args.compare:
        arms = [aggregate(t, args.seeds) for t in args.compare]
        for a in arms:
            print_agg(a)
        a, b = arms
        print(f"\n  {a['tag']} vs {b['tag']}:")
        for key in ("def_win_rate", "nashconv", "nashconv_tail",
                    "def_gap", "def_gap_tail", "att_gap", "att_gap_tail"):
            if a[key]["mean"] is not None and b[key]["mean"] is not None:
                delta = a[key]["mean"] - b[key]["mean"]
                print(f"    Δ {key:14s} {delta:+.3f}")
        print("\n  Overlapping CIs mean the arms are not separated at this "
              "sample size — report that, don't round it away.")
        if any(arm.get("probe_converged_all") is False for arm in arms):
            print("  NOTE: the best-response probe did not converge — the *_gap "
                  "numbers under-measure exploitability. Prefer *_gap_tail and "
                  "raise --br-iterations before quoting a headline delta.")
        if args.out:
            with open(args.out, "w") as f:
                json.dump({"arms": arms}, f, indent=2)
        return

    if not args.tag:
        raise SystemExit("--tag is required unless using --compare")

    if not args.aggregate_only:
        for seed in args.seeds:
            if not train_one(args.tag, seed, args):
                print(f"  WARNING: {args.tag} seed {seed} failed; continuing")

    agg = aggregate(args.tag, args.seeds)
    print_agg(agg)
    if args.out:
        with open(args.out, "w") as f:
            json.dump(agg, f, indent=2)
        print(f"\n  wrote {args.out}")


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
