"""
progress.py  –  CyberX Live Training Progress Display  (v1.0)
==============================================================
Provides two things:

  CyberXProgressCallback
    An SB3-compatible BaseCallback that hooks into every rollout
    and shows a live tqdm bar with:
      • steps/sec throughput
      • episode reward mean (rolling 20-episode window)
      • GPU VRAM usage
      • policy entropy estimate

  print_iteration_summary(...)
    Prints a rich, human-readable panel after each evaluation
    showing all metrics, Elo, baselines, and an ASCII sparkline
    of the win-rate trend so far.
"""

from __future__ import annotations  # makes all type hints lazy — fixes forward references

import time
import sys
import os
from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import numpy as np

try:
    from stable_baselines3.common.callbacks import BaseCallback
    HAS_SB3 = True
except ImportError:
    HAS_SB3 = False
    class BaseCallback:          # type: ignore
        def __init__(self, verbose=0): pass

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    import tqdm as _tqdm_module
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


# ── Terminal width helper ──────────────────────────────────────────────────────

def _tw(default: int = 72) -> int:
    try:
        return os.get_terminal_size().columns
    except Exception:
        return default


# ══════════════════════════════════════════════════════════════════════════════
#   SB3 CALLBACK — hooks into every rollout
# ══════════════════════════════════════════════════════════════════════════════
# NOTE: the old EpsilonGreedyWarmupCallback was removed in v3.0. It mutated
# locals["actions"] AFTER env.step() but BEFORE rollout_buffer.add(), so the
# buffer stored random actions that were never executed, paired with rewards
# and log-probs from the real actions — corrupting PPO's importance ratios
# for the whole warmup. Exploration warmup is now done by annealing
# model.ent_coef from the trainer (config.json [ppo] warmup_ent_coef /
# warmup_iters), which is sound.


class CyberXProgressCallback(BaseCallback):
    """
    Drop into model.learn(..., callback=cb) to get a live progress bar.

    Parameters
    ----------
    total_timesteps  : same value passed to model.learn
    role             : 'attacker' | 'defender'  (for the bar label colour)
    iteration        : current training iteration (1-based)
    n_iterations     : total planned iterations
    iteration_start  : wall-clock time when the iteration started (time.time())
    run_start        : wall-clock time when the whole run started
    device           : 'cuda' | 'cpu'
    """

    def __init__(
        self,
        total_timesteps:  int,
        role:             str   = "attacker",
        iteration:        int   = 1,
        n_iterations:     int   = 50,
        iteration_start:  float = 0.0,
        run_start:        float = 0.0,
        device:           str   = "cuda",
        verbose:          int   = 0,
    ):
        super().__init__(verbose)
        self.total_timesteps  = total_timesteps
        self.role             = role
        self.iteration        = iteration
        self.n_iterations     = n_iterations
        self.iteration_start  = iteration_start or time.time()
        self.run_start        = run_start or time.time()
        self.device           = device

        self._bar             = None
        self._last_step       = 0
        self._ep_rewards:  deque = deque(maxlen=20)  # rolling window
        self._ep_lengths:  deque = deque(maxlen=20)
        self._step_times:  deque = deque(maxlen=50)
        self._last_tick       = time.time()

    # ── SB3 hooks ──────────────────────────────────────────────────────────────

    def _on_training_start(self) -> None:
        # num_timesteps is cumulative across iterations (the trainer calls
        # learn() with reset_num_timesteps=False); the bar tracks only THIS
        # iteration's progress relative to the count at training start.
        self._start_steps = self.num_timesteps
        if not HAS_TQDM:
            return
        colour = "red" if self.role == "attacker" else "blue"
        label  = "  Red  Team" if self.role == "attacker" else "  Blue Team"
        self._bar = _tqdm_module.tqdm(
            total       = self.total_timesteps,
            desc        = label,
            unit        = " step",
            colour      = colour,
            dynamic_ncols = True,
            leave       = True,
            bar_format  = (
                "{desc}: {percentage:3.0f}%|{bar}| "
                "{n_fmt}/{total_fmt} "
                "[{elapsed}<{remaining} {postfix}]"
            ),
        )
        self._last_step = 0

    def _on_step(self) -> bool:
        steps_done = self.num_timesteps - getattr(self, "_start_steps", 0)

        # Collect episode rewards (the Monitor wrapper puts episode stats
        # under the "episode" key at episode end)
        if self.locals.get("infos"):
            for info in self.locals["infos"]:
                if isinstance(info.get("episode"), dict):
                    self._ep_rewards.append(info["episode"]["r"])
                    self._ep_lengths.append(info["episode"]["l"])

        # Throttle bar updates to avoid terminal spam (~10 Hz)
        now = time.time()
        self._step_times.append(now - self._last_tick)
        self._last_tick = now

        if self._bar is not None and (steps_done - self._last_step) >= 512:
            delta = steps_done - self._last_step
            self._last_step = steps_done
            self._bar.update(delta)

            # Build postfix stats
            pf: Dict[str, str] = {}

            if self._ep_rewards:
                pf["r̄"] = f"{np.mean(self._ep_rewards):+.2f}"

            # Steps/sec from recent tick times (one tick = num_envs env steps)
            if self._step_times:
                n_envs = getattr(self.training_env, "num_envs", 1)
                sps = 1.0 / max(np.mean(self._step_times), 1e-9) * n_envs
                pf["sps"] = f"{sps:.0f}"

            # GPU VRAM
            if HAS_TORCH and self.device == "cuda" and torch.cuda.is_available():
                used = torch.cuda.memory_allocated() / 1e9
                total = torch.cuda.get_device_properties(0).total_memory / 1e9
                pf["VRAM"] = f"{used:.1f}/{total:.0f}GB"

            self._bar.set_postfix(pf, refresh=True)

        return True   # continue training

    def _on_training_end(self) -> None:
        if self._bar is not None:
            self._bar.n = self.total_timesteps
            self._bar.refresh()
            self._bar.close()

    # ── Public accessors (used by trainer for the summary panel) ──────────────

    @property
    def mean_reward(self) -> Optional[float]:
        return float(np.mean(self._ep_rewards)) if self._ep_rewards else None

    @property
    def mean_ep_length(self) -> Optional[float]:
        return float(np.mean(self._ep_lengths)) if self._ep_lengths else None


