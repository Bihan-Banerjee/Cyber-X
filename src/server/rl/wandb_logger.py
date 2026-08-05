"""
wandb_logger.py  –  Optional Weights & Biases run tracking
===========================================================
Comparing a multi-seed sweep by reading `training_history.json` files by hand
does not scale past a handful of runs, and the plan calls for arms
(PFSP vs uniform) × seeds × ablations. W&B is the cheapest way to make those
comparable.

Deliberately a no-op unless BOTH `logging.wandb.enabled` is true in config.json
AND the package imports. Training must never fail because an optional
experiment-tracking dependency is missing — `wandb` is commented out in
requirements.txt on purpose.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class WandbLogger:
    """Thin wrapper; every method is safe to call when tracking is disabled."""

    def __init__(self, cfg: Dict[str, Any], run_config: Dict[str, Any],
                 run_name: Optional[str] = None):
        self._run = None
        wb_cfg = (cfg or {}).get("wandb", {}) or {}
        if not wb_cfg.get("enabled", False):
            return
        try:
            import wandb  # noqa: PLC0415
        except ImportError:
            logger.warning(
                "logging.wandb.enabled is true but wandb is not installed — "
                "continuing without tracking (pip install wandb)")
            return
        try:
            self._wandb = wandb
            self._run = wandb.init(
                project = wb_cfg.get("project", "cyberx-marl"),
                entity  = wb_cfg.get("entity") or None,
                name    = run_name,
                config  = run_config,
                reinit  = True,
            )
            logger.info("W&B tracking enabled: %s", self._run.name)
        except Exception as e:  # noqa: BLE001
            logger.warning("W&B init failed (%s) — continuing without tracking", e)
            self._run = None

    @property
    def enabled(self) -> bool:
        return self._run is not None

    def log_iteration(self, iteration: int, metrics: Dict[str, Any],
                      curriculum_level: int,
                      opponent_record: Optional[Dict[str, Any]] = None) -> None:
        """Log one training iteration. Flattens the nested metrics dict into the
        scalars worth comparing across arms."""
        if not self.enabled:
            return
        mm = metrics.get("main_match", {}) or {}
        entropy = metrics.get("strategy_entropy", {}) or {}
        payload: Dict[str, Any] = {
            "iteration":        iteration,
            "curriculum_level": curriculum_level,
            "att_win_rate":     mm.get("att_win_rate"),
            "def_win_rate":     mm.get("def_win_rate"),
            "draws":            mm.get("draws"),
            "mean_ep_length":   mm.get("mean_ep_length"),
            "mean_ttd":         mm.get("mean_ttd"),
            "false_positives":  mm.get("mean_false_positives"),
            "att_entropy":      entropy.get("attacker"),
            "def_entropy":      entropy.get("defender"),
        }
        for side in ("att", "def"):
            for baseline, res in (metrics.get(f"{side}_vs_baselines", {}) or {}).items():
                key = f"{side}_win_rate" if side == "att" else "def_win_rate"
                payload[f"{side}_vs_{baseline}"] = (res or {}).get(key)
        for name, elo in (metrics.get("elo", {}) or {}).items():
            payload[f"elo/{name.rsplit('_', 1)[0]}"] = elo

        # The PFSP sampling distribution is the thing an ablation reader wants
        # to see: which opponents the league actually concentrated on.
        for role, record in (opponent_record or {}).items():
            for opp_id, tally in record.items():
                games = sum(tally.values())
                if games:
                    label = opp_id.replace("rl:", "").replace("\\", "/").split("/")[-1]
                    payload[f"opponent/{role}/{label}/win_rate"] = tally["wins"] / games
                    payload[f"opponent/{role}/{label}/games"] = games

        self._run.log({k: v for k, v in payload.items() if v is not None},
                      step=iteration)

    def finish(self) -> None:
        if self.enabled:
            try:
                self._run.finish()
            except Exception:  # noqa: BLE001
                pass
            self._run = None
