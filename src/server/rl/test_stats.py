#!/usr/bin/env python3
"""
test_stats.py  –  Self-tests for the cross-seed aggregation + provenance helpers.
Plain asserts, no pytest (matches tests_rl.py). Fast (numpy only) — safe to run
in CI without the heavy RL stack. `python test_stats.py` → exit 0 on success.
"""
import sys

from stats_util import aggregate, bootstrap_ci, iqm

FAILED = []


def check(name, cond):
    if cond:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}")
        FAILED.append(name)


def main():
    # IQM trims the tails; a single outlier must not drag it like the mean does.
    vals = [0.50, 0.51, 0.49, 0.52, 5.0]
    check("iqm_ignores_outlier", iqm(vals) < 1.0 < (sum(vals) / len(vals)))
    check("iqm_small_n_is_mean", abs(iqm([0.4, 0.6]) - 0.5) < 1e-9)
    check("iqm_empty_is_none", iqm([]) is None)

    # aggregate: sample std (ddof=1) not population std; bootstrap CI brackets mean.
    a = aggregate([0.407, 0.28, 0.447, 0.346, 0.313])
    check("aggregate_n", a["n"] == 5)
    check("aggregate_mean", abs(a["mean"] - 0.3586) < 1e-3)
    check("aggregate_sample_std", abs(a["std"] - 0.0681) < 1e-3)   # pstdev would be 0.0609
    check("aggregate_ci_brackets_mean",
          a["ci_low"] <= a["mean"] <= a["ci_high"])
    check("aggregate_iqm_present", a["iqm"] is not None)

    # Edge cases.
    check("aggregate_empty", aggregate([])["mean"] is None)
    one = aggregate([0.5])
    check("aggregate_single", one["mean"] == 0.5 and one["std"] == 0.0)
    check("aggregate_drops_none",
          aggregate([0.5, None, 0.7])["n"] == 2)

    # Bootstrap is deterministic for a fixed seed.
    ci1 = bootstrap_ci([0.1, 0.2, 0.3, 0.4], seed=1)
    ci2 = bootstrap_ci([0.1, 0.2, 0.3, 0.4], seed=1)
    check("bootstrap_deterministic", ci1 == ci2)

    # Provenance config hash is stable + order-independent.
    from provenance import config_hash
    check("config_hash_stable",
          config_hash({"a": 1, "b": 2}) == config_hash({"b": 2, "a": 1}))
    check("config_hash_differs",
          config_hash({"a": 1}) != config_hash({"a": 2}))

    print(f"\n  {13 - len(FAILED)} passed, {len(FAILED)} failed\n")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
