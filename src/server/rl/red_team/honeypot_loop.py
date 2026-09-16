#!/usr/bin/env python3
"""
red_team/honeypot_loop.py  -  One-command sim->real honeypot loop (single machine)
==================================================================================
Chains the sim->real evidence pipeline that is otherwise four manual steps:

  1. red-team driver  - run the ATT&CK playbook against the LOCAL Cowrie honeypot,
     generating real, self-labeled Cowrie->Logstash->Elasticsearch telemetry.
  2. (wait for Logstash to ingest)
  3. shadow_eval      - replay the REAL telemetry window through the trained
     defender (+ the frozen/unsegmented baseline), baked to the dashboard.
  4. calibrate        - ground the env brute-force params in the real login
     telemetry (Wilson CIs + a paste-ready config-override block).

Requires the honeypot stack up - ONLY these three services, NOT the full stack
(whose bundled Ollama publishes 11434 and would collide with a host Ollama):
  docker compose -f docker/docker-compose.honeypot.yml up -d elasticsearch logstash cowrie

Usage (from src/server/rl):
  python -m red_team.honeypot_loop --dry-run       # print the plan, run nothing
  python -m red_team.honeypot_loop                 # run the whole loop
  python -m red_team.honeypot_loop --skip-attack   # telemetry already generated

Safety: the attack step targets loopback/private only (red_team.honeypot enforces
it and refuses any public host); --dry-run executes nothing.
"""
from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from red_team.honeypot import _is_local_target, es_event_count

_RL_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REPO_ROOT  = os.path.abspath(os.path.join(_RL_DIR, "..", "..", ".."))
_PUBLIC_DIR = os.path.join(_REPO_ROOT, "public", "rl-artifacts")


def _run(cmd: list, dry: bool) -> int:
    print(f"\n$ {' '.join(cmd)}", flush=True)
    return 0 if dry else subprocess.call(cmd, cwd=_RL_DIR)


def _es_ready(es_url: str, timeout: int = 5) -> bool:
    import requests
    try:
        r = requests.get(f"{es_url}/_cluster/health", timeout=timeout)
        return r.status_code == 200 and r.json().get("status") in ("green", "yellow")
    except Exception:
        return False


def _port_open(host: str, port: int, timeout: float = 3.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def main() -> None:
    p = argparse.ArgumentParser(description="One-command sim->real honeypot loop")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=2222)
    p.add_argument("--es-url", default="http://localhost:9200")
    p.add_argument("--window", default="now-1h", help="shadow/calibration ES window")
    p.add_argument("--ingest-wait", type=float, default=6.0,
                   help="seconds to let Logstash ingest before reading ES")
    p.add_argument("--skip-attack", action="store_true",
                   help="telemetry already generated; just shadow-eval + calibrate")
    p.add_argument("--out-dir", default=_PUBLIC_DIR,
                   help="where shadow_eval.json is baked (default: public/rl-artifacts)")
    p.add_argument("--dry-run", action="store_true", help="print the plan, run nothing")
    args = p.parse_args()

    py         = sys.executable
    shadow_out = os.path.join(args.out_dir, "shadow_eval.json")
    calib_out  = os.path.join(_RL_DIR, "calibration.json")
    session    = os.path.join(_RL_DIR, "red_team_honeypot_session.json")

    print("=" * 70)
    print("  SIM->REAL HONEYPOT LOOP")
    print(f"  target={args.host}:{args.port}  es={args.es_url}  window={args.window}")
    print(f"  attack={'skip' if args.skip_attack else 'run'}  dry_run={args.dry_run}")
    print("=" * 70)

    # Safety + readiness (skipped in dry-run so the plan prints on any machine).
    if not args.dry_run:
        if not _is_local_target(args.host):
            sys.exit(f"  REFUSED: {args.host} is not loopback/private - own honeypot only.")
        if not _es_ready(args.es_url):
            sys.exit(f"  Elasticsearch not ready at {args.es_url}. Start the stack:\n"
                     f"    docker compose -f docker/docker-compose.honeypot.yml up -d "
                     f"elasticsearch logstash cowrie")
        if not args.skip_attack and not _port_open(args.host, args.port):
            sys.exit(f"  Cowrie not reachable at {args.host}:{args.port} - is the "
                     f"cowrie container up?")

    # 1. red-team driver -> real self-labeled telemetry ------------------------
    if not args.skip_attack:
        before = None if args.dry_run else es_event_count(args.es_url)
        rc = _run([py, "-m", "red_team.honeypot", "--host", args.host,
                   "--port", str(args.port), "--es-url", args.es_url,
                   "--out", session], args.dry_run)
        if rc != 0 and not args.dry_run:
            print(f"  WARNING: red-team driver exited rc={rc}; continuing")
        # 2. let Logstash ingest
        if not args.dry_run:
            print(f"  waiting {args.ingest_wait}s for Logstash to ingest...")
            time.sleep(args.ingest_wait)
            after = es_event_count(args.es_url)
            print(f"  ES honeypot-* count: {before} -> {after}")
            if after is not None and before is not None and after <= before:
                print("  NOTE: event count did not rise - check Logstash ingest "
                      "before trusting the shadow/calibration numbers.")

    # 3. shadow-eval on the REAL window (+ frozen baseline), baked for the dashboard
    _run([py, "shadow_eval.py", "--es-url", args.es_url, "--window", args.window,
          "--baseline", "--out", shadow_out], args.dry_run)

    # 4. calibrate env brute-force params from the real login telemetry ---------
    _run([py, "-m", "red_team.calibrate", "--es-url", args.es_url,
          "--window", args.window, "--out", calib_out], args.dry_run)

    print("\n" + "=" * 70)
    print("  DONE.")
    print(f"    shadow_eval  -> {shadow_out}")
    print("                    (RL Arena SHADOW-MODE card; refresh the manifest with")
    print("                     python export_artifacts.py --run <run>)")
    print(f"    calibration  -> {calib_out}")
    print("                    (paste suggested_reward_overrides into config.json to")
    print("                     ground the env, then retrain)")
    print("=" * 70)


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
