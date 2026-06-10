"""
config_loader.py  –  Typed configuration for the CyberX RL stack
=================================================================
Single source of truth: config.json next to this file. All training
hyperparameters, curriculum thresholds, and league settings live there —
nothing is hardcoded in trainer.py anymore.

Validation fails loudly: a missing or mistyped key raises ConfigError at
load time rather than silently falling back to a default. Keys starting
with "_" are documentation comments and are ignored.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

_CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG_PATH = os.path.join(_CONFIG_DIR, "config.json")

ROLES = ("attacker", "defender")


class ConfigError(ValueError):
    pass


def _strip_comments(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in d.items() if not k.startswith("_")}


def _section(raw: Dict[str, Any], key: str) -> Dict[str, Any]:
    if key not in raw or not isinstance(raw[key], dict):
        raise ConfigError(f"config.json: missing required section '{key}'")
    return _strip_comments(raw[key])


def _require(d: Dict[str, Any], key: str, section: str) -> Any:
    if key not in d:
        raise ConfigError(f"config.json [{section}]: missing key '{key}'")
    return d[key]


def _role_map(d: Dict[str, Any], key: str, section: str, cast) -> Dict[str, Any]:
    m = _require(d, key, section)
    if not isinstance(m, dict) or set(m) != set(ROLES):
        raise ConfigError(
            f"config.json [{section}].{key}: must be a dict with exactly "
            f"the keys {ROLES}"
        )
    return {role: cast(m[role]) for role in ROLES}


# ── Typed sections ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PPOConfig:
    learning_rate:    float
    gamma:            float
    gae_lambda:       float
    n_steps:          int
    batch_size:       int
    n_epochs:         int
    clip_range:       float
    max_grad_norm:    float
    lstm_hidden_size: int
    features_dim:     int
    ent_coef:         Dict[str, float]   # per role
    extractor_hidden: Dict[str, int]     # per role
    warmup_ent_coef:  float
    warmup_iters:     int

    @classmethod
    def parse(cls, d: Dict[str, Any]) -> "PPOConfig":
        s = "ppo"
        return cls(
            learning_rate    = float(_require(d, "learning_rate", s)),
            gamma            = float(_require(d, "gamma", s)),
            gae_lambda       = float(_require(d, "gae_lambda", s)),
            n_steps          = int(_require(d, "n_steps", s)),
            batch_size       = int(_require(d, "batch_size", s)),
            n_epochs         = int(_require(d, "n_epochs", s)),
            clip_range       = float(_require(d, "clip_range", s)),
            max_grad_norm    = float(_require(d, "max_grad_norm", s)),
            lstm_hidden_size = int(_require(d, "lstm_hidden_size", s)),
            features_dim     = int(_require(d, "features_dim", s)),
            ent_coef         = _role_map(d, "ent_coef", s, float),
            extractor_hidden = _role_map(d, "extractor_hidden", s, int),
            warmup_ent_coef  = float(_require(d, "warmup_ent_coef", s)),
            warmup_iters     = int(_require(d, "warmup_iters", s)),
        )


@dataclass(frozen=True)
class LevelConfig:
    timestep_fraction: float
    min_timesteps:     int
    eval_episodes:     int   # 0 → use training.eval_episodes


@dataclass(frozen=True)
class CurriculumConfig:
    promo_threshold:      float
    promo_streak:         int
    max_stage_iterations: int
    levels:               Dict[int, LevelConfig]

    @classmethod
    def parse(cls, d: Dict[str, Any]) -> "CurriculumConfig":
        s = "curriculum"
        raw_levels = _strip_comments(_require(d, "levels", s))
        levels: Dict[int, LevelConfig] = {}
        for k, v in raw_levels.items():
            v = _strip_comments(v)
            levels[int(k)] = LevelConfig(
                timestep_fraction = float(_require(v, "timestep_fraction", f"{s}.levels.{k}")),
                min_timesteps     = int(_require(v, "min_timesteps", f"{s}.levels.{k}")),
                eval_episodes     = int(_require(v, "eval_episodes", f"{s}.levels.{k}")),
            )
        if set(levels) != {0, 1, 2}:
            raise ConfigError(f"config.json [{s}].levels: must define levels 0, 1, 2")
        return cls(
            promo_threshold      = float(_require(d, "promo_threshold", s)),
            promo_streak         = int(_require(d, "promo_streak", s)),
            max_stage_iterations = int(_require(d, "max_stage_iterations", s)),
            levels               = levels,
        )

    def timesteps_for(self, level: int, base_timesteps: int) -> int:
        # The min_timesteps floor must never EXCEED the requested base —
        # otherwise smoke/dev presets (5k-20k steps) silently train 30k+.
        lvl = self.levels[min(max(level, 0), 2)]
        scaled = max(lvl.min_timesteps, int(base_timesteps * lvl.timestep_fraction))
        return min(base_timesteps, scaled)

    def eval_episodes_for(self, level: int, base_episodes: int) -> int:
        lvl = self.levels[min(max(level, 0), 2)]
        return lvl.eval_episodes if lvl.eval_episodes > 0 else base_episodes


@dataclass(frozen=True)
class TrainingConfig:
    n_iterations:         int
    timesteps_per_iter:   int
    eval_episodes:        int
    n_envs:               int
    device:               str
    run_bc_phase:         bool
    run_llm_oracle_phase: bool

    @classmethod
    def parse(cls, d: Dict[str, Any]) -> "TrainingConfig":
        s = "training"
        return cls(
            n_iterations         = int(_require(d, "n_iterations", s)),
            timesteps_per_iter   = int(_require(d, "timesteps_per_iter", s)),
            eval_episodes        = int(_require(d, "eval_episodes", s)),
            n_envs               = int(_require(d, "n_envs", s)),
            device               = str(_require(d, "device", s)),
            run_bc_phase         = bool(_require(d, "run_bc_phase", s)),
            run_llm_oracle_phase = bool(_require(d, "run_llm_oracle_phase", s)),
        )


@dataclass(frozen=True)
class LeagueConfig:
    ghost_pool_max: int
    scripted_slots: int
    latest_slots:   int

    @classmethod
    def parse(cls, d: Dict[str, Any]) -> "LeagueConfig":
        s = "league"
        return cls(
            ghost_pool_max = int(_require(d, "ghost_pool_max", s)),
            scripted_slots = int(_require(d, "scripted_slots", s)),
            latest_slots   = int(_require(d, "latest_slots", s)),
        )


# ── Top-level config ───────────────────────────────────────────────────────────

class RLConfig:
    """Loads and validates config.json. Mutable only for model_paths updates
    (set_best_model.py); everything else is frozen dataclasses."""

    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        if not os.path.exists(config_path):
            raise ConfigError(f"Config file not found: {config_path}")
        with open(config_path, "r") as f:
            raw = json.load(f)

        if "seed" not in raw:
            raise ConfigError("config.json: missing top-level key 'seed'")
        self.seed: int = int(raw["seed"])

        self.ppo        = PPOConfig.parse(_section(raw, "ppo"))
        self.training   = TrainingConfig.parse(_section(raw, "training"))
        self.curriculum = CurriculumConfig.parse(_section(raw, "curriculum"))
        self.league     = LeagueConfig.parse(_section(raw, "league"))

        self.model_paths: Dict[str, str] = _section(raw, "model_paths")
        self.llm:         Dict[str, Any] = _section(raw, "llm")
        self.logging:     Dict[str, Any] = _section(raw, "logging")

        self._raw = raw

    # ── Legacy helpers (api.py / set_best_model.py) ────────────────────────────

    def get_best_attacker_path(self) -> str:
        return self.model_paths["attacker_best"]

    def get_best_defender_path(self) -> str:
        return self.model_paths["defender_best"]

    def get_llm_config(self) -> Dict[str, Any]:
        return dict(self.llm)

    def update_best_models(self, iteration: int) -> None:
        ckpt_dir = self.model_paths["checkpoints_dir"]
        self.model_paths["attacker_best"] = f"{ckpt_dir}/attacker_iter_{iteration}.zip"
        self.model_paths["defender_best"] = f"{ckpt_dir}/defender_iter_{iteration}.zip"
        self.save_config()
        print(f"Best models updated to iteration {iteration}")

    def save_config(self) -> None:
        self._raw["model_paths"] = {
            **{k: v for k, v in self._raw["model_paths"].items() if k.startswith("_")},
            **self.model_paths,
        }
        with open(self.config_path, "w") as f:
            json.dump(self._raw, f, indent=2)


_config_singleton: Optional[RLConfig] = None


def get_config(config_path: str = DEFAULT_CONFIG_PATH) -> RLConfig:
    """Lazy singleton — parses config.json once per process."""
    global _config_singleton
    if _config_singleton is None or _config_singleton.config_path != config_path:
        _config_singleton = RLConfig(config_path)
    return _config_singleton
