#!/usr/bin/env python3
"""
Download public honeypot datasets for pre-training
"""

import requests
import json
import os
from tqdm import tqdm

def download_cowrie_sample():
    """Download sample Cowrie logs from GitHub"""
    
    # Sample Cowrie dataset URLs (real public sources)
    sources = [
        {
            'name': 'Cowrie Sample 1',
            'url': 'https://raw.githubusercontent.com/cowrie/cowrie/master/docs/sample/cowrie.json',
            'output': 'datasets/cowrie_sample_1.json'
        },
        # Add more sources if found
    ]
    
    os.makedirs('datasets', exist_ok=True)
    
    print("📥 Downloading honeypot datasets...")
    
    for source in sources:
        print(f"\n  Downloading: {source['name']}")
        try:
            response = requests.get(source['url'], stream=True, timeout=30)
            
            if response.status_code == 200:
                with open(source['output'], 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                print(f"  ✅ Saved to: {source['output']}")
            else:
                print(f"  ❌ Failed: HTTP {response.status_code}")
        
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    print("\n✅ Dataset download complete!")
    print("   Check the 'datasets/' folder")

def create_synthetic_dataset():
    """
    Create a synthetic dataset if real data unavailable
    Based on common attack patterns
    """
    print("📝 Creating synthetic training dataset...")
    
    synthetic_data = []
    
    # Common attack sequences
    sequences = [
        # Sequence 1: Brute force -> recon -> exfiltrate
        [0, 0, 0, 2, 2, 7],
        
        # Sequence 2: Brute force -> enumerate -> priv esc -> backdoor
        [0, 1, 2, 4, 5],
        
        # Sequence 3: Brute force -> download malware -> modify files
        [0, 2, 3, 6],
        
        # Sequence 4: Cautious approach
        [0, 9, 2, 9, 1, 9, 7],
        
        # Sequence 5: Aggressive
        [0, 2, 3, 4, 5, 6, 7, 8]
    ]
    
    # Repeat patterns with variations
    for i in range(100):
        for seq in sequences:
            for action in seq:
                synthetic_data.append({
                    'eventid': f'synthetic.action.{action}',
                    'action': action,
                    'session_id': f'syn_{i}'
                })
    
    output_path = 'datasets/synthetic_attacks.json'
    os.makedirs('datasets', exist_ok=True)
    
    with open(output_path, 'w') as f:
        for item in synthetic_data:
            f.write(json.dumps(item) + '\n')
    
    print(f"✅ Synthetic dataset created: {output_path}")
    print(f"   {len(synthetic_data)} attack actions generated")
    
    return output_path

if __name__ == '__main__':
    print("="*60)
    print(" CyberX Dataset Preparation")
    print("="*60)
    
    # Try downloading real data
    download_cowrie_sample()
    
    # Create synthetic fallback
    create_synthetic_dataset()
    
    print("\n✅ All datasets ready for pre-training!")
