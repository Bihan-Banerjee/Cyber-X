#!/usr/bin/env python3
"""
run_training.py  –  CyberX MARL Training Entry Point  (v3.0)
==============================================================
The if __name__ == "__main__" guard at the bottom is CRITICAL on Windows.
SubprocVecEnv uses the 'spawn' start method, which re-imports this module
in each worker process. Without the guard, workers try to re-run main(),
causing infinite process spawning and deadlock.

Defaults come from config.json (see config_loader.py); CLI args override.

Usage:
  python run_training.py --mode smoke
  python run_training.py --mode dev --no-bc
  python run_training.py --mode full
  python run_training.py --mode full --resume
  python run_training.py --mode full --seed 7
  python run_training.py --mode full --no-parallel   # disable SubprocVecEnv
"""

import argparse
import multiprocessing
import os
import sys

# Windows consoles default to cp1252, which can't encode the banner's
# box-drawing characters
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def _supervise(argv: list, max_restarts: int) -> int:
    """Run training in a child process; relaunch with --resume on crashes.

    Only the child handles Ctrl+C (graceful pause → exit 0); the
    supervisor ignores SIGINT so it doesn't die mid-handoff and doesn't
    restart a deliberately paused run.
    """
    import signal
    import subprocess
    import time

    signal.signal(signal.SIGINT, signal.SIG_IGN)

    def _kill_tree(pid: int) -> None:
        """Kill the child AND its SubprocVecEnv workers. On Windows a crashed
        child leaves its worker grandchildren orphaned (~0.5 GB each); without
        this, repeated restarts pile workers up until the box runs out of RAM
        — which is exactly how an overnight run dies a second time."""
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                               capture_output=True)
            else:
                import signal as _sig
                os.killpg(os.getpgid(pid), _sig.SIGKILL)
        except Exception:
            pass

    base_cmd = [sys.executable, os.path.abspath(__file__)] + argv + ["--worker"]
    attempt = 0
    while True:
        cmd = list(base_cmd)
        if attempt > 0 and "--resume" not in cmd:
            cmd.append("--resume")
        proc = subprocess.Popen(cmd)
        try:
            code = proc.wait()
        except KeyboardInterrupt:
            _kill_tree(proc.pid)
            return 0
        if code == 0:
            return 0
        # Crash: reap any orphaned worker processes before relaunching
        _kill_tree(proc.pid)
        attempt += 1
        if attempt > max_restarts:
            print(f"\n  Training crashed {attempt} times (exit {code}) — "
                  f"giving up. Resume manually with --resume.")
            return code
        print(f"\n  Training crashed (exit {code}). "
              f"Restarting with --resume in 15s "
              f"(attempt {attempt}/{max_restarts})...\n")
        time.sleep(15)   # give the GPU driver a moment to recover


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
    parser.add_argument("--seed",          type=int,   default=None,
        help="Master seed (default: config.json seed)")
    parser.add_argument("--n-envs",        type=int,   default=None,
        help="Parallel env workers (default: config.json training.n_envs)")
    parser.add_argument("--no-bc",         action="store_true")
    parser.add_argument("--pfsp", dest="pfsp", action="store_true", default=None,
        help="Force PFSP league sampling on (overrides config.json)")
    parser.add_argument("--no-pfsp", dest="pfsp", action="store_false",
        help="Force uniform league sampling — the PFSP control arm")
    parser.add_argument("--ablate", action="append", default=[],
        choices=["bc", "curriculum", "league", "entropy_warmup"],
        help="Disable a component to measure its contribution. Repeatable; the "
             "value is recorded in trainer_state.json so runs stay identifiable.")
    parser.add_argument("--llm-oracle",    action="store_true")
    parser.add_argument("--llm-provider",
        choices=["gemini", "ollama", "anthropic", "openai"], default=None)
    parser.add_argument("--device",        type=str,   default=None)
    parser.add_argument("--resume",        action="store_true")
    parser.add_argument("--no-parallel",   action="store_true",
        help="Disable SubprocVecEnv (fallback to DummyVecEnv)")
    parser.add_argument("--max-restarts",  type=int, default=3,
        help="Auto-restart (with --resume) this many times if training "
             "crashes, e.g. on sporadic cuDNN/driver errors (default: 3)")
    parser.add_argument("--no-auto-restart", action="store_true",
        help="Disable the crash-restart supervisor")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    # ── Crash-restart supervisor ───────────────────────────────────────────
    # Sporadic CUDA/cuDNN errors (driver resets, TDR, thermal events on
    # laptop GPUs) can kill an overnight run hours in. State is saved after
    # every iteration, so the cheapest robust recovery is a fresh process
    # (fresh CUDA context) resuming from the last completed iteration.
    # The actual training runs in a child process; this parent only watches
    # the exit code. Exit 0 (completion or Ctrl+C pause) ends the loop.
    if not args.worker and not args.no_auto_restart:
        sys.exit(_supervise(sys.argv[1:], args.max_restarts))

    from config_loader import get_config
    cfg = get_config()

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
        n_iters   = args.iterations    or cfg.training.n_iterations
        timesteps = args.timesteps     or cfg.training.timesteps_per_iter
        eval_eps  = args.eval_episodes or cfg.training.eval_episodes
        run_bc    = (not args.no_bc)   and cfg.training.run_bc_phase

    llm_config = cfg.get_llm_config()
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

    # Ablations and the PFSP switch are applied to the loaded config so every
    # downstream consumer (trainer, saved state, W&B) sees one coherent view.
    if args.pfsp is not None:
        object.__setattr__(cfg.league, "pfsp_enabled", args.pfsp)
    ablations = set(args.ablate)
    if "bc" in ablations:
        run_bc = False
    if "league" in ablations:
        # Uniform ghosts only, no scripted exploiter slots and no latest-weights
        # slot: the league reduces to plain self-play against past snapshots.
        object.__setattr__(cfg.league, "pfsp_enabled", False)
        object.__setattr__(cfg.league, "scripted_slots", 0)
        object.__setattr__(cfg.league, "latest_slots", 0)
    if "entropy_warmup" in ablations:
        object.__setattr__(cfg.ppo, "warmup_iters", 0)

    seed         = args.seed if args.seed is not None else cfg.seed
    n_envs       = args.n_envs if args.n_envs is not None else cfg.training.n_envs
    device       = args.device or cfg.training.device
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
║  Device:            {device:<36} ║
║  Seed:              {seed:<36} ║
║  League sampling:   {('PFSP' if cfg.league.pfsp_enabled else 'uniform'):<36} ║
║  Ablations:         {(', '.join(sorted(ablations)) or 'none'):<36} ║
║  Resume:            {str(args.resume):<36} ║
║  Parallel envs:     {str(use_parallel) + f' (n={n_envs})':<36} ║
║  Save dir:          {args.save_dir:<36} ║
╚══════════════════════════════════════════════════════════╝
  Total PPO steps ≈ {n_iters * timesteps * 2:,}  (both agents){resume_note}
""")

    from trainer import MARLTrainer

    trainer = MARLTrainer(
        save_dir       = args.save_dir,
        n_envs         = n_envs,
        device         = device,
        llm_config     = llm_config,
        use_subprocess = use_parallel,
        seed           = seed,
        config         = cfg,
    )
    # Recorded in trainer_state.json so an archived run says what it was.
    trainer.ablations = sorted(ablations)
    if "curriculum" in ablations:
        # Skip straight to the full game: no gradual action unlock, no
        # promotion gate. This is the arm that measures what curriculum buys.
        trainer._curr_level = 2
        trainer._att_envs.env_method("set_curriculum_level", 2)
        trainer._def_envs.env_method("set_curriculum_level", 2)

    # Always close the env pools — on success, crash, or Ctrl+C — so the
    # n_envs×2 worker subprocesses never orphan and leak memory.
    try:
        trainer.train(
            n_iterations         = n_iters,
            timesteps_per_iter   = timesteps,
            eval_episodes        = eval_eps,
            run_bc_phase         = run_bc,
            run_llm_oracle_phase = run_llm,
            resume               = args.resume,
        )
    finally:
        trainer.close()

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
