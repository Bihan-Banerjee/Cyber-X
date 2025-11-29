import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Tuple, Optional
import random

class HoneypotEnvSimulated(gym.Env):
    """
    FAST simulated honeypot environment for RL training
    No real SSH connections - uses probability models instead
    """
    
    metadata = {'render.modes': ['human']}
    
    def __init__(self, mode: str = 'attacker', max_steps: int = 100):
        super().__init__()
        
        self.mode = mode
        self.max_steps = max_steps
        self.current_step = 0
        
        if mode == 'attacker':
            self._setup_attacker_spaces()
        else:
            self._setup_defender_spaces()
    
    def _setup_attacker_spaces(self):
        self.action_space = spaces.Discrete(10)
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0, 0, 0, 0, 0, 0]),
            high=np.array([1, 100, 100, 1, 1, self.max_steps, 50, 20]),
            dtype=np.float32
        )
        
        self.attack_state = {
            'connection_active': False,
            'commands_executed': 0,
            'files_accessed': 0,
            'privilege_level': 0.0,
            'failed_attempts': 0,
            'successful_exploits': 0,
            'detection_score': 0.0
        }
    
    def _setup_defender_spaces(self):
        self.action_space = spaces.Discrete(10)
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0, 0, 0, 0, 0, 0]),
            high=np.array([100, 1000, 1000, 100, 3600, 1, 50, 50]),
            dtype=np.float32
        )
        
        self.defense_state = {
            'active_connections': 0,
            'failed_logins': 0,
            'suspicious_commands': 0,
            'ips_blocked': 0,
            'attacks_detected': 0
        }
    
    def reset(self, seed: Optional[int] = None) -> Tuple[np.ndarray, dict]:
        super().reset(seed=seed)
        self.current_step = 0
        
        if self.mode == 'attacker':
            self.attack_state = {
                'connection_active': False,
                'commands_executed': 0,
                'files_accessed': 0,
                'privilege_level': 0.0,
                'failed_attempts': 0,
                'successful_exploits': 0,
                'detection_score': 0.0
            }
        else:
            self.defense_state = {
                'active_connections': random.randint(1, 5),
                'failed_logins': random.randint(0, 20),
                'suspicious_commands': random.randint(0, 10),
                'ips_blocked': 0,
                'attacks_detected': 0
            }
        
        return self._get_observation(), {}
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        self.current_step += 1
        
        if self.mode == 'attacker':
            reward, info = self._execute_attacker_action_sim(action)
        else:
            reward, info = self._execute_defender_action_sim(action)
        
        observation = self._get_observation()
        terminated = info.get('terminated', False)
        truncated = self.current_step >= self.max_steps
        
        info['step'] = self.current_step
        
        return observation, reward, terminated, truncated, info
    
    def _execute_attacker_action_sim(self, action: int) -> Tuple[float, Dict]:
        """Simulated attacker actions with probability models"""
        info = {'action': action, 'action_name': self._get_action_name(action)}
        reward = 0.0
        
        if action == 0:  # Brute force
            if random.random() < 0.3:  # 30% success rate
                self.attack_state['connection_active'] = True
                self.attack_state['privilege_level'] = 0.5
                self.attack_state['successful_exploits'] += 1
                reward = 20.0
                info['success'] = True
            else:
                self.attack_state['failed_attempts'] += 1
                reward = -2.0
                info['success'] = False
            self.attack_state['detection_score'] += 0.1
        
        elif action == 1:  # Enumerate
            if self.attack_state['connection_active']:
                reward = 5.0 + random.uniform(0, 3)
                self.attack_state['commands_executed'] += 3
                info['users_found'] = random.randint(3, 10)
            else:
                reward = -5.0
        
        elif action == 2:  # Recon
            if self.attack_state['connection_active']:
                reward = 8.0
                self.attack_state['commands_executed'] += 5
                self.attack_state['detection_score'] += 0.05
            else:
                reward = -5.0
        
        elif action == 3:  # Download malware
            if self.attack_state['connection_active']:
                if random.random() < 0.5:
                    reward = 15.0
                    self.attack_state['files_accessed'] += 1
                    self.attack_state['successful_exploits'] += 1
                    self.attack_state['detection_score'] += 0.3
                else:
                    reward = -3.0
            else:
                reward = -5.0
        
        elif action == 4:  # Privilege escalation
            if self.attack_state['connection_active'] and random.random() < 0.4:
                reward = 30.0
                self.attack_state['privilege_level'] = 1.0
                self.attack_state['successful_exploits'] += 1
                self.attack_state['detection_score'] += 0.4
            else:
                reward = -4.0
                self.attack_state['detection_score'] += 0.2
        
        elif action == 5:  # Create backdoor
            if self.attack_state['privilege_level'] >= 0.5:
                reward = 25.0 if random.random() < 0.6 else -3.0
                self.attack_state['detection_score'] += 0.25
            else:
                reward = -5.0
        
        elif action == 6:  # Modify files
            if self.attack_state['privilege_level'] >= 0.5:
                reward = 18.0 if random.random() < 0.7 else -2.0
                self.attack_state['files_accessed'] += 1
                self.attack_state['detection_score'] += 0.15
            else:
                reward = -5.0
        
        elif action == 7:  # Exfiltrate
            if self.attack_state['connection_active']:
                files = random.randint(1, 5)
                reward = 12.0 + files * 0.5
                self.attack_state['files_accessed'] += files
                self.attack_state['detection_score'] += 0.2
            else:
                reward = -5.0
        
        elif action == 8:  # Port scan
            if self.attack_state['connection_active']:
                reward = 10.0
                self.attack_state['detection_score'] += 0.3
            else:
                reward = -5.0
        
        elif action == 9:  # Wait
            reward = -0.5
        
        # Detection penalty
        if self.attack_state['detection_score'] > 0.8:
            reward -= 50.0
            info['detected'] = True
            info['terminated'] = True
            self.attack_state['connection_active'] = False
        
        return reward, info
    
    def _execute_defender_action_sim(self, action: int) -> Tuple[float, Dict]:
        """Simulated defender actions"""
        info = {'action': action, 'action_name': self._get_action_name(action)}
        reward = 0.0
        
        # Simulate ongoing attacks
        attack_happening = random.random() < 0.4
        
        if action == 0:  # Monitor
            reward = 1.0
        
        elif action == 1:  # Rate limit
            if attack_happening:
                reward = 5.0
                self.defense_state['attacks_detected'] += 1
            else:
                reward = -1.0
        
        elif action == 2:  # Temp block
            if attack_happening and random.random() < 0.7:
                reward = 10.0
                self.defense_state['ips_blocked'] += 1
                self.defense_state['attacks_detected'] += 1
            else:
                reward = -2.0
        
        elif action == 3:  # Perm block
            if attack_happening and random.random() < 0.8:
                reward = 20.0
                self.defense_state['ips_blocked'] += 1
                self.defense_state['attacks_detected'] += 1
            else:
                reward = -5.0
        
        elif action == 4:  # Deploy decoy
            reward = 15.0 if random.random() < 0.8 else -3.0
        
        elif action == 5:  # Rotate config
            reward = 8.0
        
        elif action == 6:  # Alert
            if attack_happening:
                reward = 12.0
            else:
                reward = -4.0
        
        elif action == 7:  # Isolate
            if attack_happening and random.random() < 0.9:
                reward = 25.0
            else:
                reward = -10.0
        
        elif action == 8:  # Reset
            reward = -8.0
        
        elif action == 9:  # Deception
            reward = 10.0 if random.random() < 0.7 else -2.0
        
        # Update state
        if attack_happening:
            self.defense_state['failed_logins'] += random.randint(1, 5)
            self.defense_state['suspicious_commands'] += random.randint(0, 3)
        
        return reward, info
    
    def _get_observation(self) -> np.ndarray:
        if self.mode == 'attacker':
            return np.array([
                float(self.attack_state['connection_active']),
                min(self.attack_state['commands_executed'], 100),
                min(self.attack_state['files_accessed'], 100),
                self.attack_state['privilege_level'],
                min(self.attack_state['detection_score'], 1.0),
                self.current_step,
                min(self.attack_state['failed_attempts'], 50),
                min(self.attack_state['successful_exploits'], 20)
            ], dtype=np.float32)
        else:
            return np.array([
                min(self.defense_state['active_connections'], 100),
                min(self.defense_state['failed_logins'], 1000),
                min(self.defense_state['suspicious_commands'], 1000),
                random.randint(1, 10),  # unique IPs
                random.uniform(10, 300),  # avg session duration
                float(random.random() < 0.2),  # port scan detected
                random.randint(0, 5),  # malware downloads
                random.randint(0, 3)  # priv esc attempts
            ], dtype=np.float32)
    
    def _get_action_name(self, action: int) -> str:
        if self.mode == 'attacker':
            actions = ['brute_force', 'enumerate', 'recon', 'download_malware',
                      'privilege_escalation', 'create_backdoor', 'modify_files',
                      'exfiltrate', 'port_scan', 'wait']
        else:
            actions = ['monitor', 'rate_limit', 'temp_block', 'perm_block',
                      'deploy_decoy', 'rotate_config', 'alert', 'isolate',
                      'reset', 'deception']
        return actions[action]
    
    def render(self, mode='human'):
        pass
    
    def close(self):
        pass