# ══════════════════════════════════════════════════════════════════════════════
#   ITERATION HEADER
# ══════════════════════════════════════════════════════════════════════════════

def print_iteration_header(
    iteration:       int,
    n_iterations:    int,
    curriculum_level: int,
    run_start:       float,
    iter_times:      List[float],
) -> None:
    """
    Print a rich header before each training iteration showing:
      overall progress bar, elapsed time, ETA, curriculum stage.
    """
    tw = _tw()
    pct = (iteration - 1) / max(n_iterations, 1)
    bar_w = min(40, tw - 32)
    filled = int(bar_w * pct)
    bar = "█" * filled + "░" * (bar_w - filled)

    elapsed = time.time() - run_start
    if iter_times and len(iter_times) >= 1:
        avg_iter = np.mean(iter_times[-5:])  # use last 5 iters for ETA
        remaining_iters = n_iterations - (iteration - 1)
        eta_secs = avg_iter * remaining_iters
        eta_str  = _fmt_duration(eta_secs)
        avg_str  = _fmt_duration(avg_iter)
    else:
        eta_str = "calculating..."
        avg_str = "—"

    stage_labels = {0: "Stage 0 · Scripted opponents",
                    1: "Stage 1 · Full actions",
                    2: "Stage 2 · Self-play + Fictitious play"}
    stage_str = stage_labels.get(curriculum_level, f"Stage {curriculum_level}")

    print(f"\n{'═'*tw}")
    print(f"  ITERATION {iteration}/{n_iterations}   {stage_str}   {datetime.now().strftime('%H:%M:%S')}")
    print(f"  [{bar}] {pct:.0%}  elapsed {_fmt_duration(elapsed)}  ETA {eta_str}  avg/iter {avg_str}")
    print(f"{'═'*tw}")


# ══════════════════════════════════════════════════════════════════════════════
#   POST-EVAL SUMMARY PANEL
# ══════════════════════════════════════════════════════════════════════════════

