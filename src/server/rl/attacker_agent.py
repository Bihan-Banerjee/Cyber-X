import numpy as np
import torch
import torch.nn as nn
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
import gymnasium as gym
from typing import Dict, Tuple, Optional
import os
import requests
import re
import random

from config_loader import config

class AttackerFeatureExtractor(BaseFeaturesExtractor):
    """Custom feature extractor for attacker observations"""
    
    def __init__(self, observation_space: gym.spaces.Box, features_dim: int = 128):
        super().__init__(observation_space, features_dim)
        
        n_input = observation_space.shape[0]
        
        self.network = nn.Sequential(
            nn.Linear(n_input, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, features_dim),
            nn.ReLU()
        )
    
    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        return self.network(observations)


class LLMAssistant:
    """LLM-based tactic advisor for attacker"""
    
    def __init__(self):
        self.llm_config = config.get_llm_config()
        self.enabled = self.llm_config.get('enabled', False)
        self.provider = self.llm_config.get('provider', 'ollama')
        self.model = self.llm_config.get('model', 'llama3.2:3b')
        self.api_base = self.llm_config.get('api_base', 'http://localhost:11434')
        self.consult_prob = self.llm_config.get('consult_probability', 0.2)
        self.temperature = self.llm_config.get('temperature', 0.7)
        
        if self.enabled:
            self._test_connection()
    
    def _test_connection(self):
        """Test if Ollama is running"""
        try:
            response = requests.get(f"{self.api_base}/api/tags", timeout=2)
            if response.status_code == 200:
                print(f"✅ LLM Assistant connected: {self.provider} ({self.model})")
            else:
                print(f"⚠️  LLM service responded but with error")
                self.enabled = False
        except Exception as e:
            print(f"⚠️  LLM service not available: {e}")
            print("   Continuing without LLM assistance")
            self.enabled = False
    
    def get_suggestion(self, observation: np.ndarray) -> Optional[int]:
        """Get action suggestion from LLM"""
        if not self.enabled:
            return None
        
        # Only consult LLM sometimes
        if random.random() > self.consult_prob:
            return None
        
        try:
            prompt = self._build_prompt(observation)
            
            if self.provider == 'ollama':
                return self._query_ollama(prompt)
            else:
                return None
        
        except Exception as e:
            print(f"LLM query error: {e}")
            return None
    
    def _build_prompt(self, obs: np.ndarray) -> str:
        """Build prompt from observation"""
        connection_active = obs[0] > 0.5
        commands_executed = int(obs[1])
        files_accessed = int(obs[2])
        privilege_level = obs[3]
        detection_score = obs[4]
        
        priv_str = "none"
        if privilege_level > 0.9:
            priv_str = "root"
        elif privilege_level > 0.4:
            priv_str = "user"
        
        prompt = f"""You are a red team penetration tester. Current honeypot state:
- Connection: {'ACTIVE' if connection_active else 'NOT CONNECTED'}
- Privilege: {priv_str} ({privilege_level:.2f})
- Commands run: {commands_executed}
- Files accessed: {files_accessed}
- Detection risk: {detection_score:.2f} (0=safe, 1=detected)

Available actions:
0: Brute force SSH login
1: Enumerate users/services
2: Run reconnaissance commands
3: Download malware/tools
4: Attempt privilege escalation
5: Create backdoor user
6: Modify system files
7: Exfiltrate sensitive data
8: Port scan internal network
9: Wait/observe passively

Pick ONE action number (0-9) that maximizes attack success while minimizing detection. Reply with ONLY the number."""

        return prompt
    
    def _query_ollama(self, prompt: str) -> Optional[int]:
        """Query local Ollama instance"""
        try:
            response = requests.post(
                f"{self.api_base}/api/generate",
                json={
                    'model': self.model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': self.temperature,
                        'num_predict': 20,
                        'stop': ['\n', '.']
                    }
                },
                timeout=10
            )
            
            if response.status_code == 200:
                text = response.json()['response']
                
                # Extract action number (first digit found)
                match = re.search(r'\b([0-9])\b', text)
                if match:
                    action = int(match.group(1))
                    if 0 <= action <= 9:
                        print(f"🤖 LLM suggests: action {action}")
                        return action
            
            return None
        
        except Exception as e:
            print(f"Ollama query failed: {e}")
            return None


