#!/usr/bin/env python3
"""
red_team/calibrate.py  –  Ground the simulator's numbers in real honeypot data
===============================================================================
The simulator (shared_honeypot_env.py) ships with hand-set attacker success
probabilities — p_brute_base / p_brute_decay / p_brute_min etc. This harness
estimates the ones a Cowrie honeypot can actually *observe* from real login
telemetry and emits them as ready-to-apply config overrides, so the reward
ablations and the headline runs can be grounded in evidence instead of a guess.

What Cowrie can ground (and this tool estimates):
  • Brute-force login dynamics. Cowrie logs cowrie.login.failed /
    cowrie.login.success per session. The env models a brute-force attempt as
    succeeding with p(k) = max(p_brute_min, p_brute_base - k·p_brute_decay),
    where k is the number of prior failures in the session. We reconstruct the
    per-attempt success curve from the telemetry and fit exactly that model:
      - p_brute_base  = success rate on the first attempt (k = 0),
      - p_brute_decay = -slope of success-rate vs k (least squares),
      - p_brute_min   = floor of the observed curve.
    Each estimate is reported with its sample size and a Wilson 95% interval,
    and is only emitted as an override when there is enough data to support it;
    otherwise the env default is kept and the field is marked NOT grounded.

What Cowrie CANNOT ground (reported as context, never auto-applied):
  • p_exploit_* / p_escalate_* — a honeypot has no ground-truth "did the
    exploit/escalation succeed" outcome, only that the command was typed. We
    report the observed *rates* of those command classes as context so a human
    can judge them, but we do not fabricate probabilities from them.

Honesty (mirrors PROJECT_CONTEXT.md §15): this is a small-n grounding estimate
from one operator's honeypot, not a calibrated system identification. The CIs
are wide on purpose — they are the point.

Inputs (pick one):
  --events PATH    JSON list of ES `_source` objects, or {"hits":{"hits":[...]}}
  --session PATH   a red_team.honeypot session log (its commands are replayed
                   into telemetry; note a playbook run has few login events)
  --es-url URL     query a live Elasticsearch (honeypot-*) directly
  --synthetic N    generate N synthetic login events (runnable scaffold/demo)

Usage (run from src/server/rl):
  python -m red_team.calibrate --synthetic 600 --out calibration.json
  python -m red_team.calibrate --events window.json --out calibration.json
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Minimum evidence before an estimate is trusted enough to emit as an override.
_MIN_ATTEMPTS_BASE = 20     # first-attempt (k=0) sample needed to trust p_base
_MIN_PER_BUCKET    = 8      # attempts in a k-bucket for it to enter the decay fit
_MIN_BUCKETS_DECAY = 3      # populated k-buckets needed to fit a decay slope

# RewardConfig fields this tool is allowed to ground (must be real fields;
# validated against RewardConfig at emit time via config_loader semantics).
_GROUNDABLE = ("p_brute_base", "p_brute_decay", "p_brute_min")


# ── Statistics ────────────────────────────────────────────────────────────────

def wilson_ci(successes: int, n: int, z: float = 1.96) -> Tuple[float, float]:
    """Wilson score interval for a binomial proportion — well-behaved at the
    small n and extreme rates a honeypot window produces (unlike normal-approx,
    which can leave [0,1])."""
    if n <= 0:
        return (0.0, 1.0)
    phat = successes / n
    denom = 1.0 + z * z / n
    center = (phat + z * z / (2 * n)) / denom
    margin = (z * math.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n))) / denom
    return (round(max(0.0, center - margin), 4), round(min(1.0, center + margin), 4))


def _ols_slope(xs: List[float], ys: List[float]) -> Optional[float]:
    """Least-squares slope of y vs x; None if degenerate."""
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx <= 1e-12:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / sxx


# ── Event loading ───────────────────────────────────────────────────────────

def _synthetic_login_events(n: int) -> List[dict]:
    """Synthetic brute-force telemetry with a KNOWN decaying success curve, so
    the harness has a runnable scaffold and its recovery can be sanity-checked.
    Clearly synthetic; the report flags it."""
    rng = random.Random(11)
    true_base, true_decay, true_min = 0.28, 0.02, 0.08
    out: List[dict] = []
    sess_id = 0
    i = 0
    while i < n:
        sess = f"s{sess_id}"; sess_id += 1
        ip = f"185.220.10.{rng.randint(1, 40)}"
        k = 0
        while i < n:
            p = max(true_min, true_base - k * true_decay)
            success = rng.random() < p
            eid = "cowrie.login.success" if success else "cowrie.login.failed"
            out.append({"_source": {
                "eventid": eid, "src_ip": ip, "session": sess,
                "@timestamp": f"2026-09-13T00:{i // 60:02d}:{i % 60:02d}Z",
            }})
            i += 1
            if success or k >= 25:
                break
            k += 1
    return out


def load_events(args) -> Tuple[List[dict], str]:
    """Return (hits, source_label). hits are ES-style {"_source": {...}}."""
    if args.synthetic:
        return _synthetic_login_events(args.synthetic), f"synthetic({args.synthetic})"
    if args.events:
        with open(args.events) as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            hits = raw.get("hits", {}).get("hits", raw.get("events", []))
        else:
            hits = raw
        # accept either wrapped hits or bare _source dicts
        hits = [h if "_source" in h else {"_source": h} for h in hits]
        return hits, f"events:{os.path.basename(args.events)}"
    if args.session:
        return _events_from_session(args.session), f"session:{os.path.basename(args.session)}"
    if args.es_url:
        from telemetry_adapter import TelemetryAdapter
        hits = TelemetryAdapter(es_url=args.es_url, window=args.window).fetch_events()
        return hits, f"es:{args.es_url}"
    raise SystemExit("provide --events, --session, --es-url, or --synthetic")


def _events_from_session(path: str) -> List[dict]:
    """Turn a red_team.honeypot session log's commands into ES-style command
    events (so contextual command-class rates can be computed). A playbook run
    has essentially no login events, so brute-force grounding will be marked
    insufficient — that's correct, not a bug."""
    with open(path) as f:
        session = json.load(f)
    hits: List[dict] = []
    host = (session.get("target") or {}).get("host", "127.0.0.1")
    for si, step in enumerate(session.get("labeled_steps", [])):
        for cmd in step.get("commands", []):
            hits.append({"_source": {
                "eventid": "cowrie.command.input", "input": cmd,
                "src_ip": host, "session": "playbook",
                "@timestamp": step.get("at", f"step{si}"),
            }})
    return hits


