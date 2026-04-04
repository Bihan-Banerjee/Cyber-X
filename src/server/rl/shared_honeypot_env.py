"""
shared_honeypot_env.py  –  CyberX MARL Environment  (v2.0)
============================================================
Key fixes vs v1:
  • Blocking no longer terminates the episode – attacker is reset to
    STATE_EXTERNAL (kicked back to the start).  Both agents keep
    collecting experience throughout the full episode.
  • All rewards are normalised to a consistent ±20 scale so the
    attacker's priv-esc signal no longer drowns everything else.
  • 15 % benign noise kept, but normalised in the observation layer.
  • Curriculum levels (0-2) gate action complexity and noise,
    letting agents learn basics before full self-play.
  • POMDP observations are now L∞-normalised per-perspective so the
    LSTM sees values in roughly [0, 1] rather than raw counts.
  • Rich info dict returned on every step for the evaluator.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random
from typing import Optional, Tuple, Dict, Any

# ── Kill-chain states ──────────────────────────────────────────────────────────
STATE_EXTERNAL   = 0   # Not yet inside the target network
STATE_USER_ACCESS  = 1   # Low-privilege foothold
STATE_ROOT_ACCESS  = 2   # Full compromise

# ── Curriculum levels ─────────────────────────────────────────────────────────
#   Level 0  →  restricted action sets, no noise, scripted opponent
#   Level 1  →  full action sets, low noise, scripted opponent
#   Level 2  →  full action sets, realistic noise, self-play
CURRICULUM_CONFIG = {
    # Level 0: minimal actions so agents learn the core loop first.
    #   Attacker gets brute-force (0), priv-esc (4), exfil (3), and wait (9).
    #   WITHOUT action 4, attacker can NEVER reach ROOT → nobody ever wins →
    #   all episodes truncate → win rates stay 0% forever.  This was the
    #   primary bug causing flat results in the first smoke test.
    #   Defender gets monitor (0), rate-limit (1), temp-block (2),
    #   decoy (4), alert (6 – needed for first_detection_step), wait (9).
    0: {"noise_rate": 0.00, "max_steps": 75,
        "att_mask": [0, 3, 4, 9],
        "def_mask": [0, 1, 2, 4, 6, 9]},
    # Level 1: full actions, low noise.
    1: {"noise_rate": 0.08, "max_steps": 75,  "att_mask": list(range(10)),  "def_mask": list(range(10))},
    # Level 2: full actions, realistic noise, self-play.
    2: {"noise_rate": 0.15, "max_steps": 100, "att_mask": list(range(10)),  "def_mask": list(range(10))},
}

# ── Observation normalisers (upper bounds for L∞ normalisation) ───────────────
ATT_OBS_MAX = np.array([2.0, 100.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0], dtype=np.float32)
DEF_OBS_MAX = np.array([50.0, 30.0, 1.0, 100.0, 20.0, 1.0, 0.0, 0.0], dtype=np.float32)


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
        The current opponent.  None → random policy.
    curriculum_level : int  0 | 1 | 2
        Difficulty gate.  Passed in by the Trainer and incremented
        as agents improve.
    """

    metadata = {"render.modes": ["human"]}

    def __init__(
        self,
        mode: str = "attacker",
        max_steps: Optional[int] = None,
        opponent_model=None,
        curriculum_level: int = 2,
    ):
        super().__init__()
        assert mode in ("attacker", "defender"), f"Invalid mode: {mode}"
        self.mode = mode
        self.opponent_model = opponent_model
        self.curriculum_level = min(max(curriculum_level, 0), 2)

        cfg = CURRICULUM_CONFIG[self.curriculum_level]
        self.max_steps = max_steps if max_steps is not None else cfg["max_steps"]
        self.noise_rate = cfg["noise_rate"]
        self._att_mask = cfg["att_mask"]
        self._def_mask = cfg["def_mask"]

        # Action / observation spaces (always full size; masking done inside step)
        self.action_space = spaces.Discrete(10)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(8,), dtype=np.float32
        )

        # Episode counters / state – initialised in reset()
        self.current_step = 0
        self.true_state: Dict[str, Any] = {}
        self._reset_true_state()

        # Per-episode stat accumulators for the info dict
        self._ep_att_rewards: list = []
        self._ep_def_rewards: list = []
        self._ep_att_actions: list = []
        self._ep_def_actions: list = []

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _reset_true_state(self) -> None:
        self.true_state = {
            # Shared world state
            "kill_chain_level":   STATE_EXTERNAL,
            "is_blocked":         False,   # soft block – no longer terminal
            "is_rate_limited":    False,
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
            # For time-to-detect reward shaping
            "first_detection_step": None,
        }

    def _apply_curriculum_mask(self, action: int, is_attacker: bool) -> int:
        """Remap out-of-curriculum actions to a safe no-op."""
        mask = self._att_mask if is_attacker else self._def_mask
        if action not in mask:
            return 9  # wait / monitor
        return action

    def _get_opponent_action(self) -> int:
        if self.opponent_model is None:
            opp_mask = self._def_mask if self.mode == "attacker" else self._att_mask
            return random.choice(opp_mask)
        obs = self._get_raw_observation(is_opponent=True)
        result = self.opponent_model.predict(obs, deterministic=True)
        action = result[0] if isinstance(result, tuple) else result
        return int(np.asarray(action).item())

    # ── Observation builders ───────────────────────────────────────────────────

    def _get_raw_observation(self, is_opponent: bool = False) -> np.ndarray:
        """
        Returns the POMDP observation for either the main agent or the opponent.
        Each agent sees only its own slice of the world – not the other's.
        """
        perspective = self.mode
        if is_opponent:
            perspective = "defender" if self.mode == "attacker" else "attacker"

        ts = self.true_state
        if perspective == "attacker":
            raw = np.array([
                float(ts["kill_chain_level"]),   # 0-2
                float(self.current_step),         # 0-max_steps
                float(ts["att_last_success"]),    # 0/1
                float(ts["att_last_timeout"]),    # 0/1
                0.0, 0.0, 0.0, 0.0,
            ], dtype=np.float32)
            # Normalise
            divisors = np.array([2.0, float(self.max_steps), 1.0, 1.0, 1.0, 1.0, 1.0, 1.0])
        else:
            raw = np.array([
                float(ts["failed_logins"]),       # noisy login count
                float(ts["suspicious_events"]),   # cumulative IOC count
                float(ts["is_blocked"]),           # soft block active?
                float(self.current_step),          # time pressure
                float(ts["files_downloaded"]),     # exfil indicator
                float(ts["is_rate_limited"]),      # rate limit active?
                float(ts["decoys_deployed"]),      # deception coverage
                float(ts["alerts_triggered"]),     # escalation awareness
            ], dtype=np.float32)
            divisors = np.array([50.0, 30.0, 1.0, float(self.max_steps),
                                 20.0, 1.0, 5.0, 10.0])

        return np.clip(raw / np.maximum(divisors, 1e-6), 0.0, 1.0)

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
        self._ep_att_actions = []
        self._ep_def_actions = []
        return self._get_observation(), {"curriculum_level": self.curriculum_level}

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        self.current_step += 1

        # ── Benign noise injection (curriculum-gated) ──────────────────────
        if random.random() < self.noise_rate:
            self.true_state["failed_logins"] += 1

        # ── Determine both agents' actions ────────────────────────────────
        opp_action = self._get_opponent_action()

        if self.mode == "attacker":
            att_action = self._apply_curriculum_mask(action, is_attacker=True)
            def_action = self._apply_curriculum_mask(opp_action, is_attacker=False)
        else:
            def_action = self._apply_curriculum_mask(action, is_attacker=False)
            att_action = self._apply_curriculum_mask(opp_action, is_attacker=True)

        # ── Resolve the turn ───────────────────────────────────────────────
        att_r, def_r = self._resolve_turn(att_action, def_action)

        self._ep_att_rewards.append(att_r)
        self._ep_def_rewards.append(def_r)
        self._ep_att_actions.append(att_action)
        self._ep_def_actions.append(def_action)

        # ── Termination (time only – not blocking) ─────────────────────────
        truncated  = self.current_step >= self.max_steps
        # Natural terminal: attacker achieves full root compromise AND
        # survives to end-of-episode (not immediately blocked).
        # We do NOT end on block – the attacker just gets kicked back.
        terminated = (
            self.true_state["kill_chain_level"] == STATE_ROOT_ACCESS
            and not self.true_state["is_blocked"]
            and self.current_step >= 10   # must survive at least 10 steps
        )

        reward = att_r if self.mode == "attacker" else def_r

        info = self._build_info(att_action, def_action, att_r, def_r, terminated, truncated)
        return self._get_observation(), reward, terminated, truncated, info

    # ── Core game logic ────────────────────────────────────────────────────────

    def _resolve_turn(self, att_action: int, def_action: int) -> Tuple[float, float]:
        """
        Resolve one full turn.  All reward values are in the range ±20
        so the LSTM value function can converge without one signal
        dominating the gradient.

        Reward design principles:
          • Consistent small rewards for correct conservative play (+0.5)
          • Moderate rewards for correct active responses (+5 to +10)
          • Large rewards only for decisive outcomes (+15 to +20)
          • Penalties are always smaller than the corresponding reward
            (max penalty = 60 % of max reward for that action class)
          • Blocking resets attacker to EXTERNAL – episode continues
        """
        ts = self.true_state
        att_r = 0.0
        def_r = 0.0

        # Reset per-step POMDP flags
        ts["att_last_success"] = 0
        ts["att_last_timeout"] = 0

        prev_kill_chain = ts["kill_chain_level"]

        # ── Defender moves first (sets up the environment the attacker faces) ─
        def_r += self._exec_defender_action(def_action)

        # ── Attacker acts against the environment defender just set up ────────
        att_r += self._exec_attacker_action(att_action)

        # ── Cross-agent consequence rewards ───────────────────────────────────
        if ts["kill_chain_level"] > prev_kill_chain:
            # Attacker escalated: defender penalised, attacker already rewarded
            def_r -= 8.0

        if ts["is_blocked"]:
            # Soft block: attacker penalised, kill chain reset (not episode end)
            att_r -= 5.0
            ts["kill_chain_level"] = STATE_EXTERNAL
            ts["is_blocked"] = False          # reset for next turn
            ts["is_rate_limited"] = False
            ts["blocks_issued"] += 1
            ts["att_last_timeout"] = 1
            if ts["first_detection_step"] is None:
                ts["first_detection_step"] = self.current_step

        # Time-pressure bonus for defender: reward earlier detection more
        if ts["first_detection_step"] is not None:
            steps_elapsed = self.current_step - ts["first_detection_step"]
            if steps_elapsed == 0:
                def_r += 3.0  # immediate detection bonus (applied once)

        return att_r, def_r

    def _exec_defender_action(self, action: int) -> float:
        ts = self.true_state
        r = 0.0

        if action == 0:
            # Monitor only – small sustained reward for not over-reacting.
            # BUT: if the attacker is already inside, passive monitoring is
            # bad and should be penalised lightly to prevent policy collapse
            # to "always monitor regardless of state".
            if ts["kill_chain_level"] > STATE_EXTERNAL:
                r -= 0.3   # inaction penalty when threat is active
            else:
                r += 0.5   # correct conservative play when all is quiet

        elif action == 1:
            # Rate limit – justified if ≥2 suspicious events
            if ts["suspicious_events"] >= 2 or ts["failed_logins"] >= 3:
                ts["is_rate_limited"] = True
                r += 4.0
            else:
                ts["false_positives"] += 1
                r -= 1.0

        elif action == 2:
            # Temporary block – justified if ≥3 suspicious events
            if ts["suspicious_events"] >= 3 or ts["failed_logins"] >= 5:
                ts["is_blocked"] = True   # triggers reset in _resolve_turn
                r += 10.0
            else:
                ts["false_positives"] += 1
                r -= 3.0

        elif action == 3:
            # Hard block – justified if ≥5 suspicious events or files stolen
            if ts["suspicious_events"] >= 5 or ts["files_downloaded"] > 0:
                ts["is_blocked"] = True
                r += 15.0
            else:
                ts["false_positives"] += 1
                r -= 5.0

        elif action == 4:
            # Deploy honeypot decoy – passive reward per decoy per step
            if ts["decoys_deployed"] < 5:
                ts["decoys_deployed"] += 1
                r += 2.0
            else:
                r += 0.5  # diminishing returns

        elif action == 5:
            # Rotate honeypot config – useful mid-intrusion
            if ts["kill_chain_level"] > STATE_EXTERNAL:
                ts["kill_chain_level"] = max(STATE_EXTERNAL, ts["kill_chain_level"] - 1)
                r += 8.0
            else:
                r -= 1.0   # wasteful if no intruder

        elif action == 6:
            # Trigger alert – useful if evidence is mounting
            if ts["suspicious_events"] >= 2:
                ts["alerts_triggered"] += 1
                r += 5.0
                if ts["first_detection_step"] is None:
                    ts["first_detection_step"] = self.current_step
            else:
                ts["false_positives"] += 1
                r -= 2.0

        elif action == 7:
            # Isolate segment – high-value move if attacker is inside
            if ts["kill_chain_level"] > STATE_EXTERNAL:
                ts["is_blocked"] = True
                r += 18.0
            else:
                ts["false_positives"] += 1
                r -= 6.0

        elif action == 8:
            # Full reset – very costly; last resort only
            self._reset_true_state()
            r -= 4.0

        elif action == 9:
            # Active deception (honeytokens) – reward if decoys present
            if ts["decoys_deployed"] > 0:
                r += 3.0
            else:
                r += 0.5

        # Small passive reward per decoy per step (encouraging setup)
        r += ts["decoys_deployed"] * 0.1

        return r

    def _exec_attacker_action(self, action: int) -> float:
        ts = self.true_state
        r = 0.0
        cur = ts["kill_chain_level"]

        # Rate limiting reduces attacker action success probability
        rate_limited = ts["is_rate_limited"] and random.random() < 0.45
        if rate_limited:
            ts["att_last_timeout"] = 1
            return -1.0   # action fails silently

        # Decoy penalty multiplier (attacker wastes time on fake assets)
        decoy_penalty = ts["decoys_deployed"] * 0.5

        if action == 0:
            # Brute-force SSH (only useful from EXTERNAL)
            if cur == STATE_EXTERNAL:
                success_prob = max(0.15, 0.35 - ts["failed_logins"] * 0.01)
                if random.random() < success_prob:
                    ts["kill_chain_level"] = STATE_USER_ACCESS
                    ts["suspicious_events"] += 1
                    ts["att_last_success"] = 1
                    r += 12.0
                else:
                    ts["failed_logins"] += 1
                    r -= 0.5
            else:
                r -= 2.0  # already inside – brute force is pointless

        elif action == 1:
            # Enumerate users / services (useful at USER+ level)
            if cur >= STATE_USER_ACCESS:
                r += max(1.0, 4.0 - decoy_penalty)
                ts["suspicious_events"] += 1
                ts["att_last_success"] = 1
            else:
                r -= 2.0

        elif action == 2:
            # Recon commands (whoami, uname, ls)
            if cur >= STATE_USER_ACCESS:
                r += 3.0
                ts["suspicious_events"] += 1
                ts["att_last_success"] = 1
            else:
                r -= 2.0

        elif action == 3:
            # Exfiltrate data (files, credentials)
            if cur >= STATE_USER_ACCESS:
                ts["files_downloaded"] += 1
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += 10.0
            else:
                r -= 3.0

        elif action == 4:
            # Privilege escalation (USER → ROOT)
            if cur == STATE_USER_ACCESS:
                success_prob = 0.40 - decoy_penalty * 0.05
                if random.random() < max(0.10, success_prob):
                    ts["kill_chain_level"] = STATE_ROOT_ACCESS
                    ts["suspicious_events"] += 3
                    ts["att_last_success"] = 1
                    r += 20.0
                else:
                    r -= 1.0
            else:
                r -= 4.0

        elif action == 5:
            # Create backdoor (ROOT only)
            if cur == STATE_ROOT_ACCESS:
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += 14.0
            else:
                r -= 4.0

        elif action == 6:
            # Modify system files (ROOT only)
            if cur == STATE_ROOT_ACCESS:
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += 10.0
            else:
                r -= 4.0

        elif action == 7:
            # Full exfil dump (ROOT only)
            if cur == STATE_ROOT_ACCESS:
                ts["files_downloaded"] += 3
                ts["suspicious_events"] += 3
                ts["att_last_success"] = 1
                r += 18.0
            else:
                r -= 4.0

        elif action == 8:
            # Lateral movement / internal port scan
            if cur >= STATE_USER_ACCESS:
                ts["suspicious_events"] += 2
                ts["att_last_success"] = 1
                r += 6.0
            else:
                r -= 2.0

        elif action == 9:
            # Wait / observe (always valid, tiny cost)
            r -= 0.2
            ts["att_last_success"] = 1   # not failing = success by definition

        # Survival reward: being inside the network has intrinsic value.
        # This encourages the attacker to try to stay at USER/ROOT rather than
        # giving up after a failed priv-esc attempt, and makes the exploration
        # signal strong enough to find the root-access trajectory.
        if ts["kill_chain_level"] == STATE_USER_ACCESS:
            r += 0.5   # reward for maintaining foothold
        elif ts["kill_chain_level"] == STATE_ROOT_ACCESS:
            r += 1.0   # reward for maintaining full compromise

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
        done = terminated or truncated
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
        }
        if done:
            ts = self.true_state
            # Attacker wins only if they reached ROOT and survived (not immediately blocked)
            att_win = terminated and (ts["kill_chain_level"] == STATE_ROOT_ACCESS)

            # Defender win requires a JUSTIFIED block — at least 2 suspicious events
            # must have occurred before the block.  This prevents the degenerate
            # "block everything at step 1" strategy from counting as a win.
            justified_block = (
                ts["blocks_issued"] > 0
                and ts["suspicious_events"] >= 2
            )
            detected = ts["first_detection_step"] is not None
            def_win = justified_block or detected

            info.update({
                "ep_att_return":       sum(self._ep_att_rewards),
                "ep_def_return":       sum(self._ep_def_rewards),
                "attacker_win":        att_win,
                "defender_win":        def_win,
                "first_detection_step": ts["first_detection_step"],
                "false_positives":     ts["false_positives"],
                "blocks_issued":       ts["blocks_issued"],
                "alerts_triggered":    ts["alerts_triggered"],
            })
        return info

    # ── Curriculum update (called externally by Trainer) ──────────────────────

    def set_curriculum_level(self, level: int) -> None:
        self.curriculum_level = min(max(level, 0), 2)
        cfg = CURRICULUM_CONFIG[self.curriculum_level]
        self.max_steps   = cfg["max_steps"]
        self.noise_rate  = cfg["noise_rate"]
        self._att_mask   = cfg["att_mask"]
        self._def_mask   = cfg["def_mask"]

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
            f"RateLimit={ts['is_rate_limited']}"
        )