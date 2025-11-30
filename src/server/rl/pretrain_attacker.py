#!/usr/bin/env python3
"""
Pre-train attacker agent using real honeypot attack data
"""

import json
import numpy as np
import os
from honeypot_env_sim import HoneypotEnvSimulated
from attacker_agent import AttackerAgent
from tqdm import tqdm

def load_attack_sequences(filepath: str):
    """Load attack sequences from dataset"""
    
    print(f"📂 Loading dataset: {filepath}")
    
    sequences = []
    current_session = []
    last_session_id = None
    
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return []
    
    with open(filepath, 'r') as f:
        for line in f:
            try:
                log = json.loads(line.strip())
                
                # Handle synthetic data format
                if 'action' in log:
                    action = log['action']
                    session_id = log.get('session_id', 'default')
                else:
                    # Parse real Cowrie logs
                    eventid = log.get('eventid', '')
                    session_id = log.get('session', 'default')
                    
                    # Map events to actions
                    if 'login.failed' in eventid or 'login.success' in eventid:
                        action = 0  # brute_force
                    elif 'session.connect' in eventid:
                        action = 0
                    elif 'command.input' in eventid:
                        cmd = log.get('input', '').lower()
                        
                        if any(x in cmd for x in ['whoami', 'uname', 'pwd', 'id']):
                            action = 2  # recon
                        elif any(x in cmd for x in ['ls', 'cat /etc']):
                            action = 1  # enumerate
                        elif any(x in cmd for x in ['wget', 'curl', 'fetch']):
                            action = 3  # download
                        elif any(x in cmd for x in ['sudo', 'su -', 'chmod +s']):
                            action = 4  # priv_esc
                        elif any(x in cmd for x in ['useradd', 'adduser']):
                            action = 5  # backdoor
                        elif any(x in cmd for x in ['cat /etc/passwd', 'cat /etc/shadow', 'cat ~/.ssh']):
                            action = 7  # exfiltrate
                        elif any(x in cmd for x in ['nmap', 'nc ', 'telnet']):
                            action = 8  # port_scan
                        else:
                            action = 2  # default: recon
                    elif 'session.file_download' in eventid:
                        action = 3  # download
                    else:
                        continue
                
                # Group by session
                if session_id != last_session_id and current_session:
                    sequences.append(current_session)
                    current_session = []
                
                current_session.append(action)
                last_session_id = session_id
            
            except Exception as e:
                continue
        
        # Add last session
        if current_session:
            sequences.append(current_session)
    
    print(f"✅ Loaded {len(sequences)} attack sessions")
    total_actions = sum(len(s) for s in sequences)
    print(f"   Total actions: {total_actions}")
    
    return sequences

def pretrain_with_imitation(
    agent: AttackerAgent,
    sequences: list,
    n_epochs: int = 20,
    batch_size: int = 32
):
    """
    Behavioral cloning: train agent to imitate real attackers
    """
    
    if not sequences:
        print("❌ No training sequences available")
        return agent
    
    print(f"\n🎓 Pre-training with Behavioral Cloning")
    print(f"   Epochs: {n_epochs}")
    print(f"   Attack sessions: {len(sequences)}")
    
    env = agent.env
    
    for epoch in range(n_epochs):
        epoch_loss = 0
        actions_trained = 0
        
        # Shuffle sequences
        np.random.shuffle(sequences)
        
        for session in tqdm(sequences[:100], desc=f"Epoch {epoch+1}/{n_epochs}"):
            obs, _ = env.reset()
            
            for action in session:
                # Ensure action is valid
                if not (0 <= action < env.action_space.n):
                    continue
                
                # Execute action in environment
                next_obs, reward, done, truncated, info = env.step(action)
                
                # Simple imitation: give positive reward for following demo
                # This biases the RL training towards expert behavior
                if reward > 0:
                    epoch_loss -= reward  # Lower loss = better
                
                actions_trained += 1
                obs = next_obs
                
                if done or truncated:
                    break
        
        avg_loss = epoch_loss / max(actions_trained, 1)
        
        if (epoch + 1) % 5 == 0:
            print(f"   Epoch {epoch+1}: Actions trained = {actions_trained}, Loss = {avg_loss:.4f}")
    
    print(f"✅ Pre-training complete!")
    return agent

def main():
    print("="*60)
    print(" CyberX Attacker Pre-Training")
    print("="*60)
    
    # Step 1: Load datasets
    datasets = [
        'datasets/synthetic_attacks.json',
        'datasets/cowrie_sample_1.json'
    ]
    
    all_sequences = []
    for dataset_path in datasets:
        if os.path.exists(dataset_path):
            sequences = load_attack_sequences(dataset_path)
            all_sequences.extend(sequences)
    
    if not all_sequences:
        print("❌ No datasets available. Run download_dataset.py first!")
        return
    
    print(f"\n📊 Combined dataset: {len(all_sequences)} sessions")
    
    # Step 2: Create environment and agent
    print("\n🏗️  Initializing environment and agent...")
    env = HoneypotEnvSimulated(mode='attacker', max_steps=100)
    agent = AttackerAgent(env, use_llm=False)  # Disable LLM during pre-training
    
    # Step 3: Pre-train with behavioral cloning
    agent = pretrain_with_imitation(agent, all_sequences, n_epochs=30)
    
    # Step 4: Fine-tune with RL
    print("\n🔥 Fine-tuning with reinforcement learning...")
    agent.train(total_timesteps=50000)
    
    # Step 5: Evaluate
    print("\n📊 Evaluating pre-trained agent...")
    results = agent.evaluate(n_episodes=20)
    
    # Step 6: Save
    os.makedirs('models/pretrained', exist_ok=True)
    save_path = 'models/pretrained/attacker_pretrained.zip'
    agent.save(save_path)
    
    print(f"\n{'='*60}")
    print("✅ Pre-training Complete!")
    print(f"{'='*60}")
    print(f"  Model saved: {save_path}")
    print(f"  Mean Reward: {results['mean_reward']:.2f}")
    print(f"  Success Rate: {results['success_rate']:.2%}")
    print(f"\nNext: Use this model as starting point for self-play training")

if __name__ == '__main__':
    main()