# ── Brute-force curve reconstruction ──────────────────────────────────────────

def brute_force_curve(hits: List[dict]) -> Dict[str, Any]:
    """Reconstruct the per-attempt brute-force success curve from login events.

    Groups login events by session, orders them, and for each attempt records
    (k = prior failures in that session, outcome). Counting stops at a session's
    first success — the env models 'attempts until breach', not post-breach
    re-auth. Sessions that never succeed contribute failures at rising k.
    """
    sessions: Dict[str, List[Tuple[Any, int, str]]] = defaultdict(list)
    for idx, hit in enumerate(hits):
        s = hit.get("_source", {})
        eid = s.get("eventid", "")
        if "login.failed" in eid:
            outcome = "failed"
        elif "login.success" in eid:
            outcome = "success"
        else:
            continue
        sessions[s.get("session") or f"_anon{idx}"].append(
            (s.get("@timestamp"), idx, outcome))

    bucket_succ: Dict[int, int] = defaultdict(int)
    bucket_tot:  Dict[int, int] = defaultdict(int)
    fails_before_success: List[int] = []
    total_succ = total_att = 0

    for evs in sessions.values():
        # order by timestamp when present, else by original position
        evs.sort(key=lambda e: (e[0] if e[0] is not None else "", e[1]))
        k = 0
        for _, _, outcome in evs:
            bucket_tot[k] += 1
            total_att += 1
            if outcome == "success":
                bucket_succ[k] += 1
                total_succ += 1
                fails_before_success.append(k)
                break                      # attempts-until-breach
            k += 1

    return {
        "n_sessions_with_logins": len(sessions),
        "total_attempts":         total_att,
        "total_successes":        total_succ,
        "bucket_succ":            dict(bucket_succ),
        "bucket_tot":             dict(bucket_tot),
        "fails_before_success":   fails_before_success,
    }


