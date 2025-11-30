#!/usr/bin/env python3
"""
Complete training workflow:
1. Download datasets
2. Pre-train attacker
3. Run self-play training with LLM
4. Set best models
"""

import os
import sys

def main():
    print("""
╔═══════════════════════════════════════════════════════════════╗
║              CyberX Complete Training Pipeline                ║
║  1. Dataset Preparation                                       ║
║  2. Attacker Pre-training                                     ║
║  3. Self-Play RL Training (with LLM)                         ║
║  4. Model Evaluation & Selection                              ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Download datasets
    print("\n" + "="*60)
    print("STEP 1: Downloading & Preparing Datasets")
    print("="*60)
    os.system('python download_dataset.py')
    
    # Step 2: Pre-train attacker
    print("\n" + "="*60)
    print("STEP 2: Pre-training Attacker")
    print("="*60)
    
    response = input("\nStart pre-training? (y/n): ")
    if response.lower() == 'y':
        os.system('python pretrain_attacker.py')
    
    # Step 3: Self-play training
    print("\n" + "="*60)
    print("STEP 3: Self-Play Training")
    print("="*60)
    
    iterations = input("Number of iterations (default 10): ") or "10"
    timesteps = input("Timesteps per iteration (default 50000): ") or "50000"
    
    response = input(f"\nStart training ({iterations} iterations)? (y/n): ")
    if response.lower() == 'y':
        cmd = f'python run_training.py --iterations {iterations} --timesteps {timesteps}'
        os.system(cmd)
    
    # Step 4: Set best model
    print("\n" + "="*60)
    print("STEP 4: Select Best Model")
    print("="*60)
    
    iteration = input("Which iteration to set as best? (e.g., 24): ")
    if iteration:
        os.system(f'python set_best_model.py {iteration}')
    
    print("\n✅ Complete training pipeline finished!")
    print("   Check models/production/ for trained models")
    print("   Check logs/ for TensorBoard data")

if __name__ == '__main__':
    main()
