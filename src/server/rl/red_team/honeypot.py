#!/usr/bin/env python3
"""
red_team/honeypot.py  –  Autonomous red-team driver for the LOCAL Cowrie honeypot
==================================================================================
Runs the ATT&CK playbook (playbook.py) against the user's OWN local Cowrie SSH
honeypot to generate real Cowrie→Logstash→Elasticsearch telemetry. Because the
red-team agent chose every TTP, the resulting events are SELF-LABELED — the
ground-truth attacker intent that shadow_eval.py never had (its data is
synthetic). This is what turns the sim→real bridge from a demo into evidence.

SAFETY (this drives attack traffic, so the guardrails are hard):
  • Target is restricted to loopback / RFC1918 private addresses — the honeypot
    the user runs on their own machine. Public IPs and public-resolving
    hostnames are refused outright.
  • --dry-run prints the exact playbook and connection target and executes
    NOTHING. Always dry-run first.
  • No credentials are entered anywhere real; Cowrie accepts throwaway logins by
    design. Do not point this at anything that is not your own honeypot.

Requires paramiko (optional): pip install paramiko. The in-sim probe
(red_team.probe) does NOT need it.

Usage:
  python -m red_team.honeypot --dry-run
  python -m red_team.honeypot --host 127.0.0.1 --port 2222 --out session.json
Run from src/server/rl.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import socket
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from red_team.playbook import ATT_CK_MAP, DEFAULT_HONEYPOT_ORDER, HONEYPOT_TTPS

# Kill-chain phase each TTP belongs to — the label shadow_eval can key off.
_TTP_PHASE = {
    "passive_recon": "recon", "active_scan": "recon",
    "exploit_service": "foothold",
    "escalate_privilege": "privileged", "dump_credentials": "privileged",
    "collect_data": "objective", "exfiltrate": "objective",
    "defense_evasion": "evasion",
}


def _is_local_target(host: str) -> bool:
    """Only loopback or RFC1918/link-local private addresses are allowed —
    the honeypot the user runs themselves. Anything public is refused."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr.split("%")[0])
        except ValueError:
            return False
        if not (ip.is_loopback or ip.is_private or ip.is_link_local):
            return False
    return True


def build_plan(order: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    order = order or DEFAULT_HONEYPOT_ORDER
    plan = []
    for ttp in order:
        if ttp not in HONEYPOT_TTPS:
            continue
        info = ATT_CK_MAP.get(ttp, {})
        plan.append({
            "ttp":          ttp,
            "phase":        _TTP_PHASE.get(ttp, "—"),
            "technique_id": info.get("technique_id", "—"),
            "technique":    info.get("technique", ttp),
            "commands":     HONEYPOT_TTPS[ttp],
        })
    return plan


def print_plan(host: str, port: int, plan: List[Dict[str, Any]]) -> None:
    print(f"\n  Red-team playbook against {host}:{port} (Cowrie SSH honeypot)\n")
    for step in plan:
        print(f"  [{step['phase']:<10}] {step['ttp']:<20} {step['technique_id']}")
        for cmd in step["commands"]:
            print(f"       $ {cmd}")
    print()


def es_event_count(es_url: str) -> Optional[int]:
    import requests
    try:
        r = requests.get(f"{es_url}/honeypot-*/_count", timeout=5)
        if r.status_code == 200:
            return r.json().get("count")
    except Exception:
        return None
    return None


def run_against_cowrie(
    host: str, port: int, username: str, password: str,
    plan: List[Dict[str, Any]], settle: float = 0.4,
) -> List[Dict[str, Any]]:
    """Open one SSH session to Cowrie and run each TTP's commands, recording
    output. Returns the executed, self-labeled steps."""
    try:
        import paramiko
    except ImportError:
        sys.exit("  paramiko not installed — run: pip install paramiko "
                 "(only the honeypot driver needs it; the in-sim probe does not)")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    executed: List[Dict[str, Any]] = []
    try:
        client.connect(host, port=port, username=username, password=password,
                       timeout=15, allow_agent=False, look_for_keys=False)
        for step in plan:
            outputs = []
            for cmd in step["commands"]:
                try:
                    _stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
                    out = stdout.read().decode(errors="replace")
                    err = stderr.read().decode(errors="replace")
                    outputs.append({"cmd": cmd, "stdout": out[:400], "stderr": err[:200]})
                except Exception as exc:  # Cowrie may drop some commands
                    outputs.append({"cmd": cmd, "error": str(exc)})
                time.sleep(settle)
            executed.append({**step, "outputs": outputs,
                             "at": datetime.now(timezone.utc).isoformat()})
    finally:
        client.close()
    return executed


def main():
    p = argparse.ArgumentParser(description="Autonomous red-team vs LOCAL Cowrie honeypot")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=2222)
    p.add_argument("--username", default="root")
    p.add_argument("--password", default="123456",
                   help="Cowrie accepts throwaway logins; this is not a real credential")
    p.add_argument("--es-url", default="http://localhost:9200")
    p.add_argument("--dry-run", action="store_true",
                   help="Print the playbook and target, execute nothing")
    p.add_argument("--out", default="red_team_honeypot_session.json")
    args = p.parse_args()

    plan = build_plan()
    print_plan(args.host, args.port, plan)

    if args.dry_run:
        print("  DRY RUN — nothing executed.\n")
        return

    if not _is_local_target(args.host):
        sys.exit(f"  REFUSED: {args.host} is not a loopback/private target. This "
                 f"tool only attacks your own local honeypot.")

    before = es_event_count(args.es_url)
    print(f"  ES honeypot-* count before: {before}")
    executed = run_against_cowrie(args.host, args.port, args.username, args.password, plan)
    time.sleep(3.0)  # let Logstash ingest
    after = es_event_count(args.es_url)
    print(f"  ES honeypot-* count after:  {after}")

    session = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target":       {"host": args.host, "port": args.port},
        "es_count_before": before, "es_count_after": after,
        "labeled_steps": executed,
        "note": "Self-labeled red-team session against the user's OWN local "
                "Cowrie honeypot. Each step's `phase`/`technique_id` is the "
                "ground-truth attacker intent for shadow-mode evaluation.",
    }
    with open(args.out, "w") as f:
        json.dump(session, f, indent=2, default=str)
    print(f"\n  Session log → {args.out}\n")


if __name__ == "__main__":
    main()
