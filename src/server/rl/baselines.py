"""
baselines.py  –  CyberX Scripted Baseline Agents  (v3.0)
==========================================================
Three tiers of scripted agents per role:

  Attacker tiers:
    RandomAttacker      – uniform random from valid actions
    ScriptedAttacker    – rule-based, follows kill-chain order
    ExpertAttacker      – adaptive, reads POMDP and varies tactics

  Defender tiers:
    RandomDefender      – uniform random from valid actions
    ScriptedDefender    – threshold-based detection and response
    ExpertDefender      – proactive deception + early detection

These serve three purposes:
  1.  Curriculum training opponents (Random → Scripted → Expert → Self-play)
  2.  Permanent "exploiter" slots in the level-2 league mix, so self-play
      agents never forget how to beat simple strategies
  3.  Evaluation baselines for the research paper tables

v3.0: each agent owns a seedable RNG (the env seeds it from its own
np_random at reset) and a reset() hook clearing per-episode state, so
trajectories are reproducible end-to-end.
"""

import random

import numpy as np


# ── Utility ────────────────────────────────────────────────────────────────────

def _scalar(action) -> int:
    """Safely extract a scalar integer from any action format."""
    if isinstance(action, (int, np.integer)):
        return int(action)
    return int(np.asarray(action).flat[0])


class _ScriptedAgent:
    """Base class: per-instance seedable RNG + per-episode reset hook.
    SharedHoneypotEnv calls seed() and reset() at episode boundaries."""

    def __init__(self):
        self._rng = random.Random()

    def seed(self, seed: int) -> None:
        self._rng.seed(seed)

    def reset(self) -> None:
        pass


# ══════════════════════════════════════════════════════════════════════════════
#   ATTACKER BASELINES
# ══════════════════════════════════════════════════════════════════════════════

class RandomAttacker(_ScriptedAgent):
    """Uniform random attacker. Stage-0 sparring partner for the defender."""
    name = "RandomAttacker"

    def predict(self, observation, deterministic: bool = True):
        return self._rng.randint(0, 9), None


class ScriptedAttacker(_ScriptedAgent):
    """
    Kill-chain-ordered attacker that reads its POMDP observation.

    Attacker POMDP observation (after normalisation, ×scale → raw):
        obs[0]  kill_chain_level  / 2.0
        obs[1]  current_step      / max_steps
        obs[2]  last_success      (0/1)
        obs[3]  last_timeout      (0/1)

    Strategy:
        EXTERNAL     → brute force (action 0)
        USER_ACCESS  → recon (2) then exfil (3) then priv-esc (4)
        ROOT_ACCESS  → backdoor (5) then full exfil (7) then lateral (8)
        If timed out → wait (9) to let rate-limit decay
    """
    name = "ScriptedAttacker"

    def predict(self, observation, deterministic: bool = True):
        kill_chain   = round(float(observation[0]) * 2.0)
        last_timeout = float(observation[3]) > 0.5

        if last_timeout:
            return 9, None

        if kill_chain == 0:     # EXTERNAL – brute force
            return 0, None
        elif kill_chain == 1:   # USER – recon → exfil → esc
            return self._rng.choice([1, 2, 3, 4]), None
        else:                   # ROOT – maximise impact
            return self._rng.choice([5, 6, 7, 8]), None


class ExpertAttacker(_ScriptedAgent):
    """
    Adaptive attacker with noise avoidance and decoy awareness.

    Additional heuristics:
      • Stealthy mode: avoids high-suspicion actions when kill chain is
        fragile (prefers low-noise moves until priv-esc is confirmed)
      • Exponential back-off after repeated timeouts
      • Random variety to prevent the defender exploiting fixed patterns
    """
    name = "ExpertAttacker"

    def __init__(self):
        super().__init__()
        self._consec_failures = 0

    def reset(self) -> None:
        self._consec_failures = 0

    def predict(self, observation, deterministic: bool = True):
        kill_chain   = round(float(observation[0]) * 2.0)
        step_frac    = float(observation[1])          # normalised 0-1
        last_success = float(observation[2]) > 0.5
        last_timeout = float(observation[3]) > 0.5

        if last_timeout:
            self._consec_failures += 1
            # Exponential back-off with random jitter
            if self._consec_failures >= 2:
                self._consec_failures = 0
                return 9, None  # wait

        if not last_success:
            self._consec_failures += 1
        else:
            self._consec_failures = 0

        # Late-game urgency: go aggressive in last 30 % of episode
        urgent = step_frac > 0.70

        if kill_chain == 0:
            # Prefer slow brute-force (less noise) early, accelerate late
            if urgent:
                return 0, None  # keep hammering
            return self._rng.choices([0, 9], weights=[0.7, 0.3])[0], None

        elif kill_chain == 1:
            if urgent:
                # Commit hard to priv-esc
                return self._rng.choices([4, 3, 2], weights=[0.6, 0.25, 0.15])[0], None
            # Stealth: prefer recon/enum before committing to priv-esc
            return self._rng.choices([1, 2, 3, 4], weights=[0.2, 0.3, 0.25, 0.25])[0], None

        else:  # ROOT
            if urgent:
                return self._rng.choice([7, 5, 6]), None
            return self._rng.choices([5, 6, 7, 8], weights=[0.3, 0.2, 0.3, 0.2])[0], None


# ══════════════════════════════════════════════════════════════════════════════
#   DEFENDER BASELINES
# ══════════════════════════════════════════════════════════════════════════════

