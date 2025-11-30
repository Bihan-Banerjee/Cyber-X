#!/usr/bin/env python3
"""
Set a specific iteration as the best model
"""

from config_loader import config
import shutil
import os

def set_best_model(iteration: int):
    """Copy iteration models to 'best' and update config"""
    
    prod_dir = config.config['model_paths']['production_dir']
    
    attacker_src = f"{prod_dir}/attacker_iter_{iteration}.zip"
    defender_src = f"{prod_dir}/defender_iter_{iteration}.zip"
    
    attacker_dst = f"{prod_dir}/attacker_best.zip"
    defender_dst = f"{prod_dir}/defender_best.zip"
    
    # Check source files exist
    if not os.path.exists(attacker_src):
        print(f"❌ Attacker model not found: {attacker_src}")
        return
    
    if not os.path.exists(defender_src):
        print(f"❌ Defender model not found: {defender_src}")
        return
    
    # Copy to best
    print(f"📋 Copying iteration {iteration} models...")
    shutil.copy(attacker_src, attacker_dst)
    shutil.copy(defender_src, defender_dst)
    
    # Update config
    config.update_best_models(iteration)
    
    print(f"✅ Iteration {iteration} is now the default/best model!")
    print(f"   Attacker: {attacker_dst}")
    print(f"   Defender: {defender_dst}")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python set_best_model.py <iteration_number>")
        print("Example: python set_best_model.py 24")
        sys.exit(1)
    
    iteration = int(sys.argv[1])
    set_best_model(iteration)
