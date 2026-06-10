"""
evaluator.py  –  CyberX MARL Evaluation Framework  (v1.1)
===========================================================
Provides:
  • EloRatingSystem   – proper Elo with configurable K-factor
  • MARLEvaluator     – runs head-to-head tournaments and computes all
                        metrics needed for the research paper results tables
  • plot_training_curves – matplotlib helpers for paper figures

Paper metrics produced:
  • Attacker win rate vs. each baseline + vs. current defender
  • Defender win rate vs. each baseline + vs. current attacker
  • Time-to-detection  (mean ± std steps before first defender action)
  • False positive rate (blocks when no real attack)
  • Kill-chain depth reached (distribution across episodes)
  • Elo trajectories over training iterations
  • Strategy entropy  (action distribution Shannon entropy per agent)

v1.2: the local _StatefulDefender wrapper was replaced by the shared
      shared_honeypot_env.StatefulOpponent (the same class the training
      envs use), and eval matches are seeded so results are reproducible.
"""

import json
import os
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

# ── Optional matplotlib import (graceful degradation in headless envs) ────────
try:
    import matplotlib
    matplotlib.use("Agg")          # non-interactive backend for servers
    import matplotlib.pyplot as plt
    import matplotlib.gridspec as gridspec
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    logger.warning("matplotlib not installed – plotting disabled")


def _cpu_eval_clone(agent):
    """Predict-only CPU copy of an RL agent for evaluation threads.

    RecurrentPPO.predict just delegates to policy.predict (same signature),
    so a fresh policy exposed as `.model` satisfies everything _run_match
    and StatefulOpponent need — without ever moving or sharing the live
    training model.

    The clone is rebuilt from the policy's constructor parameters + a CPU
    state_dict copy. deepcopy is NOT usable here: on CUDA models the
    cuDNN-flattened LSTM weights are non-leaf tensors and deepcopy raises.
    sb3-contrib's RecurrentActorCriticPolicy does not include its LSTM
    kwargs in _get_constructor_parameters, so they are merged in explicitly
    from the live module.
    """
    import inspect
    from types import SimpleNamespace

    policy = agent.model.policy
    params = policy._get_constructor_parameters()

    accepted = inspect.signature(type(policy).__init__).parameters
    lstm = policy.lstm_actor
    for key, value in (
        ("lstm_hidden_size",   lstm.hidden_size),
        ("n_lstm_layers",      lstm.num_layers),
        ("shared_lstm",        getattr(policy, "shared_lstm", False)),
        ("enable_critic_lstm", getattr(policy, "enable_critic_lstm", True)),
        ("lstm_kwargs",        getattr(policy, "lstm_kwargs", None)),
    ):
        if key in accepted and key not in params:
            params[key] = value

    clone = type(policy)(**params)   # modules are created on CPU
    clone.load_state_dict(
        {k: v.detach().cpu() for k, v in policy.state_dict().items()}
    )
    clone.set_training_mode(False)
    return SimpleNamespace(model=clone)


