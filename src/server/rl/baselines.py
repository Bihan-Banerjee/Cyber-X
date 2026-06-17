"""
baselines.py  –  CyberX Scripted Baseline Agents  (v4.0 · APT vs SOC)
======================================================================
Three tiers per role, written against the v4 observation layout:

  Attacker tiers
    RandomAttacker   – uniform random
    ScriptedAttacker – "smash and grab": fast, loud kill chain
    ExpertAttacker   – "low and slow" APT: stealth, persistence, evasion

  Defender tiers
    RandomDefender   – uniform random
    ScriptedDefender – reactive: investigate → contain on evidence
    ExpertDefender   – proactive SOC: decoys, hunting, hardening, counters

They serve three purposes:
  1. Curriculum opponents (Random → Scripted → Expert → league self-play)
  2. Permanent exploiter slots in the level-2 league mix, so self-play
     agents never forget how to beat simple/strong scripts
  3. BC experts (the demonstrations the agents are pretrained on) and the
     evaluation baselines for the paper tables

Each agent owns a seedable RNG and a reset() hook (the env seeds/resets it
per episode), so trajectories are reproducible end-to-end.

Observation layouts (must match shared_honeypot_env._get_raw_observation):
  Attacker: [stage/3, step, last_success, last_detected, suspicion/20,
             recon, persistence, credentials, data_staged, rate_limited,
             foothold/5, patched]
  Defender: [anomalies/20, evidence/10, failed/50, step, egress/5,
             alerts/10, decoys/5, decoy_tripped, containment, hosts/5,
             cred_anomaly, rate_limited]
"""

import random

import numpy as np

from shared_honeypot_env import (
    ACTION_DIM,
    STAGE_RECON, STAGE_FOOTHOLD, STAGE_PRIVILEGED,
    A_PASSIVE_RECON, A_ACTIVE_SCAN, A_EXPLOIT, A_BRUTE_FORCE, A_PHISHING,
    A_PERSISTENCE, A_ESCALATE, A_DUMP_CREDS, A_LATERAL, A_DEFENSE_EVASION,
    A_COLLECT, A_EXFILTRATE, A_IMPACT, A_WAIT,
    D_MONITOR, D_INVESTIGATE, D_RATE_LIMIT, D_DEPLOY_DECOY, D_THREAT_HUNT,
    D_ISOLATE, D_HARD_BLOCK, D_PATCH_HARDEN, D_ROTATE_CREDS,
    D_RESTORE_BACKUP, D_RAISE_ALERT, D_DECEPTION,
)

N_DEF_ACTIONS = 12   # defender uses 0..11; 12,13 are unused pads


def _scalar(action) -> int:
    if isinstance(action, (int, np.integer)):
        return int(action)
    return int(np.asarray(action).flat[0])


class _ScriptedAgent:
    """Per-instance seedable RNG + per-episode reset hook."""

    def __init__(self):
        self._rng = random.Random()

    def seed(self, seed: int) -> None:
        self._rng.seed(seed)

    def reset(self) -> None:
        pass


# ── Attacker observation decode helper ────────────────────────────────────────

def _att_view(o):
    return {
        "stage":        round(float(o[0]) * 3.0),
        "step":         float(o[1]),
        "last_success": float(o[2]) > 0.5,
        "detected":     float(o[3]) > 0.5,
        "suspicion":    float(o[4]),           # /20 normalized
        "recon":        float(o[5]) > 0.5,
        "persistence":  float(o[6]) > 0.5,
        "credentials":  float(o[7]) > 0.5,
        "data_staged":  float(o[8]) > 0.5,
        "rate_limited": float(o[9]) > 0.5,
        "footholds":    float(o[10]),
        "patched":      float(o[11]),
    }


