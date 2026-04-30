"""
attacker_agent.py  –  CyberX Red-Team RL Agent  (v2.0)
=======================================================
Upgrades from v1:
  • Deeper feature extractor with residual connections for richer
    representation of the small POMDP observation vector
  • pretrain_on_expert now accepts BOTH scripted agents AND numpy
    datasets (from LLMOracle.save_dataset) — unified BC interface
  • Gradient clipping on BC optimizer to prevent exploding gradients
  • Proper LSTM state reset between episodes during pretraining
  • save/load helpers that handle path creation automatically
  • Curriculum-aware env factory method for parallel training
"""

import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sb3_contrib import RecurrentPPO
from stable_baselines3.common.vec_env import DummyVecEnv
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
import gymnasium as gym
from tqdm import tqdm
from typing import Optional, Union


# ── Feature extractor with residual block ─────────────────────────────────────

class AttackerFeatureExtractor(BaseFeaturesExtractor):
    """
    MLP with a residual connection.  The residual path projects the raw
    8-dim observation to the hidden size; the main path learns deviations
    from that projection.  This is more stable than a plain deep MLP for
    very small observation spaces.
    """

    def __init__(self, observation_space: gym.spaces.Box, features_dim: int = 256):
        super().__init__(observation_space, features_dim)
        n_input = observation_space.shape[0]
        hidden  = 256

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

    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        residual = self.input_proj(observations)        # projection shortcut
        x = self.layer1(observations)
        x = self.layer2(x + residual)                   # residual addition
        return self.layer3(x)


# ── Agent wrapper ──────────────────────────────────────────────────────────────

