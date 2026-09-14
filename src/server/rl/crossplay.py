#!/usr/bin/env python3
"""
crossplay.py  –  N×N cross-play matrix + empirical Nash over archived agents
=============================================================================
Self-play win rate is transitive by assumption; real populations often are not.
The v4.1 run showed rock-paper-scissors cycling, and nothing in the current
evaluation would detect it: Elo collapses a population onto one axis and hides
non-transitivity by construction (Balduzzi et al., "Re-evaluating Evaluation",
NeurIPS 2018).

This harness plays every archived attacker against every archived defender,
reports the win-rate matrix, solves the resulting zero-sum matrix game for an
empirical Nash equilibrium, and measures how far the population is from
transitive. It is the cheapest research result still on the table: no training,
pure inference, and each run already leaves ~50 ghosts plus best/final
checkpoints on disk.

Usage:
  python crossplay.py --run-dir models/cyberx_marl/results/run_four_a
  python crossplay.py --run-dir <dir> --stride 10 --episodes 30
  python crossplay.py --ghosts models/cyberx_marl/ghosts --stride 5
"""

import argparse
import glob
import json
import os
import re
import shutil
import sys
import tempfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _iter_num(path: str) -> int:
    m = re.search(r"_(\d+)\.zip$", os.path.basename(path))
    return int(m.group(1)) if m else -1


def collect_agents(args) -> dict:
    """Gather {role: [(label, path)]} from a run dir and/or a ghost pool."""
    agents = {"attacker": [], "defender": []}
    prefix = {"attacker": "att", "defender": "def"}

    if args.ghosts:
        for role in agents:
            paths = sorted(
                glob.glob(os.path.join(args.ghosts, f"{prefix[role]}_*.zip")),
                key=_iter_num)
            for p in paths[::args.stride]:
                agents[role].append((os.path.basename(p)[:-4], p))

    if args.run_dir:
        # Ghosts stored alongside the run, then the headline snapshots.
        pool = os.path.join(args.run_dir, "ghosts")
        if os.path.isdir(pool):
            for role in agents:
                paths = sorted(
                    glob.glob(os.path.join(pool, f"{prefix[role]}_*.zip")),
                    key=_iter_num)
                for p in paths[::args.stride]:
                    agents[role].append((os.path.basename(p)[:-4], p))
        for role in agents:
            for name in ("best", "final"):
                p = os.path.join(args.run_dir, f"{role}_{name}.zip")
                if os.path.exists(p):
                    agents[role].append((f"{prefix[role]}_{name}", p))

    if args.scripted:
        agents["attacker"] += [("random_att", "scripted:random_attacker"),
                               ("scripted_att", "scripted:scripted_attacker"),
                               ("expert_att", "scripted:expert_attacker")]
        agents["defender"] += [("random_def", "scripted:random_defender"),
                               ("scripted_def", "scripted:scripted_defender"),
                               ("expert_def", "scripted:expert_defender")]
    return agents


def load_agent(spec: str):
    """A match agent for either a scripted baseline or a saved RecurrentPPO."""
    from types import SimpleNamespace
    if spec.startswith("scripted:"):
        from baselines import OPPONENT_REGISTRY
        return OPPONENT_REGISTRY[spec.split(":", 1)[1]]()
    from sb3_contrib import RecurrentPPO
    import agents  # noqa: F401 — registers the custom extractor for unpickling
    return SimpleNamespace(model=RecurrentPPO.load(spec, device="cpu"))


def solve_zero_sum(matrix):
    """Empirical Nash of the zero-sum game via fictitious play.

    Fictitious play converges to Nash in zero-sum games (Robinson 1951) and
    needs no LP solver, so this adds no dependency for a matrix this small.
    Returns (row_strategy, col_strategy, game_value) where the row player is
    the attacker maximizing its win rate.
    """
    n_rows, n_cols = len(matrix), len(matrix[0])
    row_counts = [0.0] * n_rows
    col_counts = [0.0] * n_cols
    row_payoff = [0.0] * n_rows
    col_payoff = [0.0] * n_cols

    for _ in range(20_000):
        # Attacker maximizes its win rate; defender minimizes it.
        r = max(range(n_rows), key=lambda i: row_payoff[i])
        c = min(range(n_cols), key=lambda j: col_payoff[j])
        row_counts[r] += 1
        col_counts[c] += 1
        for i in range(n_rows):
            row_payoff[i] += matrix[i][c]
        for j in range(n_cols):
            col_payoff[j] += matrix[r][j]

    total_r, total_c = sum(row_counts), sum(col_counts)
    row_strategy = [c / total_r for c in row_counts]
    col_strategy = [c / total_c for c in col_counts]
    value = sum(row_strategy[i] * matrix[i][j] * col_strategy[j]
                for i in range(n_rows) for j in range(n_cols))
    return row_strategy, col_strategy, value


