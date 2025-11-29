import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple
import time
import json
import os
from datetime import datetime

from honeypot_env import HoneypotEnv
from honeypot_env_sim import HoneypotEnvSimulated
from attacker_agent import AttackerAgent, AttackerCallback
from defender_agent import DefenderAgent, DefenderCallback


class SelfPlayTrainer:
    """
    Self-play training system where attacker and defender agents
    learn by playing against each other iteratively
    """
    
    def __init__(
        self,
        elasticsearch_url: str = 'http://localhost:9200',
        honeypot_host: str = 'localhost',
        honeypot_port: int = 2222,
        max_steps: int = 100,
        save_dir: str = './models'
    ):
        # Create environments
#        self.attacker_env = HoneypotEnv(
#            mode='attacker',
#            elasticsearch_url=elasticsearch_url,
#            honeypot_host=honeypot_host,
#            honeypot_port=honeypot_port,
#            max_steps=max_steps
#        )
#        
#        self.defender_env = HoneypotEnv(
#            mode='defender',
#            elasticsearch_url=elasticsearch_url,
#            honeypot_host=honeypot_host,
#            honeypot_port=honeypot_port,
#            max_steps=max_steps
#        )

        self.attacker_env = HoneypotEnvSimulated(mode='attacker', max_steps=max_steps)
        self.defender_env = HoneypotEnvSimulated(mode='defender', max_steps=max_steps)
        
        # Create agents
        self.attacker = AttackerAgent(self.attacker_env)
        self.defender = DefenderAgent(self.defender_env)
        
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)
        
        # Training history
        self.training_history = {
            'iterations': [],
            'attacker_rewards': [],
            'defender_rewards': [],
            'attack_success_rates': [],
            'detection_rates': [],
            'timestamps': []
        }
    
    def train_self_play(
        self,
        n_iterations: int = 10,
        timesteps_per_iteration: int = 10000,
        eval_episodes: int = 5
    ):
        """
        Self-play training loop:
        1. Train attacker against current defender
        2. Train defender against current attacker
        3. Evaluate both
        4. Repeat
        """
        print("🚀 Starting Self-Play Training Loop")
        print(f"Iterations: {n_iterations}")
        print(f"Timesteps per iteration: {timesteps_per_iteration}")
        print("="*60)
        
        for iteration in range(1, n_iterations + 1):
            print(f"\n{'='*60}")
            print(f"🔄 ITERATION {iteration}/{n_iterations}")
            print(f"{'='*60}\n")
            
            start_time = time.time()
            
            # Phase 1: Train Attacker
            print(f"\n--- Phase 1: Training Attacker ---")
            attacker_callback = AttackerCallback()
            self.attacker.train(
                total_timesteps=timesteps_per_iteration,
                callback=attacker_callback,
                log_interval=10
            )
            
            # Phase 2: Train Defender
            print(f"\n--- Phase 2: Training Defender ---")
            defender_callback = DefenderCallback()
            self.defender.train(
                total_timesteps=timesteps_per_iteration,
                callback=defender_callback,
                log_interval=10
            )
            
            # Phase 3: Evaluate both agents
            print(f"\n--- Phase 3: Evaluation ---")
            attacker_results = self.attacker.evaluate(n_episodes=eval_episodes)
            defender_results = self.defender.evaluate(n_episodes=eval_episodes)
            
            # Log results
            iteration_time = time.time() - start_time
            self._log_iteration(iteration, attacker_results, defender_results, iteration_time)
            
            # Save models periodically
            if iteration % 2 == 0:
                self.save_models(iteration)
            
            # Plot progress
            if iteration % 5 == 0:
                self.plot_training_progress()
        
        print(f"\n{'='*60}")
        print("✅ Self-Play Training Complete!")
        print(f"{'='*60}\n")
        
        # Final save and plots
        self.save_models(n_iterations)
        self.plot_training_progress()
        self.save_training_history()
    
    def train_alternating(
        self,
        n_rounds: int = 5,
        attacker_timesteps: int = 20000,
        defender_timesteps: int = 20000
    ):
        """
        Alternating training: train one agent at a time
        """
        print("🎯 Starting Alternating Training")
        print(f"Rounds: {n_rounds}")
        print("="*60)
        
        for round_num in range(1, n_rounds + 1):
            print(f"\n{'='*60}")
            print(f"🔄 ROUND {round_num}/{n_rounds}")
            print(f"{'='*60}\n")
            
            # Train attacker
            print("🔴 Training Attacker...")
            self.attacker.train(total_timesteps=attacker_timesteps)
            attacker_results = self.attacker.evaluate(n_episodes=5)
            
            # Train defender against improved attacker
            print("\n🔵 Training Defender...")
            self.defender.train(total_timesteps=defender_timesteps)
            defender_results = self.defender.evaluate(n_episodes=5)
            
            # Log and save
            self._log_iteration(round_num, attacker_results, defender_results, 0)
            self.save_models(round_num)
        
        print("\n✅ Alternating Training Complete!")
        self.plot_training_progress()
    
    def _log_iteration(
        self,
        iteration: int,
        attacker_results: Dict,
        defender_results: Dict,
        iteration_time: float
    ):
        """Log iteration metrics"""
        self.training_history['iterations'].append(iteration)
        self.training_history['attacker_rewards'].append(attacker_results['mean_reward'])
        self.training_history['defender_rewards'].append(defender_results['mean_reward'])
        self.training_history['attack_success_rates'].append(attacker_results['success_rate'])
        self.training_history['detection_rates'].append(attacker_results['detection_rate'])
        self.training_history['timestamps'].append(datetime.now().isoformat())
        
        print(f"\n📊 Iteration {iteration} Summary:")
        print(f"  Time: {iteration_time:.1f}s")
        print(f"  Attacker Reward: {attacker_results['mean_reward']:.2f}")
        print(f"  Defender Reward: {defender_results['mean_reward']:.2f}")
        print(f"  Attack Success Rate: {attacker_results['success_rate']:.2%}")
        print(f"  Detection Rate: {attacker_results['detection_rate']:.2%}")
    
    def save_models(self, iteration: int):
        """Save both agent models"""
        attacker_path = f"{self.save_dir}/attacker_iter_{iteration}.zip"
        defender_path = f"{self.save_dir}/defender_iter_{iteration}.zip"
        
        self.attacker.save(attacker_path)
        self.defender.save(defender_path)
        
        print(f"\n💾 Models saved (Iteration {iteration})")
    
    def load_models(self, iteration: int):
        """Load both agent models"""
        attacker_path = f"{self.save_dir}/attacker_iter_{iteration}.zip"
        defender_path = f"{self.save_dir}/defender_iter_{iteration}.zip"
        
        self.attacker.load(attacker_path)
        self.defender.load(defender_path)
        
        print(f"📂 Models loaded (Iteration {iteration})")
    
    def save_training_history(self):
        """Save training history to JSON"""
        history_path = f"{self.save_dir}/training_history.json"
        with open(history_path, 'w') as f:
            json.dump(self.training_history, f, indent=2)
        print(f"💾 Training history saved to {history_path}")
    
    def plot_training_progress(self):
        """Plot training metrics"""
        if not self.training_history['iterations']:
            print("No training history to plot")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('CyberX Self-Play Training Progress', fontsize=16)
        
        iterations = self.training_history['iterations']
        
        # Plot 1: Rewards
        axes[0, 0].plot(iterations, self.training_history['attacker_rewards'], 
                       'r-', label='Attacker', linewidth=2)
        axes[0, 0].plot(iterations, self.training_history['defender_rewards'], 
                       'b-', label='Defender', linewidth=2)
        axes[0, 0].set_xlabel('Iteration')
        axes[0, 0].set_ylabel('Mean Reward')
        axes[0, 0].set_title('Agent Rewards Over Time')
        axes[0, 0].legend()
        axes[0, 0].grid(True, alpha=0.3)
        
        # Plot 2: Attack Success Rate
        axes[0, 1].plot(iterations, self.training_history['attack_success_rates'], 
                       'g-', linewidth=2)
        axes[0, 1].set_xlabel('Iteration')
        axes[0, 1].set_ylabel('Success Rate')
        axes[0, 1].set_title('Attack Success Rate')
        axes[0, 1].grid(True, alpha=0.3)
        axes[0, 1].set_ylim([0, 1])
        
        # Plot 3: Detection Rate
        axes[1, 0].plot(iterations, self.training_history['detection_rates'], 
                       'orange', linewidth=2)
        axes[1, 0].set_xlabel('Iteration')
        axes[1, 0].set_ylabel('Detection Rate')
        axes[1, 0].set_title('Attacker Detection Rate')
        axes[1, 0].grid(True, alpha=0.3)
        axes[1, 0].set_ylim([0, 1])
        
        # Plot 4: Win Rate Balance
        axes[1, 1].bar(['Attacker', 'Defender'], 
                      [np.mean(self.training_history['attack_success_rates']),
                       np.mean(self.training_history['detection_rates'])],
                      color=['red', 'blue'])
        axes[1, 1].set_ylabel('Average Rate')
        axes[1, 1].set_title('Overall Performance Balance')
        axes[1, 1].set_ylim([0, 1])
        axes[1, 1].grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        plot_path = f"{self.save_dir}/training_progress.png"
        plt.savefig(plot_path, dpi=150, bbox_inches='tight')
        print(f"📈 Training plots saved to {plot_path}")
        plt.close()
    
    def demonstrate(self, n_episodes: int = 3):
        """Run demonstration episodes with trained agents"""
        print("\n🎬 Running Demonstration Episodes")
        print("="*60)
        
        for episode in range(1, n_episodes + 1):
            print(f"\n--- Episode {episode} ---")
            
            # Attacker episode
            obs, _ = self.attacker_env.reset()
            done = False
            truncated = False
            total_reward = 0
            
            print("\n🔴 Attacker Actions:")
            while not (done or truncated):
                action = self.attacker.predict(obs, deterministic=True)
                obs, reward, done, truncated, info = self.attacker_env.step(action)
                total_reward += reward
                
                print(f"  Step {info['step']}: {info['action_name']} | Reward: {reward:.2f}")
                
                if done:
                    print(f"  ❌ Episode terminated: {info.get('error', 'Detected')}")
            
            print(f"  Total Reward: {total_reward:.2f}")
        
        print("\n✅ Demonstration complete!")


def main():
    """Main training script"""
    print("="*60)
    print(" CyberX RL Training System")
    print("  Attacker vs Defender Self-Play")
    print("="*60)
    
    # Initialize trainer
    trainer = SelfPlayTrainer(
        elasticsearch_url='http://localhost:9200',
        honeypot_host='localhost',
        honeypot_port=2222,
        max_steps=100,
        save_dir='./models/cyberx'
    )
    
    # Run self-play training
    trainer.train_self_play(
        n_iterations=10,
        timesteps_per_iteration=10000,
        eval_episodes=5
    )
    
    # Demonstrate trained agents
    trainer.demonstrate(n_episodes=3)


if __name__ == "__main__":
    main()
