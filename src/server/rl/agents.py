"""
agents.py  –  CyberX Unified RL Agent  (v3.0)
==============================================
Replaces attacker_agent.py + defender_agent.py (~95% duplicated code) with
one parameterized RLAgent. Role differences live in ROLE_DEFAULTS / config:

  • ent_coef: attacker 0.10 (0.05 proved insufficient — the LSTM collapses
    after warmup), defender 0.05 (its denser observation needs less forced
    exploration)
  • extractor hidden width: attacker 256, defender 512 (the defender's
    8 observation dims are all simultaneously informative)

All PPO hyperparameters are explicit and config-driven (config.json [ppo]),
including gamma/gae_lambda which previously rode on silent SB3 defaults.

Behavioral cloning is sequence-aware: episodes are batched whole and the
LSTM is unrolled step-by-step with hidden state carried across time, so BC
actually trains the recurrent dynamics instead of treating the policy as an
MLP over shuffled transitions.
"""

import os
from typing import List, Optional, Tuple

import gymnasium as gym
import numpy as np
import torch
import torch.nn as nn
from sb3_contrib import RecurrentPPO
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
from tqdm import tqdm

from config_loader import PPOConfig

ROLES = ("attacker", "defender")

# Policy/value head sizes (identical across roles; the role-specific part is
# the feature extractor width)
NET_ARCH = dict(pi=[256, 128], vf=[256, 128])


# ── Feature extractor ──────────────────────────────────────────────────────────

class ResidualFeatureExtractor(BaseFeaturesExtractor):
    """
    Three-layer MLP with two residual paths: an input projection shortcut
    into the middle layer and a bottleneck skip into the output. More stable
    than a plain deep MLP for very small observation spaces.

    `hidden` is role-dependent (attacker 256, defender 512).
    """

    def __init__(self, observation_space: gym.spaces.Box,
                 features_dim: int = 256, hidden: int = 256):
        super().__init__(observation_space, features_dim)
        n_input = observation_space.shape[0]

        self.input_proj = nn.Linear(n_input, hidden)
        self.layer1 = nn.Sequential(
            nn.Linear(n_input, hidden), nn.LayerNorm(hidden), nn.ReLU()
        )
        self.layer2 = nn.Sequential(
            nn.Linear(hidden, hidden), nn.LayerNorm(hidden), nn.ReLU()
        )
        self.layer3 = nn.Sequential(
            nn.Linear(hidden, features_dim), nn.LayerNorm(features_dim), nn.ReLU()
        )
        self.res_proj = nn.Linear(hidden, features_dim)

    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        residual = self.input_proj(observations)
        x = self.layer1(observations)
        x = self.layer2(x + residual)
        return self.layer3(x) + self.res_proj(x)


# ── Agent wrapper ──────────────────────────────────────────────────────────────

