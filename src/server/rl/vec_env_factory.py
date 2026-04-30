"""
vec_env_factory.py  –  CyberX Parallel Environment Factory
===========================================================
SubprocVecEnv requires environment factory functions to be picklable.
On Windows (spawn start method), this means they must be module-level
named functions — not lambdas or closures capturing non-picklable objects.

This module provides:
  make_parallel_envs(...)
    Creates a SubprocVecEnv for training.  Falls back to DummyVecEnv
    automatically if subprocess creation fails (e.g. in notebooks).

  make_diverse_envs(...)
    Creates a VecEnv where each worker gets a DIFFERENT opponent sampled
    from a pool of classes.  Prevents specialisation to a single style.
    Used for levels 0 and 1 so the policy sees varied opponents every
    rollout rather than 8 identical copies of one scripted agent.

  make_eval_env(...)
    Creates a single unwrapped env for evaluation (no vec wrapping needed).

For level 2 (self-play), the opponent RL agent is saved to a temp path
and loaded fresh inside each subprocess, avoiding CUDA serialization issues.
"""

import os
import random
import logging
from typing import Optional, Callable, List

logger = logging.getLogger(__name__)

# ── Picklable env factories ────────────────────────────────────────────────────
# Each returns a zero-argument callable that creates one env instance.
# ALL state captured in these closures must be picklable (str, int, class refs).

def _make_scripted_env_fn(
    mode:             str,
    opponent_cls:     type,
    curriculum_level: int,
) -> Callable:
    """Factory for scripted-opponent envs (levels 0 and 1). Fully picklable."""
    def _init():
        from shared_honeypot_env import SharedHoneypotEnv
        return SharedHoneypotEnv(
            mode             = mode,
            opponent_model   = opponent_cls(),
            curriculum_level = curriculum_level,
        )
    return _init


def _make_model_env_fn(
    mode:             str,
    opponent_path:    str,
    curriculum_level: int,
) -> Callable:
    """
    Factory for RL-opponent envs (level 2).
    Loads the opponent from disk inside the subprocess so CUDA tensors
    never cross the process boundary.
    """
    def _init():
        from shared_honeypot_env import SharedHoneypotEnv
        from sb3_contrib import RecurrentPPO

        # Load opponent weights fresh inside this subprocess
        try:
            opp_model = RecurrentPPO.load(opponent_path, device="cpu")
            # Wrap in a predict-compatible shim
            class _ModelWrapper:
                def __init__(self, m): self._m = m
                def predict(self, obs, deterministic=True):
                    import numpy as np
                    a, _ = self._m.predict(obs, deterministic=deterministic)
                    return int(np.asarray(a).flat[0]), None
            opponent = _ModelWrapper(opp_model)
        except Exception as e:
            logger.warning("Subprocess: could not load opponent from %s: %s", opponent_path, e)
            opponent = None   # falls back to random policy inside env

        return SharedHoneypotEnv(
            mode             = mode,
            opponent_model   = opponent,
            curriculum_level = curriculum_level,
        )
    return _init


# ── Public API ─────────────────────────────────────────────────────────────────

def make_diverse_envs(
    mode:             str,
    n_envs:           int,
    curriculum_level: int,
    opponent_pool:    List[type],
    use_subprocess:   bool = True,
):
    """
    Create a VecEnv where EACH worker independently samples a different
    opponent class from opponent_pool.

    This is the primary anti-specialisation mechanism for levels 0 and 1.
    With 8 workers and a pool of [ScriptedDefender, ExpertDefender], each
    PPO rollout contains experience against multiple opponent styles in the
    same gradient update, preventing the policy from memorising one opponent.

    Parameters
    ----------
    mode             : 'attacker' | 'defender'
    n_envs           : number of parallel environments
    curriculum_level : 0 | 1 | 2
    opponent_pool    : list of CLASS objects (not instances) to sample from
    use_subprocess   : if True, attempt SubprocVecEnv; fall back to DummyVecEnv

    Returns
    -------
    VecEnv (SubprocVecEnv or DummyVecEnv)
    """
    env_fns = [
        _make_scripted_env_fn(mode, random.choice(opponent_pool), curriculum_level)
        for _ in range(n_envs)
    ]

    if not use_subprocess or n_envs == 1:
        from stable_baselines3.common.vec_env import DummyVecEnv
        return DummyVecEnv(env_fns)

    try:
        from stable_baselines3.common.vec_env import SubprocVecEnv
        vec_env = SubprocVecEnv(env_fns, start_method="spawn")
        logger.info(
            "make_diverse_envs: SubprocVecEnv %d workers, mode=%s, level=%d, pool=%s",
            n_envs, mode, curriculum_level,
            [c.__name__ for c in opponent_pool],
        )
        return vec_env
    except Exception as e:
        logger.warning("make_diverse_envs: SubprocVecEnv failed (%s), using DummyVecEnv", e)
        from stable_baselines3.common.vec_env import DummyVecEnv
        return DummyVecEnv(env_fns)


def make_parallel_envs(
    mode:              str,
    n_envs:            int,
    curriculum_level:  int,
    opponent=None,
    opponent_path:     Optional[str] = None,
    use_subprocess:    bool = True,
):
    """
    Create a vectorised training environment.

    Parameters
    ----------
    mode             : 'attacker' | 'defender'
    n_envs           : number of parallel environments
    curriculum_level : 0 | 1 | 2
    opponent         : scripted agent instance (levels 0-1) OR RL agent (level 2)
    opponent_path    : path to saved RL opponent .zip (level 2 only)
    use_subprocess   : if False, always use DummyVecEnv (for debugging)

    Returns
    -------
    VecEnv (SubprocVecEnv or DummyVecEnv)
    """
    from stable_baselines3.common.vec_env import DummyVecEnv

    # Determine factory type based on opponent
    is_scripted = opponent_path is None   # no path = scripted opponent

    if is_scripted:
        opponent_cls = type(opponent) if opponent is not None else _NullOpponent
        env_fns = [
            _make_scripted_env_fn(mode, opponent_cls, curriculum_level)
            for _ in range(n_envs)
        ]
    else:
        if not os.path.exists(opponent_path):
            logger.warning("Opponent path not found: %s — using random policy", opponent_path)
            env_fns = [
                _make_scripted_env_fn(mode, _NullOpponent, curriculum_level)
                for _ in range(n_envs)
            ]
        else:
            env_fns = [
                _make_model_env_fn(mode, opponent_path, curriculum_level)
                for _ in range(n_envs)
            ]

    if not use_subprocess or n_envs == 1:
        return DummyVecEnv(env_fns)

    try:
        from stable_baselines3.common.vec_env import SubprocVecEnv
        vec_env = SubprocVecEnv(env_fns, start_method="spawn")
        logger.info(
            "SubprocVecEnv created: %d workers, mode=%s, level=%d",
            n_envs, mode, curriculum_level,
        )
        return vec_env
    except Exception as e:
        logger.warning(
            "SubprocVecEnv failed (%s), falling back to DummyVecEnv", e
        )
        return DummyVecEnv(env_fns)


class _NullOpponent:
    """
    Random-policy fallback when no opponent is specified.
    Uses a fixed pool of valid actions rather than the full 0-9 range
    so it stays curriculum-compatible.
    """
    def __init__(self): pass
    def predict(self, obs, deterministic=True):
        return random.randint(0, 9), None