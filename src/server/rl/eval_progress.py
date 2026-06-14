"""
eval_progress.py  –  Rich progress display for the exploitability evaluation
=============================================================================
Brings the exploitability/best-response eval up to the same visibility as the
training loop: a top-level progress bar across ALL best-response iterations
(both sides), wall-clock + ETA, clear phase headers, live win-rate sparklines,
and — via the training CyberXProgressCallback — a per-iteration step bar with
steps/sec and VRAM.

Without this, the eval just printed one sparse line per iteration and you had
no idea how far along it was or how long it would take.

Reuses the rendering primitives in progress.py so the look matches training.
"""

import time
from typing import List, Optional

from progress import (
    CyberXProgressCallback,
    _fmt_duration,
    _mini_bar,
    _sparkline,
    _tw,
)


class ExploitProgress:
    """Tracks and renders progress across the whole exploitability run.

    A "unit" of work is one best-response iteration (a learn() + an eval).
    Total units = len(sides) × br_iterations. The top-level bar advances one
    unit at a time, so ETA reflects the entire evaluation, not just the
    current side.
    """

    def __init__(
        self,
        sides:          List[str],     # frozen roles being probed, e.g. ["attacker","defender"]
        br_iterations:  int,
        br_timesteps:   int,
        eval_episodes:  int,
        device:         str,
        bc:             bool,
    ):
        self.sides         = sides
        self.br_iterations = br_iterations
        self.br_timesteps  = br_timesteps
        self.eval_episodes = eval_episodes
        self.device        = device
        self.bc            = bc

        self.total_units   = max(1, len(sides) * br_iterations)
        self.units_done    = 0
        self._iter_times: List[float] = []
        self._unit_t0      = None
        self.run_start     = time.time()

    # ── Panels ──────────────────────────────────────────────────────────────

    def header(self, att_path: str, def_path: str) -> None:
        tw = _tw()
        total_steps = self.total_units * self.br_timesteps
        print(f"\n{'═'*tw}")
        print("  EXPLOITABILITY  EVALUATION  –  approximate best-response")
        print(f"{'═'*tw}")
        print(f"  Attacker model : {att_path}")
        print(f"  Defender model : {def_path}")
        print(f"  Probing        : {', '.join(self.sides)}")
        print(f"  Per side       : {self.br_iterations} best-response iters × "
              f"{self.br_timesteps:,} steps   (BC warm-start: {self.bc})")
        print(f"  Eval per iter  : {self.eval_episodes} episodes")
        print(f"  Total work     : {self.total_units} BR iters  ≈ "
              f"{total_steps:,} PPO steps   ·   device {self.device.upper()}")
        print(f"{'═'*tw}\n")

    def equilibrium(self, eq_att: float, eq_def: float) -> None:
        draw = max(0.0, 1.0 - eq_att - eq_def)
        print("  Equilibrium baseline  (frozen A* vs frozen D*)")
        print(f"    Attacker {_mini_bar(eq_att, 20)} {eq_att:5.0%}")
        print(f"    Defender {_mini_bar(eq_def, 20)} {eq_def:5.0%}    "
              f"(draws {draw:.0%})\n")

    def phase_start(self, frozen_role: str) -> None:
        br_role = "defender" if frozen_role == "attacker" else "attacker"
        tw = _tw()
        print(f"{'─'*tw}")
        print(f"  PROBING FROZEN {frozen_role.upper()}  →  training a "
              f"best-response {br_role.upper()} to exploit it")
        print(f"{'─'*tw}")

    def make_callback(self, frozen_role: str, br_iter: int) -> CyberXProgressCallback:
        """Per-iteration step bar (steps/sec, VRAM, reward) — same widget the
        trainer uses inside learn()."""
        br_role = "defender" if frozen_role == "attacker" else "attacker"
        self._unit_t0 = time.time()
        return CyberXProgressCallback(
            total_timesteps = self.br_timesteps,
            role            = br_role,
            iteration       = br_iter,
            n_iterations    = self.br_iterations,
            iteration_start = self._unit_t0,
            run_start       = self.run_start,
            device          = self.device,
        )

    def record_iter(
        self,
        frozen_role: str,
        br_iter:     int,
        win_rate:    float,
        curve:       List[float],
    ) -> None:
        """Called after each BR iteration's learn()+eval. Renders the
        overall progress bar + ETA and this side's win-rate curve."""
        now = time.time()
        if self._unit_t0 is not None:
            self._iter_times.append(now - self._unit_t0)
        self.units_done += 1

        frac = self.units_done / self.total_units
        avg  = (sum(self._iter_times) / len(self._iter_times)
                if self._iter_times else 0.0)
        remaining = avg * (self.total_units - self.units_done)
        br_role = "defender" if frozen_role == "attacker" else "attacker"

        best = max(curve) if curve else win_rate
        print(f"    BR {br_role} iter {br_iter:2d}/{self.br_iterations}  ·  "
              f"win rate vs frozen {frozen_role}: {win_rate:5.0%}  "
              f"(best {best:.0%})")
        print(f"      curve {_sparkline(curve, 20)}  {_mini_bar(win_rate, 16, '▓', '░')}")
        print(f"      overall [{_mini_bar(frac, 28)}] {frac:4.0%}  "
              f"({self.units_done}/{self.total_units} BR iters)  ·  "
              f"elapsed {_fmt_duration(now - self.run_start)}  ·  "
              f"ETA {_fmt_duration(remaining)}\n")

    def phase_end(self, frozen_role: str, exploitability: float, gap: float) -> None:
        br_role = "defender" if frozen_role == "attacker" else "attacker"
        verdict = ("robust" if gap <= 0.10 else
                   "some exploit room" if gap <= 0.30 else
                   "EXPLOITABLE")
        print(f"  ► Frozen {frozen_role.upper()} exploitability = "
              f"{exploitability:.0%}  (best a dedicated {br_role} could do)  ·  "
              f"gap over equilibrium {gap:+.0%}  →  {verdict}\n")

    def final(self, nashconv: Optional[float]) -> None:
        tw = _tw()
        print(f"{'═'*tw}")
        print(f"  EXPLOITABILITY EVALUATION COMPLETE  ·  "
              f"total {_fmt_duration(time.time() - self.run_start)}")
        if nashconv is not None:
            band = ("STRONG (near-equilibrium)" if nashconv < 0.15 else
                    "DECENT" if nashconv < 0.35 else
                    "BRITTLE")
            print(f"  NashConv = {nashconv:.2f}   →   {band}")
            print("  (sum of positive best-response gaps; lower = closer to an "
                  "unexploitable equilibrium)")
        print(f"{'═'*tw}\n")