class RLAgent:
    """
    Wraps a RecurrentPPO (LSTM) model for either role with helpers for:
      • Sequence-aware behavioral cloning from scripted experts
      • Flat BC from oracle datasets (no episode boundaries in the npz)
      • Clean save / load with automatic directory creation
      • A .predict() shim so the agent can act as a curriculum opponent
    """

    def __init__(
        self,
        env,
        role: str,
        ppo: PPOConfig,
        device: str = "auto",
        seed: Optional[int] = None,
        tensorboard_dir: str = "./logs",
    ):
        assert role in ROLES, f"Invalid role: {role}"
        self.role = role
        self.env = env
        self.ppo_cfg = ppo

        policy_kwargs = dict(
            features_extractor_class  = ResidualFeatureExtractor,
            features_extractor_kwargs = dict(
                features_dim = ppo.features_dim,
                hidden       = ppo.extractor_hidden[role],
            ),
            net_arch           = NET_ARCH,
            enable_critic_lstm = True,
            lstm_hidden_size   = ppo.lstm_hidden_size,
        )

        self.model = RecurrentPPO(
            "MlpLstmPolicy",
            env,
            learning_rate   = ppo.learning_rate,
            gamma           = ppo.gamma,
            gae_lambda      = ppo.gae_lambda,
            # n_steps × n_envs samples per rollout (256 × 8 = 2048)
            n_steps         = ppo.n_steps,
            batch_size      = ppo.batch_size,
            n_epochs        = ppo.n_epochs,
            ent_coef        = ppo.ent_coef[role],
            clip_range      = ppo.clip_range,
            max_grad_norm   = ppo.max_grad_norm,
            policy_kwargs   = policy_kwargs,
            verbose         = 0,
            device          = device,
            seed            = seed,
            tensorboard_log = f"{tensorboard_dir}/{role}",
        )

    # ── Predict shim (curriculum opponent interface) ───────────────────────────

    def predict(self, observation: np.ndarray, deterministic: bool = True):
        """Thin wrapper so RLAgent can be used as an opponent_model.
        Note: memoryless — for stateful eval/opponent use, wrap the
        underlying model in shared_honeypot_env.StatefulOpponent."""
        obs = np.array(observation, dtype=np.float32).reshape(1, -1)
        action, _ = self.model.predict(obs, deterministic=deterministic)
        return int(np.asarray(action).flat[0]), None

    # ── Save / load ────────────────────────────────────────────────────────────

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.model.save(path)

    def load(self, path: str) -> None:
        self.model = RecurrentPPO.load(path, env=self.env, device=self.model.device)

    # ── Behavioral cloning ─────────────────────────────────────────────────────

    def pretrain_on_expert(
        self,
        expert,
        env,
        num_episodes:   int   = 500,
        epochs:         int   = 20,
        batch_episodes: int   = 32,
        lr:             float = 1e-3,
    ) -> None:
        """Sequence-aware BC from a scripted expert: the expert plays
        num_episodes, then whole episodes are cloned with the LSTM unrolled
        through time."""
        label = "RED TEAM" if self.role == "attacker" else "BLUE TEAM"
        print(f"\n[{label}] Generating expert dataset ({num_episodes} episodes)...")
        episodes = self._collect_expert_episodes(expert, env, num_episodes)
        self._train_bc_sequences(episodes, epochs, batch_episodes, lr, label)

    def pretrain_on_dataset(
        self,
        dataset_path:  str,
        epochs:        int   = 20,
        batch_size:    int   = 512,
        lr:            float = 1e-3,
    ) -> None:
        """Flat BC from a saved numpy dataset (LLMOracle.save_dataset).
        The npz stores no episode boundaries, so each transition is treated
        as a length-1 sequence (zero LSTM state) — weaker than sequence BC
        but sufficient for an action-prior warm start."""
        label = ("RED TEAM" if self.role == "attacker" else "BLUE TEAM") + " (Oracle)"
        print(f"\n[{label}] Loading oracle dataset from {dataset_path}...")
        data = np.load(dataset_path)
        obs_arr = np.asarray(data["observations"], dtype=np.float32)
        act_arr = np.asarray(data["actions"], dtype=np.int64)
        print(f"   Loaded {len(obs_arr)} transitions.")
        self._train_bc_flat(obs_arr, act_arr, epochs, batch_size, lr, label)

    # ── Internal helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _collect_expert_episodes(
        expert, env, num_episodes: int
    ) -> List[Tuple[np.ndarray, np.ndarray]]:
        """Roll the expert in env, returning per-episode (obs[T,D], act[T])."""
        episodes = []
        for _ in tqdm(range(num_episodes), desc="Expert Rollouts", leave=False):
            obs, _ = env.reset()
            if hasattr(expert, "reset"):
                expert.reset()
            obs_list, act_list = [], []
            done, steps = False, 0
            while not done:
                action, _ = expert.predict(obs)
                obs_list.append(np.asarray(obs, dtype=np.float32))
                act_list.append(int(action))
                obs, _, term, trunc, _ = env.step(int(action))
                done = term or trunc
                steps += 1
                if steps > env.max_steps + 5:
                    break
            episodes.append((np.stack(obs_list), np.asarray(act_list, dtype=np.int64)))
        return episodes

    def _lstm_shape(self) -> Tuple[int, int]:
        """(num_layers, hidden_size) of the actor LSTM."""
        lstm = getattr(self.model.policy, "lstm_actor", None)
        if lstm is not None:
            return lstm.num_layers, lstm.hidden_size
        return 1, self.ppo_cfg.lstm_hidden_size

    def _train_bc_sequences(
        self,
        episodes:       List[Tuple[np.ndarray, np.ndarray]],
        epochs:         int,
        batch_episodes: int,
        lr:             float,
        label:          str,
    ) -> None:
        """BC with proper BPTT: batches of whole episodes, padded to the
        batch max length, LSTM state carried across timesteps, padded steps
        masked out of the loss."""
        n_transitions = sum(len(a) for _, a in episodes)
        print(f"   Dataset: {len(episodes)} episodes, {n_transitions} transitions")

        policy    = self.model.policy
        optimizer = torch.optim.Adam(policy.parameters(), lr=lr)
        device    = next(policy.parameters()).device
        n_layers, lstm_h = self._lstm_shape()

        policy.set_training_mode(True)
        best_loss = float("inf")
        order = np.arange(len(episodes))
        rng = np.random.default_rng(0)

        for _ in tqdm(range(epochs), desc="BC (sequence)", leave=False):
            rng.shuffle(order)
            epoch_loss, n_batches = 0.0, 0

            for start in range(0, len(order), batch_episodes):
                batch = [episodes[i] for i in order[start:start + batch_episodes]]
                B     = len(batch)
                T     = max(len(a) for _, a in batch)
                D     = batch[0][0].shape[1]

                obs_pad  = np.zeros((T, B, D), dtype=np.float32)
                act_pad  = np.zeros((T, B), dtype=np.int64)
                mask_pad = np.zeros((T, B), dtype=np.float32)
                for b, (o, a) in enumerate(batch):
                    obs_pad[:len(a), b]  = o
                    act_pad[:len(a), b]  = a
                    mask_pad[:len(a), b] = 1.0

                obs_t  = torch.from_numpy(obs_pad).to(device)
                act_t  = torch.from_numpy(act_pad).to(device)
                mask_t = torch.from_numpy(mask_pad).to(device)

                lstm_states = (
                    torch.zeros(n_layers, B, lstm_h, device=device),
                    torch.zeros(n_layers, B, lstm_h, device=device),
                )
                loss_sum = obs_t.new_zeros(())
                for t in range(T):
                    ep_starts = torch.full(
                        (B,), 1.0 if t == 0 else 0.0,
                        dtype=torch.float32, device=device,
                    )
                    dist, lstm_states = policy.get_distribution(
                        obs_t[t], lstm_states, ep_starts
                    )
                    loss_sum = loss_sum - (dist.log_prob(act_t[t]) * mask_t[t]).sum()

                loss = loss_sum / mask_t.sum().clamp(min=1.0)
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), max_norm=1.0)
                optimizer.step()
                epoch_loss += loss.item()
                n_batches  += 1

            best_loss = min(best_loss, epoch_loss / max(n_batches, 1))

        policy.set_training_mode(False)
        print(f"   BC complete – best epoch loss: {best_loss:.4f}")

    def _train_bc_flat(
        self,
        obs_arr:    np.ndarray,
        act_arr:    np.ndarray,
        epochs:     int,
        batch_size: int,
        lr:         float,
        label:      str,
    ) -> None:
        """Length-1-sequence BC for datasets without episode boundaries."""
        from torch.utils.data import DataLoader, TensorDataset

        policy    = self.model.policy
        optimizer = torch.optim.Adam(policy.parameters(), lr=lr)
        device    = next(policy.parameters()).device
        n_layers, lstm_h = self._lstm_shape()

        loader = DataLoader(
            TensorDataset(torch.from_numpy(obs_arr), torch.from_numpy(act_arr)),
            batch_size=batch_size, shuffle=True,
            pin_memory=(device.type == "cuda"),
        )

        print(f"[{label}] Behavioral Cloning ({epochs} epochs)...")
        policy.set_training_mode(True)
        best_loss = float("inf")

        for _ in tqdm(range(epochs), desc="BC (flat)", leave=False):
            epoch_loss = 0.0
            for batch_obs, batch_acts in loader:
                batch_obs  = batch_obs.to(device)
                batch_acts = batch_acts.to(device)
                bs = len(batch_obs)

                lstm_states = (
                    torch.zeros(n_layers, bs, lstm_h, device=device),
                    torch.zeros(n_layers, bs, lstm_h, device=device),
                )
                ep_starts = torch.ones(bs, dtype=torch.float32, device=device)

                dist, _ = policy.get_distribution(batch_obs, lstm_states, ep_starts)
                loss = -dist.log_prob(batch_acts).mean()

                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), max_norm=1.0)
                optimizer.step()
                epoch_loss += loss.item()

            best_loss = min(best_loss, epoch_loss / max(len(loader), 1))

        policy.set_training_mode(False)
        print(f"   BC complete – best epoch loss: {best_loss:.4f}")
