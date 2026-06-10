"""
shared_honeypot_env.py  –  CyberX MARL Environment  (v3.0)
============================================================
Two-agent shared environment: one instance trains either the attacker or
the defender (mode=...) while the opponent acts inside step() via an
injected policy.

v3.0 changes:
  • Fully seeded — every random draw goes through self.np_random, so
    reset(seed=...) makes trajectories reproducible. SB3 propagates
    per-worker seeds (seed+rank) automatically.
  • StatefulOpponent threads LSTM state across steps within an episode
    (RL opponents previously acted memoryless during training).
  • Hot-swap API for persistent worker pools: set_scripted_opponent(),
    load_rl_opponent(), set_curriculum_level() — all callable through
    VecEnv.env_method() without rebuilding subprocesses.
  • All reward coefficients live in RewardConfig (defaults = previous
    hardcoded values, with the game-design fixes below).
  • Win conditions are exclusive: attacker wins on sustained ROOT;
    defender wins only via a JUSTIFIED block recorded at block time
    (alert-only detection no longer auto-wins).
  • Rate limiting persists for rate_limit_duration steps and is no
    longer cleared by an unrelated block.
  • Post-cap exfiltration penalty raised so EV(priv-esc) strictly
    dominates exfil spam.

Action masking note: sb3-contrib's RecurrentPPO has no invalid-action
masking support, so curriculum gating remaps out-of-mask actions to
wait/monitor (action 9) instead of masking logits.
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

logger = logging.getLogger(__name__)

# ── Kill-chain states ──────────────────────────────────────────────────────────
STATE_EXTERNAL    = 0   # Not yet inside the target network
STATE_USER_ACCESS = 1   # Low-privilege foothold
STATE_ROOT_ACCESS = 2   # Full compromise

# ── Action names (used by the demo stream and telemetry adapter) ──────────────
ATT_ACTION_NAMES = [
    "brute_force_ssh", "enumerate", "recon", "exfiltrate_data",
    "privilege_escalation", "create_backdoor", "modify_files",
    "full_exfil_dump", "lateral_movement", "wait",
]
DEF_ACTION_NAMES = [
    "monitor", "rate_limit", "temp_block", "hard_block",
    "deploy_decoy", "rotate_config", "trigger_alert", "isolate_segment",
    "full_reset", "active_deception",
]

# ── Curriculum levels ─────────────────────────────────────────────────────────
#   Level 0  →  restricted action sets, no noise, scripted opponent
#   Level 1  →  full action sets, low noise, scripted opponent
#   Level 2  →  full action sets, realistic noise, self-play
CURRICULUM_CONFIG = {
    # Level 0: minimal actions so agents learn the core loop first.
    #   Attacker keeps brute-force (0), exfil (3), priv-esc (4), wait (9) —
    #   without priv-esc the attacker can never reach ROOT and win rates
    #   stay 0% forever. Defender keeps monitor/rate-limit/temp-block/
    #   decoy/alert/wait.
    0: {"noise_rate": 0.00, "max_steps": 75,
        "att_mask": [0, 3, 4, 9],
        "def_mask": [0, 1, 2, 4, 6, 9]},
    1: {"noise_rate": 0.08, "max_steps": 75,
        "att_mask": list(range(10)), "def_mask": list(range(10))},
    2: {"noise_rate": 0.15, "max_steps": 100,
        "att_mask": list(range(10)), "def_mask": list(range(10))},
}


# ── Reward configuration ───────────────────────────────────────────────────────

@dataclass(frozen=True)
class RewardConfig:
    """All reward/probability coefficients. Defaults preserve the tuned v2
    values except where annotated as a v3 game-design fix.

    Design principles (±20 scale):
      • Small rewards for correct conservative play (+0.5)
      • Moderate rewards for correct active responses (+5 to +10)
      • Large rewards only for decisive outcomes (+15 to +25)
      • Penalties smaller than the corresponding correct-play reward
    """

    # ── Defender action rewards ──
    monitor_quiet:          float = 0.5
    monitor_while_breached: float = -0.3
    rate_limit_hit:         float = 4.0
    rate_limit_fp:          float = -1.0
    rate_limit_duration:    int   = 3      # v3: persists N steps, not cleared by blocks
    temp_block_hit:         float = 10.0
    temp_block_fp:          float = -3.0
    hard_block_hit:         float = 15.0
    hard_block_fp:          float = -5.0
    decoy_deploy:           float = 2.0
    decoy_after_cap:        float = 0.5
    decoy_cap:              int   = 5
    rotate_hit:             float = 8.0
    rotate_fp:              float = -1.0
    alert_hit:              float = 5.0
    alert_spam:             float = -3.0
    alert_fp:               float = -2.0
    alert_cap:              int   = 2
    isolate_hit:            float = 18.0
    isolate_fp:             float = -6.0
    full_reset_cost:        float = -4.0
    deception_with_decoys:  float = 3.0
    deception_no_decoys:    float = 0.5
    deception_after_cap:    float = 0.1
    deception_cap:          int   = 3
    decoy_passive_per_step: float = 0.1
    block_spam_pen:         float = -10.0
    block_spam_cap:         int   = 5
    missed_escalation_pen:  float = -8.0
    immediate_detect_bonus: float = 3.0

    # ── Attacker action rewards ──
    rate_limited_fail:      float = -1.0
    rate_limited_prob:      float = 0.45
    brute_success:          float = 12.0
    brute_fail:             float = -0.5
    brute_inside_pen:       float = -2.0
    brute_base_prob:        float = 0.35
    brute_min_prob:         float = 0.15
    brute_prob_decay:       float = 0.01   # per failed login
    enum_base:              float = 4.0
    enum_min:               float = 1.0
    recon_reward:           float = 3.0
    exfil_reward:           float = 10.0
    exfil_cap:              int   = 3
    exfil_after_cap:        float = -2.0   # v3 fix: was -1.0; EV(priv-esc) now strictly dominates
    exfil_wrong_state:      float = -3.0
    privesc_success:        float = 25.0
    privesc_fail:           float = -1.0
    privesc_wrong_state:    float = -4.0
    privesc_base_prob:      float = 0.40
    privesc_min_prob:       float = 0.10
    privesc_decoy_decay:    float = 0.05   # per deployed decoy
    backdoor_reward:        float = 14.0
    modify_reward:          float = 10.0
    dump_reward:            float = 18.0
    root_wrong_state:       float = -4.0
    lateral_reward:         float = 6.0
    wrong_state_pen:        float = -2.0
    wait_pen:               float = -0.2
    blocked_pen:            float = -5.0
    decoy_penalty_rate:     float = 0.5    # attacker reward loss per deployed decoy

    # ── Survival shaping ──
    stuck_external_base:    float = 0.3
    stuck_external_rate:    float = 0.02
    stuck_external_max:     float = 0.5
    survival_user:          float = 0.5
    survival_root:          float = 2.0


DEFAULT_REWARDS = RewardConfig()


# ── Shared observation builder (also used by telemetry_adapter.py) ────────────

def defender_observation(
    failed_logins:     float,
    suspicious_events: float,
    is_blocked:        bool,
    step_fraction:     float,
    files_downloaded:  float,
    is_rate_limited:   bool,
    decoys_deployed:   float,
    alerts_triggered:  float,
) -> np.ndarray:
    """8-dim L∞-normalized defender observation. Single source of truth for
    the layout — the live telemetry adapter builds the same vector from
    real Elasticsearch events."""
    raw = np.array([
        failed_logins / 50.0,
        suspicious_events / 30.0,
        float(is_blocked),
        step_fraction,
        files_downloaded / 20.0,
        float(is_rate_limited),
        decoys_deployed / 5.0,
        alerts_triggered / 10.0,
    ], dtype=np.float32)
    return np.clip(raw, 0.0, 1.0)


# ── Stateful opponent wrapper ──────────────────────────────────────────────────

class StatefulOpponent:
    """Wraps an SB3 recurrent model so its LSTM hidden state persists across
    steps within an episode. The env calls .reset() at episode boundaries.

    Without this, every opponent_model.predict(obs) call starts from a zero
    LSTM state — the opponent plays memoryless and self-play quality drops.
    """

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
    Shared attacker/defender environment for CyberX MARL.

    Parameters
    ----------
    mode : 'attacker' | 'defender'
        Which agent this env instance trains.
    max_steps : int
        Overrides curriculum default when set explicitly.
    opponent_model : object with .predict(obs) -> (action, _)
        The current opponent. None → seeded random policy over the
        opponent's curriculum mask. May expose .reset() for episode
        boundaries (StatefulOpponent does).
    curriculum_level : int  0 | 1 | 2
    rewards : RewardConfig
        Reward coefficients; defaults to DEFAULT_REWARDS.
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

        # Action / observation spaces (always full size; masking done inside step)
        self.action_space = spaces.Discrete(10)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(8,), dtype=np.float32
        )

        self.current_step = 0
        self.true_state: Dict[str, Any] = {}
        self._reset_true_state()

        # Per-episode stat accumulators for the info dict
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
        """Swap in a scripted opponent by registry name without rebuilding
        the worker process. See baselines.OPPONENT_REGISTRY."""
        from baselines import OPPONENT_REGISTRY
        self.opponent_model = OPPONENT_REGISTRY[name]()
        self._opponent_id = name
        return name

    def load_rl_opponent(self, path: str) -> bool:
        """Load a frozen RL opponent from disk (CPU) inside this worker and
        wrap it so its LSTM state persists within episodes."""
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

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _reset_true_state(self) -> None:
        self.true_state = {
            # Shared world state
            "kill_chain_level":   STATE_EXTERNAL,
            "is_blocked":         False,   # soft block – no longer terminal
            "rate_limit_steps":   0,       # v3: duration counter, not a bool
            "decoys_deployed":    0,
            "failed_logins":      0,
            "suspicious_events":  0,
            "files_downloaded":   0,
            "alerts_triggered":   0,
            # Attacker POMDP tracking
            "att_last_success":   0,
            "att_last_timeout":   0,
            # Defender internal counters
            "false_positives":    0,
            "blocks_issued":      0,
            "justified_blocks":   0,       # v3: recorded at block time
            "active_deception_count": 0,
            # For time-to-detect reward shaping
            "first_detection_step": None,
        }

    def _apply_curriculum_mask(self, action: int, is_attacker: bool) -> int:
        """Remap out-of-curriculum actions to a safe no-op (wait/monitor)."""
        mask = self._att_mask if is_attacker else self._def_mask
        return action if action in mask else 9

    def _get_opponent_action(self) -> int:
        if self.opponent_model is None:
            opp_mask = self._def_mask if self.mode == "attacker" else self._att_mask
            return int(self.np_random.choice(opp_mask))
        obs = self._get_raw_observation(is_opponent=True)
        result = self.opponent_model.predict(obs, deterministic=True)
        action = result[0] if isinstance(result, tuple) else result
        return int(np.asarray(action).item())

    # ── Observation builders ───────────────────────────────────────────────────

    def _get_raw_observation(self, is_opponent: bool = False) -> np.ndarray:
        """POMDP observation for either the main agent or the opponent.
        Each agent sees only its own slice of the world."""
        perspective = self.mode
        if is_opponent:
            perspective = "defender" if self.mode == "attacker" else "attacker"

        ts = self.true_state
        if perspective == "attacker":
            raw = np.array([
                ts["kill_chain_level"] / 2.0,
                self.current_step / float(self.max_steps),
                float(ts["att_last_success"]),
                float(ts["att_last_timeout"]),
                0.0, 0.0, 0.0, 0.0,
            ], dtype=np.float32)
            return np.clip(raw, 0.0, 1.0)

        return defender_observation(
            failed_logins     = ts["failed_logins"],
            suspicious_events = ts["suspicious_events"],
            is_blocked        = ts["is_blocked"],
            step_fraction     = self.current_step / float(self.max_steps),
            files_downloaded  = ts["files_downloaded"],
            is_rate_limited   = ts["rate_limit_steps"] > 0,
            decoys_deployed   = ts["decoys_deployed"],
            alerts_triggered  = ts["alerts_triggered"],
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
        # Episode boundary housekeeping for the opponent: re-seed its RNG from
        # ours (keeps the full trajectory reproducible) and clear any
        # per-episode state (LSTM memory, back-off counters).
        if self.opponent_model is not None:
            if hasattr(self.opponent_model, "seed"):
                self.opponent_model.seed(int(self.np_random.integers(2**31)))
            if hasattr(self.opponent_model, "reset"):
                self.opponent_model.reset()
        return self._get_observation(), {"curriculum_level": self.curriculum_level}

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        self.current_step += 1

        # Benign noise injection (curriculum-gated)
        if self.np_random.random() < self.noise_rate:
            self.true_state["failed_logins"] += 1

        opp_action = self._get_opponent_action()

        if self.mode == "attacker":
            att_action = self._apply_curriculum_mask(action, is_attacker=True)
            def_action = self._apply_curriculum_mask(opp_action, is_attacker=False)
        else:
            def_action = self._apply_curriculum_mask(action, is_attacker=False)
            att_action = self._apply_curriculum_mask(opp_action, is_attacker=True)

        att_r, def_r = self._resolve_turn(att_action, def_action)

        self._ep_att_rewards.append(att_r)
        self._ep_def_rewards.append(def_r)

        truncated = self.current_step >= self.max_steps
        # Natural terminal: attacker achieves full root compromise AND
        # survives (not immediately blocked). Blocking never ends the
        # episode — the attacker is kicked back to EXTERNAL instead.
        terminated = (
            self.true_state["kill_chain_level"] == STATE_ROOT_ACCESS
            and not self.true_state["is_blocked"]
            and self.current_step >= 10
        )

        reward = att_r if self.mode == "attacker" else def_r
        info = self._build_info(att_action, def_action, att_r, def_r, terminated, truncated)
        return self._get_observation(), reward, terminated, truncated, info

    # ── Core game logic ────────────────────────────────────────────────────────

    def _resolve_turn(self, att_action: int, def_action: int) -> Tuple[float, float]:
        ts = self.true_state
        rw = self.rw

        # Reset per-step POMDP flags
        ts["att_last_success"] = 0
        ts["att_last_timeout"] = 0

        prev_kill_chain = ts["kill_chain_level"]

        # Defender moves first (sets up the environment the attacker faces)
        def_r = self._exec_defender_action(def_action)
        att_r = self._exec_attacker_action(att_action)

        # Cross-agent consequences
        if ts["kill_chain_level"] > prev_kill_chain:
            def_r += rw.missed_escalation_pen

        if ts["is_blocked"]:
            # Soft block: attacker penalised, kill chain reset, episode continues.
            # v3: rate limiting is NOT cleared here — it expires on its own.
            att_r += rw.blocked_pen
            ts["kill_chain_level"] = STATE_EXTERNAL
            ts["is_blocked"] = False
            ts["blocks_issued"] += 1
            ts["att_last_timeout"] = 1
            if ts["first_detection_step"] is None:
                ts["first_detection_step"] = self.current_step

        # Rate limit expires after rate_limit_duration turns
        if ts["rate_limit_steps"] > 0:
            ts["rate_limit_steps"] -= 1

        # Time-pressure bonus for the defender: detecting immediately pays
        if ts["first_detection_step"] is not None:
            if self.current_step - ts["first_detection_step"] == 0:
                def_r += rw.immediate_detect_bonus

        return att_r, def_r

    def _record_block(self) -> None:
        """A block fires. It only counts toward the win condition when it was
        justified by attacker-driven evidence at block time — benign noise
        (failed logins) alone is not justification."""
        ts = self.true_state
        ts["is_blocked"] = True
        if ts["suspicious_events"] >= 2 or ts["kill_chain_level"] > STATE_EXTERNAL:
            ts["justified_blocks"] += 1

    def _exec_defender_action(self, action: int) -> float:
        ts = self.true_state
        rw = self.rw
        r = 0.0

        if action == 0:
            # Monitor — correct when quiet, lightly penalised when breached
            # (prevents collapse to "always monitor").
            if ts["kill_chain_level"] > STATE_EXTERNAL:
                r += rw.monitor_while_breached
            else:
                r += rw.monitor_quiet

        elif action == 1:
            # Rate limit – justified if ≥2 suspicious events
            if ts["suspicious_events"] >= 2 or ts["failed_logins"] >= 3:
                ts["rate_limit_steps"] = rw.rate_limit_duration
                r += rw.rate_limit_hit
            else:
                ts["false_positives"] += 1
                r += rw.rate_limit_fp

        elif action == 2:
            # Temporary block – justified if ≥3 suspicious events
            if ts["suspicious_events"] >= 3 or ts["failed_logins"] >= 5:
                self._record_block()
                r += rw.temp_block_hit
            else:
                ts["false_positives"] += 1
                r += rw.temp_block_fp

        elif action == 3:
            # Hard block – justified if ≥5 suspicious events or files stolen
            if ts["suspicious_events"] >= 5 or ts["files_downloaded"] > 0:
                self._record_block()
                r += rw.hard_block_hit
            else:
                ts["false_positives"] += 1
                r += rw.hard_block_fp

        elif action == 4:
            # Deploy honeypot decoy – diminishing returns past the cap
            if ts["decoys_deployed"] < rw.decoy_cap:
                ts["decoys_deployed"] += 1
                r += rw.decoy_deploy
            else:
                r += rw.decoy_after_cap

        elif action == 5:
            # Rotate honeypot config – useful mid-intrusion
            if ts["kill_chain_level"] > STATE_EXTERNAL:
                ts["kill_chain_level"] = max(STATE_EXTERNAL, ts["kill_chain_level"] - 1)
                r += rw.rotate_hit
            else:
                r += rw.rotate_fp

        elif action == 6:
            # Trigger alert — capped per episode, spam penalised
            if ts["suspicious_events"] >= 2:
                ts["alerts_triggered"] += 1
                if ts["first_detection_step"] is None:
                    ts["first_detection_step"] = self.current_step
                r += rw.alert_hit if ts["alerts_triggered"] <= rw.alert_cap else rw.alert_spam
            else:
                ts["false_positives"] += 1
                r += rw.alert_fp

        elif action == 7:
            # Isolate segment – high-value move if attacker is inside
            if ts["kill_chain_level"] > STATE_EXTERNAL:
                self._record_block()
                r += rw.isolate_hit
            else:
                ts["false_positives"] += 1
                r += rw.isolate_fp

        elif action == 8:
            # Full reset – very costly; last resort only
            self._reset_true_state()
            r += rw.full_reset_cost

        elif action == 9:
            # Active deception (honeytokens) — capped per episode
            count = ts["active_deception_count"]
            ts["active_deception_count"] = count + 1
            if count < rw.deception_cap:
                r += (rw.deception_with_decoys if ts["decoys_deployed"] > 0
                      else rw.deception_no_decoys)
            else:
                r += rw.deception_after_cap

        # Small passive reward per decoy per step (encourages setup)
        r += ts["decoys_deployed"] * rw.decoy_passive_per_step

        # Block frequency cap: blocking every step is spam, not defense
        if ts["blocks_issued"] > rw.block_spam_cap:
            r += rw.block_spam_pen

        return r

    def _exec_attacker_action(self, action: int) -> float:
        ts = self.true_state
        rw = self.rw
        rng = self.np_random
        r = 0.0
        cur = ts["kill_chain_level"]

        # Rate limiting makes attacker actions fail probabilistically
        if ts["rate_limit_steps"] > 0 and rng.random() < rw.rate_limited_prob:
            ts["att_last_timeout"] = 1
            return rw.rate_limited_fail

        # Decoys waste the attacker's time on fake assets
        decoy_penalty = ts["decoys_deployed"] * rw.decoy_penalty_rate

        if action == 0:
            # Brute-force SSH (only useful from EXTERNAL)
            if cur == STATE_EXTERNAL:
                success_prob = max(
                    rw.brute_min_prob,
                    rw.brute_base_prob - ts["failed_logins"] * rw.brute_prob_decay,
                )
                if rng.random() < success_prob:
                    ts["kill_chain_level"] = STATE_USER_ACCESS
                    ts["suspicious_events"] += 1
                    ts["att_last_success"] = 1
                    r += rw.brute_success
                else:
                    ts["failed_logins"] += 1
                    r += rw.brute_fail
            else:
                r += rw.brute_inside_pen

        elif action == 1:
            # Enumerate users / services (USER+)
            if cur >= STATE_USER_ACCESS:
                r += max(rw.enum_min, rw.enum_base - decoy_penalty)
                ts["suspicious_events"] += 1
                ts["att_last_success"] = 1
            else:
                r += rw.wrong_state_pen

        elif action == 2:
            # Recon commands (USER+)
            if cur >= STATE_USER_ACCESS:
                r += rw.recon_reward
                ts["suspicious_events"] += 1
                ts["att_last_success"] = 1
            else:
                r += rw.wrong_state_pen

        elif action == 3:
            # Exfiltrate data — capped; after the cap it actively penalises
            # so priv-esc is strictly better than exfil spam.
            if cur >= STATE_USER_ACCESS:
                ts["files_downloaded"] += 1
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += (rw.exfil_reward if ts["files_downloaded"] <= rw.exfil_cap
                      else rw.exfil_after_cap)
            else:
                r += rw.exfil_wrong_state

        elif action == 4:
            # Privilege escalation (USER → ROOT)
            if cur == STATE_USER_ACCESS:
                success_prob = max(
                    rw.privesc_min_prob,
                    rw.privesc_base_prob - decoy_penalty * rw.privesc_decoy_decay,
                )
                if rng.random() < success_prob:
                    ts["kill_chain_level"] = STATE_ROOT_ACCESS
                    ts["suspicious_events"] += 3
                    ts["att_last_success"] = 1
                    r += rw.privesc_success
                else:
                    r += rw.privesc_fail
            else:
                r += rw.privesc_wrong_state

        elif action == 5:
            # Create backdoor (ROOT only)
            if cur == STATE_ROOT_ACCESS:
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += rw.backdoor_reward
            else:
                r += rw.root_wrong_state

        elif action == 6:
            # Modify system files (ROOT only)
            if cur == STATE_ROOT_ACCESS:
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += rw.modify_reward
            else:
                r += rw.root_wrong_state

        elif action == 7:
            # Full exfil dump (ROOT only)
            if cur == STATE_ROOT_ACCESS:
                ts["files_downloaded"] += 3
                ts["suspicious_events"] += 3
                ts["att_last_success"] = 1
                r += rw.dump_reward
            else:
                r += rw.root_wrong_state

        elif action == 8:
            # Lateral movement / internal port scan (USER+)
            if cur >= STATE_USER_ACCESS:
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += rw.lateral_reward
            else:
                r += rw.wrong_state_pen

        elif action == 9:
            # Wait / observe (always valid, tiny cost)
            r += rw.wait_pen
            ts["att_last_success"] = 1   # not failing = success by definition

        # Survival / time-pressure shaping
        if ts["kill_chain_level"] == STATE_EXTERNAL:
            steps_stuck = max(0, self.current_step - 5)
            r -= rw.stuck_external_base + min(
                rw.stuck_external_max, steps_stuck * rw.stuck_external_rate
            )
        elif ts["kill_chain_level"] == STATE_USER_ACCESS:
            r += rw.survival_user
        elif ts["kill_chain_level"] == STATE_ROOT_ACCESS:
            # ROOT pays substantially more per step than USER so the attacker
            # prefers escalating over camping at USER.
            r += rw.survival_root

        return r

    # ── Info dict ──────────────────────────────────────────────────────────────

    def _build_info(
        self,
        att_action: int,
        def_action: int,
        att_r: float,
        def_r: float,
        terminated: bool,
        truncated: bool,
    ) -> dict:
        ts = self.true_state
        info: Dict[str, Any] = {
            "step":              self.current_step,
            "curriculum_level":  self.curriculum_level,
            "kill_chain":        ts["kill_chain_level"],
            "suspicious_events": ts["suspicious_events"],
            "failed_logins":     ts["failed_logins"],
            "files_downloaded":  ts["files_downloaded"],
            "decoys_deployed":   ts["decoys_deployed"],
            "att_action":        att_action,
            "def_action":        def_action,
            "att_step_reward":   att_r,
            "def_step_reward":   def_r,
            "opponent_id":       self._opponent_id,
        }
        if terminated or truncated:
            # Exclusive win conditions (v3):
            #   Attacker wins by reaching ROOT and surviving.
            #   Defender wins ONLY via a justified block (recorded at block
            #   time) — alerts alone are detection, not containment.
            att_win = terminated and (ts["kill_chain_level"] == STATE_ROOT_ACCESS)
            def_win = (not att_win) and ts["justified_blocks"] >= 1

            info.update({
                "ep_att_return":        sum(self._ep_att_rewards),
                "ep_def_return":        sum(self._ep_def_rewards),
                "attacker_win":         att_win,
                "defender_win":         def_win,
                "first_detection_step": ts["first_detection_step"],
                "false_positives":      ts["false_positives"],
                "blocks_issued":        ts["blocks_issued"],
                "justified_blocks":     ts["justified_blocks"],
                "alerts_triggered":     ts["alerts_triggered"],
            })
        return info

    def render(self, mode: str = "human") -> None:
        ts = self.true_state
        kc_names = {0: "EXTERNAL", 1: "USER_ACCESS", 2: "ROOT_ACCESS"}
        print(
            f"[Step {self.current_step:3d}] "
            f"KillChain={kc_names[ts['kill_chain_level']]} | "
            f"SuspEvt={ts['suspicious_events']} | "
            f"FailedLogins={ts['failed_logins']} | "
            f"Files={ts['files_downloaded']} | "
            f"Decoys={ts['decoys_deployed']} | "
            f"RateLimit={ts['rate_limit_steps'] > 0}"
        )