def estimate_brute_params(curve: Dict[str, Any], env_defaults: Dict[str, float]
                          ) -> Dict[str, Any]:
    """Fit p(k) = max(p_min, p_base - k·decay) to the reconstructed curve.
    Emits an override only where the data supports it; otherwise keeps the env
    default and records why."""
    bucket_succ = curve["bucket_succ"]
    bucket_tot  = curve["bucket_tot"]
    total_att   = curve["total_attempts"]
    total_succ  = curve["total_successes"]

    est: Dict[str, Any] = {"overrides": {}, "detail": {}, "not_grounded": {}}

    # overall mean per-attempt success (context)
    est["detail"]["mean_success_rate"] = (
        round(total_succ / total_att, 4) if total_att else None)
    est["detail"]["mean_success_ci95"] = wilson_ci(total_succ, total_att)

    # p_brute_base — first-attempt (k=0) success rate
    n0 = bucket_tot.get(0, 0)
    s0 = bucket_succ.get(0, 0)
    if n0 >= _MIN_ATTEMPTS_BASE:
        base = round(s0 / n0, 4)
        est["overrides"]["p_brute_base"] = base
        est["detail"]["p_brute_base"] = {
            "value": base, "n": n0, "ci95": wilson_ci(s0, n0)}
    else:
        est["not_grounded"]["p_brute_base"] = (
            f"only {n0} first-attempt logins (< {_MIN_ATTEMPTS_BASE}); "
            f"kept env default {env_defaults['p_brute_base']}")

    # p_brute_decay — slope of success rate vs prior-failure count
    ks = sorted(k for k in bucket_tot if bucket_tot[k] >= _MIN_PER_BUCKET)
    if len(ks) >= _MIN_BUCKETS_DECAY:
        rates = [bucket_succ.get(k, 0) / bucket_tot[k] for k in ks]
        slope = _ols_slope([float(k) for k in ks], rates)
        if slope is not None:
            decay = round(max(0.0, -slope), 4)
            est["overrides"]["p_brute_decay"] = decay
            est["detail"]["p_brute_decay"] = {
                "value": decay, "buckets_used": ks,
                "rates": [round(r, 3) for r in rates]}
        else:
            est["not_grounded"]["p_brute_decay"] = "degenerate fit; kept default"
    else:
        est["not_grounded"]["p_brute_decay"] = (
            f"only {len(ks)} usable k-buckets (< {_MIN_BUCKETS_DECAY}); "
            f"kept env default {env_defaults['p_brute_decay']}")

    # p_brute_min — floor of the observed curve. Only emitted if a decay was fit
    # AND the tail settles at a POSITIVE rate below the default floor. A zero
    # observation from a sparse tail bucket is treated as noise (it would make
    # brute-force impossible in the env), not as evidence the floor is 0.
    if "p_brute_decay" in est["overrides"] and ks:
        tail_rates = [bucket_succ.get(k, 0) / bucket_tot[k] for k in ks]
        observed_floor = round(min(tail_rates), 4)
        if observed_floor <= 0.0:
            est["not_grounded"]["p_brute_min"] = (
                "lowest observed bucket rate is 0 (sparse tail); treated as "
                f"noise, kept env default {env_defaults['p_brute_min']}")
        elif observed_floor < env_defaults["p_brute_min"]:
            est["overrides"]["p_brute_min"] = observed_floor
            est["detail"]["p_brute_min"] = {"value": observed_floor}
        else:
            est["not_grounded"]["p_brute_min"] = (
                f"observed floor {observed_floor} ≥ default "
                f"{env_defaults['p_brute_min']}; kept default")
    else:
        est["not_grounded"]["p_brute_min"] = "no decay fit; kept default"

    # keep base ≥ min consistency if both were grounded
    if ("p_brute_base" in est["overrides"] and "p_brute_min" in est["overrides"]
            and est["overrides"]["p_brute_min"] > est["overrides"]["p_brute_base"]):
        est["overrides"]["p_brute_min"] = est["overrides"]["p_brute_base"]

    return est


# ── Contextual (not-grounded) command-class rates ─────────────────────────────

