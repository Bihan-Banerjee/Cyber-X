"""
vec_env_factory.py  –  CyberX Persistent Parallel Environment Factory  (v3.0)
==============================================================================
One vectorised pool per training side, created ONCE and kept alive for the
whole run. Opponents and curriculum levels are hot-swapped in place via
VecEnv.env_method() — see SharedHoneypotEnv.set_scripted_opponent /
load_rl_opponent / set_curriculum_level. This removes the 8-subprocess
spawn (~5-10s on Windows) that v2 paid up to four times per iteration.

SubprocVecEnv requires the env factory functions to be picklable. On
Windows (spawn start method) that means module-level named functions whose
captured state is plain data (str/int) — no model objects cross the
process boundary; RL opponents are loaded from disk inside each worker.

Each worker:
  • wraps the env in Monitor so info["episode"] exists (SB3's
    ep_info_buffer and the live progress bar were silently empty without it)
  • runs torch.set_num_threads(1) — 8 workers each spawning a full
    intra-op thread pool oversubscribes the CPU and slows opponent
    inference down
"""

import logging
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)


class ForwardingMonitor:
    """Monitor subclass exposing the hot-swap API explicitly, so
    VecEnv.env_method() doesn't go through gymnasium's deprecated
    Wrapper.__getattr__ forwarding (which warns on every call)."""

    # Defined lazily because stable_baselines3 must not be imported at
    # module load time in the parent before spawn pickling.
    _cls = None

    @classmethod
    def wrap(cls, env):
        if cls._cls is None:
            from stable_baselines3.common.monitor import Monitor

            class _ForwardingMonitor(Monitor):
                def set_scripted_opponent(self, name: str) -> str:
                    return self.env.unwrapped.set_scripted_opponent(name)

                def load_rl_opponent(self, path: str) -> bool:
                    return self.env.unwrapped.load_rl_opponent(path)

                def set_curriculum_level(self, level: int) -> int:
                    return self.env.unwrapped.set_curriculum_level(level)

            cls._cls = _ForwardingMonitor
        return cls._cls(env)


def _make_env_fn(
    mode:             str,
    curriculum_level: int,
    opponent_name:    Optional[str],
    rank:             int,
) -> Callable:
    """Picklable factory for one worker env. opponent_name is a
    baselines.OPPONENT_REGISTRY key, or None for the seeded random policy."""
    def _init():
        import torch
        torch.set_num_threads(1)

        from shared_honeypot_env import SharedHoneypotEnv

        env = SharedHoneypotEnv(mode=mode, curriculum_level=curriculum_level)
        if opponent_name is not None:
            env.set_scripted_opponent(opponent_name)
        return ForwardingMonitor.wrap(env)
    return _init


def make_vec_env(
    mode:             str,
    n_envs:           int,
    curriculum_level: int,
    opponent_names:   Optional[List[Optional[str]]] = None,
    use_subprocess:   bool = True,
):
    """
    Create the persistent vectorised training pool for one side.

    Parameters
    ----------
    mode             : 'attacker' | 'defender'
    n_envs           : number of parallel workers
    curriculum_level : 0 | 1 | 2
    opponent_names   : per-worker initial scripted opponent registry names
                       (cycled if shorter than n_envs); None entries → seeded
                       random policy. The trainer re-rolls the mix every
                       iteration via env_method, so this is just the start.
    use_subprocess   : if False, always use DummyVecEnv (debugging/notebooks)

    Env seeding note: per-worker seeds (seed + rank) are applied by SB3 —
    RecurrentPPO(seed=...) calls VecEnv.seed(), which each SharedHoneypotEnv
    honors through gymnasium's np_random.
    """
    names = opponent_names or [None]
    env_fns = [
        _make_env_fn(mode, curriculum_level, names[i % len(names)], i)
        for i in range(n_envs)
    ]

    if not use_subprocess or n_envs == 1:
        from stable_baselines3.common.vec_env import DummyVecEnv
        return DummyVecEnv(env_fns)

    try:
        from stable_baselines3.common.vec_env import SubprocVecEnv
        vec_env = SubprocVecEnv(env_fns, start_method="spawn")
        logger.info("SubprocVecEnv ready: %d workers, mode=%s, level=%d",
                    n_envs, mode, curriculum_level)
        return vec_env
    except Exception as e:
        logger.warning("SubprocVecEnv failed (%s), falling back to DummyVecEnv", e)
        from stable_baselines3.common.vec_env import DummyVecEnv
        return DummyVecEnv(env_fns)