def transitivity_violations(matrix, row_labels, col_labels):
    """Count intransitive triples in the induced attacker ordering.

    If the population were transitive, ranking attackers by mean win rate would
    predict every pairwise comparison. Each violation is a pair whose head-to-head
    profile contradicts the ranking — evidence Elo is hiding a cycle.
    """
    n_rows = len(matrix)
    means = [sum(row) / len(row) for row in matrix]
    order = sorted(range(n_rows), key=lambda i: -means[i])
    violations = []
    for a_idx in range(len(order)):
        for b_idx in range(a_idx + 1, len(order)):
            i, j = order[a_idx], order[b_idx]
            # i is ranked above j, so it should beat j on more columns.
            i_better = sum(1 for c in range(len(matrix[0]))
                           if matrix[i][c] > matrix[j][c])
            j_better = sum(1 for c in range(len(matrix[0]))
                           if matrix[j][c] > matrix[i][c])
            if j_better > i_better:
                violations.append({
                    "ranked_higher": row_labels[i], "ranked_lower": row_labels[j],
                    "cols_won_by_higher": i_better, "cols_won_by_lower": j_better,
                })
    total_pairs = len(order) * (len(order) - 1) // 2
    return violations, total_pairs


def main() -> None:
    p = argparse.ArgumentParser(description="Cross-play matrix + empirical Nash")
    p.add_argument("--run-dir", help="run dir with ghosts/ and *_best.zip")
    p.add_argument("--ghosts", help="a ghost pool directory")
    p.add_argument("--stride", type=int, default=5,
                   help="take every Nth ghost (the matrix is quadratic)")
    p.add_argument("--episodes", type=int, default=30, help="episodes per cell")
    p.add_argument("--scripted", action="store_true", default=True,
                   help="include the scripted baselines as anchors")
    p.add_argument("--no-scripted", dest="scripted", action="store_false")
    p.add_argument("--seed", type=int, default=4242)
    p.add_argument("--out", help="JSON report path")
    args = p.parse_args()

    if not (args.run_dir or args.ghosts):
        raise SystemExit("provide --run-dir or --ghosts")

    agents = collect_agents(args)
    if not agents["attacker"] or not agents["defender"]:
        raise SystemExit(f"no agents found: {[(k, len(v)) for k, v in agents.items()]}")

    n_a, n_d = len(agents["attacker"]), len(agents["defender"])
    print(f"  Cross-play: {n_a} attackers × {n_d} defenders × "
          f"{args.episodes} eps = {n_a * n_d * args.episodes:,} episodes\n")

    from evaluator import MARLEvaluator
    tmp = tempfile.mkdtemp()
    matrix, row_labels = [], []
    try:
        ev = MARLEvaluator(save_dir=tmp)
        col_labels = [lbl for lbl, _ in agents["defender"]]
        loaded_def = [(lbl, load_agent(path)) for lbl, path in agents["defender"]]

        for i, (att_label, att_path) in enumerate(agents["attacker"], 1):
            att = load_agent(att_path)
            row = []
            for def_label, dfd in loaded_def:
                res = ev._run_match(att, dfd, args.episodes,
                                    curriculum_level=2, label="crossplay",
                                    seed=args.seed)
                row.append(round(res["att_win_rate"], 3))
            matrix.append(row)
            row_labels.append(att_label)
            print(f"  [{i}/{n_a}] {att_label:20s} mean att win "
                  f"{sum(row)/len(row):.3f}", flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    att_strategy, def_strategy, value = solve_zero_sum(matrix)
    violations, total_pairs = transitivity_violations(matrix, row_labels, col_labels)

    def support(labels, strategy, floor=0.01):
        return {l: round(w, 3) for l, w in zip(labels, strategy) if w > floor}

    report = {
        "row_labels": row_labels, "col_labels": col_labels,
        "matrix": matrix, "episodes_per_cell": args.episodes,
        "nash": {
            "value_att_win_rate": round(value, 4),
            "attacker_support": support(row_labels, att_strategy),
            "defender_support": support(col_labels, def_strategy),
        },
        "transitivity": {
            "violations": len(violations),
            "pairs_compared": total_pairs,
            "violation_rate": round(len(violations) / total_pairs, 3) if total_pairs else 0.0,
            "examples": violations[:10],
        },
        "note": ("Cross-play over archived checkpoints. A Nash support wider "
                 "than one agent, or a non-zero violation rate, means the "
                 "population is non-transitive and Elo alone is misleading."),
    }

    print(f"\n  Empirical Nash: attacker wins {value:.3f} at equilibrium")
    print(f"    attacker support ({len(report['nash']['attacker_support'])}): "
          f"{report['nash']['attacker_support']}")
    print(f"    defender support ({len(report['nash']['defender_support'])}): "
          f"{report['nash']['defender_support']}")
    print(f"  Transitivity violations: {len(violations)}/{total_pairs} "
          f"({report['transitivity']['violation_rate']:.0%})")
    if len(report["nash"]["attacker_support"]) > 1:
        print("    Nash mixes several attackers → non-transitive population; "
              "a single 'best' checkpoint is not well defined here.")

    out = args.out or (os.path.join(args.run_dir, "crossplay_report.json")
                       if args.run_dir else "crossplay_report.json")
    with open(out, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved → {out}\n")


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