# ══════════════════════════════════════════════════════════════════════════════
#   ELO RATING SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class EloRatingSystem:
    """
    Standard Elo rating system adapted for MARL evaluation.

    Each agent (attacker or defender, identified by name string) has an Elo
    rating initialised at 1500.  After each head-to-head match the ratings
    are updated using the standard expected-score formula.

    K-factor schedule:
      K = 32  for the first 30 matches  (provisional period)
      K = 16  for the next 70 matches
      K = 10  after 100+ matches        (established rating)

    Usage:
        elo = EloRatingSystem()
        elo.update("attacker_iter_3", "scripted_defender", attacker_won=True)
        print(elo.rating("attacker_iter_3"))
    """

    BASE_ELO   = 1500.0
    K_SCHEDULE = [(30, 32.0), (100, 16.0), (float("inf"), 10.0)]

    def __init__(self):
        self._ratings:       Dict[str, float] = {}
        self._match_counts:  Dict[str, int]   = {}
        self._history:       List[Dict]       = []

    def _k_factor(self, agent: str) -> float:
        n = self._match_counts.get(agent, 0)
        for threshold, k in self.K_SCHEDULE:
            if n < threshold:
                return k
        return 10.0

    def rating(self, agent: str) -> float:
        return self._ratings.get(agent, self.BASE_ELO)

    def update(
        self,
        agent_a: str,
        agent_b: str,
        a_wins: int,
        b_wins: int,
        draws: int = 0,
    ) -> Tuple[float, float]:
        """
        Update ratings after a multi-game match.

        Parameters
        ----------
        agent_a, agent_b : str  agent identifiers
        a_wins, b_wins   : int  number of wins
        draws            : int  number of draws

        Returns
        -------
        (delta_a, delta_b) : float  rating change for each agent
        """
        ra = self.rating(agent_a)
        rb = self.rating(agent_b)

        total   = a_wins + b_wins + draws
        score_a = (a_wins + 0.5 * draws) / max(total, 1)
        score_b = 1.0 - score_a

        expected_a = 1.0 / (1.0 + 10 ** ((rb - ra) / 400.0))
        expected_b = 1.0 - expected_a

        ka = self._k_factor(agent_a) * total
        kb = self._k_factor(agent_b) * total

        delta_a = ka * (score_a - expected_a)
        delta_b = kb * (score_b - expected_b)

        self._ratings[agent_a] = ra + delta_a
        self._ratings[agent_b] = rb + delta_b

        for ag in (agent_a, agent_b):
            self._match_counts[ag] = self._match_counts.get(ag, 0) + total

        self._history.append({
            "agent_a": agent_a, "agent_b": agent_b,
            "a_wins": a_wins, "b_wins": b_wins, "draws": draws,
            "ra_before": ra, "rb_before": rb,
            "ra_after":  self._ratings[agent_a],
            "rb_after":  self._ratings[agent_b],
        })
        return delta_a, delta_b

    def leaderboard(self) -> List[Tuple[str, float]]:
        return sorted(self._ratings.items(), key=lambda x: -x[1])

    def to_dict(self) -> dict:
        return {
            "ratings":      self._ratings,
            "match_counts": self._match_counts,
            "history":      self._history[-200:],  # keep last 200 matches
        }

    def from_dict(self, data: dict) -> None:
        self._ratings      = data.get("ratings", {})
        self._match_counts = data.get("match_counts", {})
        self._history      = data.get("history", [])


# ══════════════════════════════════════════════════════════════════════════════
#   MARL EVALUATOR
# ══════════════════════════════════════════════════════════════════════════════