class RandomDefender(_ScriptedAgent):
    """Uniform random defender. Paired with RandomAttacker in Stage 0."""
    name = "RandomDefender"

    def predict(self, observation, deterministic: bool = True):
        return self._rng.randint(0, 9), None


class ScriptedDefender(_ScriptedAgent):
    """
    Threshold-based defender reading its POMDP observation.

    Defender POMDP observation (after normalisation):
        obs[0]  failed_logins      / 50.0
        obs[1]  suspicious_events  / 30.0
        obs[2]  is_blocked         (0/1)
        obs[3]  current_step       / max_steps
        obs[4]  files_downloaded   / 20.0
        obs[5]  is_rate_limited    (0/1)
        obs[6]  decoys_deployed    / 5.0
        obs[7]  alerts_triggered   / 10.0

    Strategy:
        Files stolen    → isolate (7) immediately
        High suspicion  → hard block (3)
        Mid suspicion   → temp block (2) or alert (6)
        Low suspicion   → rate limit (1)
        Very low        → deploy decoy (4) or monitor (0)
    """
    name = "ScriptedDefender"

    def predict(self, observation, deterministic: bool = True):
        failed_logins     = float(observation[0]) * 50.0
        suspicious_events = float(observation[1]) * 30.0
        is_blocked        = float(observation[2]) > 0.5
        files_downloaded  = float(observation[4]) * 20.0
        is_rate_limited   = float(observation[5]) > 0.5
        decoys_deployed   = float(observation[6]) * 5.0

        # Already blocked → just monitor this step
        if is_blocked:
            return 0, None

        # Files exfiltrated → emergency isolation
        if files_downloaded > 0:
            return 7, None

        # Very high suspicion → hard block
        if suspicious_events >= 5:
            return 3, None

        # High suspicion → alert + temp block
        if suspicious_events >= 3:
            return self._rng.choice([2, 6]), None

        # Moderate suspicion → rate limit
        if suspicious_events >= 2 or failed_logins >= 5:
            if not is_rate_limited:
                return 1, None

        # Low threat → deploy decoy if not fully deployed
        if decoys_deployed < 3:
            return 4, None

        # Periodic active deception
        return self._rng.choices([0, 9, 4], weights=[0.5, 0.3, 0.2])[0], None


class ExpertDefender(_ScriptedAgent):
    """
    Proactive deception-first defender.

    Key upgrades over ScriptedDefender:
      • Deploys decoys early (before attack even begins) for passive reward
      • Uses active deception (9) to confuse attacker once decoys are up
      • Times alerts to increase information gain
      • Responds to rate-limit success by following up with temp block
    """
    name = "ExpertDefender"

    def __init__(self):
        super().__init__()
        self._rate_limited_at_step = -10
        self._current_step = 0

    def reset(self) -> None:
        self._rate_limited_at_step = -10
        self._current_step = 0

    def predict(self, observation, deterministic: bool = True):
        self._current_step += 1

        failed_logins     = float(observation[0]) * 50.0
        suspicious_events = float(observation[1]) * 30.0
        is_blocked        = float(observation[2]) > 0.5
        step_frac         = float(observation[3])
        files_downloaded  = float(observation[4]) * 20.0
        is_rate_limited   = float(observation[5]) > 0.5
        decoys_deployed   = float(observation[6]) * 5.0
        alerts_triggered  = float(observation[7]) * 10.0

        if is_blocked:
            # After a block clears, immediately reset to active deception
            return (9 if decoys_deployed >= 2 else 4), None

        # ── Immediate threat response ──────────────────────────────────────
        if files_downloaded > 0:
            return 7, None   # isolate: data is leaving

        if suspicious_events >= 6:
            return 3, None   # hard block: overwhelming evidence

        if suspicious_events >= 4:
            return 2, None   # temp block: strong evidence

        # ── Strategic deception layer (deploy early) ───────────────────────
        if step_frac < 0.2 and decoys_deployed < 3:
            return 4, None

        # If decoys are deployed, use active deception to waste attacker time
        if decoys_deployed >= 2 and suspicious_events < 2:
            return 9, None

        # ── Graduated response ─────────────────────────────────────────────
        if suspicious_events >= 2 or failed_logins >= 4:
            if not is_rate_limited:
                self._rate_limited_at_step = self._current_step
                return 1, None
            # Rate limit is already active: escalate to alert if evidence grew
            if suspicious_events >= 3 and alerts_triggered < 1:
                return 6, None
            return 0, None   # monitor while rate limit does its job

        if failed_logins >= 2:
            return 1, None

        # ── Default: maintain deception posture ───────────────────────────
        if decoys_deployed < 5:
            return self._rng.choices([4, 0], weights=[0.6, 0.4])[0], None
        return self._rng.choices([9, 0, 6], weights=[0.5, 0.3, 0.2])[0], None


# ══════════════════════════════════════════════════════════════════════════════
#   REGISTRY — used by SharedHoneypotEnv.set_scripted_opponent (hot-swap via
#   VecEnv.env_method) and by the trainer's league mix
# ══════════════════════════════════════════════════════════════════════════════

OPPONENT_REGISTRY = {
    "random_attacker":   RandomAttacker,
    "scripted_attacker": ScriptedAttacker,
    "expert_attacker":   ExpertAttacker,
    "random_defender":   RandomDefender,
    "scripted_defender": ScriptedDefender,
    "expert_defender":   ExpertDefender,
}

# Scripted opponent names available per curriculum level, keyed by the role
# of the TRAINING agent (i.e. the opponent plays the other role).
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
