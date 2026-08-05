"""
attack_grounding.py  –  Action ↔ MITRE ATT&CK / D3FEND grounding table
=======================================================================
Phase-D grounding (PROJECT_CONTEXT.md §16): every environment action is mapped
to the real-world technique it abstracts, so the sim can be described in the
vocabulary a security venue actually uses.

This module is the single source of truth. `src/data/attackMap.ts` mirrors it
for the frontend and `tests_rl.py` asserts the two agree — a paper table and a
UI label that drift apart is the failure mode this exists to prevent.

Verification status
-------------------
IDs were checked against attack.mitre.org and d3fend.mitre.org (2026-08).
Three entries in the original hand-written frontend map were wrong and are
corrected here:

  * Credential Rotation is **D3-CRO**, not D3-CR.
  * D3FEND has **no "Alerting" technique** — `raise_alert` is an operational
    escalation step with no defensive-technique equivalent, so it maps to None
    rather than to an invented ID.
  * D3FEND has **no "System Restore" technique** — the closest real techniques
    are D3-RDI (Restore Disk Image) and D3-RF (Restore File).

Honesty note for the write-up: these are *abstractions*, not implementations.
The environment models one representative behaviour per technique family; it
does not simulate the sub-techniques. Say so when citing the table.
"""

from typing import Dict, NamedTuple, Optional


class Grounding(NamedTuple):
    action:    str
    technique: Optional[str]   # ATT&CK / D3FEND ID, or None if no equivalent
    name:      Optional[str]   # the official technique name for that ID
    tactic:    str             # ATT&CK tactic, or the SOC function for defenders
    note:      str             # what the env models, and where it abstracts


# ── Attacker: 14 actions → ATT&CK Enterprise ────────────────────────────────
# Index is the action id in shared_honeypot_env.ATT_ACTION_NAMES order.
ATTACKER_GROUNDING = [
    Grounding("passive_recon", "T1592", "Gather Victim Host Information",
              "Reconnaissance",
              "Passive collection; emits little noise in the stealth economy."),
    Grounding("active_scan", "T1595", "Active Scanning",
              "Reconnaissance",
              "Noisy probe — the loud alternative to passive_recon."),
    Grounding("exploit_service", "T1190", "Exploit Public-Facing Application",
              "Initial Access",
              "Success probability is reduced by the defender's patched_level."),
    Grounding("brute_force", "T1110", "Brute Force",
              "Credential Access",
              "Drives the failed_logins signal; the loudest way in."),
    Grounding("phishing", "T1566", "Phishing",
              "Initial Access",
              "Quiet route to a foothold. v4.3 made it decoy-trippable — it was "
              "previously a silent, decoy-proof path (PROJECT_CONTEXT.md §15)."),
    Grounding("establish_persistence", "T1543", "Create or Modify System Process",
              "Persistence",
              "Softens containment knock-back; countered by restore_backup."),
    Grounding("escalate_privilege", "T1068", "Exploitation for Privilege Escalation",
              "Privilege Escalation",
              "RECON/FOOTHOLD → PRIVILEGED transition; credentials boost it."),
    Grounding("dump_credentials", "T1003", "OS Credential Dumping",
              "Credential Access",
              "Sets the credentials flag; countered by rotate_credentials."),
    Grounding("lateral_movement", "T1021", "Remote Services",
              "Lateral Movement",
              "A foothold counter, not a real host graph — the topology "
              "abstraction is the largest gap to real networks."),
    Grounding("defense_evasion", "T1070", "Indicator Removal",
              "Defense Evasion",
              "Clears suspicion; pays only for suspicion actually removed."),
    Grounding("collect_data", "T1074", "Data Staged",
              "Collection",
              "One-time on the data_staged flag, so it cannot be farmed."),
    Grounding("exfiltrate", "T1041", "Exfiltration Over C2 Channel",
              "Exfiltration",
              "An objective win condition at exfil_objective_volume; very loud."),
    Grounding("execute_impact", "T1486", "Data Encrypted for Impact",
              "Impact",
              "The other objective win condition; loudest action in the game."),
    Grounding("wait", None, None,
              "n/a",
              "A no-op for timing/stealth. No ATT&CK equivalent — dwelling is a "
              "property of an intrusion, not a technique."),
]

