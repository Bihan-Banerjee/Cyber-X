import numpy as np
import torch
import torch.nn as nn
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
import gymnasium as gym
from typing import Dict
import os

class DefenderFeatureExtractor(BaseFeaturesExtractor):
    """
    Custom feature extractor for defender observations
    Learns to identify attack patterns
    """
    
    def __init__(self, observation_space: gym.spaces.Box, features_dim: int = 128):
        super().__init__(observation_space, features_dim)
        
        n_input = observation_space.shape[0]
        
        self.network = nn.Sequential(
            nn.Linear(n_input, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, features_dim),
            nn.ReLU()
        )
    
    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        return self.network(observations)


class DefenderAgent:
    """
    RL Agent that learns to defend honeypot systems
    Uses PPO algorithm to detect and mitigate attacks
    """
    
    def __init__(
        self,
        env,
        learning_rate: float = 3e-4,
        n_steps: int = 2048,
        batch_size: int = 64,
        n_epochs: int = 10,
        gamma: float = 0.99,
        gae_lambda: float = 0.95,
        clip_range: float = 0.2,
        ent_coef: float = 0.01,
        vf_coef: float = 0.5,
        max_grad_norm: float = 0.5,
        tensorboard_log: str = "./logs/defender/",
        device: str = "auto"
    ):
        self.env = env
        
        # Custom policy
        policy_kwargs = dict(
            features_extractor_class=DefenderFeatureExtractor,
            features_extractor_kwargs=dict(features_dim=128),
            net_arch=[dict(pi=[256, 128], vf=[256, 128])]
        )
        
        # Initialize PPO agent
        self.model = PPO(
            "MlpPolicy",
            env,
            learning_rate=learning_rate,
            n_steps=n_steps,
            batch_size=batch_size,
            n_epochs=n_epochs,
            gamma=gamma,
            gae_lambda=gae_lambda,
            clip_range=clip_range,
            ent_coef=ent_coef,
            vf_coef=vf_coef,
            max_grad_norm=max_grad_norm,
            policy_kwargs=policy_kwargs,
            verbose=1,
            tensorboard_log=tensorboard_log,
            device=device
        )
        
        self.total_episodes = 0
        self.attacks_detected = 0
        self.false_positives = 0
    
    def train(
        self,
        total_timesteps: int,
        callback=None,
        log_interval: int = 10
    ):
        """Train the defender agent"""
        print(f"🔵 Training Defender Agent for {total_timesteps} timesteps...")
        
        self.model.learn(
            total_timesteps=total_timesteps,
            callback=callback,
            log_interval=log_interval,
            progress_bar=True
        )
        
        print("✅ Defender training complete!")
        return self
    
    def predict(self, observation, deterministic: bool = False):
        """Get action from trained policy"""
        action, _states = self.model.predict(observation, deterministic=deterministic)
        return action
    
    def evaluate(self, n_episodes: int = 10) -> Dict:
        """Evaluate defender performance"""
        print(f"📊 Evaluating Defender Agent over {n_episodes} episodes...")
        
        episode_rewards = []
        episode_lengths = []
        attacks_detected = 0
        false_positives = 0
        attacks_mitigated = 0
        
        for episode in range(n_episodes):
            obs, _ = self.env.reset()
            done = False
            truncated = False
            episode_reward = 0
            episode_length = 0
            
            while not (done or truncated):
                action = self.predict(obs, deterministic=True)
                obs, reward, done, truncated, info = self.env.step(action)
                episode_reward += reward
                episode_length += 1
                
                # Track defense metrics
                attacks_detected += info.get('attacks_detected', 0)
                false_positives += info.get('false_positives', 0)
                attacks_mitigated += info.get('attacks_mitigated', 0)
            
            episode_rewards.append(episode_reward)
            episode_lengths.append(episode_length)
            
            print(f"Episode {episode + 1}: Reward={episode_reward:.2f}, Length={episode_length}")
        
        total_detections = attacks_detected + false_positives
        precision = attacks_detected / total_detections if total_detections > 0 else 0
        
        results = {
            'mean_reward': np.mean(episode_rewards),
            'std_reward': np.std(episode_rewards),
            'mean_length': np.mean(episode_lengths),
            'attacks_detected': attacks_detected,
            'false_positives': false_positives,
            'precision': precision,
            'attacks_mitigated': attacks_mitigated
        }
        
        print(f"\n📈 Evaluation Results:")
        print(f"  Mean Reward: {results['mean_reward']:.2f} ± {results['std_reward']:.2f}")
        print(f"  Mean Episode Length: {results['mean_length']:.1f}")
        print(f"  Attacks Detected: {results['attacks_detected']}")
        print(f"  False Positives: {results['false_positives']}")
        print(f"  Precision: {results['precision']:.2%}")
        print(f"  Attacks Mitigated: {results['attacks_mitigated']}")
        
        return results
    
    def save(self, path: str):
        """Save trained model"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.model.save(path)
        print(f"💾 Defender model saved to {path}")
    
    def load(self, path: str):
        """Load trained model"""
        self.model = PPO.load(path, env=self.env)
        print(f"📂 Defender model loaded from {path}")
        return self


class DefenderCallback(BaseCallback):
    """Custom callback for defender training"""
    
    def __init__(self, verbose=0):
        super().__init__(verbose)
        self.episode_rewards = []
        self.episode_lengths = []
        self.current_episode_reward = 0
        self.current_episode_length = 0
    
    def _on_step(self) -> bool:
        self.current_episode_reward += self.locals['rewards'][0]
        self.current_episode_length += 1
        
        # Check if episode ended
        if self.locals['dones'][0]:
            self.episode_rewards.append(self.current_episode_reward)
            self.episode_lengths.append(self.current_episode_length)
            
            # Log to tensorboard
            self.logger.record('defender/episode_reward', self.current_episode_reward)
            self.logger.record('defender/episode_length', self.current_episode_length)
            
            # Reset counters
            self.current_episode_reward = 0
            self.current_episode_length = 0
            
            # Print progress
            if len(self.episode_rewards) % 10 == 0:
                mean_reward = np.mean(self.episode_rewards[-10:])
                print(f"🔵 Episode {len(self.episode_rewards)}: Mean Reward (last 10) = {mean_reward:.2f}")
        
        return True
