"""
stats_util.py  –  Honest aggregation for multi-seed CyberX results
===================================================================
Small, dependency-light (numpy only) statistics for reporting results across
seeds. Replaces the previous `statistics.pstdev` (population std) aggregation,
which both used the wrong estimator for a sample of runs and reported a single
number with no uncertainty.

What a reviewer wants for a handful of seeds (Agarwal et al., "Deep RL at the
Edge of the Statistical Precipice", NeurIPS 2021):
  • the interquartile mean (IQM) — a robust central estimate that ignores the
    top/bottom 25% of runs, so one lucky/unlucky seed doesn't dominate;
  • a bootstrap confidence interval, not just ± std;
  • sample std / SEM alongside, for the reader who wants them.

We hand-roll the bootstrap (rliable is not a dependency) so this stays runnable
from the committed environment with nothing extra to install.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence

import numpy as np


def _clean(values: Sequence[Optional[float]]) -> np.ndarray:
    return np.array([float(v) for v in values if v is not None], dtype=np.float64)


def iqm(values: Sequence[Optional[float]]) -> Optional[float]:
    """Interquartile mean: mean of the middle 50% of the data. Falls back to
    the plain mean when there are too few points to trim."""
    a = np.sort(_clean(values))
    n = a.size
    if n == 0:
        return None
    if n < 4:
        return float(a.mean())
    lo = int(np.floor(n * 0.25))
    hi = int(np.ceil(n * 0.75))
    mid = a[lo:hi]
    return float(mid.mean()) if mid.size else float(a.mean())


def bootstrap_ci(
    values: Sequence[Optional[float]],
    n_boot: int = 10_000,
    ci: float = 0.95,
    statistic: str = "iqm",
    seed: int = 0,
) -> Dict[str, Optional[float]]:
    """Percentile bootstrap CI for the IQM (or mean) of `values`.

    Returns {low, high}. With a single data point the CI collapses to that
    point; with none, both are None. Deterministic for a fixed seed."""
    a = _clean(values)
    if a.size == 0:
        return {"low": None, "high": None}
    if a.size == 1:
        return {"low": float(a[0]), "high": float(a[0])}
    stat_fn = iqm if statistic == "iqm" else (lambda x: float(np.mean(_clean(x))))
    rng = np.random.default_rng(seed)
    boots = np.empty(n_boot, dtype=np.float64)
    for i in range(n_boot):
        sample = rng.choice(a, size=a.size, replace=True)
        boots[i] = stat_fn(sample)
    alpha = (1.0 - ci) / 2.0
    return {
        "low":  round(float(np.quantile(boots, alpha)), 4),
        "high": round(float(np.quantile(boots, 1.0 - alpha)), 4),
    }


def aggregate(values: Sequence[Optional[float]], ci: float = 0.95) -> Dict[str, Optional[float]]:
    """Full summary for a set of per-seed values: n, mean, iqm, sample std,
    SEM, and a bootstrap CI on the IQM. `std` is the SAMPLE std (ddof=1), not
    the population std."""
    a = _clean(values)
    n = int(a.size)
    if n == 0:
        return {"n": 0, "mean": None, "iqm": None, "std": None, "sem": None,
                "ci_low": None, "ci_high": None}
    mean = float(a.mean())
    std = float(a.std(ddof=1)) if n > 1 else 0.0
    sem = float(std / np.sqrt(n)) if n > 1 else 0.0
    interval = bootstrap_ci(a, ci=ci)
    return {
        "n":       n,
        "mean":    round(mean, 4),
        "iqm":     round(iqm(a), 4) if iqm(a) is not None else None,
        "std":     round(std, 4),
        "sem":     round(sem, 4),
        "ci_low":  interval["low"],
        "ci_high": interval["high"],
    }


def format_pm(agg: Dict[str, Optional[float]], places: int = 3) -> str:
    """'0.360 [0.31, 0.41]' style summary for logs/tables."""
    if agg.get("mean") is None:
        return "n/a"
    m = f"{agg['mean']:.{places}f}"
    if agg.get("ci_low") is not None and agg.get("n", 0) > 1:
        return f"{m}  IQM {agg['iqm']:.{places}f} [{agg['ci_low']:.{places}f}, {agg['ci_high']:.{places}f}] (n={agg['n']})"
    return f"{m} (n={agg['n']})"