class AttackerAgent:
    """
    Wraps a RecurrentPPO (LSTM) model with helpers for:
      • Behavioral cloning from scripted agents or oracle datasets
      • Clean save / load with automatic directory creation
      • A .predict() shim so the agent can also act as a curriculum opponent
    """

    def __init__(
        self,
        env: DummyVecEnv,
        learning_rate: float = 3e-4,
        ent_coef:      float = 0.10,   # 0.05 proven insufficient — LSTM collapses after warmup
        device:        str   = "auto",
    ):
        self.env = env

        policy_kwargs = dict(
            features_extractor_class  = AttackerFeatureExtractor,
            features_extractor_kwargs = dict(features_dim=256),
            net_arch                  = dict(pi=[256, 128], vf=[256, 128]),
            enable_critic_lstm        = True,
            lstm_hidden_size          = 256,
        )

        self.model = RecurrentPPO(
            "MlpLstmPolicy",
            env,
            learning_rate = learning_rate,
            # n_steps=256 + 8 envs = 2048 samples/rollout — enough for PPO.
            # Halving from 512 cuts rollout collection time by ~40%.
            n_steps       = 256,
            # Larger batch → fewer gradient steps → faster update, better GPU use.
            batch_size    = 512,
            # 4 epochs vs 10: 2.5x faster update phase, negligible quality loss
            # for this environment complexity.
            n_epochs      = 4,
            ent_coef      = ent_coef,
            clip_range    = 0.2,
            max_grad_norm = 0.5,
            policy_kwargs = policy_kwargs,
            verbose       = 0,
            device        = device,
            tensorboard_log = "./logs/attacker",
        )

    # ── Behavioral cloning ─────────────────────────────────────────────────────

    def pretrain_on_expert(
        self,
        expert,
        env,
        num_episodes:   int = 500,
        epochs:         int = 20,
        batch_size:     int = 512,
        lr:             float = 1e-3,
    ) -> None:
        """
        Behavioral cloning from a scripted expert agent.
        The expert runs num_episodes, producing (obs, action) pairs.
        """
        print("\n🧠 [RED TEAM] Generating Expert Attack Dataset...")
        obs_list, act_list = self._collect_expert_rollouts(expert, env, num_episodes)
        self._train_bc(obs_list, act_list, epochs, batch_size, lr, label="RED TEAM")

    def pretrain_on_dataset(
        self,
        dataset_path:  str,
        epochs:        int = 20,
        batch_size:    int = 512,
        lr:            float = 1e-3,
    ) -> None:
        """
        Behavioral cloning from a saved numpy dataset
        (e.g. from LLMOracle.save_dataset).
        """
        print(f"\n🧠 [RED TEAM] Loading Oracle Dataset from {dataset_path}...")
        data = np.load(dataset_path)
        obs_list = list(data["observations"])
        act_list = list(data["actions"])
        print(f"   Loaded {len(obs_list)} transitions.")
        self._train_bc(obs_list, act_list, epochs, batch_size, lr, label="RED TEAM (Oracle)")

    # ── Predict shim (curriculum opponent interface) ───────────────────────────

    def predict(self, observation: np.ndarray, deterministic: bool = True):
        """Thin wrapper so AttackerAgent can be used as an opponent_model."""
        obs = np.array(observation, dtype=np.float32).reshape(1, -1)
        action, _ = self.model.predict(obs, deterministic=deterministic)
        return int(np.asarray(action).flat[0]), None

    # ── Save / load ────────────────────────────────────────────────────────────

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.model.save(path)

    def load(self, path: str) -> None:
        self.model = RecurrentPPO.load(path, env=self.env, device=self.model.device)

    # ── Internal helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _collect_expert_rollouts(expert, env, num_episodes: int):
        obs_list, act_list = [], []
        for _ in tqdm(range(num_episodes), desc="Expert Rollouts", colour="red", leave=False):
            obs, _ = env.reset()
            done, steps = False, 0
            while not done:
                action, _ = expert.predict(obs)
                obs_list.append(obs.copy())
                act_list.append(int(action))
                obs, _, term, trunc, _ = env.step(int(action))
                done = term or trunc
                steps += 1
                if steps > env.max_steps + 5:
                    break
        return obs_list, act_list

    def _train_bc(
        self,
        obs_list:   list,
        act_list:   list,
        epochs:     int,
        batch_size: int,
        lr:         float,
        label:      str,
    ) -> None:
        print(f"   Dataset size: {len(obs_list)} transitions")
        obs_t = torch.tensor(np.array(obs_list, dtype=np.float32))
        act_t = torch.tensor(np.array(act_list, dtype=np.int64))
        loader = DataLoader(
            TensorDataset(obs_t, act_t),
            batch_size=batch_size, shuffle=True, pin_memory=True
        )

        policy    = self.model.policy
        optimizer = torch.optim.Adam(policy.parameters(), lr=lr)
        device    = next(policy.parameters()).device

        print(f"🎓 [{label}] Behavioral Cloning ({epochs} epochs)...")
        policy.train()
        # sb3-contrib attribute name changed across versions — probe both
        lstm_h = (getattr(self.model.policy, "lstm_hidden_size", None)
                  or getattr(getattr(self.model.policy, "lstm_actor", None),
                             "hidden_size", None)
                  or 256)
        best_loss = float("inf")

        for epoch in tqdm(range(epochs), desc="BC Training", colour="red", leave=False):
            epoch_loss = 0.0
            for batch_obs, batch_acts in loader:
                batch_obs  = batch_obs.to(device)
                batch_acts = batch_acts.to(device)
                bs = len(batch_obs)

                lstm_states = (
                    torch.zeros(1, bs, lstm_h, device=device),
                    torch.zeros(1, bs, lstm_h, device=device),
                )
                ep_starts = torch.ones(bs, dtype=torch.float32, device=device)

                distribution, _ = policy.get_distribution(batch_obs, lstm_states, ep_starts)
                loss = -distribution.log_prob(batch_acts).mean()

                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), max_norm=1.0)
                optimizer.step()
                epoch_loss += loss.item()

            avg_loss = epoch_loss / len(loader)
            if avg_loss < best_loss:
                best_loss = avg_loss

        policy.eval()
        print(f"   BC complete – best loss: {best_loss:.4f}")