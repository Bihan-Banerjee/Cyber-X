#!/usr/bin/env python3
"""
Long overnight training for production-quality agents
"""

from trainer import SelfPlayTrainer

def main():
    print("""
    ╔═══════════════════════════════════════════╗
    ║   CyberX OVERNIGHT TRAINING               ║
    ║   ~8 hours for production agents          ║
    ╚═══════════════════════════════════════════╝
    """)
    
    trainer = SelfPlayTrainer(save_dir='./models/production')
    
    trainer.train_self_play(
        n_iterations=100,        # 100 iterations
        timesteps_per_iteration=100000,  # 100k timesteps each
        eval_episodes=20         # Thorough evaluation
    )
    
    print("\n✅ PRODUCTION TRAINING COMPLETE!")
    print("   Total timesteps: 10,000,000")
    print("   Models saved to: ./models/production")

if __name__ == '__main__':
    main()