def _def_view(o):
    return {
        "anomalies":     float(o[0]) * 20.0,
        "evidence":      float(o[1]) * 10.0,
        "failed":        float(o[2]) * 50.0,
        "step":          float(o[3]),
        "egress":        float(o[4]) * 5.0,
        "alerts":        float(o[5]) * 10.0,
        "decoys":        float(o[6]) * 5.0,
        "decoy_tripped": float(o[7]) > 0.5,
        "containment":   float(o[8]) > 0.5,
        "hosts":         float(o[9]) * 5.0,
        "cred_anomaly":  float(o[10]) > 0.5,
        "rate_limited":  float(o[11]) > 0.5,
    }


# ══════════════════════════════════════════════════════════════════════════════
#   ATTACKER BASELINES
# ══════════════════════════════════════════════════════════════════════════════

class RandomAttacker(_ScriptedAgent):
    name = "RandomAttacker"

    def predict(self, observation, deterministic: bool = True):
        return self._rng.randint(0, ACTION_DIM - 1), None


class ScriptedAttacker(_ScriptedAgent):
    """Smash-and-grab: drive straight up the kill chain with loud actions.
    Often wins against a passive defender, often caught by an active one."""
    name = "ScriptedAttacker"

    def predict(self, observation, deterministic: bool = True):
        v = _att_view(observation)

        # Back off only if actively throttled and already noisy
        if v["rate_limited"] and v["suspicion"] > 0.3:
            return A_WAIT, None

        if v["stage"] == STAGE_RECON:
            if not v["recon"]:
                return A_PASSIVE_RECON, None
            return A_EXPLOIT, None
        if v["stage"] == STAGE_FOOTHOLD:
            return A_ESCALATE, None
        if v["stage"] == STAGE_PRIVILEGED:
            return A_IMPACT, None
        return A_WAIT, None


class ExpertAttacker(_ScriptedAgent):
    """Adaptive APT: stealthy and persistence-first early, but decisive under
    pressure. Pursues the quiet data-exfiltration path while it can; once the
    clock runs low or the SOC has clearly noticed, it commits to a fast,
    loud impact for the win rather than getting ground down by containments."""
    name = "ExpertAttacker"

    def __init__(self):
        super().__init__()
        self._detections = 0

    def reset(self) -> None:
        self._detections = 0

    def predict(self, observation, deterministic: bool = True):
        v = _att_view(observation)
        if v["detected"]:
            self._detections += 1

        # Under pressure (late, or repeatedly caught) the smart play is to
        # finish fast, not to keep tiptoeing into more containments.
        pressured = v["step"] > 0.6 or self._detections >= 2

        # Stealth management only when there's still time to be patient
        if not pressured and (v["suspicion"] > 0.5 or v["detected"]):
            return A_DEFENSE_EVASION if self._rng.random() < 0.6 else A_WAIT, None
        if v["rate_limited"] and not pressured:
            return A_WAIT, None

        if v["stage"] == STAGE_RECON:
            if not v["recon"]:
                return A_PASSIVE_RECON, None
            return A_PHISHING if (not pressured and self._rng.random() < 0.5) else A_EXPLOIT, None

        if v["stage"] == STAGE_FOOTHOLD:
            if not v["persistence"] and not pressured:
                return A_PERSISTENCE, None
            return A_ESCALATE, None

        if v["stage"] == STAGE_PRIVILEGED:
            if pressured:
                return A_IMPACT, None                 # decisive fast win
            if not v["credentials"]:
                return A_DUMP_CREDS, None
            if not v["data_staged"]:
                return A_COLLECT, None
            return A_EXFILTRATE, None                  # quiet data-theft win

        return A_WAIT, None


# ══════════════════════════════════════════════════════════════════════════════
#   DEFENDER BASELINES
# ══════════════════════════════════════════════════════════════════════════════

class RandomDefender(_ScriptedAgent):
    name = "RandomDefender"

    def predict(self, observation, deterministic: bool = True):
        return self._rng.randint(0, N_DEF_ACTIONS - 1), None