class MARLEvaluator:
    """
    Runs head-to-head evaluation matches and records all statistics
    required for the research paper.

    Usage (called from Trainer after each iteration):
        evaluator = MARLEvaluator(save_dir="./results")
        metrics = evaluator.evaluate_iteration(
            iteration     = 5,
            attacker      = attacker_agent,
            defender      = defender_agent,
            baselines_att = {"random": RandomAttacker(), "scripted": ScriptedAttacker()},
            baselines_def = {"random": RandomDefender(), "scripted": ScriptedDefender()},
            n_episodes    = 50,
            curriculum_level = 2,
        )
    """

    def __init__(self, save_dir: str = "./results"):
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)
        self.elo = EloRatingSystem()
        self.all_metrics:   List[Dict] = []
        self._elo_path      = os.path.join(save_dir, "elo_ratings.json")
        self._metrics_path  = os.path.join(save_dir, "training_metrics.json")

        # Try to load existing Elo state
        if os.path.exists(self._elo_path):
            with open(self._elo_path) as f:
                self.elo.from_dict(json.load(f))

    # ── Core evaluation routine ────────────────────────────────────────────────

    def evaluate_iteration(
        self,
        iteration: int,
        attacker,
        defender,
        baselines_att: Dict[str, Any],
        baselines_def: Dict[str, Any],
        n_episodes: int = 50,
        curriculum_level: int = 2,
        silent: bool = False,
    ) -> Dict[str, Any]:
        """
        Run a full evaluation suite, running all matches in parallel
        using a thread pool with CPU inference.

        Eval runs on predict-only CPU CLONES of the policies. The live
        training models are never migrated or shared with eval threads:
        repeatedly moving cuDNN LSTM modules CUDA→CPU→CUDA (the old
        approach) forces their flattened weight buffers to be re-laid-out
        every iteration and has been observed to destabilize the cuDNN
        backward pass (CUDNN_STATUS_INTERNAL_ERROR mid-training).
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        att_name = f"attacker_iter_{iteration}"
        def_name = f"defender_iter_{iteration}"

        metrics: Dict[str, Any] = {
            "iteration":       iteration,
            "timestamp":       datetime.utcnow().isoformat(),
            "curriculum_level": curriculum_level,
            "n_episodes":      n_episodes,
        }

        eval_attacker = _cpu_eval_clone(attacker)
        eval_defender = _cpu_eval_clone(defender)

        # ── Build the full match list ──────────────────────────────────────
        match_list = [("main", eval_attacker, eval_defender)]
        for bname, bdef in baselines_def.items():
            match_list.append((f"att_{bname}", eval_attacker, bdef))
        for bname, batt in baselines_att.items():
            match_list.append((f"def_{bname}", batt, eval_defender))

        results: Dict[str, Any] = {}

        # ── Run all matches in parallel (max 4 threads) ───────────────────
        n_workers = min(4, len(match_list))
        with ThreadPoolExecutor(max_workers=n_workers) as pool:
            futures = {
                pool.submit(
                    self._run_match, att, dfn, n_episodes,
                    curriculum_level, label,
                    # Deterministic per-match seed → reproducible eval
                    iteration * 9973 + idx,
                ): label
                for idx, (label, att, dfn) in enumerate(match_list)
            }
            for future in as_completed(futures):
                label = futures[future]
                try:
                    results[label] = future.result()
                except Exception as e:
                    logger.warning("Match %s failed: %s", label, e)
                    results[label] = {"att_wins": 0, "def_wins": 0, "draws": n_episodes,
                                      "att_win_rate": 0, "def_win_rate": 0,
                                      "mean_ep_length": 0, "std_ep_length": 0,
                                      "mean_ttd": None, "std_ttd": None,
                                      "ttd_rate": 0, "mean_false_positives": 0,
                                      "kc_depth_dist": {"external":0,"user_access":0,"root_access":0},
                                      "att_action_counts": {}, "def_action_counts": {}}

        # ── Assemble metrics ───────────────────────────────────────────────
        main = results["main"]
        metrics["main_match"] = main
        self.elo.update(att_name, def_name, main["att_wins"], main["def_wins"], main["draws"])

        metrics["att_vs_baselines"] = {}
        for bname in baselines_def:
            m = results.get(f"att_{bname}", {})
            metrics["att_vs_baselines"][bname] = m
            self.elo.update(att_name, f"def_{bname}",
                            m.get("att_wins", 0), m.get("def_wins", 0))

        metrics["def_vs_baselines"] = {}
        for bname in baselines_att:
            m = results.get(f"def_{bname}", {})
            metrics["def_vs_baselines"][bname] = m
            self.elo.update(f"att_{bname}", def_name,
                            m.get("att_wins", 0), m.get("def_wins", 0))

        metrics["elo"] = {
            att_name: self.elo.rating(att_name),
            def_name: self.elo.rating(def_name),
        }
        metrics["strategy_entropy"] = {
            "attacker": self._compute_entropy(main.get("att_action_counts", {})),
            "defender": self._compute_entropy(main.get("def_action_counts", {})),
        }

        self.all_metrics.append(metrics)
        self._save_json(self._metrics_path, self.all_metrics)
        self._save_json(self._elo_path, self.elo.to_dict())

        if not silent:
            self._print_summary(iteration, metrics)
        return metrics

    # ── Match runner ───────────────────────────────────────────────────────────

    def _run_match(
        self,
        attacker_agent,
        defender_agent,
        n_episodes: int,
        curriculum_level: int,
        label: str = "",
        seed: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Run n_episodes between attacker and defender.

        Handles BOTH:
          • RL agents  (RLAgent with .model attribute)
          • Scripted agents (RandomAttacker / ScriptedDefender etc. with .predict())

        The RL defender is wrapped in the shared StatefulOpponent so its LSTM
        hidden state persists across steps within each episode (the env calls
        opponent_model.predict() with no state argument). The env itself
        resets/seeds the wrapper at episode boundaries.
        """
        from shared_honeypot_env import SharedHoneypotEnv, StatefulOpponent

        att_wins   = 0
        def_wins   = 0
        draws      = 0
        ep_lengths = []
        ttd_list   = []
        fp_list    = []
        kc_depths  = []
        att_actions: Dict[int, int] = {i: 0 for i in range(10)}
        def_actions: Dict[int, int] = {i: 0 for i in range(10)}

        # Determine if agents are RL (have .model) or scripted (just .predict)
        att_is_rl = hasattr(attacker_agent, "model")
        def_is_rl = hasattr(defender_agent, "model")

        # The env drives the defender as its internal opponent; RL defenders
        # need LSTM state threading, scripted ones pass through unchanged.
        eval_defender = (StatefulOpponent(defender_agent.model)
                         if def_is_rl else defender_agent)

        # One env per match — reused across episodes. The seeded reset makes
        # the whole match reproducible (env noise, scripted opponents, and
        # success-probability draws all flow from this np_random stream).
        env = SharedHoneypotEnv(
            mode="attacker",
            opponent_model=eval_defender,
            curriculum_level=curriculum_level,
        )
        env.reset(seed=seed)

        # Scripted *main-side* attackers have their own RNG: seed it for
        # reproducibility (env only seeds its internal opponent).
        if not att_is_rl and hasattr(attacker_agent, "seed") and seed is not None:
            attacker_agent.seed(seed + 1)

        for ep in range(n_episodes):
            obs, _ = env.reset()

            # Reset per-episode state on the attacker side (the env handles
            # its internal defender opponent automatically).
            att_lstm_state = None
            if not att_is_rl and hasattr(attacker_agent, "reset"):
                attacker_agent.reset()

            done = False
            ep_att_acts = []
            ep_def_acts = []

            while not done:
                # ── Get attacker action ───────────────────────────────────
                if att_is_rl:
                    try:
                        act_a, att_lstm_state = attacker_agent.model.predict(
                            obs, state=att_lstm_state, deterministic=True
                        )
                        act_a = int(np.asarray(act_a).flat[0])
                    except Exception:
                        act_a = int(np.random.randint(0, 10))
                else:
                    act_a, _ = attacker_agent.predict(obs, deterministic=True)
                    act_a = int(np.asarray(act_a).flat[0])

                obs, _, terminated, truncated, info = env.step(act_a)
                ep_att_acts.append(info.get("att_action", act_a))
                ep_def_acts.append(info.get("def_action", 0))
                done = terminated or truncated

            ep_lengths.append(info.get("step", env.current_step))
            kc_depths.append(info.get("kill_chain", 0))
            fp_list.append(info.get("false_positives", 0))

            ttd = info.get("first_detection_step")
            if ttd is not None:
                ttd_list.append(ttd)

            if info.get("attacker_win", False):
                att_wins += 1
            elif info.get("defender_win", False):
                def_wins += 1
            else:
                draws += 1

            for a in ep_att_acts:
                att_actions[int(a)] = att_actions.get(int(a), 0) + 1
            for a in ep_def_acts:
                def_actions[int(a)] = def_actions.get(int(a), 0) + 1

        total = max(n_episodes, 1)
        return {
            "label":             label,
            "n_episodes":        total,
            "att_wins":          att_wins,
            "def_wins":          def_wins,
            "draws":             draws,
            "att_win_rate":      att_wins / total,
            "def_win_rate":      def_wins / total,
            "mean_ep_length":    float(np.mean(ep_lengths)) if ep_lengths else 0.0,
            "std_ep_length":     float(np.std(ep_lengths))  if ep_lengths else 0.0,
            "mean_ttd":          float(np.mean(ttd_list))   if ttd_list   else None,
            "std_ttd":           float(np.std(ttd_list))    if ttd_list   else None,
            "ttd_rate":          len(ttd_list) / total,
            "mean_false_positives": float(np.mean(fp_list)),
            "kc_depth_dist":     {
                "external":    sum(1 for d in kc_depths if d == 0) / total,
                "user_access": sum(1 for d in kc_depths if d == 1) / total,
                "root_access": sum(1 for d in kc_depths if d == 2) / total,
            },
            "att_action_counts": att_actions,
            "def_action_counts": def_actions,
        }

    # ── Plotting ───────────────────────────────────────────────────────────────

    def plot_training_curves(self, output_path: Optional[str] = None) -> None:
        if not HAS_MATPLOTLIB:
            logger.warning("matplotlib not available – cannot plot")
            return
        if not self.all_metrics:
            logger.warning("No metrics to plot yet")
            return

        iters     = [m["iteration"] for m in self.all_metrics]
        att_wr    = [m["main_match"]["att_win_rate"]  for m in self.all_metrics]
        def_wr    = [m["main_match"]["def_win_rate"]  for m in self.all_metrics]
        att_elo   = [m["elo"].get(f"attacker_iter_{m['iteration']}", 1500) for m in self.all_metrics]
        def_elo   = [m["elo"].get(f"defender_iter_{m['iteration']}", 1500) for m in self.all_metrics]
        att_entr  = [m["strategy_entropy"]["attacker"] for m in self.all_metrics]
        def_entr  = [m["strategy_entropy"]["defender"] for m in self.all_metrics]

        # Baseline comparisons (vs scripted)
        att_vs_scripted_def = [
            m["att_vs_baselines"].get("scripted", {}).get("att_win_rate", None)
            for m in self.all_metrics
        ]
        def_vs_scripted_att = [
            m["def_vs_baselines"].get("scripted", {}).get("def_win_rate", None)
            for m in self.all_metrics
        ]

        fig = plt.figure(figsize=(16, 10))
        gs  = gridspec.GridSpec(2, 3, figure=fig, hspace=0.4, wspace=0.35)

        # Panel 1: Win rates (main match)
        ax1 = fig.add_subplot(gs[0, 0])
        ax1.plot(iters, att_wr, "r-o", label="Attacker", linewidth=2)
        ax1.plot(iters, def_wr, "b-s", label="Defender", linewidth=2)
        ax1.axhline(0.5, color="gray", linestyle="--", alpha=0.5)
        ax1.set_title("Win Rate (self-play)")
        ax1.set_xlabel("Training Iteration")
        ax1.set_ylabel("Win Rate")
        ax1.legend()
        ax1.set_ylim(0, 1)
        ax1.grid(True, alpha=0.3)

        # Panel 2: Elo trajectories
        ax2 = fig.add_subplot(gs[0, 1])
        ax2.plot(iters, att_elo, "r-o", label="Attacker Elo", linewidth=2)
        ax2.plot(iters, def_elo, "b-s", label="Defender Elo", linewidth=2)
        ax2.axhline(1500, color="gray", linestyle="--", alpha=0.5, label="Baseline Elo")
        ax2.set_title("Elo Rating Trajectories")
        ax2.set_xlabel("Training Iteration")
        ax2.set_ylabel("Elo Rating")
        ax2.legend()
        ax2.grid(True, alpha=0.3)

        # Panel 3: vs Scripted baseline
        ax3 = fig.add_subplot(gs[0, 2])
        valid_att = [(i, v) for i, v in zip(iters, att_vs_scripted_def) if v is not None]
        valid_def = [(i, v) for i, v in zip(iters, def_vs_scripted_att) if v is not None]
        if valid_att:
            ax3.plot(*zip(*valid_att), "r--^", label="Att vs. ScriptedDef", linewidth=1.5)
        if valid_def:
            ax3.plot(*zip(*valid_def), "b--v", label="Def vs. ScriptedAtt", linewidth=1.5)
        ax3.axhline(0.5, color="gray", linestyle=":", alpha=0.5)
        ax3.set_title("Win Rate vs. Scripted Baseline")
        ax3.set_xlabel("Training Iteration")
        ax3.set_ylabel("Win Rate")
        ax3.legend()
        ax3.set_ylim(0, 1)
        ax3.grid(True, alpha=0.3)

        # Panel 4: Strategy entropy
        ax4 = fig.add_subplot(gs[1, 0])
        ax4.plot(iters, att_entr, "r-o", label="Attacker", linewidth=2)
        ax4.plot(iters, def_entr, "b-s", label="Defender", linewidth=2)
        ax4.axhline(np.log2(10), color="gray", linestyle="--", alpha=0.5, label="Max entropy")
        ax4.set_title("Strategy Entropy (action diversity)")
        ax4.set_xlabel("Training Iteration")
        ax4.set_ylabel("Shannon Entropy (bits)")
        ax4.legend()
        ax4.grid(True, alpha=0.3)

        # Panel 5: Time-to-detect
        ttd_means = [m["main_match"].get("mean_ttd") for m in self.all_metrics]
        ttd_stds  = [m["main_match"].get("std_ttd")  for m in self.all_metrics]
        valid_ttd = [(i, mn, sd) for i, mn, sd in zip(iters, ttd_means, ttd_stds)
                     if mn is not None]
        ax5 = fig.add_subplot(gs[1, 1])
        if valid_ttd:
            vi, vm, vs = zip(*valid_ttd)
            ax5.errorbar(vi, vm, yerr=vs, fmt="b-D", capsize=4, linewidth=2, label="Mean TTD")
        ax5.set_title("Time-to-Detection (steps)")
        ax5.set_xlabel("Training Iteration")
        ax5.set_ylabel("Steps until first detection")
        ax5.legend()
        ax5.grid(True, alpha=0.3)

        # Panel 6: Kill-chain depth distribution (last iteration)
        ax6 = fig.add_subplot(gs[1, 2])
        if self.all_metrics:
            last = self.all_metrics[-1]["main_match"]["kc_depth_dist"]
            labels = ["External", "User\nAccess", "Root\nAccess"]
            vals   = [last["external"], last["user_access"], last["root_access"]]
            colors = ["#4CAF50", "#FF9800", "#F44336"]
            bars   = ax6.bar(labels, vals, color=colors, edgecolor="white", linewidth=0.8)
            for bar, val in zip(bars, vals):
                ax6.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                         f"{val:.1%}", ha="center", va="bottom", fontsize=9)
        ax6.set_title(f"Kill-Chain Depth (iter {iters[-1]})")
        ax6.set_ylabel("Fraction of Episodes")
        ax6.set_ylim(0, 1)
        ax6.grid(True, alpha=0.3, axis="y")

        fig.suptitle("CyberX MARL Training Results", fontsize=14, fontweight="bold")

        path = output_path or os.path.join(self.save_dir, "training_curves.png")
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        logger.info("Training curves saved to %s", path)

    def plot_action_heatmap(self, iteration: int, output_path: Optional[str] = None) -> None:
        """Action frequency heatmap for a specific iteration (paper figure)."""
        if not HAS_MATPLOTLIB:
            return
        m = next((x for x in self.all_metrics if x["iteration"] == iteration), None)
        if m is None:
            logger.warning("No metrics for iteration %d", iteration)
            return

        att_counts = m["main_match"].get("att_action_counts", {})
        def_counts = m["main_match"].get("def_action_counts", {})

        att_labels = [
            "Brute force", "Enumerate", "Recon", "Exfiltrate",
            "Priv esc.", "Backdoor", "Modify files", "Full dump",
            "Lateral mvt", "Wait",
        ]
        def_labels = [
            "Monitor", "Rate limit", "Temp block", "Hard block",
            "Deploy decoy", "Rotate config", "Alert", "Isolate",
            "Full reset", "Active deception",
        ]

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        for ax, counts, labels, title, color in [
            (axes[0], att_counts, att_labels, "Attacker Action Frequency", "Reds"),
            (axes[1], def_counts, def_labels, "Defender Action Frequency", "Blues"),
        ]:
            total = max(sum(counts.values()), 1)
            vals  = [counts.get(i, 0) / total for i in range(10)]
            bars  = ax.barh(range(10), vals, color=plt.cm.get_cmap(color)(
                np.linspace(0.3, 0.9, 10)))
            ax.set_yticks(range(10))
            ax.set_yticklabels(labels, fontsize=9)
            ax.set_xlabel("Frequency (fraction)")
            ax.set_title(f"{title}\n(iteration {iteration})")
            ax.set_xlim(0, max(vals) * 1.2 if max(vals) > 0 else 1)
            ax.grid(True, axis="x", alpha=0.3)
            for bar, val in zip(bars, vals):
                ax.text(val + 0.002, bar.get_y() + bar.get_height() / 2,
                        f"{val:.1%}", va="center", fontsize=8)

        fig.tight_layout()
        path = output_path or os.path.join(self.save_dir, f"action_heatmap_iter{iteration}.png")
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        logger.info("Action heatmap saved to %s", path)

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _compute_entropy(action_counts: Dict) -> float:
        """Shannon entropy in bits.  Returns 0.0 for a collapsed (single-action) policy."""
        total = sum(action_counts.values())
        if total == 0:
            return 0.0
        probs = np.array([action_counts.get(i, 0) / total for i in range(10)])
        probs = probs[probs > 0]
        # Clamp: floating point can produce -0.0 for a pure deterministic policy
        return max(0.0, float(-np.sum(probs * np.log2(probs))))

    @staticmethod
    def _save_json(path: str, data: Any) -> None:
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def _print_summary(self, iteration: int, metrics: Dict) -> None:
        m = metrics["main_match"]
        att_elo = metrics["elo"].get(f"attacker_iter_{iteration}", 1500)
        def_elo = metrics["elo"].get(f"defender_iter_{iteration}", 1500)
        print(f"\n{'='*60}")
        print(f"  EVALUATION  –  Iteration {iteration}")
        print(f"{'='*60}")
        print(f"  Attacker win rate (vs defender): {m['att_win_rate']:.1%}   Elo: {att_elo:.0f}")
        print(f"  Defender win rate (vs attacker): {m['def_win_rate']:.1%}   Elo: {def_elo:.0f}")
        print(f"  Mean episode length:             {m['mean_ep_length']:.1f} steps")
        ttd = m.get("mean_ttd")
        print(f"  Mean time-to-detect:             {'N/A' if ttd is None else f'{ttd:.1f} steps'}")
        print(f"  Mean false positives/ep:         {m['mean_false_positives']:.2f}")
        kc = m["kc_depth_dist"]
        print(f"  Kill-chain depth:  "
              f"External={kc['external']:.0%}  "
              f"User={kc['user_access']:.0%}  "
              f"Root={kc['root_access']:.0%}")
        entr = metrics["strategy_entropy"]
        print(f"  Strategy entropy:  Att={entr['attacker']:.2f}  Def={entr['defender']:.2f}  "
              f"(max={np.log2(10):.2f} bits)")
        print(f"{'='*60}\n")

    def latest_summary_table(self) -> str:
        """Return a markdown table of the most recent evaluation – ready to paste into the paper."""
        if not self.all_metrics:
            return "No evaluations recorded yet."
        lines = []
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        m = self.all_metrics[-1]
        mm = m["main_match"]
        iter_ = m["iteration"]
        lines.append(f"| Iteration | {iter_} |")
        lines.append(f"| Attacker win rate (self-play) | {mm['att_win_rate']:.1%} |")
        lines.append(f"| Defender win rate (self-play) | {mm['def_win_rate']:.1%} |")
        lines.append(f"| Attacker Elo | {m['elo'].get(f'attacker_iter_{iter_}', 1500):.0f} |")
        lines.append(f"| Defender Elo | {m['elo'].get(f'defender_iter_{iter_}', 1500):.0f} |")
        ttd = mm.get("mean_ttd")
        lines.append(f"| Mean time-to-detect | {'N/A' if ttd is None else f'{ttd:.1f} steps'} |")
        lines.append(f"| Mean false positives / ep | {mm['mean_false_positives']:.2f} |")
        kc = mm["kc_depth_dist"]
        lines.append(f"| Episodes reaching root access | {kc['root_access']:.1%} |")
        lines.append(f"| Attacker strategy entropy | {m['strategy_entropy']['attacker']:.2f} bits |")
        lines.append(f"| Defender strategy entropy | {m['strategy_entropy']['defender']:.2f} bits |")
        for bname, bm in m.get("att_vs_baselines", {}).items():
            lines.append(f"| Att win rate vs {bname} defender | {bm['att_win_rate']:.1%} |")
        for bname, bm in m.get("def_vs_baselines", {}).items():
            lines.append(f"| Def win rate vs {bname} attacker | {bm['def_win_rate']:.1%} |")
        return "\n".join(lines)