def command_context(hits: List[dict]) -> Dict[str, Any]:
    """Observed rates of command classes — reported for human judgement only.
    A honeypot cannot tell us whether an exploit/escalation *succeeded*, so
    these never become p_exploit_*/p_escalate_* overrides."""
    from telemetry_adapter import TelemetryAdapter
    summ = TelemetryAdapter.summarize(hits)
    n_sessions = max(summ["n_sessions"], 1)
    return {
        "note": ("Observed command-class rates. Context only — a honeypot has "
                 "no ground-truth success outcome for exploit/escalation, so "
                 "these are NOT converted into env probabilities."),
        "n_sessions": summ["n_sessions"],
        "n_src_ips":  summ["n_src_ips"],
        "suspicious_command_events": summ["suspicious_commands"],
        "priv_esc_command_events":   summ["priv_esc_attempts"],
        "download_events":           summ["downloads"],
        "any_scan_observed":         bool(summ["port_scan"]),
        "priv_esc_sessions_fraction": round(
            min(summ["priv_esc_attempts"], n_sessions) / n_sessions, 3),
    }


def _env_brute_defaults() -> Dict[str, float]:
    from dataclasses import fields
    from shared_honeypot_env import RewardConfig
    # Guard: every field we claim to ground must be a real RewardConfig field,
    # so the suggested_reward_overrides block always survives config_loader's
    # validation (get_reward_overrides raises on an unknown key).
    valid = {f.name for f in fields(RewardConfig)}
    unknown = [k for k in _GROUNDABLE if k not in valid]
    if unknown:
        raise SystemExit(f"calibrate: not RewardConfig fields: {unknown}")
    rc = RewardConfig()
    return {k: getattr(rc, k) for k in _GROUNDABLE}


def main() -> None:
    p = argparse.ArgumentParser(description="Calibrate env params from honeypot telemetry")
    src = p.add_argument_group("input (choose one)")
    src.add_argument("--events", help="JSON of recorded ES events")
    src.add_argument("--session", help="a red_team.honeypot session log")
    src.add_argument("--es-url", help="query a live Elasticsearch")
    src.add_argument("--window", default="now-24h", help="ES time window (with --es-url)")
    src.add_argument("--synthetic", type=int, default=0,
                     help="generate N synthetic login events (scaffold)")
    p.add_argument("--out", help="write calibration.json here")
    args = p.parse_args()

    hits, source = load_events(args)
    if not hits:
        raise SystemExit("no events to calibrate from")

    env_defaults = _env_brute_defaults()
    curve = brute_force_curve(hits)
    brute = estimate_brute_params(curve, env_defaults)
    context = command_context(hits)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source":       source,
        "synthetic":    bool(args.synthetic),
        "n_events":     len(hits),
        "env_defaults": env_defaults,
        "brute_force":  {**{k: v for k, v in curve.items()
                            if k not in ("bucket_succ", "bucket_tot")},
                         "estimates": brute["detail"],
                         "not_grounded": brute["not_grounded"]},
        "command_context": context,
        # The paste-ready block for config.json's "rewards" section. Empty when
        # nothing was grounded — an honest empty result, not a fabricated one.
        "suggested_reward_overrides": brute["overrides"],
        "note": ("Grounding estimate from one honeypot's telemetry, not a "
                 "calibrated system identification. CIs are wide by design. "
                 "Apply by pasting suggested_reward_overrides into config.json "
                 "[rewards]; config.json stays the immutable experiment record."),
    }

    # ── Print summary ──────────────────────────────────────────────────────────
    print(f"\n  Calibration source: {source}   events={len(hits)}")
    bf = report["brute_force"]
    print(f"  Brute-force: {bf['total_successes']}/{bf['total_attempts']} attempts "
          f"succeeded over {bf['n_sessions_with_logins']} sessions")
    md = brute["detail"].get("mean_success_rate")
    if md is not None:
        print(f"  Mean per-attempt success: {md}  CI95 {brute['detail']['mean_success_ci95']}")
    if brute["overrides"]:
        print("\n  Grounded overrides (paste into config.json [rewards]):")
        for k, v in brute["overrides"].items():
            print(f"    \"{k}\": {v},")
    else:
        print("\n  No parameter had enough data to ground — env defaults kept.")
    if brute["not_grounded"]:
        print("\n  Not grounded:")
        for k, why in brute["not_grounded"].items():
            print(f"    {k}: {why}")
    print()

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"  Calibration report → {args.out}\n")


if __name__ == "__main__":
    main()