class AttackerAgent:
    """RL Agent that learns to attack honeypot systems with optional LLM guidance"""
    
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
        tensorboard_log: str = "./logs/attacker/",
        device: str = "auto",
        use_llm: bool = True
    ):
        self.env = env
        self.use_llm = use_llm and config.get_llm_config().get('enabled', False)
        
        # Initialize LLM assistant
        self.llm_assistant = LLMAssistant() if self.use_llm else None
        
        # Custom policy with feature extractor
        policy_kwargs = dict(
            features_extractor_class=AttackerFeatureExtractor,
            features_extractor_kwargs=dict(features_dim=128),
            net_arch=dict(pi=[256, 128], vf=[256, 128])
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
        self.total_steps = 0
        self.attack_success_rate = []
        self.detection_rate = []
        self.llm_suggestions_used = 0
        self.llm_suggestions_total = 0
    
    def train(
        self,
        total_timesteps: int,
        callback=None,
        log_interval: int = 10
    ):
        """Train the attacker agent"""
        print(f"🔴 Training Attacker Agent for {total_timesteps} timesteps...")
        if self.llm_assistant and self.llm_assistant.enabled:
            print(f"   🤖 LLM assistance: ENABLED ({self.llm_assistant.consult_prob*100:.0f}% consult rate)")
        
        self.model.learn(
            total_timesteps=total_timesteps,
            callback=callback,
            log_interval=log_interval,
            progress_bar=True
        )
        
        print("✅ Attacker training complete!")
        return self
    
    def predict(self, observation, deterministic: bool = False):
        """Get action from trained policy, optionally consulting LLM"""
        
        # Try LLM suggestion first
        if self.llm_assistant and self.llm_assistant.enabled and not deterministic:
            self.llm_suggestions_total += 1
            llm_action = self.llm_assistant.get_suggestion(observation)
            
            if llm_action is not None:
                self.llm_suggestions_used += 1
                return llm_action
        
        # Fall back to RL policy
        action, _states = self.model.predict(observation, deterministic=deterministic)
        return action
    
    def evaluate(self, n_episodes: int = 10) -> Dict:
        """Evaluate attacker performance"""
        print(f"📊 Evaluating Attacker Agent over {n_episodes} episodes...")
        
        episode_rewards = []
        episode_lengths = []
        success_count = 0
        detection_count = 0
        
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
                
                # Track success metrics (relaxed criteria)
                if episode_reward > 300:  # Threshold for "successful" attack
                    success_count += 1
                    break  # Count once per episode
                
                if info.get('detected', False):
                    detection_count += 1
                    break
            
            episode_rewards.append(episode_reward)
            episode_lengths.append(episode_length)
            
            print(f"Episode {episode + 1}: Reward={episode_reward:.2f}, Length={episode_length}")
        
        results = {
            'mean_reward': np.mean(episode_rewards),
            'std_reward': np.std(episode_rewards),
            'mean_length': np.mean(episode_lengths),
            'success_rate': success_count / n_episodes,
            'detection_rate': detection_count / n_episodes
        }
        
        print(f"\n📈 Evaluation Results:")
        print(f"  Mean Reward: {results['mean_reward']:.2f} ± {results['std_reward']:.2f}")
        print(f"  Mean Episode Length: {results['mean_length']:.1f}")
        print(f"  Success Rate: {results['success_rate']:.2%}")
        print(f"  Detection Rate: {results['detection_rate']:.2%}")
        
        if self.llm_suggestions_total > 0:
            llm_usage = self.llm_suggestions_used / self.llm_suggestions_total
            print(f"  LLM Usage: {llm_usage:.1%} ({self.llm_suggestions_used}/{self.llm_suggestions_total})")
        
        return results
    
    def save(self, path: str):
        """Save trained model"""
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
        self.model.save(path)
        print(f"💾 Attacker model saved to {path}")
    
    def load(self, path: str):
        """Load trained model"""
        if not os.path.exists(path):
            print(f"❌ Model file not found: {path}")
            return self
        
        self.model = PPO.load(path, env=self.env)
        print(f"📂 Attacker model loaded from {path}")
        return self
    
    def load_best(self):
        """Load the best/default model from config"""
        best_path = config.get_best_attacker_path()
        return self.load(best_path)


class AttackerCallback(BaseCallback):
    """Custom callback for attacker training"""
    
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
            self.logger.record('attacker/episode_reward', self.current_episode_reward)
            self.logger.record('attacker/episode_length', self.current_episode_length)
            
            # Reset counters
            self.current_episode_reward = 0
            self.current_episode_length = 0
            
            # Print progress
            if len(self.episode_rewards) % 10 == 0:
                mean_reward = np.mean(self.episode_rewards[-10:])
                print(f"🔴 Episode {len(self.episode_rewards)}: Mean Reward (last 10) = {mean_reward:.2f}")
        
        return True
