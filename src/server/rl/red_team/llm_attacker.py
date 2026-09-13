"""
red_team/llm_attacker.py  –  Autonomous LLM red-team attacker (in-sim)
=======================================================================
An LLM-driven attacker that plays SharedHoneypotEnv through the same
`.predict(obs) -> (action, _)` interface the scripted baselines and the
StatefulOpponent use, so it drops straight into the evaluator's match runner
and the exploitability harness.

Why this matters (the research hook): the trained RL defender was measured as
exploitable by a *same-policy-class* PPO best-response. An LLM attacker is an
OUT-OF-POLICY-CLASS adversary — it reasons about the game in natural language
rather than optimising the same objective. If it also beats the defender, the
exploitability finding is far stronger than "one PPO run found a hole."

The agent selects actions via llm_oracle.LLMOracle (reusing its provider
clients + prompt scaffolding) and falls back to the scripted ExpertAttacker
when the LLM is disabled or unreachable — so the probe is always runnable, LLM
or not (the fallback case is reported honestly as such). Every step is recorded
with its ATT&CK grounding for the demo and the write-up.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from baselines import ExpertAttacker
from llm_oracle import LLMOracle
from red_team.playbook import attack_info


class RedTeamAttacker:
    """LLM attacker with a scripted fallback and per-step reasoning traces."""

    name = "RedTeamAttacker"

    def __init__(
        self,
        llm_config: Optional[Dict[str, Any]] = None,
        fallback=None,
        seed: int = 0,
        max_steps: int = 100,
    ):
        self.llm_config = llm_config or {"enabled": False}
        # Force-enable querying when a provider is configured: the oracle's
        # should_consult() gate is for *training* (cost control); for a probe
        # we want the LLM to drive every step.
        self._use_llm = bool(self.llm_config.get("enabled", False))
        self.oracle = LLMOracle("attacker", self.llm_config) if self._use_llm else None
        self.fallback = fallback if fallback is not None else ExpertAttacker()
        self._rng = np.random.default_rng(seed)
        self.max_steps = max_steps

        self._cum_reward = 0.0
        self._step = 0
        self.trace: List[Dict[str, Any]] = []

    # ── Agent interface ──────────────────────────────────────────────────────

    def predict(self, observation, deterministic: bool = True):
        action: Optional[int] = None
        source = "fallback"
        reasoning = None

        if self.oracle is not None:
            action = self.oracle.query(
                np.asarray(observation, dtype=np.float32),
                cum_reward=self._cum_reward, max_steps=self.max_steps,
            )
            if action is not None:
                source = "llm"
                reasoning = self.oracle.last_reasoning

        if action is None:
            fb_action, _ = self.fallback.predict(observation, deterministic)
            action = int(np.asarray(fb_action).flat[0])

        info = attack_info(action)
        if not reasoning:
            reasoning = info["rationale"]

        self.trace.append({
            "step":         self._step,
            "action":       int(action),
            "action_name":  info["action"],
            "technique_id": info["technique_id"],
            "technique":    info["technique"],
            "tactic":       info["tactic"],
            "source":       source,          # "llm" or "fallback"
            "reasoning":    reasoning,
        })
        self._step += 1
        return int(action), None

    def observe_reward(self, reward: float) -> None:
        self._cum_reward += float(reward)

    def reset(self) -> None:
        self._cum_reward = 0.0
        self._step = 0
        if hasattr(self.fallback, "reset"):
            self.fallback.reset()
        # trace persists across episodes so a probe can inspect the whole run;
        # call clear_trace() between episodes if per-episode traces are wanted.

    def clear_trace(self) -> None:
        self.trace = []

    def seed(self, seed: int) -> None:
        self._rng = np.random.default_rng(seed)
        if hasattr(self.fallback, "seed"):
            self.fallback.seed(seed)

    # ── Introspection ────────────────────────────────────────────────────────

    @property
    def used_llm(self) -> bool:
        return self.oracle is not None

    def llm_stats(self) -> Dict[str, Any]:
        return self.oracle.stats() if self.oracle is not None else {"enabled": False}
