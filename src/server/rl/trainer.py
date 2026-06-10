"""
trainer.py  –  CyberX MARL Trainer  (v3.0)
============================================
Pause / Resume:
  Training saves full state after every completed iteration.
  Press Ctrl+C once to pause cleanly after the current iteration.
  Run with --resume to continue from exactly where you left off.

Curriculum:
  Stage 0 → scripted opponents, restricted actions
  Stage 1 → scripted opponents, full actions
  Stage 2 → league self-play (see below)

League (anti-specialization), v3:
  The v2 trainer gave all workers ONE identical frozen opponent per
  iteration — PPO fully exploits it within 100k steps and the agents
  specialize into beating each other while losing to simple scripts.
  v3 re-rolls a per-worker opponent mix every iteration:
    • `scripted_slots` workers always face scripted/expert agents
      (permanent exploiter slots — agents can never forget the basics)
    • `latest_slots` workers face the opponent's latest weights
    • the rest face ghosts sampled UNIFORMLY over the full history
      (recency-biased sampling causes strategy cycling)
  Best models are gated on a composite score = min(main win rate,
  vs-scripted, vs-expert): a script-loser can never become *_best.zip.

Performance, v3:
  Worker pools are created once and kept alive for the entire run;
  opponents/curriculum hot-swap in place via env_method. Ghosts are
  zip paths on disk (file copies of *_latest.zip), not in-memory models.

All hyperparameters live in config.json — see config_loader.py.
"""

import copy
import json
import logging
import os
import random
import shutil
import signal
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import torch
from stable_baselines3.common.utils import set_random_seed

from agents import RLAgent
from baselines import (
    SCRIPTED_POOL_BY_LEVEL,
    ExpertAttacker, ExpertDefender,
    RandomAttacker, RandomDefender,
    ScriptedAttacker, ScriptedDefender,
)
from config_loader import RLConfig, get_config
from evaluator import MARLEvaluator
from llm_oracle import LLMOracle
from progress import (
    CyberXProgressCallback,
    print_final_summary,
    print_iteration_header,
    print_iteration_summary,
)
from shared_honeypot_env import SharedHoneypotEnv
from vec_env_factory import make_vec_env

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

BANNER = """
╔══════════════════════════════════════════════════════════╗
║        CyberX  MARL  Training  System  (v3.0)           ║
║   Attacker vs Defender · Curriculum · League Play       ║
║              LLM Oracle · Elo Evaluation                ║
╚══════════════════════════════════════════════════════════╝
"""

# (kind, value) per worker: ("scripted", registry_name) or ("rl", zip_path)
OpponentMix = List[Tuple[str, str]]


