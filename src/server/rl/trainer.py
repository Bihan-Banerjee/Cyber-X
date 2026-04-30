"""
trainer.py  –  CyberX MARL Trainer  (v2.0)
============================================
Pause / Resume:
  Training saves full state after every completed iteration.
  Press Ctrl+C once to pause cleanly after the current iteration.
  Run with --resume to continue from exactly where you left off.

Curriculum:
  Stage 0 → scripted opponents, restricted actions
  Stage 1 → scripted opponents, full actions
  Stage 2 → self-play + fictitious play

GPU diagnostics:
  Prints device, GPU name, CUDA version on startup so you always know
  what hardware is actually being used.
"""

import os
import json
import signal
import random
import logging
import threading
from typing import Optional, Dict, List
from datetime import datetime
import time
import copy
import numpy as np
import torch
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
from sb3_contrib import RecurrentPPO
from vec_env_factory import make_diverse_envs
from shared_honeypot_env import SharedHoneypotEnv
from baselines import (
    RandomAttacker, RandomDefender,
    ScriptedAttacker, ScriptedDefender,
    ExpertAttacker, ExpertDefender,
)
from attacker_agent import AttackerAgent
from defender_agent import DefenderAgent
from evaluator import MARLEvaluator
from llm_oracle import LLMOracle
from vec_env_factory import make_parallel_envs
from progress import (
    CyberXProgressCallback,
    EpsilonGreedyWarmupCallback,
    print_iteration_header,
    print_iteration_summary,
    print_final_summary,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

BANNER = """
╔══════════════════════════════════════════════════════════╗
║        CyberX  MARL  Training  System  (v2.0)           ║
║   Attacker vs Defender · Curriculum · Fictitious Play   ║
║              LLM Oracle · Elo Evaluation                ║
╚══════════════════════════════════════════════════════════╝
"""

# NOTE: The make_diverse_envs calls that previously appeared here at module
# scope (referencing `self.n_envs`) have been removed — they caused a
# NameError on import because `self` does not exist at module level.
# The equivalent logic lives in _rebuild_envs_for_curriculum() and the
# train() loop where `self` is valid.


class MARLTrainer:
    CURRICULUM_PROMO_THRESHOLD = 0.60
    CURRICULUM_PROMO_STREAK    = 2
    MAX_STAGE_ITERS            = 8
    GHOST_POOL_MAX             = 15
    STATE_FILENAME             = "trainer_state.json"

    def __init__(
        self,
        save_dir:       str   = "./models/cyberx_marl",
        lr:             float = 3e-4,
        ent_coef:       float = 0.01,
        n_envs:         int   = 8,
        device:         str   = "auto",
        llm_config:     Optional[Dict] = None,
        use_subprocess: bool  = True,   # safe now that run_training.py has __main__ guard
    ):
        self.save_dir      = save_dir
        self.lr            = lr
        self.ent_coef      = ent_coef
        self.n_envs        = n_envs
        self.llm_config    = llm_config or {"enabled": False}
        self.device        = self._resolve_device(device)
        # SubprocVecEnv: safe because run_training.py has if __name__=="__main__"
        # guard preventing workers from re-running main() on Windows spawn.
        self.use_subprocess = use_subprocess

        for d in [save_dir, f"{save_dir}/ghosts", f"{save_dir}/checkpoints",
                  "./data/oracle_datasets", "./logs"]:
            os.makedirs(d, exist_ok=True)

        # Mutable training state — all of this is persisted in trainer_state.json
        self._curr_level          = 0
        self._stage_promo_streak  = 0
        self._stage_iter_count    = 0
        self._start_iteration     = 1
        self._att_ghost_paths: List[str] = []
        self._def_ghost_paths: List[str] = []
        self._att_ghosts: List[AttackerAgent] = []
        self._def_ghosts: List[DefenderAgent] = []

        # Env pool: reuse SubprocVecEnv when the opponent type hasn't changed.
        # Spawning 8 subprocesses takes 5-10s on Windows; skipping this on
        # iterations where the opponent is the same scripted class saves
        # ~10-20s per iteration at levels 0-1.
        self._att_env_pool: Optional[object] = None
        self._def_env_pool: Optional[object] = None
        self._att_env_key:  Optional[str]    = None   # e.g. "attacker_ScriptedDefender_0"
        self._def_env_key:  Optional[str]    = None

        t0 = time.time()
        self._att_envs = self._make_vec_env("attacker", ScriptedDefender())
        self._def_envs = self._make_vec_env("defender", ScriptedAttacker())
        print(f"  Envs ready ({time.time()-t0:.1f}s)", flush=True)

        t0 = time.time()
        self.attacker = AttackerAgent(self._att_envs, lr, ent_coef, self.device)
        print(f"  Attacker ready ({time.time()-t0:.1f}s)", flush=True)

        t0 = time.time()
        self.defender = DefenderAgent(self._def_envs, lr, ent_coef, self.device)
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
        self._run_start:  float = time.time()   # set properly in train()
        self._iter_times: List[float] = []       # per-iteration wall times
        signal.signal(signal.SIGINT, self._handle_sigint)

        print(BANNER)
        logger.info("Trainer ready.  Device=%s  dir=%s", self.device, save_dir)

    # ── Device resolution ──────────────────────────────────────────────────────

    @staticmethod
    def _resolve_device(requested: str) -> str:
        """
        Resolve 'auto' to the best available device and print a clear
        diagnostic.  This is the first place to look if GPU isn't being used.

        Common cause of GPU not being used on Windows:
          pip install torch  →  installs CPU-only build by default.
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

    # ── State persistence ──────────────────────────────────────────────────────

    def save_state(self, completed_iteration: int) -> None:
        """
        Save everything needed to resume.
        Called automatically after every completed iteration.

        Saves:
          models/cyberx_marl/attacker_latest.zip   ← current weights
          models/cyberx_marl/defender_latest.zip
          models/cyberx_marl/trainer_state.json     ← curriculum + Elo + history
        """
        att_path = f"{self.save_dir}/attacker_latest.zip"
        def_path = f"{self.save_dir}/defender_latest.zip"
        self.attacker.save(att_path)
        self.defender.save(def_path)

        state = {
            "version":            "2.0",
            "saved_at":           datetime.utcnow().isoformat(),
            "next_iteration":     completed_iteration + 1,
            "curr_level":         self._curr_level,
            "stage_promo_streak": self._stage_promo_streak,
            "stage_iter_count":   self._stage_iter_count,
            "att_ghost_paths":    self._att_ghost_paths,
            "def_ghost_paths":    self._def_ghost_paths,
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
        """
        Load saved state if it exists.  Returns True if resumed successfully.
        """
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
        self._att_ghost_paths     = s.get("att_ghost_paths", [])
        self._def_ghost_paths     = s.get("def_ghost_paths", [])
        self.history              = s["history"]
        self.evaluator.elo.from_dict(s.get("elo", {}))

        # Restore evaluator metrics for accurate plots after resume
        metrics_path = f"{self.save_dir}/results/training_metrics.json"
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                self.evaluator.all_metrics = json.load(f)

        # Load model weights
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

        # Don't rebuild full envs here — the training loop calls
        # _rebuild_envs_for_curriculum() at the start of each iteration anyway.
        # Rebuilding here just wastes 16 env instantiations on startup.
        # Ghost pools are only used at level 2; skip if at level 0/1.
        if self._curr_level >= 2:
            self._rebuild_envs_for_curriculum()
            self._rebuild_ghost_pools()
        return True

    def _rebuild_ghost_pools(self) -> None:
        """Reload ghost agents from the saved path lists."""
        self._att_ghosts, self._def_ghosts = [], []
        for path in self._att_ghost_paths[-self.GHOST_POOL_MAX:]:
            if os.path.exists(path):
                try:
                    g = AttackerAgent(self._att_envs, self.lr, self.ent_coef, self.device)
                    g.model = RecurrentPPO.load(path, env=self._att_envs)
                    self._att_ghosts.append(g)
                except Exception as e:
                    logger.warning("Ghost att load failed %s: %s", path, e)
        for path in self._def_ghost_paths[-self.GHOST_POOL_MAX:]:
            if os.path.exists(path):
                try:
                    g = DefenderAgent(self._def_envs, self.lr, self.ent_coef, self.device)
                    g.model = RecurrentPPO.load(path, env=self._def_envs)
                    self._def_ghosts.append(g)
                except Exception as e:
                    logger.warning("Ghost def load failed %s: %s", path, e)
        logger.info("Ghost pools: %d att, %d def",
                    len(self._att_ghosts), len(self._def_ghosts))

    # ── Main training loop ─────────────────────────────────────────────────────

    def train(
        self,
        n_iterations:         int  = 30,
        timesteps_per_iter:   int  = 100_000,
        eval_episodes:        int  = 50,
        run_bc_phase:         bool = True,
        run_llm_oracle_phase: bool = False,
        resume:               bool = False,
    ) -> Dict:
        """
        Full training run.  Pass resume=True to continue from saved state.
        Press Ctrl+C at any time to pause cleanly after the current iteration.
        """
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
            iter_t0 = time.time()

            print_iteration_header(
                iteration        = iteration,
                n_iterations     = n_iterations,
                curriculum_level = self._curr_level,
                run_start        = self._run_start,
                iter_times       = self._iter_times,
            )

            self._save_ghost(iteration)
            self._rebuild_envs_for_curriculum()

            # FIX: initialise path variables before the if/elif/else so they are
            # always defined when _make_vec_env is called below, regardless of
            # which curriculum branch was taken.  At levels 0 and 1 there is no
            # RL opponent file, so the paths stay None (scripted opponents are
            # passed as objects, not files).
            att_opp_path: Optional[str] = None
            def_opp_path: Optional[str] = None

            if self._curr_level == 0:
                def_pool = [RandomDefender, ScriptedDefender]
                att_pool = [RandomAttacker, ScriptedAttacker]
                att_opp = random.choice(def_pool)()
                def_opp = random.choice(att_pool)()
            elif self._curr_level == 1:
                def_pool = [ScriptedDefender, ExpertDefender]
                att_pool = [ScriptedAttacker, ExpertAttacker]
                # Weight toward harder opponents as stage_iter_count increases
                progress = min(self._stage_iter_count / 8.0, 1.0)
                att_opp = (ExpertDefender() if random.random() < progress
                           else ScriptedDefender())
                def_opp = (ExpertAttacker() if random.random() < progress
                           else ScriptedAttacker())
            else:
                # Opponent diversity: 70% current RL opponent, 30% scripted.
                # This directly addresses the specialization trap — agents that
                # only train against each other overfit to the specific partner.
                # Mixing in scripted opponents forces generalization.
                if random.random() < 0.30:
                    att_opp = random.choice([ScriptedDefender(), ExpertDefender()])
                    def_opp = random.choice([ScriptedAttacker(), ExpertAttacker()])
                    att_opp_path = def_opp_path = None
                else:
                    att_opp = self._sample_opponent(self._def_ghosts, self.defender)
                    def_opp = self._sample_opponent(self._att_ghosts, self.attacker)
                    att_opp_path = os.path.join(self.save_dir, "_tmp_def_opp.zip")
                    def_opp_path = os.path.join(self.save_dir, "_tmp_att_opp.zip")
                    att_opp.save(att_opp_path)
                    def_opp.save(def_opp_path)

            # Curriculum-aware timesteps and eval episodes.
            # At level 0 agents are training against simple scripted opponents —
            # 30k steps is enough signal without wasting hours.  Full 100k only
            # kicks in at level 2 (self-play) where the policy landscape is
            # genuinely complex.  Same logic for eval: 20 eps at level 0 is
            # statistically sufficient; save the 50-ep eval for paper results.
            curr_timesteps = {0: max(30_000,  timesteps_per_iter // 3),
                              1: max(60_000,  timesteps_per_iter // 2),
                              2: timesteps_per_iter}.get(self._curr_level, timesteps_per_iter)
            # Level 0: 10 episodes is enough signal. Saves ~40 min per iteration.
            # Level 1: 20 episodes. Level 2: full count for paper-quality results.
            curr_eval_eps  = {0: 10,
                              1: max(20, eval_episodes // 2),
                              2: eval_episodes}.get(self._curr_level, eval_episodes)

            print(f"  Timesteps: {curr_timesteps:,}   Eval episodes: {curr_eval_eps}"
                  f"   Envs: {self.n_envs}")

            # ── Attacker training with live progress bar ───────────────────
            att_cb = CyberXProgressCallback(
                total_timesteps = curr_timesteps,
                role            = "attacker",
                iteration       = iteration,
                n_iterations    = n_iterations,
                iteration_start = iter_t0,
                run_start       = self._run_start,
                device          = self.device,
            )
            # Epsilon-greedy warmup: forces exploration for first 6 iters.
            # Decays from 30% random actions → 0%.  Prevents LSTM collapse.
            att_eps_cb = EpsilonGreedyWarmupCallback(
                action_space_n    = 10,
                start_eps         = 0.30,
                end_eps           = 0.0,
                warmup_iters      = 12,
                current_iteration = iteration,
            )
            att_envs = self._make_vec_env("attacker", att_opp, att_opp_path)
            self.attacker.model.set_env(att_envs)
            self.attacker.model.learn(
                total_timesteps     = curr_timesteps,
                reset_num_timesteps = False,
                tb_log_name         = "attacker",
                callback            = [att_cb, att_eps_cb],
            )
            if att_eps_cb.epsilon > 0:
                print(f"  Epsilon warmup: injected {att_eps_cb.inject_rate:.0%} random attacker actions")

            # ── Defender training with live progress bar ───────────────────
            def_cb = CyberXProgressCallback(
                total_timesteps = curr_timesteps,
                role            = "defender",
                iteration       = iteration,
                n_iterations    = n_iterations,
                iteration_start = iter_t0,
                run_start       = self._run_start,
                device          = self.device,
            )
            def_eps_cb = EpsilonGreedyWarmupCallback(
                action_space_n    = 10,
                start_eps         = 0.20,
                end_eps           = 0.0,
                warmup_iters      = 12,
                current_iteration = iteration,
            )
            def_envs = self._make_vec_env("defender", def_opp, def_opp_path)
            self.defender.model.set_env(def_envs)
            self.defender.model.learn(
                total_timesteps     = curr_timesteps,
                reset_num_timesteps = False,
                tb_log_name         = "defender",
                callback            = [def_cb, def_eps_cb],
            )

            # Checkpoint — expensive on Windows CUDA (~60-90 s per save).
            # At level 0+1: only save every 5 iterations. Always save at level 2.
            # Runs in a background thread so it never blocks the training loop.
            should_checkpoint = (
                n_iterations > 2 and
                (self._curr_level == 2 or iteration % 5 == 0)
            )
            if should_checkpoint:
                print("  Saving checkpoint (async)...", flush=True)
                self._checkpoint_async(iteration)

            # At level 0, skip baseline matches entirely — only run the main
            # attacker-vs-defender match. Saves ~50 min per iteration.
            # Baselines only matter for curriculum promotion decisions (level 1+).
            if self._curr_level == 0:
                n_matches  = 1
                total_eps  = curr_eval_eps
                run_baselines = False
            else:
                n_matches  = 1 + 3 + 3
                total_eps  = curr_eval_eps * n_matches
                run_baselines = True

            print(f"  Evaluating ({total_eps} eps, {n_matches} match{'es' if n_matches>1 else ''})...",
                  flush=True)
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
            self._check_curriculum_promotion(metrics)
            self._stage_iter_count += 1

            # Rich post-eval summary (replaces the old plain print)
            print_iteration_summary(
                iteration     = iteration,
                n_iterations  = n_iterations,
                metrics       = metrics,
                history       = self.history,
                iter_elapsed  = iter_elapsed,
                run_start     = self._run_start,
                att_callback  = att_cb,
                def_callback  = def_cb,
            )

            if iteration % 5 == 0:
                self.evaluator.plot_training_curves()
                self.evaluator.plot_action_heatmap(iteration)

            self.save_state(iteration)

            if self._pause_requested:
                print(f"\n  Training paused after iteration {iteration}.")
                print(f"  To resume:  python run_training.py --resume")
                print(f"  State file: {self.save_dir}/{self.STATE_FILENAME}\n")
                break

        self._save_final()
        return self.history

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
            env   = SharedHoneypotEnv(mode=mode, curriculum_level=level,
                                      opponent_model=opp_cls())
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

    # ── Fictitious play ────────────────────────────────────────────────────────

    def _save_ghost(self, iteration: int) -> None:
        if self._curr_level < 2:
            return
        att_path = f"{self.save_dir}/ghosts/att_{iteration}.zip"
        def_path = f"{self.save_dir}/ghosts/def_{iteration}.zip"
        self.attacker.save(att_path)
        self.defender.save(def_path)

        # Deep copy policy weights in-memory — no second disk read per ghost.
        # (Bug 3 fix: original code did RecurrentPPO.load(att_path) immediately
        # after saving, costing 60-90s of GPU serialisation per ghost save.)
        ga = AttackerAgent(self._att_envs, self.lr, self.ent_coef, self.device)
        ga.model.policy.load_state_dict(
            copy.deepcopy(self.attacker.model.policy.state_dict())
        )
        self._att_ghosts.append(ga)
        self._att_ghost_paths.append(att_path)

        gd = DefenderAgent(self._def_envs, self.lr, self.ent_coef, self.device)
        gd.model.policy.load_state_dict(
            copy.deepcopy(self.defender.model.policy.state_dict())
        )
        self._def_ghosts.append(gd)
        self._def_ghost_paths.append(def_path)

        for pool, paths in [(self._att_ghosts, self._att_ghost_paths),
                            (self._def_ghosts, self._def_ghost_paths)]:
            while len(pool) > self.GHOST_POOL_MAX:
                pool.pop(0); paths.pop(0)

    def _sample_opponent(self, pool, current):
        return random.choice(pool) if pool and random.random() < 0.5 else current

    # ── Curriculum ─────────────────────────────────────────────────────────────

    def _check_curriculum_promotion(self, metrics: Dict) -> None:
        if self._curr_level >= 2:
            return

        # Bug 1 fix: at level 0 baselines are not run, so att_vs_baselines /
        # def_vs_baselines are empty dicts and the scripted key is missing.
        # Both win rates came back as 0 every iteration, permanently blocking
        # streak-based promotion and wasting ~15 iterations per stage.
        # Fix: detect the missing key (None sentinel) and fall back to the
        # main match win rates which ARE available at every level.
        att_wr = (metrics.get("att_vs_baselines", {})
                         .get("scripted", {}).get("att_win_rate"))
        def_wr = (metrics.get("def_vs_baselines", {})
                         .get("scripted", {}).get("def_win_rate"))

        if att_wr is None:  # baselines not run (level 0)
            att_wr = metrics.get("main_match", {}).get("att_win_rate", 0)
            def_wr = metrics.get("main_match", {}).get("def_win_rate", 0)
            # At level 0, a competent attacker should win > 55%, defender > 30%
            # (defender is naturally disadvantaged at level 0 vs scripted attacker)
            promote = att_wr >= 0.55
        else:
            promote = (att_wr >= self.CURRICULUM_PROMO_THRESHOLD
                       and def_wr >= self.CURRICULUM_PROMO_THRESHOLD)

        if promote:
            self._stage_promo_streak += 1
        else:
            self._stage_promo_streak = 0

        if (self._stage_promo_streak >= self.CURRICULUM_PROMO_STREAK
                or self._stage_iter_count >= self.MAX_STAGE_ITERS):
            self._curr_level += 1
            self._stage_promo_streak = self._stage_iter_count = 0
            # Invalidate cached envs — the new curriculum level needs different envs
            self._att_env_key = None
            self._def_env_key = None
            print(f"\n  CURRICULUM ADVANCE → Stage {self._curr_level}")
            self._rebuild_envs_for_curriculum()

    def _rebuild_envs_for_curriculum(self) -> None:
        if self._curr_level == 0:
            # Rotate opponents so agents don't overfit to one scripted style
            def_opps = [RandomDefender(), ScriptedDefender()]
            att_opps = [RandomAttacker(), ScriptedAttacker()]
            self._att_envs = self._make_vec_env("attacker",
                                 random.choice(def_opps))
            self._def_envs = self._make_vec_env("defender",
                                 random.choice(att_opps))
        elif self._curr_level == 1:
            # Mix scripted and expert so agents see adaptive play before self-play
            def_opps = [ScriptedDefender(), ExpertDefender()]
            att_opps = [ScriptedAttacker(), ExpertAttacker()]
            self._att_envs = self._make_vec_env("attacker",
                                 random.choice(def_opps))
            self._def_envs = self._make_vec_env("defender",
                                 random.choice(att_opps))
        else:
            # Save current agents so subprocesses can load them
            att_p = os.path.join(self.save_dir, "_tmp_def_opp.zip")
            def_p = os.path.join(self.save_dir, "_tmp_att_opp.zip")
            self.defender.save(att_p)   # defender is the attacker env's opponent
            self.attacker.save(def_p)   # attacker is the defender env's opponent
            self._att_envs = self._make_vec_env("attacker", opponent_path=att_p)
            self._def_envs = self._make_vec_env("defender", opponent_path=def_p)

    # ── Utilities ──────────────────────────────────────────────────────────────

    def _make_vec_env(self, mode: str, opponent=None, opponent_path: str = None,
                      n_envs_override: int = None):
        """
        Create or retrieve a cached vectorised env.

        Cache key = (mode, opponent_class_name, curriculum_level, n_envs).
        When the key matches the existing pool, the pool is returned as-is
        — no subprocess spawning.  When it changes (e.g. curriculum advance
        or new opponent path), the old pool is closed first.

        RL opponents (opponent_path set) are never cached because they change
        every iteration.  Scripted opponents at levels 0-1 are always cached.
        """
        n = n_envs_override if n_envs_override is not None else self.n_envs
        is_att = (mode == "attacker")

        # Build cache key.  RL opponents use None key (never cache).
        if opponent_path is not None:
            cache_key = None
        else:
            opp_name = type(opponent).__name__ if opponent else "None"
            cache_key = f"{mode}_{opp_name}_{self._curr_level}_{n}"

        cached_env = self._att_env_pool if is_att else self._def_env_pool
        cached_key = self._att_env_key  if is_att else self._def_env_key

        # Return cached pool if key matches
        if cache_key is not None and cache_key == cached_key and cached_env is not None:
            return cached_env

        # Close old pool before creating new one (frees subprocess resources)
        if cached_env is not None:
            try:
                cached_env.close()
            except Exception:
                pass

        new_env = make_parallel_envs(
            mode             = mode,
            n_envs           = n,
            curriculum_level = self._curr_level,
            opponent         = opponent,
            opponent_path    = opponent_path,
            use_subprocess   = self.use_subprocess,
        )

        # Store in pool (only cache if key is stable)
        if is_att:
            self._att_env_pool = new_env
            self._att_env_key  = cache_key
        else:
            self._def_env_pool = new_env
            self._def_env_key  = cache_key

        return new_env

    def _checkpoint(self, iteration: int) -> None:
        """Synchronous checkpoint — prefer _checkpoint_async during training."""
        d = f"{self.save_dir}/checkpoints"
        self.attacker.save(f"{d}/attacker_iter_{iteration}.zip")
        self.defender.save(f"{d}/defender_iter_{iteration}.zip")
        logger.info("Checkpointed iteration %d", iteration)

    def _checkpoint_async(self, iteration: int) -> None:
        """
        Save checkpoint in a background daemon thread so the GPU serialisation
        (~60-90 s on CUDA) does not block the next training iteration.
        The thread is a daemon so it won't prevent clean process exit.
        Note: do not call this twice for the same iteration before the first
        write has finished — the filenames are deterministic and would race.
        """
        # Take snapshots of the state dicts now (on the main thread) so the
        # background thread works on a stable copy even if the models keep
        # training.  deepcopy is fast relative to disk I/O.
        att_state = copy.deepcopy(self.attacker.model.policy.state_dict())
        def_state = copy.deepcopy(self.defender.model.policy.state_dict())

        def _do_save():
            try:
                d = f"{self.save_dir}/checkpoints"
                # Temporarily load snapshot weights into fresh agents for saving.
                # We cannot call .save() on the live agents from a background
                # thread (not thread-safe with SB3).  Instead we write the state
                # dicts directly via torch.save so there is zero contention.
                torch.save(att_state,
                           f"{d}/attacker_iter_{iteration}_policy.pt")
                torch.save(def_state,
                           f"{d}/defender_iter_{iteration}_policy.pt")
                logger.info("Async checkpoint saved for iteration %d", iteration)
            except Exception as e:
                logger.warning("Async checkpoint failed for iteration %d: %s",
                               iteration, e)

        threading.Thread(target=_do_save, daemon=True).start()

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
        self.attacker.save(f"{self.save_dir}/attacker_best.zip")
        self.defender.save(f"{self.save_dir}/defender_best.zip")
        self.evaluator.plot_training_curves()
        print_final_summary(
            history     = self.history,
            run_start   = self._run_start,
            leaderboard = self.evaluator.elo.leaderboard(),
        )
        print(f"  Best models : {self.save_dir}/attacker_best.zip")
        print(f"              : {self.save_dir}/defender_best.zip")
        print(f"  Results     : {self.save_dir}/results/")
        print(f"  TensorBoard : tensorboard --logdir ./logs\n")