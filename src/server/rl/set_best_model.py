#!/usr/bin/env python3
"""
Set a specific checkpoint iteration as the best model.

Usage: python set_best_model.py <iteration_number>
"""

import os
import shutil
import sys

from config_loader import get_config


def set_best_model(iteration: int) -> None:
    config   = get_config()
    ckpt_dir = config.model_paths["checkpoints_dir"]

    attacker_src = f"{ckpt_dir}/attacker_iter_{iteration}.zip"
    defender_src = f"{ckpt_dir}/defender_iter_{iteration}.zip"
    attacker_dst = config.get_best_attacker_path()
    defender_dst = config.get_best_defender_path()

    for src in (attacker_src, defender_src):
        if not os.path.exists(src):
            print(f"Model not found: {src}")
            return

    print(f"Copying iteration {iteration} models...")
    shutil.copy(attacker_src, attacker_dst)
    shutil.copy(defender_src, defender_dst)

    print(f"Iteration {iteration} is now the best model:")
    print(f"  Attacker: {attacker_dst}")
    print(f"  Defender: {defender_dst}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python set_best_model.py <iteration_number>")
        sys.exit(1)
    set_best_model(int(sys.argv[1]))
