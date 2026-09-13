"""
red_team  –  Autonomous LLM red-team for CyberX
================================================
An out-of-policy-class adversary and the sim→real bridge around it:
  • red_team.probe      — out-of-class exploitability probe vs the RL defender
  • red_team.honeypot   — attack the user's OWN local Cowrie for self-labeled
                          telemetry (loopback/private only; optional paramiko)
  • red_team.calibrate  — ground the env's brute-force success probabilities in
                          real honeypot login telemetry (with CIs)

ATT&CK grounding is not duplicated here — playbook.py is a view over the
project's single source of truth, attack_grounding.py. The closed-loop
defensive-inference eval lives in shadow_eval.py + soc_state.py.

Self-contained by design so it can later be extracted into its own package.
Import the in-sim pieces without pulling the honeypot's optional paramiko dep.
"""

from red_team.playbook import ATT_CK_MAP, attack_info

__all__ = ["ATT_CK_MAP", "attack_info"]
