"""
shared_honeypot_env.py  –  CyberX MARL Environment  (v4.0 · APT vs SOC)
========================================================================
A two-agent shared environment modelling a realistic intrusion: an APT
attacker progressing through a MITRE-inspired kill chain against a SOC
defender that must detect, investigate, and contain it.

One instance trains either side (mode=...); the opponent acts inside
step() through an injected policy.

Why v4 (vs the v3 rush game):
  v3 let the attacker win by merely *touching* ROOT, with detection
  thresholds it crossed only at the escalation that ended the episode —
  so the defender could never respond in time and the upper kill chain
  was dead content. v4 makes the contest realistic and balanced:

  • Stealth economy: every attacker action emits NOISE into a hidden
    suspicion accumulator that decays over time. Loud actions
    (brute-force, exfil, impact) are easy to catch; quiet ones
    (phishing, passive recon, defense-evasion) are not. The attacker
    can actively clear logs to cool down.
  • Detection ≠ containment: the defender sees only a NOISY anomaly
    signal (benign traffic creates false anomalies). It must INVESTIGATE
    or THREAT-HUNT to convert suspicion into EVIDENCE, and containment
    only "counts" (and avoids a false-positive penalty) when evidence
    clears a threshold. This is SOC triage, and it gives blocking a
    realistic cost/latency.
  • Counterplay mechanics: persistence (survives containment),
    credentials (enables lateral movement / faster escalation), and
    target hardening (patching lowers exploit success) — each with a
    defender counter (restore-from-backup, credential rotation,
    patching). Honeypot decoys can trip a noisy attacker into instant
    strong evidence, rewarding proactive defense.
  • Winning requires finishing the job: the attacker must EXECUTE IMPACT
    or EXFILTRATE enough data — not just reach ROOT. The defender wins
    by evidence-backed containment (full eviction if the attacker never
    established persistence) or by detecting and surviving to the end.

Design invariants kept from v3: gymnasium np_random seeding end-to-end,
StatefulOpponent LSTM threading, env_method hot-swap API, a single
RewardConfig dataclass holding every tunable, and exclusive win
conditions in the info dict.

Action masking note: sb3-contrib RecurrentPPO has no invalid-action
masking, so curriculum gating remaps out-of-mask actions to a safe
no-op (attacker→WAIT, defender→MONITOR) rather than masking logits.
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

logger = logging.getLogger(__name__)

# ── Dimensions ──────────────────────────────────────────────────────────────
ACTION_DIM = 14   # attacker uses all 14; defender uses 0-11 (12,13 remap→monitor)
OBS_DIM    = 12

# ── Kill-chain stages ───────────────────────────────────────────────────────
STAGE_RECON      = 0   # outside the perimeter, gathering information
STAGE_FOOTHOLD   = 1   # initial access (user-level)
STAGE_PRIVILEGED = 2   # root / domain-admin
STAGE_OBJECTIVE  = 3   # objective achieved (terminal attacker win)

# ── Attacker actions ────────────────────────────────────────────────────────
A_PASSIVE_RECON  = 0
A_ACTIVE_SCAN    = 1
A_EXPLOIT        = 2
A_BRUTE_FORCE    = 3
A_PHISHING       = 4
A_PERSISTENCE    = 5
A_ESCALATE       = 6
A_DUMP_CREDS     = 7
A_LATERAL        = 8
A_DEFENSE_EVASION = 9
A_COLLECT        = 10
A_EXFILTRATE     = 11
A_IMPACT         = 12
A_WAIT           = 13

# Actions that touch live systems and can therefore trip a honeypot decoy
ACTIVE_ATT_ACTIONS = frozenset({
    A_ACTIVE_SCAN, A_EXPLOIT, A_BRUTE_FORCE, A_PERSISTENCE, A_ESCALATE,
    A_DUMP_CREDS, A_LATERAL, A_COLLECT, A_EXFILTRATE, A_IMPACT,
})

# ── Defender actions ────────────────────────────────────────────────────────
D_MONITOR        = 0
D_INVESTIGATE    = 1
D_RATE_LIMIT     = 2
D_DEPLOY_DECOY   = 3
D_THREAT_HUNT    = 4
D_ISOLATE        = 5
D_HARD_BLOCK     = 6
D_PATCH_HARDEN   = 7
D_ROTATE_CREDS   = 8
D_RESTORE_BACKUP = 9
D_RAISE_ALERT    = 10
D_DECEPTION      = 11

ATT_ACTION_NAMES = [
    "passive_recon", "active_scan", "exploit_service", "brute_force",
    "phishing", "establish_persistence", "escalate_privilege",
    "dump_credentials", "lateral_movement", "defense_evasion",
    "collect_data", "exfiltrate", "execute_impact", "wait",
]
DEF_ACTION_NAMES = [
    "monitor", "investigate", "rate_limit", "deploy_decoy", "threat_hunt",
    "isolate_host", "hard_block", "patch_harden", "rotate_credentials",
    "restore_backup", "raise_alert", "deception_response",
    "(unused)", "(unused)",   # pad to ACTION_DIM for indexing safety
]

# ── Curriculum levels ─────────────────────────────────────────────────────────
#   0 → core kill chain only, no noise, scripted opponent
#   1 → full actions, low benign noise, scripted opponent
#   2 → full actions, realistic noise, league self-play
CURRICULUM_CONFIG = {
    0: {"noise_rate": 0.00, "max_steps": 60,
        # Minimal but complete path so a competent attacker CAN win:
        # recon → exploit → escalate → impact (+wait).
        "att_mask": [A_PASSIVE_RECON, A_EXPLOIT, A_ESCALATE, A_IMPACT, A_WAIT],
        # Detect → investigate → contain, plus a decoy.
        "def_mask": [D_MONITOR, D_INVESTIGATE, D_DEPLOY_DECOY, D_ISOLATE, D_HARD_BLOCK]},
    1: {"noise_rate": 0.06, "max_steps": 80,
        "att_mask": list(range(ACTION_DIM)),
        "def_mask": list(range(12))},
    2: {"noise_rate": 0.12, "max_steps": 100,
        "att_mask": list(range(ACTION_DIM)),
        "def_mask": list(range(12))},
}


# ── Tunable game constants & reward coefficients ──────────────────────────────

@dataclass(frozen=True)
class RewardConfig:
    """Every dynamics and reward coefficient in one place. Defaults aim for a
    contested game on the ±25 reward scale; all are overridable per-instance.

    Reward philosophy:
      • dense progress signals so neither LSTM starves for gradient
      • terminal outcomes dominate (+25 win / -15 loss) so agents optimise
        for *winning*, not for farming intermediate rewards
      • every defender false action costs less than the correct one, but
        false positives are real (prevents block-everything collapse)
    """

    # ── Detection / stealth dynamics ──
    suspicion_decay:        float = 0.92    # per-step log aging
    suspicion_cap:          float = 30.0
    evidence_cap:           float = 12.0
    evidence_decay:         float = 0.96    # stale indicators fade
    contain_isolate_evid:   float = 3.0     # evidence needed for a justified isolate
    contain_block_evid:     float = 6.0     # evidence needed for a justified hard block
    # Containment consumes the evidence that justified it (the SOC must
    # re-detect to act again) — that alone prevents block-spam, so the
    # operational cooldown only needs to stop double-firing in one tick.
    contain_cooldown_steps: int   = 1
    investigate_fraction:   float = 0.55    # fraction of current suspicion → evidence per investigate
    threat_hunt_gain:       float = 1.5     # evidence from proactive hunting
    monitor_evidence_gain:  float = 0.4     # passive evidence when suspicion already high
    anomaly_noise_weight:   float = 0.5     # how much benign failed-logins inflate observed anomalies
    obs_suspicion_scale:    float = 20.0
    obs_evidence_scale:     float = 10.0
    decoy_trip_base:        float = 0.15    # per deployed decoy, capped
    decoy_trip_cap:         float = 0.50
    decoy_trip_evidence:    float = 4.0     # enough to justify an isolate, not an instant block
    decoy_trip_suspicion:   float = 4.0
    rate_limit_duration:    int   = 4
    rate_limit_slow:        float = 0.5     # success-prob multiplier while rate-limited
    max_footholds:          int   = 5
    exfil_objective_volume: int   = 3       # exfiltration count that counts as objective

    # ── Attacker action noise (added to suspicion) ──
    noise_passive_recon:    float = 0.2
    noise_active_scan:      float = 1.5
    noise_exploit:          float = 1.0
    noise_brute:            float = 2.5
    noise_phishing:         float = 0.4
    noise_persistence:      float = 1.2
    noise_escalate:         float = 1.5
    noise_dump:             float = 2.0
    noise_lateral:          float = 1.8
    noise_collect:          float = 0.8
    noise_exfil:            float = 2.5
    noise_impact:           float = 4.0
    evasion_reduce:         float = 4.0     # suspicion removed by a successful evasion
    evasion_success:        float = 0.7
    evasion_fail_noise:     float = 2.0     # caught clearing logs
    wait_suspicion_decay:   float = 2.0     # extra cool-down from dwelling

    # ── Attacker success probabilities ──
    p_exploit_base:         float = 0.45
    p_exploit_recon_bonus:  float = 0.25
    p_brute_base:           float = 0.30
    p_brute_decay:          float = 0.015   # per failed login
    p_brute_min:            float = 0.10
    p_phishing:             float = 0.40
    p_escalate_base:        float = 0.45
    p_escalate_cred_bonus:  float = 0.30
    p_escalate_min:         float = 0.10
    patch_success_penalty:  float = 0.5     # multiplies (1 - patched_level) into exploit/escalate
    patch_step:             float = 0.25    # hardening added per patch action

    # ── Attacker rewards ──
    r_recon:                float = 0.8
    r_scan:                 float = 0.6
    r_foothold:             float = 6.0
    r_persistence:          float = 4.0
    r_privileged:           float = 10.0
    r_dump_creds:           float = 5.0
    r_lateral:              float = 4.0
    r_collect:              float = 3.0
    r_exfil:                float = 8.0
    r_impact_win:           float = 25.0
    r_evasion:              float = 2.0
    r_wait:                 float = -0.3
    r_wrong_stage:          float = -1.5    # action invalid for current stage
    r_action_failed:        float = -0.5    # valid action, probabilistic miss
    r_rate_limited_fail:    float = -1.0
    r_decoy_tripped:        float = -4.0
    r_contained:            float = -8.0    # knocked back by a justified containment
    r_evicted:              float = -10.0   # fully evicted (terminal loss)
    # Per-step survival shaping (small; objective should dominate)
    surv_recon:             float = -0.25   # mild pressure to get inside
    surv_foothold:          float = 0.3
    surv_privileged:        float = 0.6

    # ── Defender rewards ──
    rd_monitor_quiet:       float = 0.3
    rd_monitor_breached:    float = -0.3
    rd_investigate_hit:     float = 2.0     # × evidence gained
    rd_investigate_idle:    float = -0.5    # investigating when nothing is happening
    rd_threat_hunt_hit:     float = 3.0
    rd_threat_hunt_idle:    float = -0.6
    rd_rate_limit_hit:      float = 2.5
    rd_rate_limit_fp:       float = -1.0
    rd_decoy_deploy:        float = 1.5
    rd_decoy_cap:           int   = 5
    rd_decoy_after_cap:     float = 0.2
    rd_decoy_passive:       float = 0.05    # tiny — must not become a farm
    rd_isolate_just:        float = 10.0
    rd_isolate_fp:          float = -6.0
    rd_block_just:          float = 18.0
    rd_block_fp:            float = -7.0
    rd_contain_cooldown:    float = -1.0    # tried to contain while a response is in progress
    rd_patch_active:        float = 1.0
    rd_patch_idle:          float = -0.5
    rd_rotate_hit:          float = 5.0     # rotating creds when a credential anomaly exists
    rd_rotate_idle:         float = -1.0
    rd_restore_hit:         float = 6.0     # restoring when persistence exists
    rd_restore_idle:        float = -3.0    # expensive false move
    rd_alert_hit:           float = 4.0
    rd_alert_spam:          float = -3.0
    rd_alert_cap:           int   = 3
    rd_deception_hit:       float = 2.5
    rd_deception_idle:      float = 0.2
    rd_deception_cap:       int   = 4
    rd_early_detect_bonus:  float = 3.0
    rd_missed_escalation:   float = -6.0    # attacker advanced a stage this turn
    rd_objective_lost:      float = -15.0   # attacker completed the objective


DEFAULT_REWARDS = RewardConfig()


# ── Shared observation builders (also used by telemetry_adapter.py) ──────────

def defender_observation(
    observed_anomalies: float,
    evidence:           float,
    failed_logins:      float,
    step_fraction:      float,
    egress_volume:      float,
    alerts:             float,
    decoys_deployed:    float,
    decoy_tripped:      bool,
    containment_active: bool,
    hosts_anomalous:    float,
    credential_anomaly: bool,
    rate_limited:       bool,
    rw: RewardConfig = DEFAULT_REWARDS,
) -> np.ndarray:
    """12-dim L∞-normalized defender observation. Single source of truth for
    the layout — the live telemetry adapter builds the same vector from real
    Elasticsearch events."""
    raw = np.array([
        observed_anomalies / rw.obs_suspicion_scale,
        evidence / rw.obs_evidence_scale,
        failed_logins / 50.0,
        step_fraction,
        egress_volume / 5.0,
        alerts / 10.0,
        decoys_deployed / 5.0,
        float(decoy_tripped),
        float(containment_active),
        hosts_anomalous / float(rw.max_footholds),
        float(credential_anomaly),
        float(rate_limited),
    ], dtype=np.float32)
    return np.clip(raw, 0.0, 1.0)


# ── Stateful opponent wrapper ──────────────────────────────────────────────────

class StatefulOpponent:
    """Wraps an SB3 recurrent model so its LSTM hidden state persists across
    steps within an episode. The env calls .reset() at episode boundaries.
    Without it, every opponent_model.predict(obs) starts from a zero LSTM
    state and the opponent plays memoryless."""

    def __init__(self, model):
        self._model = model
        self._state = None

    def predict(self, obs: np.ndarray, deterministic: bool = True):
        obs_arr = np.asarray(obs, dtype=np.float32).reshape(1, -1)
        action, self._state = self._model.predict(
            obs_arr, state=self._state, deterministic=deterministic
        )
        return int(np.asarray(action).flat[0]), None

    def reset(self) -> None:
        self._state = None


class SharedHoneypotEnv(gym.Env):
    """
    Shared attacker/defender APT-vs-SOC environment for CyberX MARL.

    Parameters
    ----------
    mode : 'attacker' | 'defender'
    max_steps : int, optional
        Overrides the curriculum default.
    opponent_model : object with .predict(obs) -> (action, _)
        None → seeded random policy over the opponent's curriculum mask.
        May expose .reset()/.seed() for episode boundaries.
    curriculum_level : 0 | 1 | 2
    rewards : RewardConfig
    """

    metadata = {"render.modes": ["human"]}

    def __init__(
        self,
        mode: str = "attacker",
        max_steps: Optional[int] = None,
        opponent_model=None,
        curriculum_level: int = 2,
        rewards: RewardConfig = DEFAULT_REWARDS,
    ):
        super().__init__()
        assert mode in ("attacker", "defender"), f"Invalid mode: {mode}"
        self.mode = mode
        self.opponent_model = opponent_model
        self._opponent_id = type(opponent_model).__name__ if opponent_model else "random"
        self.rw = rewards
        self._max_steps_override = max_steps

        self.curriculum_level = min(max(curriculum_level, 0), 2)
        self._apply_curriculum(self.curriculum_level)

        self.action_space = spaces.Discrete(ACTION_DIM)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(OBS_DIM,), dtype=np.float32
        )

        self.current_step = 0
        self.true_state: Dict[str, Any] = {}
        self._reset_true_state()

        self._ep_att_rewards: list = []
        self._ep_def_rewards: list = []

    # ── Curriculum / opponent hot-swap (callable via VecEnv.env_method) ────────

    def _apply_curriculum(self, level: int) -> None:
        cfg = CURRICULUM_CONFIG[level]
        self.max_steps = (self._max_steps_override
                          if self._max_steps_override is not None
                          else cfg["max_steps"])
        self.noise_rate = cfg["noise_rate"]
        self._att_mask = cfg["att_mask"]
        self._def_mask = cfg["def_mask"]

    def set_curriculum_level(self, level: int) -> int:
        self.curriculum_level = min(max(level, 0), 2)
        self._apply_curriculum(self.curriculum_level)
        return self.curriculum_level

    def set_scripted_opponent(self, name: str) -> str:
        from baselines import OPPONENT_REGISTRY
        self.opponent_model = OPPONENT_REGISTRY[name]()
        self._opponent_id = name
        return name

    def load_rl_opponent(self, path: str) -> bool:
        try:
            from sb3_contrib import RecurrentPPO
            model = RecurrentPPO.load(path, device="cpu")
            self.opponent_model = StatefulOpponent(model)
            self._opponent_id = f"rl:{path}"
            return True
        except Exception as e:
            logger.warning("load_rl_opponent failed for %s: %s", path, e)
            self.opponent_model = None
            self._opponent_id = "random"
            return False

    # ── State ──────────────────────────────────────────────────────────────────

    def _reset_true_state(self) -> None:
        self.true_state = {
            # Kill chain
            "stage":             STAGE_RECON,
            "recon_done":        False,
            "persistence":       False,
            "credentials":       False,
            "data_staged":       False,
            "foothold_count":    0,
            # Stealth / detection
            "suspicion":         0.0,
            "evidence":          0.0,
            "failed_logins":     0,
            "egress_volume":     0,
            "alerts":            0,
            "decoys_deployed":   0,
            "decoy_tripped":     False,
            "credential_anomaly": False,
            # Target / control state
            "patched_level":     0.0,
            "rate_limit_steps":  0,
            "containment_active": False,
            "contain_cooldown":  0,
            # Episode bookkeeping
            "objective_done":    False,
            "evicted":           False,
            "first_detection_step": None,
            "justified_containments": 0,
            "false_positives":   0,
            "deception_count":   0,
            # Per-step POMDP flags
            "last_att_success":  0,
            "last_att_detected": 0,
        }

    def _apply_curriculum_mask(self, action: int, is_attacker: bool) -> int:
        mask = self._att_mask if is_attacker else self._def_mask
        if action in mask:
            return action
        return A_WAIT if is_attacker else D_MONITOR

    def _get_opponent_action(self) -> int:
        if self.opponent_model is None:
            opp_mask = self._def_mask if self.mode == "attacker" else self._att_mask
            return int(self.np_random.choice(opp_mask))
        obs = self._get_raw_observation(is_opponent=True)
        result = self.opponent_model.predict(obs, deterministic=True)
        action = result[0] if isinstance(result, tuple) else result
        return int(np.asarray(action).item())

    # ── Observations ─────────────────────────────────────────────────────────

    def _observed_anomalies(self) -> float:
        """Defender's noisy view of suspicion: benign failed logins inflate it,
        which is why the defender must investigate before containing."""
        ts = self.true_state
        return ts["suspicion"] + self.rw.anomaly_noise_weight * ts["failed_logins"]

    def _get_raw_observation(self, is_opponent: bool = False) -> np.ndarray:
        perspective = self.mode
        if is_opponent:
            perspective = "defender" if self.mode == "attacker" else "attacker"

        ts = self.true_state
        if perspective == "attacker":
            raw = np.array([
                ts["stage"] / float(STAGE_OBJECTIVE),
                self.current_step / float(self.max_steps),
                float(ts["last_att_success"]),
                float(ts["last_att_detected"]),
                ts["suspicion"] / self.rw.obs_suspicion_scale,   # attacker senses its "heat"
                float(ts["recon_done"]),
                float(ts["persistence"]),
                float(ts["credentials"]),
                float(ts["data_staged"]),
                float(ts["rate_limit_steps"] > 0),
                ts["foothold_count"] / float(self.rw.max_footholds),
                ts["patched_level"],
            ], dtype=np.float32)
            return np.clip(raw, 0.0, 1.0)

        hosts_anomalous = ts["foothold_count"] if ts["suspicion"] > 1.0 else 0
        return defender_observation(
            observed_anomalies = self._observed_anomalies(),
            evidence           = ts["evidence"],
            failed_logins      = ts["failed_logins"],
            step_fraction      = self.current_step / float(self.max_steps),
            egress_volume      = ts["egress_volume"],
            alerts             = ts["alerts"],
            decoys_deployed    = ts["decoys_deployed"],
            decoy_tripped      = ts["decoy_tripped"],
            containment_active = ts["containment_active"],
            hosts_anomalous    = hosts_anomalous,
            credential_anomaly = ts["credential_anomaly"],
            rate_limited       = ts["rate_limit_steps"] > 0,
            rw                 = self.rw,
        )

    def _get_observation(self) -> np.ndarray:
        return self._get_raw_observation(is_opponent=False)

    # ── Gym interface ──────────────────────────────────────────────────────────

    def reset(
        self, seed: Optional[int] = None, options: Optional[dict] = None
    ) -> Tuple[np.ndarray, dict]:
        super().reset(seed=seed)
        self.current_step = 0
        self._reset_true_state()
        self._ep_att_rewards = []
        self._ep_def_rewards = []
        if self.opponent_model is not None:
            if hasattr(self.opponent_model, "seed"):
                self.opponent_model.seed(int(self.np_random.integers(2**31)))
            if hasattr(self.opponent_model, "reset"):
                self.opponent_model.reset()
        return self._get_observation(), {"curriculum_level": self.curriculum_level}

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        self.current_step += 1
        ts = self.true_state

        # Benign noise: background failed logins create false anomalies
        if self.np_random.random() < self.noise_rate:
            ts["failed_logins"] += 1

        opp_action = self._get_opponent_action()
        if self.mode == "attacker":
            att_action = self._apply_curriculum_mask(action, True)
            def_action = self._apply_curriculum_mask(opp_action, False)
        else:
            def_action = self._apply_curriculum_mask(action, False)
            att_action = self._apply_curriculum_mask(opp_action, True)

        att_r, def_r = self._resolve_turn(att_action, def_action)

        self._ep_att_rewards.append(att_r)
        self._ep_def_rewards.append(def_r)

        truncated  = self.current_step >= self.max_steps
        terminated = ts["objective_done"] or ts["evicted"]

        reward = att_r if self.mode == "attacker" else def_r
        info = self._build_info(att_action, def_action, att_r, def_r, terminated, truncated)
        return self._get_observation(), reward, terminated, truncated, info

    # ── Core game logic ────────────────────────────────────────────────────────

    def _resolve_turn(self, att_action: int, def_action: int) -> Tuple[float, float]:
        ts = self.true_state
        rw = self.rw

        ts["last_att_success"]  = 0
        ts["last_att_detected"] = 0
        ts["decoy_tripped"]     = False

        prev_stage = ts["stage"]

        # Time-based decays (log aging, fading indicators, response cooldown)
        ts["suspicion"] *= rw.suspicion_decay
        ts["evidence"]  *= rw.evidence_decay
        if ts["rate_limit_steps"] > 0:
            ts["rate_limit_steps"] -= 1
        if ts["contain_cooldown"] > 0:
            ts["contain_cooldown"] -= 1
            if ts["contain_cooldown"] == 0:
                ts["containment_active"] = False

        # The attacker acts first and generates telemetry; the defender then
        # observes and responds. (Defender-first let the SOC pre-emptively
        # knock a privileged attacker back every turn before it could ever
        # act — an unwinnable trap.)
        att_r = self._exec_attacker_action(att_action)
        def_r = self._exec_defender_action(def_action)

        # Cross-agent consequences
        if ts["stage"] > prev_stage and not ts["objective_done"]:
            def_r += rw.rd_missed_escalation

        ts["suspicion"] = min(ts["suspicion"], rw.suspicion_cap)
        ts["evidence"]  = min(ts["evidence"], rw.evidence_cap)

        # First-detection (evidence first crosses isolate threshold)
        if ts["first_detection_step"] is None and ts["evidence"] >= rw.contain_isolate_evid:
            ts["first_detection_step"] = self.current_step
            def_r += rw.rd_early_detect_bonus
            ts["last_att_detected"] = 1

        # Terminal bookkeeping rewards
        if ts["objective_done"]:
            def_r += rw.rd_objective_lost

        return att_r, def_r

    def _exec_defender_action(self, action: int) -> float:
        ts = self.true_state
        rw = self.rw
        r = 0.0
        breached = ts["stage"] > STAGE_RECON
        anomalies = self._observed_anomalies()

        if action == D_MONITOR:
            if anomalies > 2.0:
                ts["evidence"] += rw.monitor_evidence_gain
                r += rw.monitor_evidence_gain
            elif breached:
                r += rw.rd_monitor_breached
            else:
                r += rw.rd_monitor_quiet

        elif action == D_INVESTIGATE:
            # Convert a fraction of current suspicion into hard evidence
            gain = min(ts["suspicion"], rw.evidence_cap) * rw.investigate_fraction
            if gain > 0.3:
                ts["evidence"] += gain
                r += rw.rd_investigate_hit * (gain / rw.evidence_cap)
            else:
                r += rw.rd_investigate_idle

        elif action == D_THREAT_HUNT:
            # Proactive: finds even stealthy intruders, but wasteful if none
            if ts["suspicion"] > 0.5 or breached:
                ts["evidence"] += rw.threat_hunt_gain
                r += rw.rd_threat_hunt_hit * 0.5
            else:
                r += rw.rd_threat_hunt_idle

        elif action == D_RATE_LIMIT:
            if anomalies >= 2.0 or ts["failed_logins"] >= 3:
                ts["rate_limit_steps"] = rw.rate_limit_duration
                r += rw.rd_rate_limit_hit
            else:
                ts["false_positives"] += 1
                r += rw.rd_rate_limit_fp

        elif action == D_DEPLOY_DECOY:
            if ts["decoys_deployed"] < rw.rd_decoy_cap:
                ts["decoys_deployed"] += 1
                r += rw.rd_decoy_deploy
            else:
                r += rw.rd_decoy_after_cap

        elif action == D_ISOLATE:
            if ts["contain_cooldown"] > 0:
                r += rw.rd_contain_cooldown
            elif ts["evidence"] >= rw.contain_isolate_evid:
                self._apply_containment(full=False)
                r += rw.rd_isolate_just
            else:
                ts["false_positives"] += 1
                r += rw.rd_isolate_fp

        elif action == D_HARD_BLOCK:
            if ts["contain_cooldown"] > 0:
                r += rw.rd_contain_cooldown
            elif ts["evidence"] >= rw.contain_block_evid:
                self._apply_containment(full=True)
                r += rw.rd_block_just
            else:
                ts["false_positives"] += 1
                r += rw.rd_block_fp

        elif action == D_PATCH_HARDEN:
            if breached or ts["suspicion"] > 1.0:
                ts["patched_level"] = min(1.0, ts["patched_level"] + rw.patch_step)
                r += rw.rd_patch_active
            else:
                ts["patched_level"] = min(1.0, ts["patched_level"] + rw.patch_step)
                r += rw.rd_patch_idle

        elif action == D_ROTATE_CREDS:
            if ts["credentials"] or ts["credential_anomaly"]:
                ts["credentials"] = False
                ts["credential_anomaly"] = False
                r += rw.rd_rotate_hit
            else:
                r += rw.rd_rotate_idle

        elif action == D_RESTORE_BACKUP:
            if ts["persistence"]:
                ts["persistence"] = False
                if ts["stage"] > STAGE_RECON:
                    ts["stage"] = STAGE_RECON
                    ts["credentials"] = False
                r += rw.rd_restore_hit
            else:
                r += rw.rd_restore_idle

        elif action == D_RAISE_ALERT:
            if anomalies >= 2.0 or ts["decoy_tripped"]:
                ts["alerts"] += 1
                ts["evidence"] += 1.0
                r += rw.rd_alert_hit if ts["alerts"] <= rw.rd_alert_cap else rw.rd_alert_spam
            else:
                ts["false_positives"] += 1
                r += rw.rd_alert_spam

        elif action == D_DECEPTION:
            ts["deception_count"] += 1
            if ts["decoys_deployed"] > 0 and ts["deception_count"] <= rw.rd_deception_cap:
                # Deception slows the attacker (treated as a soft rate limit)
                ts["rate_limit_steps"] = max(ts["rate_limit_steps"], 2)
                r += rw.rd_deception_hit
            else:
                r += rw.rd_deception_idle

        # Tiny passive decoy upkeep (must stay small to avoid farming)
        r += ts["decoys_deployed"] * rw.rd_decoy_passive
        return r

    def _apply_containment(self, full: bool) -> None:
        """Apply a justified containment. The response is disruptive, so it
        starts a cooldown and consumes the evidence that justified it (the
        SOC must re-detect to act again). Persistence lets the attacker
        survive; a full block with no persistence is a decisive eviction."""
        ts = self.true_state
        ts["justified_containments"] += 1
        ts["containment_active"] = True
        ts["contain_cooldown"] = self.rw.contain_cooldown_steps
        ts["evidence"] = 0.0
        ts["last_att_detected"] = 1

        if full and not ts["persistence"]:
            ts["evicted"] = True
            return
        # Knock back: persistence keeps a foothold, otherwise back to recon
        if ts["persistence"]:
            ts["stage"] = STAGE_FOOTHOLD
            ts["credentials"] = False
        else:
            ts["stage"] = STAGE_RECON
            ts["credentials"] = False
            ts["data_staged"] = False
        ts["foothold_count"] = max(0, ts["foothold_count"] - 1)

    def _exec_attacker_action(self, action: int) -> float:
        ts = self.true_state
        rw = self.rw
        rng = self.np_random
        r = 0.0
        stage = ts["stage"]
        rate_limited = ts["rate_limit_steps"] > 0

        def slowed(p: float) -> float:
            return p * rw.rate_limit_slow if rate_limited else p

        # ── Stealth-only actions (no decoy trip, often reduce heat) ──
        if action == A_PASSIVE_RECON:
            ts["recon_done"] = True
            ts["suspicion"] += rw.noise_passive_recon
            ts["last_att_success"] = 1
            r += rw.r_recon
            return r + self._survival_shaping()

        if action == A_DEFENSE_EVASION:
            if rng.random() < rw.evasion_success:
                ts["suspicion"] = max(0.0, ts["suspicion"] - rw.evasion_reduce)
                ts["last_att_success"] = 1
                r += rw.r_evasion
            else:
                ts["suspicion"] += rw.evasion_fail_noise   # caught clearing logs
                r += rw.r_action_failed
            return r + self._survival_shaping()

        if action == A_WAIT:
            ts["suspicion"] = max(0.0, ts["suspicion"] - rw.wait_suspicion_decay)
            r += rw.r_wait
            return r + self._survival_shaping()

        # ── Active actions: may trip a decoy, always emit noise ──
        tripped = False
        if action in ACTIVE_ATT_ACTIONS and ts["decoys_deployed"] > 0 and not ts["decoy_tripped"]:
            p_trip = min(rw.decoy_trip_cap, ts["decoys_deployed"] * rw.decoy_trip_base)
            if rng.random() < p_trip:
                tripped = True
                ts["decoy_tripped"] = True
                ts["evidence"] += rw.decoy_trip_evidence
                ts["suspicion"] += rw.decoy_trip_suspicion
                ts["last_att_detected"] = 1

        if action == A_ACTIVE_SCAN:
            ts["recon_done"] = True
            ts["suspicion"] += rw.noise_active_scan
            ts["last_att_success"] = 1
            r += rw.r_scan

        elif action == A_EXPLOIT:
            if stage == STAGE_RECON:
                p = rw.p_exploit_base + (rw.p_exploit_recon_bonus if ts["recon_done"] else 0.0)
                p *= (1.0 - rw.patch_success_penalty * ts["patched_level"])
                ts["suspicion"] += rw.noise_exploit
                if rng.random() < slowed(p):
                    ts["stage"] = STAGE_FOOTHOLD
                    ts["foothold_count"] = max(1, ts["foothold_count"])
                    ts["last_att_success"] = 1
                    r += rw.r_foothold
                else:
                    r += rw.r_action_failed
            else:
                r += rw.r_wrong_stage

        elif action == A_BRUTE_FORCE:
            if stage == STAGE_RECON:
                p = max(rw.p_brute_min, rw.p_brute_base - ts["failed_logins"] * rw.p_brute_decay)
                p *= (1.0 - rw.patch_success_penalty * ts["patched_level"])
                ts["suspicion"] += rw.noise_brute
                if rng.random() < slowed(p):
                    ts["stage"] = STAGE_FOOTHOLD
                    ts["foothold_count"] = max(1, ts["foothold_count"])
                    ts["last_att_success"] = 1
                    r += rw.r_foothold
                else:
                    ts["failed_logins"] += 1
                    r += rw.r_action_failed
            else:
                r += rw.r_wrong_stage

        elif action == A_PHISHING:
            if stage == STAGE_RECON:
                ts["suspicion"] += rw.noise_phishing
                if rng.random() < slowed(rw.p_phishing):
                    ts["stage"] = STAGE_FOOTHOLD
                    ts["foothold_count"] = max(1, ts["foothold_count"])
                    ts["last_att_success"] = 1
                    r += rw.r_foothold
                else:
                    r += rw.r_action_failed
            else:
                r += rw.r_wrong_stage

        elif action == A_PERSISTENCE:
            if stage >= STAGE_FOOTHOLD and not ts["persistence"]:
                ts["persistence"] = True
                ts["suspicion"] += rw.noise_persistence
                ts["last_att_success"] = 1
                r += rw.r_persistence
            else:
                r += rw.r_wrong_stage

        elif action == A_ESCALATE:
            if stage == STAGE_FOOTHOLD:
                p = rw.p_escalate_base + (rw.p_escalate_cred_bonus if ts["credentials"] else 0.0)
                p *= (1.0 - rw.patch_success_penalty * ts["patched_level"])
                ts["suspicion"] += rw.noise_escalate
                if rng.random() < slowed(max(rw.p_escalate_min, p)):
                    ts["stage"] = STAGE_PRIVILEGED
                    ts["last_att_success"] = 1
                    r += rw.r_privileged
                else:
                    r += rw.r_action_failed
            else:
                r += rw.r_wrong_stage

        elif action == A_DUMP_CREDS:
            if stage == STAGE_PRIVILEGED:
                ts["credentials"] = True
                ts["credential_anomaly"] = True
                ts["suspicion"] += rw.noise_dump
                ts["last_att_success"] = 1
                r += rw.r_dump_creds
            else:
                r += rw.r_wrong_stage

        elif action == A_LATERAL:
            if stage == STAGE_PRIVILEGED and ts["credentials"]:
                ts["foothold_count"] = min(rw.max_footholds, ts["foothold_count"] + 1)
                ts["credential_anomaly"] = True
                ts["suspicion"] += rw.noise_lateral
                ts["last_att_success"] = 1
                r += rw.r_lateral
            else:
                r += rw.r_wrong_stage

        elif action == A_COLLECT:
            if stage == STAGE_PRIVILEGED:
                ts["data_staged"] = True
                ts["suspicion"] += rw.noise_collect
                ts["last_att_success"] = 1
                r += rw.r_collect
            else:
                r += rw.r_wrong_stage

        elif action == A_EXFILTRATE:
            if stage == STAGE_PRIVILEGED and ts["data_staged"]:
                ts["egress_volume"] += 1
                ts["suspicion"] += rw.noise_exfil
                ts["last_att_success"] = 1
                r += rw.r_exfil
                if ts["egress_volume"] >= rw.exfil_objective_volume:
                    ts["objective_done"] = True
                    r += rw.r_impact_win
            else:
                r += rw.r_wrong_stage

        elif action == A_IMPACT:
            if stage == STAGE_PRIVILEGED:
                ts["suspicion"] += rw.noise_impact
                ts["objective_done"] = True
                ts["last_att_success"] = 1
                r += rw.r_impact_win
            else:
                r += rw.r_wrong_stage

        if tripped:
            r += rw.r_decoy_tripped
        if rate_limited and ts["last_att_success"] == 0:
            r += rw.r_rate_limited_fail
        return r + self._survival_shaping()

    def _survival_shaping(self) -> float:
        stage = self.true_state["stage"]
        rw = self.rw
        if stage == STAGE_RECON:
            return rw.surv_recon
        if stage == STAGE_FOOTHOLD:
            return rw.surv_foothold
        if stage == STAGE_PRIVILEGED:
            return rw.surv_privileged
        return 0.0

    # ── Info dict ──────────────────────────────────────────────────────────────

    def _build_info(
        self, att_action: int, def_action: int,
        att_r: float, def_r: float, terminated: bool, truncated: bool,
    ) -> dict:
        ts = self.true_state
        rw = self.rw
        info: Dict[str, Any] = {
            "step":              self.current_step,
            "curriculum_level":  self.curriculum_level,
            "stage":             ts["stage"],
            "kill_chain":        ts["stage"],   # back-compat alias for plots
            "suspicion":         round(ts["suspicion"], 2),
            "evidence":          round(ts["evidence"], 2),
            "failed_logins":     ts["failed_logins"],
            "egress_volume":     ts["egress_volume"],
            "decoys_deployed":   ts["decoys_deployed"],
            "att_action":        att_action,
            "def_action":        def_action,
            "att_step_reward":   att_r,
            "def_step_reward":   def_r,
            "opponent_id":       self._opponent_id,
        }
        if terminated or truncated:
            # Exclusive win conditions:
            #   Attacker wins by completing the objective (impact or enough
            #   exfiltration).
            #   Defender wins only by actually STOPPING the intrusion: a
            #   decisive eviction (full block with no persistence), or
            #   repeated evidence-backed containment (≥2) that keeps setting
            #   a persistent attacker back. A single knock-back is not a win —
            #   it just buys time. Detecting-but-not-stopping at the time
            #   limit is a draw (a dwelling, unresolved breach).
            att_win = ts["objective_done"]
            def_win = (not att_win) and (
                ts["evicted"] or ts["justified_containments"] >= 2
            )
            info.update({
                "ep_att_return":         sum(self._ep_att_rewards),
                "ep_def_return":         sum(self._ep_def_rewards),
                "attacker_win":          att_win,
                "defender_win":          def_win,
                "objective_done":        ts["objective_done"],
                "evicted":               ts["evicted"],
                "first_detection_step":  ts["first_detection_step"],
                "false_positives":       ts["false_positives"],
                "justified_containments": ts["justified_containments"],
                "alerts_triggered":      ts["alerts"],
                "final_evidence":        round(ts["evidence"], 2),
            })
        return info

    def render(self, mode: str = "human") -> None:
        ts = self.true_state
        names = {0: "RECON", 1: "FOOTHOLD", 2: "PRIVILEGED", 3: "OBJECTIVE"}
        print(
            f"[Step {self.current_step:3d}] stage={names[ts['stage']]:10s} "
            f"susp={ts['suspicion']:5.1f} evid={ts['evidence']:5.1f} "
            f"persist={int(ts['persistence'])} creds={int(ts['credentials'])} "
            f"decoys={ts['decoys_deployed']} egress={ts['egress_volume']} "
            f"rate_lim={ts['rate_limit_steps']}"
        )