class MARLTrainer:
    STATE_FILENAME = "trainer_state.json"

    def __init__(
        self,
        save_dir:       str = "./models/cyberx_marl",
        n_envs:         Optional[int] = None,
        device:         Optional[str] = None,
        llm_config:     Optional[Dict] = None,
        use_subprocess: bool = True,   # run_training.py has the __main__ guard
        seed:           Optional[int] = None,
        config:         Optional[RLConfig] = None,
    ):
        self.cfg        = config or get_config()
        self.save_dir   = save_dir
        self.n_envs     = n_envs if n_envs is not None else self.cfg.training.n_envs
        self.llm_config = llm_config or {"enabled": False}
        self.device     = self._resolve_device(device or self.cfg.training.device)
        self.use_subprocess = use_subprocess

        self.seed = seed if seed is not None else self.cfg.seed
        set_random_seed(self.seed, using_cuda=(self.device == "cuda"))
        random.seed(self.seed)   # opponent sampling below uses `random`

        for d in [save_dir, f"{save_dir}/ghosts", f"{save_dir}/checkpoints",
                  "./data/oracle_datasets", "./logs"]:
            os.makedirs(d, exist_ok=True)

        # Mutable training state — persisted in trainer_state.json
        self._curr_level         = 0
        self._stage_promo_streak = 0
        self._stage_iter_count   = 0
        self._start_iteration    = 1
        self._att_ghost_paths: List[str] = []
        self._def_ghost_paths: List[str] = []
        self._best_score = {"attacker": -1.0, "defender": -1.0}

        # ── Persistent worker pools: created ONCE, opponents hot-swapped ──
        t0 = time.time()
        self._att_envs = make_vec_env(
            "attacker", self.n_envs, self._curr_level,
            opponent_names=self._initial_scripted_names("attacker"),
            use_subprocess=use_subprocess,
        )
        self._def_envs = make_vec_env(
            "defender", self.n_envs, self._curr_level,
            opponent_names=self._initial_scripted_names("defender"),
            use_subprocess=use_subprocess,
        )
        print(f"  Envs ready ({time.time()-t0:.1f}s)", flush=True)

        tb_dir = self.cfg.logging.get("tensorboard_dir", "./logs")
        t0 = time.time()
        self.attacker = RLAgent(self._att_envs, "attacker", self.cfg.ppo,
                                self.device, seed=self.seed, tensorboard_dir=tb_dir)
        print(f"  Attacker ready ({time.time()-t0:.1f}s)", flush=True)

        t0 = time.time()
        # seed+1: identical seeds would give both agents identical init for
        # every same-shaped layer
        self.defender = RLAgent(self._def_envs, "defender", self.cfg.ppo,
                                self.device, seed=self.seed + 1, tensorboard_dir=tb_dir)
        print(f"  Defender ready ({time.time()-t0:.1f}s)", flush=True)

        self.evaluator  = MARLEvaluator(save_dir=f"{save_dir}/results")
        self.att_oracle = LLMOracle("attacker", self.llm_config)
        self.def_oracle = LLMOracle("defender", self.llm_config)

        self.history: Dict = {
            "iterations": [], "curriculum_levels": [],
            "att_win_rates": [], "def_win_rates": [],
            "att_elo": [], "def_elo": [], "timestamps": [],
        }

        self._pause_requested = False
        self._run_start:  float = time.time()
        self._iter_times: List[float] = []
        signal.signal(signal.SIGINT, self._handle_sigint)

        print(BANNER)
        logger.info("Trainer ready.  Device=%s  seed=%d  dir=%s",
                    self.device, self.seed, save_dir)

    # ── Device resolution ──────────────────────────────────────────────────────

    @staticmethod
    def _resolve_device(requested: str) -> str:
        """Resolve 'auto' to the best available device with a clear diagnostic.

        Common cause of GPU not being used on Windows:
          pip install torch  →  installs the CPU-only build by default.
          Check: torch.version.cuda — if None, you have the CPU build.
          Fix:   pip install torch --index-url https://download.pytorch.org/whl/cu121
        """
        cuda_ok = torch.cuda.is_available()
        resolved = ("cuda" if cuda_ok else "cpu") if requested == "auto" else requested
        if resolved == "cuda" and not cuda_ok:
            print("  WARNING: device='cuda' requested but CUDA unavailable. Using CPU.")
            resolved = "cpu"

        print("\n  ── Device check ────────────────────────────────────")
        print(f"  CUDA available  : {cuda_ok}")
        if cuda_ok:
            print(f"  GPU             : {torch.cuda.get_device_name(0)}")
            print(f"  CUDA version    : {torch.version.cuda}")
            vram = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"  VRAM            : {vram:.1f} GB")
        print(f"  PyTorch build   : {torch.__version__}")
        if not cuda_ok:
            print("  Note: CUDA not found. If you have an NVIDIA GPU:")
            print("  pip install torch --index-url https://download.pytorch.org/whl/cu121")
        print(f"  Active device   : {resolved.upper()}")
        print("  ────────────────────────────────────────────────────\n")
        return resolved

    # ── Graceful pause on Ctrl+C ───────────────────────────────────────────────

    def _handle_sigint(self, sig, frame):
        if not self._pause_requested:
            print("\n\n  Pause requested. Finishing current iteration then saving...")
            print("  Press Ctrl+C again to force-quit (unsaved progress lost).\n")
            self._pause_requested = True
        else:
            raise KeyboardInterrupt

    # ── League: per-worker opponent mixing ─────────────────────────────────────

    def _initial_scripted_names(self, role: str) -> List[str]:
        pool = SCRIPTED_POOL_BY_LEVEL[role][self._curr_level]
        return [random.choice(pool) for _ in range(self.n_envs)]

    def _latest_opponent_path(self, role: str) -> str:
        """The opponent of `role` is the other agent's latest snapshot."""
        other = "defender" if role == "attacker" else "attacker"
        return f"{self.save_dir}/{other}_latest.zip"

    def _roll_opponent_mix(self, role: str) -> OpponentMix:
        """
        Per-worker opponent assignment for this iteration.

        Levels 0-1: every worker independently samples from the scripted
        pool, so each PPO update contains experience against multiple
        opponent styles (the core anti-specialization mechanism).

        Level 2: league mix — scripted exploiter slots + latest opponent
        + ghosts sampled uniformly over the full history.
        """
        pool = SCRIPTED_POOL_BY_LEVEL[role][self._curr_level]
        if self._curr_level < 2:
            return [("scripted", random.choice(pool)) for _ in range(self.n_envs)]

        ghosts = (self._def_ghost_paths if role == "attacker"
                  else self._att_ghost_paths)
        ghosts = [p for p in ghosts if os.path.exists(p)]
        latest = self._latest_opponent_path(role)
        has_latest = os.path.exists(latest)

        n = self.n_envs
        n_scripted = min(self.cfg.league.scripted_slots, n)
        n_latest   = min(self.cfg.league.latest_slots, n - n_scripted) if has_latest else 0
        # Ghost slots are capped at the number of DISTINCT ghosts and drawn
        # without replacement. Early at level 2 the pool holds one ghost
        # that IS yesterday's latest — filling 4 slots with it gives 6/8
        # workers the same opponent, which is exactly the specialization
        # pressure the league exists to prevent. Surplus slots fall back to
        # scripted opponents until the pool deepens.
        n_ghost = min(n - n_scripted - n_latest, len(ghosts))

        mix: OpponentMix = [("scripted", random.choice(pool))
                            for _ in range(n_scripted)]
        mix += [("rl", latest)] * n_latest
        mix += [("rl", g) for g in random.sample(ghosts, n_ghost)]
        while len(mix) < n:
            mix.append(("scripted", random.choice(pool)))
        return mix

    def _apply_opponent_mix(self, vec_env, mix: OpponentMix) -> None:
        for i, (kind, value) in enumerate(mix):
            if kind == "scripted":
                vec_env.env_method("set_scripted_opponent", value, indices=[i])
            else:
                vec_env.env_method("load_rl_opponent", value, indices=[i])

    @staticmethod
    def _describe_mix(mix: OpponentMix) -> str:
        counts: Dict[str, int] = {}
        for kind, value in mix:
            label = value if kind == "scripted" else os.path.basename(value)
            counts[label] = counts.get(label, 0) + 1
        return ", ".join(f"{n}×{name}" for name, n in sorted(counts.items()))

    # ── Entropy warmup (replaces the buffer-corrupting epsilon callback) ──────

    def _ent_coef_for(self, role: str, iteration: int) -> float:
        base = self.cfg.ppo.ent_coef[role]
        warmup_iters = self.cfg.ppo.warmup_iters
        if iteration > warmup_iters:
            return base
        start = max(self.cfg.ppo.warmup_ent_coef, base)
        frac = (iteration - 1) / max(warmup_iters, 1)
        return start + (base - start) * frac

    # ── State persistence ──────────────────────────────────────────────────────

    def save_state(self, completed_iteration: int) -> None:
        """Save everything needed to resume. Called after every iteration."""
        att_path = f"{self.save_dir}/attacker_latest.zip"
        def_path = f"{self.save_dir}/defender_latest.zip"
        self.attacker.save(att_path)
        self.defender.save(def_path)

        state = {
            "version":            "3.0",
            "saved_at":           datetime.utcnow().isoformat(),
            "seed":               self.seed,
            "next_iteration":     completed_iteration + 1,
            "curr_level":         self._curr_level,
            "stage_promo_streak": self._stage_promo_streak,
            "stage_iter_count":   self._stage_iter_count,
            "att_ghost_paths":    self._att_ghost_paths,
            "def_ghost_paths":    self._def_ghost_paths,
            "best_score":         self._best_score,
            "attacker_path":      att_path,
            "defender_path":      def_path,
            "history":            self.history,
            "elo":                self.evaluator.elo.to_dict(),
        }
        state_path = os.path.join(self.save_dir, self.STATE_FILENAME)
        with open(state_path, "w") as f:
            json.dump(state, f, indent=2, default=str)
        logger.info("State saved → iter %d complete, resume from %d",
                    completed_iteration, completed_iteration + 1)

    def load_state(self) -> bool:
        """Load saved state if it exists. Returns True if resumed."""
        state_path = os.path.join(self.save_dir, self.STATE_FILENAME)
        if not os.path.exists(state_path):
            return False

        with open(state_path) as f:
            s = json.load(f)

        print(f"\n  Resuming from iteration {s['next_iteration']}")
        print(f"  Last saved: {s['saved_at']}")
        print(f"  Curriculum level: {s['curr_level']}")
        print(f"  Completed iterations: {len(s['history'].get('iterations', []))}\n")

        self._start_iteration     = s["next_iteration"]
        self._curr_level          = s["curr_level"]
        self._stage_promo_streak  = s["stage_promo_streak"]
        self._stage_iter_count    = s["stage_iter_count"]
        self._att_ghost_paths     = [p for p in s.get("att_ghost_paths", [])
                                     if os.path.exists(p)]
        self._def_ghost_paths     = [p for p in s.get("def_ghost_paths", [])
                                     if os.path.exists(p)]
        self._best_score          = s.get("best_score", self._best_score)
        self.history              = s["history"]
        self.evaluator.elo.from_dict(s.get("elo", {}))

        # Restore evaluator metrics for accurate plots after resume
        metrics_path = f"{self.save_dir}/results/training_metrics.json"
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                self.evaluator.all_metrics = json.load(f)

        for path, label, agent in [
            (s.get("attacker_path"), "Attacker", self.attacker),
            (s.get("defender_path"), "Defender", self.defender),
        ]:
            if path and os.path.exists(path):
                t0 = time.time()
                agent.load(path)
                logger.info("Loaded %s from %s  (%.1fs)", label, path, time.time()-t0)
            else:
                logger.warning("%s not found at %s — starting fresh", label, path)

        # Pools were built at level 0 in __init__ — sync them to the
        # restored level in place (no rebuild).
        if self._curr_level > 0:
            self._att_envs.env_method("set_curriculum_level", self._curr_level)
            self._def_envs.env_method("set_curriculum_level", self._curr_level)

        logger.info("Ghost pools: %d att, %d def (paths only)",
                    len(self._att_ghost_paths), len(self._def_ghost_paths))
        return True

    # ── Main training loop ─────────────────────────────────────────────────────

    def train(
        self,
        n_iterations:         Optional[int] = None,
        timesteps_per_iter:   Optional[int] = None,
        eval_episodes:        Optional[int] = None,
        run_bc_phase:         bool = True,
        run_llm_oracle_phase: bool = False,
        resume:               bool = False,
    ) -> Dict:
        """Full training run. Pass resume=True to continue from saved state.
        Press Ctrl+C at any time to pause cleanly after the current iteration."""
        n_iterations       = n_iterations       or self.cfg.training.n_iterations
        timesteps_per_iter = timesteps_per_iter or self.cfg.training.timesteps_per_iter
        eval_episodes      = eval_episodes      or self.cfg.training.eval_episodes

        if resume:
            if not self.load_state():
                logger.info("No saved state found at %s — starting fresh.", self.save_dir)

        self._run_start = time.time()
        fresh_start = (self._start_iteration == 1)

        if run_bc_phase and fresh_start:
            self._phase_behavioral_cloning()

        if run_llm_oracle_phase and self.llm_config.get("enabled") and fresh_start:
            self._phase_llm_oracle_cloning()

        for iteration in range(self._start_iteration, n_iterations + 1):
            try:
                self._run_iteration(iteration, n_iterations,
                                    timesteps_per_iter, eval_episodes)
            except (EOFError, BrokenPipeError, ConnectionResetError):
                # On Windows, Ctrl+C reaches the SubprocVecEnv workers too;
                # if they die before the iteration finishes, the pipes break.
                # When a pause was requested this is a graceful stop, not a
                # crash — state from the last completed iteration is saved.
                if self._pause_requested:
                    print("\n  Paused mid-iteration (env workers interrupted)."
                          f"\n  To resume:  python run_training.py --resume"
                          f"\n  State file: {self.save_dir}/{self.STATE_FILENAME}\n")
                    return self.history
                raise

            if self._pause_requested:
                print(f"\n  Training paused after iteration {iteration}.")
                print(f"  To resume:  python run_training.py --resume")
                print(f"  State file: {self.save_dir}/{self.STATE_FILENAME}\n")
                break

        self._save_final()
        return self.history

    def _run_iteration(
        self,
        iteration:          int,
        n_iterations:       int,
        timesteps_per_iter: int,
        eval_episodes:      int,
    ) -> None:
        iter_t0 = time.time()

        print_iteration_header(
            iteration        = iteration,
            n_iterations     = n_iterations,
            curriculum_level = self._curr_level,
            run_start        = self._run_start,
            iter_times       = self._iter_times,
        )

        self._save_ghost(iteration)

        # ── League: roll and apply this iteration's opponent mix ────────
        att_mix = self._roll_opponent_mix("attacker")
        def_mix = self._roll_opponent_mix("defender")
        self._apply_opponent_mix(self._att_envs, att_mix)
        self._apply_opponent_mix(self._def_envs, def_mix)
        print(f"  Attacker vs: {self._describe_mix(att_mix)}")
        print(f"  Defender vs: {self._describe_mix(def_mix)}")

        curr_timesteps = self.cfg.curriculum.timesteps_for(
            self._curr_level, timesteps_per_iter)
        curr_eval_eps = self.cfg.curriculum.eval_episodes_for(
            self._curr_level, eval_episodes)
        print(f"  Timesteps: {curr_timesteps:,}   Eval episodes: {curr_eval_eps}"
              f"   Envs: {self.n_envs}")

        # ── Train both sides on the persistent pools ────────────────────
        callbacks = {}
        for role, agent in (("attacker", self.attacker),
                            ("defender", self.defender)):
            ent_coef = self._ent_coef_for(role, iteration)
            agent.model.ent_coef = ent_coef
            if iteration <= self.cfg.ppo.warmup_iters:
                print(f"  {role.capitalize()} entropy warmup: "
                      f"ent_coef={ent_coef:.3f}")

            cb = CyberXProgressCallback(
                total_timesteps = curr_timesteps,
                role            = role,
                iteration       = iteration,
                n_iterations    = n_iterations,
                iteration_start = iter_t0,
                run_start       = self._run_start,
                device          = self.device,
            )
            callbacks[role] = cb
            agent.model.learn(
                total_timesteps     = curr_timesteps,
                reset_num_timesteps = False,
                tb_log_name         = role,
                callback            = cb,
            )

        # Checkpoint — runs in a background thread so disk I/O never
        # blocks the loop. Level 0-1: every 5 iterations.
        should_checkpoint = (
            n_iterations > 2 and
            (self._curr_level == 2 or iteration % 5 == 0)
        )
        if should_checkpoint:
            print("  Saving checkpoint (async)...", flush=True)
            self._checkpoint_async(iteration)

        # At level 0, skip baseline matches — only the main match
        # informs promotion there, and it saves ~50 min/iteration.
        run_baselines = self._curr_level > 0
        n_matches = 7 if run_baselines else 1
        print(f"  Evaluating ({curr_eval_eps * n_matches} eps, "
              f"{n_matches} match{'es' if n_matches > 1 else ''})...", flush=True)

        metrics = self.evaluator.evaluate_iteration(
            iteration        = iteration,
            attacker         = self.attacker,
            defender         = self.defender,
            baselines_att    = {
                "random":   RandomAttacker(),
                "scripted": ScriptedAttacker(),
                "expert":   ExpertAttacker(),
            } if run_baselines else {},
            baselines_def    = {
                "random":   RandomDefender(),
                "scripted": ScriptedDefender(),
                "expert":   ExpertDefender(),
            } if run_baselines else {},
            n_episodes       = curr_eval_eps,
            curriculum_level = self._curr_level,
            silent           = True,
        )

        iter_elapsed = time.time() - iter_t0
        self._iter_times.append(iter_elapsed)

        self._update_history(iteration, metrics)
        self._update_best_models(metrics)
        self._check_curriculum_promotion(metrics)
        self._stage_iter_count += 1

        print_iteration_summary(
            iteration     = iteration,
            n_iterations  = n_iterations,
            metrics       = metrics,
            history       = self.history,
            iter_elapsed  = iter_elapsed,
            run_start     = self._run_start,
            att_callback  = callbacks["attacker"],
            def_callback  = callbacks["defender"],
        )

        if iteration % self.cfg.logging.get("save_plots_every_n_iters", 5) == 0:
            self.evaluator.plot_training_curves()
            self.evaluator.plot_action_heatmap(iteration)

        self.save_state(iteration)

    # ── Phase 0 helpers ────────────────────────────────────────────────────────

    def _phase_behavioral_cloning(self) -> None:
        print(f"\n{'─'*62}\n  PHASE 0-A  –  Behavioral Cloning\n{'─'*62}")
        steps = [
            ("attacker", ScriptedAttacker, ScriptedDefender, 0, 500),
            ("defender", ScriptedDefender, ScriptedAttacker, 0, 500),
            ("attacker", ExpertAttacker,   ExpertDefender,   1, 300),
            ("defender", ExpertDefender,   ExpertAttacker,   1, 300),
        ]
        for mode, exp_cls, opp_cls, level, n_ep in steps:
            env = SharedHoneypotEnv(mode=mode, curriculum_level=level,
                                    opponent_model=opp_cls())
            env.reset(seed=self.seed)
            agent = self.attacker if mode == "attacker" else self.defender
            agent.pretrain_on_expert(exp_cls(), env, num_episodes=n_ep, epochs=20)

    def _phase_llm_oracle_cloning(self) -> None:
        print(f"\n{'─'*62}\n  PHASE 0-B  –  LLM Oracle Cloning\n{'─'*62}")
        for role, oracle, path in [
            ("attacker", self.att_oracle,
             "./data/oracle_datasets/attacker_oracle.npz"),
            ("defender", self.def_oracle,
             "./data/oracle_datasets/defender_oracle.npz"),
        ]:
            self._collect_oracle_rollouts(role, oracle, path)
            agent = self.attacker if role == "attacker" else self.defender
            if os.path.exists(path):
                agent.pretrain_on_dataset(path, epochs=15)

    def _collect_oracle_rollouts(self, role, oracle, save_path, n_episodes=200):
        opp = ScriptedDefender() if role == "attacker" else ScriptedAttacker()
        env = SharedHoneypotEnv(mode=role, curriculum_level=1, opponent_model=opp)
        env.reset(seed=self.seed)
        for _ in range(n_episodes):
            obs, _ = env.reset()
            cum_r, done = 0.0, False
            while not done:
                action = oracle.query(obs, cum_reward=cum_r, max_steps=env.max_steps)
                if action is None:
                    action, _ = opp.predict(obs)
                obs_b = obs.copy()
                obs, r, term, trunc, _ = env.step(int(action))
                oracle.record_transition(obs_b, action, r)
                cum_r += r
                done = term or trunc
        oracle.save_dataset(save_path)

    # ── League: ghost snapshots (paths only) ───────────────────────────────────

    def _save_ghost(self, iteration: int) -> None:
        """Snapshot both agents into the ghost pools. Ghosts are plain file
        copies of *_latest.zip (written by save_state last iteration) — no
        GPU serialisation, no in-memory model duplicates."""
        if self._curr_level < 2:
            return
        for role, paths in (("attacker", self._att_ghost_paths),
                            ("defender", self._def_ghost_paths)):
            latest = f"{self.save_dir}/{role}_latest.zip"
            if not os.path.exists(latest):
                logger.warning("Ghost skip: %s missing", latest)
                continue
            ghost = f"{self.save_dir}/ghosts/{role[:3]}_{iteration}.zip"
            shutil.copy(latest, ghost)
            paths.append(ghost)
            while len(paths) > self.cfg.league.ghost_pool_max:
                paths.pop(0)   # drop from pool; file stays on disk for analysis

    # ── Best-model gating ──────────────────────────────────────────────────────

    def _composite_score(self, metrics: Dict, role: str) -> float:
        """min(main win rate, vs-scripted, vs-expert) — the anti-specialization
        gate. At level 0 baselines aren't run, so it's the main rate only."""
        key = "att_win_rate" if role == "attacker" else "def_win_rate"
        scores = [metrics.get("main_match", {}).get(key, 0.0)]
        vs = metrics.get(f"{'att' if role == 'attacker' else 'def'}_vs_baselines", {})
        for bname in ("scripted", "expert"):
            wr = (vs.get(bname) or {}).get(key)
            if wr is not None:
                scores.append(wr)
        return min(scores)

    def _update_best_models(self, metrics: Dict) -> None:
        # Level 0 runs no baseline matches, so the composite would be the
        # main-match rate alone — a script-naive policy could lock in a high
        # score that level-1+ composites (which include the script gates)
        # can never beat. Only gate best models once baselines run.
        if self._curr_level == 0:
            return
        for role, agent in (("attacker", self.attacker),
                            ("defender", self.defender)):
            score = self._composite_score(metrics, role)
            if score > self._best_score[role]:
                self._best_score[role] = score
                best_path = f"{self.save_dir}/{role}_best.zip"
                agent.save(best_path)
                print(f"  New best {role}: composite score {score:.2f} "
                      f"→ {os.path.basename(best_path)}")

    # ── Curriculum ─────────────────────────────────────────────────────────────

    def _check_curriculum_promotion(self, metrics: Dict) -> None:
        if self._curr_level >= 2:
            return
        cur = self.cfg.curriculum

        att_wr = (metrics.get("att_vs_baselines", {})
                         .get("scripted", {}).get("att_win_rate"))
        def_wr = (metrics.get("def_vs_baselines", {})
                         .get("scripted", {}).get("def_win_rate"))

        if att_wr is None:
            # Level 0: baselines not run — fall back to the main match.
            # A competent attacker should win >55% there; the defender is
            # naturally disadvantaged vs a scripted attacker at level 0.
            att_wr = metrics.get("main_match", {}).get("att_win_rate", 0)
            promote = att_wr >= 0.55
        else:
            promote = (att_wr >= cur.promo_threshold
                       and def_wr >= cur.promo_threshold)

        if promote:
            self._stage_promo_streak += 1
        else:
            self._stage_promo_streak = 0

        if (self._stage_promo_streak >= cur.promo_streak
                or self._stage_iter_count >= cur.max_stage_iterations):
            self._curr_level += 1
            self._stage_promo_streak = self._stage_iter_count = 0
            print(f"\n  CURRICULUM ADVANCE → Stage {self._curr_level}")
            # Hot-swap the level on the live pools — no rebuild
            self._att_envs.env_method("set_curriculum_level", self._curr_level)
            self._def_envs.env_method("set_curriculum_level", self._curr_level)

    # ── Checkpointing ──────────────────────────────────────────────────────────

    def _checkpoint_async(self, iteration: int) -> None:
        """Save policy state dicts in a background daemon thread so disk
        I/O never blocks the next training iteration. Snapshots are copied
        to CPU on the main thread first, so the background thread performs
        no CUDA operations concurrently with training."""
        att_state = {k: v.detach().cpu()
                     for k, v in self.attacker.model.policy.state_dict().items()}
        def_state = {k: v.detach().cpu()
                     for k, v in self.defender.model.policy.state_dict().items()}

        def _do_save():
            try:
                d = f"{self.save_dir}/checkpoints"
                torch.save(att_state, f"{d}/attacker_iter_{iteration}_policy.pt")
                torch.save(def_state, f"{d}/defender_iter_{iteration}_policy.pt")
                logger.info("Async checkpoint saved for iteration %d", iteration)
            except Exception as e:
                logger.warning("Async checkpoint failed for iteration %d: %s",
                               iteration, e)

        threading.Thread(target=_do_save, daemon=True).start()

    # ── History / final save ───────────────────────────────────────────────────

    def _update_history(self, iteration: int, metrics: Dict) -> None:
        mm = metrics["main_match"]
        self.history["iterations"].append(iteration)
        self.history["curriculum_levels"].append(self._curr_level)
        self.history["att_win_rates"].append(mm["att_win_rate"])
        self.history["def_win_rates"].append(mm["def_win_rate"])
        self.history["att_elo"].append(
            metrics["elo"].get(f"attacker_iter_{iteration}", 1500))
        self.history["def_elo"].append(
            metrics["elo"].get(f"defender_iter_{iteration}", 1500))
        self.history["timestamps"].append(datetime.utcnow().isoformat())
        with open(f"{self.save_dir}/training_history.json", "w") as f:
            json.dump(self.history, f, indent=2)

    def _save_final(self) -> None:
        # *_best.zip is managed by composite-score gating during training —
        # final weights are saved separately so a late regression can't
        # overwrite the best snapshot.
        self.attacker.save(f"{self.save_dir}/attacker_final.zip")
        self.defender.save(f"{self.save_dir}/defender_final.zip")
        self.evaluator.plot_training_curves()
        print_final_summary(
            history     = self.history,
            run_start   = self._run_start,
            leaderboard = self.evaluator.elo.leaderboard(),
        )
        if self._best_score["attacker"] >= 0 or self._best_score["defender"] >= 0:
            print(f"  Best models : {self.save_dir}/attacker_best.zip "
                  f"(composite {self._best_score['attacker']:.2f})")
            print(f"              : {self.save_dir}/defender_best.zip "
                  f"(composite {self._best_score['defender']:.2f})")
        else:
            print("  Best models : not gated yet (best-model selection needs "
                  "level 1+ baseline evals)")
        print(f"  Final models: {self.save_dir}/attacker_final.zip / defender_final.zip")
        print(f"  Results     : {self.save_dir}/results/")
        print(f"  TensorBoard : tensorboard --logdir ./logs\n")