# ── Defender: 12 actions → D3FEND ───────────────────────────────────────────
# Index is the action id in shared_honeypot_env.DEF_ACTION_NAMES order.
DEFENDER_GROUNDING = [
    Grounding("monitor", "D3-NTA", "Network Traffic Analysis",
              "Detect",
              "Passive evidence trickle, capped by evidence headroom."),
    Grounding("investigate", "D3-NTA", "Network Traffic Analysis",
              "Detect",
              "Converts a fraction of suspicion into hard evidence."),
    Grounding("rate_limit", "D3-ISVA", "Inbound Session Volume Analysis",
              "Isolate",
              "Throttling on session volume. D3FEND models the *analysis*; the "
              "env also models the resulting throttle, so this is a partial fit."),
    Grounding("deploy_decoy", "D3-DE", "Decoy Environment",
              "Deceive",
              "Trips noisy attackers into instant evidence. Capped per episode."),
    Grounding("threat_hunt", "D3-NTA", "Network Traffic Analysis",
              "Detect",
              "Proactive: works on any active breach, not just a noisy one — "
              "the counter to a quiet attacker."),
    Grounding("isolate_host", "D3-NI", "Network Isolation",
              "Isolate",
              "Justified above contain_isolate_evid; consumes that evidence."),
    Grounding("hard_block", "D3-ITF", "Inbound Traffic Filtering",
              "Isolate",
              "Higher evidence bar than isolate_host; knocks back further."),
    Grounding("patch_harden", "D3-AH", "Application Hardening",
              "Harden",
              "Lowers exploit/escalation success; pays only when it increases."),
    Grounding("rotate_credentials", "D3-CRO", "Credential Rotation",
              "Evict",
              "Clears the credential anomaly and the attacker's credentials."),
    Grounding("restore_backup", "D3-RDI", "Restore Disk Image",
              "Restore",
              "Removes persistence and resets the kill chain. D3FEND splits "
              "restore by asset (D3-RF/RC/RD/RDI); the env models one action."),
    Grounding("raise_alert", None, None,
              "Escalate",
              "Escalation to a human responder. D3FEND has no Alerting "
              "technique — this is a SOC process step, not a defensive "
              "technique, and is deliberately left unmapped."),
    Grounding("deception_response", "D3-DE", "Decoy Environment",
              "Deceive",
              "Active engagement to mislead; shares D3-DE with deploy_decoy."),
]


def as_dict() -> Dict[str, list]:
    """Serializable form — used by the artifact export and the paper table."""
    return {
        "attacker": [g._asdict() for g in ATTACKER_GROUNDING],
        "defender": [g._asdict() for g in DEFENDER_GROUNDING],
        "note": ("Actions abstract technique families, not sub-techniques. "
                 "IDs verified against attack.mitre.org / d3fend.mitre.org "
                 "(2026-08). Unmapped actions are marked null rather than "
                 "assigned an approximate ID."),
    }


def markdown_table() -> str:
    """The grounding table as markdown, for dropping into the paper."""
    lines = ["| Action | Role | Technique | Name | Tactic / function |",
             "|---|---|---|---|---|"]
    for role, table in (("attacker", ATTACKER_GROUNDING),
                        ("defender", DEFENDER_GROUNDING)):
        for g in table:
            tech = g.technique or "—"
            name = g.name or "no equivalent"
            lines.append(f"| `{g.action}` | {role} | {tech} | {name} | {g.tactic} |")
    return "\n".join(lines)


if __name__ == "__main__":
    print(markdown_table())
