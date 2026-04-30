#!/usr/bin/env python3
"""
run_training.py  –  CyberX MARL Training Entry Point  (v2.1)
==============================================================
The if __name__ == "__main__" guard at the bottom is CRITICAL on Windows.
SubprocVecEnv uses the 'spawn' start method, which re-imports this module
in each worker process. Without the guard, workers try to re-run main(),
causing infinite process spawning and deadlock.

Usage:
  python run_training.py --mode smoke
  python run_training.py --mode dev --no-bc
  python run_training.py --mode full
  python run_training.py --mode full --resume
  python run_training.py --mode full --no-parallel   # disable SubprocVecEnv
"""

import argparse
import json
import multiprocessing
import os


def load_config(config_path: str = "config.json") -> dict:
    if os.path.exists(config_path):
        with open(config_path) as f:
            return json.load(f)
    return {}


def main():
    parser = argparse.ArgumentParser(
        description="CyberX MARL Training System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--mode",
        choices=["smoke", "dev", "full", "custom"], default="custom")
    parser.add_argument("--iterations",    type=int,   default=None)
    parser.add_argument("--timesteps",     type=int,   default=None)
    parser.add_argument("--eval-episodes", type=int,   default=None)
    parser.add_argument("--save-dir",      type=str,   default="./models/cyberx_marl")
    parser.add_argument("--no-bc",         action="store_true")
    parser.add_argument("--llm-oracle",    action="store_true")
    parser.add_argument("--llm-provider",
        choices=["gemini", "ollama", "anthropic", "openai"], default=None)
    parser.add_argument("--device",        type=str,   default="auto")
    parser.add_argument("--resume",        action="store_true")
    parser.add_argument("--no-parallel",   action="store_true",
        help="Disable SubprocVecEnv (fallback to DummyVecEnv)")
    args = parser.parse_args()

    PRESETS = {
        "smoke": dict(iterations=2,  timesteps=5_000,   eval_episodes=10,  run_bc=False),
        "dev":   dict(iterations=10, timesteps=20_000,  eval_episodes=20,  run_bc=True),
        "full":  dict(iterations=50, timesteps=100_000, eval_episodes=50,  run_bc=True),
    }
    if args.mode in PRESETS:
        p         = PRESETS[args.mode]
        n_iters   = args.iterations    or p["iterations"]
        timesteps = args.timesteps     or p["timesteps"]
        eval_eps  = args.eval_episodes or p["eval_episodes"]
        run_bc    = (not args.no_bc)   and p["run_bc"]
    else:
        n_iters   = args.iterations    or 30
        timesteps = args.timesteps     or 100_000
        eval_eps  = args.eval_episodes or 50
        run_bc    = not args.no_bc

    cfg        = load_config()
    llm_config = cfg.get("llm", {})
    run_llm    = args.llm_oracle or llm_config.get("enabled", False)
    llm_config["enabled"] = run_llm
    if args.llm_provider:
        llm_config["provider"] = args.llm_provider
    display_provider = llm_config.get("provider", "not configured")

    if run_llm:
        env_keys = {"gemini": "GEMINI_API_KEY", "anthropic": "ANTHROPIC_API_KEY",
                    "openai": "OPENAI_API_KEY", "ollama": None}
        env_key = env_keys.get(display_provider)
        if env_key and not os.environ.get(env_key) and not llm_config.get("api_key"):
            print(f"  Warning: {env_key} not set. LLM oracle disabled.")
            llm_config["enabled"] = False
            run_llm = False

    use_parallel = not args.no_parallel
    resume_note  = "  (resuming from saved state)" if args.resume else ""

    print(f"""
╔══════════════════════════════════════════════════════════╗
║         CyberX MARL  –  Training Configuration          ║
╠══════════════════════════════════════════════════════════╣
║  Mode:              {args.mode:<36} ║
║  Iterations:        {n_iters:<36,} ║
║  Timesteps/iter:    {timesteps:<36,} ║
║  Eval episodes:     {eval_eps:<36} ║
║  Behavioral cloning:{str(run_bc):<36} ║
║  LLM oracle:        {str(run_llm):<36} ║
║  LLM provider:      {display_provider:<36} ║
║  Device:            {args.device:<36} ║
║  Resume:            {str(args.resume):<36} ║
║  Parallel envs:     {str(use_parallel):<36} ║
║  Save dir:          {args.save_dir:<36} ║
╚══════════════════════════════════════════════════════════╝
  Total PPO steps ≈ {n_iters * timesteps * 2:,}  (both agents){resume_note}
""")

    from trainer import MARLTrainer

    trainer = MARLTrainer(
        save_dir      = args.save_dir,
        llm_config    = llm_config,
        device        = args.device,
        use_subprocess= use_parallel,
    )

    history = trainer.train(
        n_iterations         = n_iters,
        timesteps_per_iter   = timesteps,
        eval_episodes        = eval_eps,
        run_bc_phase         = run_bc,
        run_llm_oracle_phase = run_llm,
        resume               = args.resume,
    )

    if not trainer._pause_requested:
        print(f"\n  Training complete!")
        print(f"  Best models:  {args.save_dir}/attacker_best.zip")
        print(f"                {args.save_dir}/defender_best.zip")
        print(f"  Results:      {args.save_dir}/results/")
        print(f"\n  TensorBoard:  tensorboard --logdir ./logs")


# ── CRITICAL: this guard prevents SubprocVecEnv workers from re-running ───────
# On Windows, spawn re-imports this module in every worker process.
# Without this guard, each worker calls main() again → infinite loop → deadlock.
if __name__ == "__main__":
    multiprocessing.freeze_support()   # needed for frozen (PyInstaller) builds
    main()