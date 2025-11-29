#!/usr/bin/env python3
"""
Quick start script for CyberX RL training
"""

import argparse
from trainer import SelfPlayTrainer

def main():
    parser = argparse.ArgumentParser(description='CyberX RL Training')
    parser.add_argument('--iterations', type=int, default=10, help='Number of training iterations')
    parser.add_argument('--timesteps', type=int, default=10000, help='Timesteps per iteration')
    parser.add_argument('--eval-episodes', type=int, default=5, help='Evaluation episodes')
    parser.add_argument('--save-dir', type=str, default='./models/cyberx', help='Model save directory')
    
    args = parser.parse_args()
    
    print(f"""
    ╔═══════════════════════════════════════════╗
    ║   CyberX RL Training System              ║
    ║   Attacker vs Defender Self-Play         ║
    ╚═══════════════════════════════════════════╝
    
    Configuration:
      Iterations: {args.iterations}
      Timesteps per iteration: {args.timesteps}
      Evaluation episodes: {args.eval_episodes}
      Save directory: {args.save_dir}
    """)
    
    # Initialize trainer
    trainer = SelfPlayTrainer(save_dir=args.save_dir)
    
    # Run training
    trainer.train_self_play(
        n_iterations=args.iterations,
        timesteps_per_iteration=args.timesteps,
        eval_episodes=args.eval_episodes
    )
    
    print("\n✅ Training complete! Models saved to:", args.save_dir)

if __name__ == '__main__':
    main()