def print_iteration_summary(
    iteration:        int,
    n_iterations:     int,
    metrics:          Dict[str, Any],
    history:          Dict,
    iter_elapsed:     float,
    run_start:        float,
    att_callback:     Optional[CyberXProgressCallback] = None,
    def_callback:     Optional[CyberXProgressCallback] = None,
) -> None:
    """
    Print the full post-evaluation summary panel.
    Replaces the old evaluator._print_summary with a much richer display.
    """
    tw = _tw()
    mm  = metrics.get("main_match", {})
    elo = metrics.get("elo", {})
    entr = metrics.get("strategy_entropy", {})
    kc   = mm.get("kc_depth_dist", {})
    att_name = f"attacker_iter_{iteration}"
    def_name = f"defender_iter_{iteration}"

    att_wr  = mm.get("att_win_rate", 0)
    def_wr  = mm.get("def_win_rate", 0)
    att_elo = elo.get(att_name, 1500)
    def_elo = elo.get(def_name, 1500)
    ttd     = mm.get("mean_ttd")
    fp      = mm.get("mean_false_positives", 0)

    # Win-rate trend sparkline (last N iterations)
    att_hist = history.get("att_win_rates", [])
    def_hist = history.get("def_win_rates", [])
    att_spark = _sparkline(att_hist[-12:])
    def_spark = _sparkline(def_hist[-12:])

    # Elo trend
    att_elo_hist = history.get("att_elo", [])
    def_elo_hist = history.get("def_elo", [])
    att_elo_delta = att_elo - att_elo_hist[-2] if len(att_elo_hist) >= 2 else 0
    def_elo_delta = def_elo - def_elo_hist[-2] if len(def_elo_hist) >= 2 else 0

    # Baseline comparison
    att_vs = metrics.get("att_vs_baselines", {})
    def_vs = metrics.get("def_vs_baselines", {})

    sep = "─" * tw

    print(f"\n{sep}")
    print(f"  EVALUATION COMPLETE  ·  Iteration {iteration}/{n_iterations}  ·  "
          f"iter took {_fmt_duration(iter_elapsed)}  ·  "
          f"run elapsed {_fmt_duration(time.time() - run_start)}")
    print(sep)

    # ── Win rates ──────────────────────────────────────────────────────────────
    att_bar = _mini_bar(att_wr, 20, "█", "░")
    def_bar = _mini_bar(def_wr, 20, "█", "░")
    print(f"\n  Win rates (self-play, n={mm.get('n_episodes',50)} eps)")
    print(f"    Attacker  {att_bar} {att_wr:5.1%}   trend: {att_spark}")
    print(f"    Defender  {def_bar} {def_wr:5.1%}   trend: {def_spark}")

    # ── Elo ────────────────────────────────────────────────────────────────────
    att_sign = "▲" if att_elo_delta > 0 else ("▼" if att_elo_delta < 0 else "─")
    def_sign = "▲" if def_elo_delta > 0 else ("▼" if def_elo_delta < 0 else "─")
    print(f"\n  Elo ratings")
    print(f"    Attacker  {att_elo:6.0f}  {att_sign}{abs(att_elo_delta):4.0f}  "
          f"  Defender  {def_elo:6.0f}  {def_sign}{abs(def_elo_delta):4.0f}")

    # ── Baseline comparison table ──────────────────────────────────────────────
    baselines = ["random", "scripted", "expert"]
    print(f"\n  vs. Baselines")
    print(f"    {'Baseline':<10}  {'Att WR':>7}  {'Def WR':>7}")
    print(f"    {'─'*10}  {'─'*7}  {'─'*7}")
    for b in baselines:
        awr = att_vs.get(b, {}).get("att_win_rate")
        dwr = def_vs.get(b, {}).get("def_win_rate")
        astr = f"{awr:6.1%}" if awr is not None else "   N/A"
        dstr = f"{dwr:6.1%}" if dwr is not None else "   N/A"
        print(f"    {b:<10}  {astr}   {dstr}")

    # ── Kill-chain depth ───────────────────────────────────────────────────────
    ext_pct  = kc.get("external", 0)
    usr_pct  = kc.get("user_access", 0)
    root_pct = kc.get("root_access", 0)
    print(f"\n  Kill-chain depth reached")
    print(f"    Recon       {_mini_bar(ext_pct,  25, '─', ' ')} {ext_pct:5.1%}")
    print(f"    Foothold    {_mini_bar(usr_pct,  25, '▒', ' ')} {usr_pct:5.1%}")
    print(f"    Privileged  {_mini_bar(root_pct, 25, '█', ' ')} {root_pct:5.1%}")

    # ── Timing & detection ─────────────────────────────────────────────────────
    ttd_str = f"{ttd:.1f} steps" if ttd is not None else "not detected"
    print(f"\n  Detection & timing")
    print(f"    Time-to-detect (mean)   {ttd_str}")
    print(f"    False positives/ep      {fp:.2f}")
    print(f"    Mean episode length     {mm.get('mean_ep_length', 0):.1f} ± "
          f"{mm.get('std_ep_length', 0):.1f} steps")

    # ── Strategy entropy ───────────────────────────────────────────────────────
    att_e = entr.get("attacker", 0)
    def_e = entr.get("defender", 0)
    from shared_honeypot_env import ACTION_DIM
    max_e = np.log2(ACTION_DIM)
    print(f"\n  Strategy entropy  (max = {max_e:.2f} bits)")
    print(f"    Attacker  {_mini_bar(att_e/max_e, 20, '▓', '░')} {att_e:.2f} bits")
    print(f"    Defender  {_mini_bar(def_e/max_e, 20, '▓', '░')} {def_e:.2f} bits")

    # ── Training throughput ────────────────────────────────────────────────────
    if att_callback and att_callback.mean_reward is not None:
        print(f"\n  PPO episode stats (rolling 20-ep window)")
        if att_callback.mean_reward is not None:
            print(f"    Attacker  r̄={att_callback.mean_reward:+.2f}  "
                  f"len={att_callback.mean_ep_length or 0:.0f}")
        if def_callback and def_callback.mean_reward is not None:
            print(f"    Defender  r̄={def_callback.mean_reward:+.2f}  "
                  f"len={def_callback.mean_ep_length or 0:.0f}")

    print(f"\n{sep}\n")