class ScriptedDefender(_ScriptedAgent):
    """Reactive SOC: build evidence by investigating, then contain once the
    evidence justifies it. Deploys a few decoys; otherwise monitors."""
    name = "ScriptedDefender"

    def predict(self, observation, deterministic: bool = True):
        v = _def_view(observation)

        # Contain when evidence justifies it (mirrors env thresholds)
        if v["evidence"] >= 6.0:
            return D_HARD_BLOCK, None
        if v["evidence"] >= 3.0:
            return D_ISOLATE, None

        # A tripped decoy is hard proof — alert to convert it into evidence
        if v["decoy_tripped"]:
            return D_RAISE_ALERT, None

        # Visible anomalies but not enough evidence → investigate
        if v["anomalies"] >= 2.0 or v["egress"] > 0:
            return D_INVESTIGATE, None

        # Quiet: lay a few decoys, then monitor
        if v["decoys"] < 3:
            return D_DEPLOY_DECOY, None
        return D_MONITOR, None


class ExpertDefender(_ScriptedAgent):
    """Proactive SOC: pre-stage decoys and patching, threat-hunt for stealthy
    intruders, convert evidence decisively, and deploy the counter-mechanics
    (credential rotation, backup restore) the low-and-slow attacker fears."""
    name = "ExpertDefender"

    def __init__(self):
        super().__init__()
        self._hunts = 0

    def reset(self) -> None:
        self._hunts = 0

    def predict(self, observation, deterministic: bool = True):
        v = _def_view(observation)

        # 1. Decisive containment the instant evidence justifies it
        if v["evidence"] >= 6.0:
            return D_HARD_BLOCK, None
        if v["evidence"] >= 3.0:
            return D_ISOLATE, None

        # 2. Convert hard signals into evidence / deploy counters
        if v["decoy_tripped"]:
            return D_RAISE_ALERT, None
        if v["cred_anomaly"]:
            return D_ROTATE_CREDS, None
        # Re-intrusion after a containment suggests persistence → restore
        if v["containment"] and v["anomalies"] >= 2.0:
            return D_RESTORE_BACKUP, None

        # 3. Core reactive loop: investigate the moment anything looks off,
        #    so evidence is ready to contain the next escalation.
        if v["anomalies"] >= 1.5 or v["egress"] > 0:
            return D_INVESTIGATE, None

        # 4. Quiet: pre-stage a couple of decoys and hunt periodically
        if v["decoys"] < 2:
            return D_DEPLOY_DECOY, None
        if v["failed"] >= 3 and not v["rate_limited"]:
            return D_RATE_LIMIT, None
        self._hunts += 1
        if self._hunts % 3 == 0:
            return D_THREAT_HUNT, None
        return D_MONITOR, None


# ══════════════════════════════════════════════════════════════════════════════
#   REGISTRY — hot-swap via SharedHoneypotEnv.set_scripted_opponent and the
#   trainer's league mix
# ══════════════════════════════════════════════════════════════════════════════

OPPONENT_REGISTRY = {
    "random_attacker":   RandomAttacker,
    "scripted_attacker": ScriptedAttacker,
    "expert_attacker":   ExpertAttacker,
    "random_defender":   RandomDefender,
    "scripted_defender": ScriptedDefender,
    "expert_defender":   ExpertDefender,
}

# Scripted opponents available per curriculum level, keyed by the role of the
# TRAINING agent (the opponent plays the other role).
SCRIPTED_POOL_BY_LEVEL = {
    "attacker": {   # opponents for the attacker = defenders
        0: ["random_defender", "scripted_defender"],
        1: ["scripted_defender", "expert_defender"],
        2: ["scripted_defender", "expert_defender"],
    },
    "defender": {   # opponents for the defender = attackers
        0: ["random_attacker", "scripted_attacker"],
        1: ["scripted_attacker", "expert_attacker"],
        2: ["scripted_attacker", "expert_attacker"],
    },
}