# ══════════════════════════════════════════════════════════════════════════════
#   FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

def print_final_summary(
    history:    Dict,
    run_start:  float,
    leaderboard: List,
) -> None:
    tw = _tw()
    total_time = time.time() - run_start
    iters_done = len(history.get("iterations", []))

    print(f"\n{'═'*tw}")
    print(f"  TRAINING COMPLETE  ·  {iters_done} iterations  ·  {_fmt_duration(total_time)}")
    print(f"{'═'*tw}")

    # Win rate trend over all iterations
    att_hist = history.get("att_win_rates", [])
    def_hist = history.get("def_win_rates", [])
    if att_hist:
        print(f"\n  Win-rate trajectory (all iterations)")
        print(f"    Attacker  {_sparkline(att_hist, width=50)}")
        print(f"    Defender  {_sparkline(def_hist, width=50)}")

        print(f"\n  Final win rates (last 5 iter avg)")
        print(f"    Attacker  {np.mean(att_hist[-5:]):.1%}")
        print(f"    Defender  {np.mean(def_hist[-5:]):.1%}")

    # Elo leaderboard
    print(f"\n  Elo Leaderboard")
    print(f"  {'─'*35}")
    for i, (name, elo) in enumerate(leaderboard[:12], 1):
        bar = _mini_bar(max(0, elo - 1000) / 1000, 15, "█", "░")
        print(f"  {i:2d}. {elo:6.0f}  {bar}  {name}")

    print(f"\n{'═'*tw}\n")


# ══════════════════════════════════════════════════════════════════════════════
#   HELPERS
# ══════════════════════════════════════════════════════════════════════════════

_SPARK_CHARS = "▁▂▃▄▅▆▇█"

def _sparkline(values: list, width: int = 16) -> str:
    if not values:
        return "─" * width
    vs = list(values[-width:])
    mn, mx = min(vs), max(vs)
    rng = mx - mn or 1e-9
    result = ""
    for v in vs:
        idx = int((v - mn) / rng * (len(_SPARK_CHARS) - 1))
        result += _SPARK_CHARS[idx]
    return result.ljust(width)


def _mini_bar(fraction: float, width: int, fill: str = "█", empty: str = "░") -> str:
    fraction = max(0.0, min(1.0, fraction))
    filled   = int(round(fraction * width))
    return fill * filled + empty * (width - filled)


def _fmt_duration(seconds: float) -> str:
    seconds = max(0, int(seconds))
    h, rem  = divmod(seconds, 3600)
    m, s    = divmod(rem, 60)
    if h > 0:
        return f"{h}h {m:02d}m {s:02d}s"
    if m > 0:
        return f"{m}m {s:02d}s"
    return f"{s}s"