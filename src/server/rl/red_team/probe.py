#!/usr/bin/env python3
"""
red_team/probe.py  –  Out-of-class exploitability probe
========================================================
Freeze the trained RL defender and attack it with the autonomous LLM red-team
attacker. Reports the LLM attacker's win rate vs the defender and puts it next
to two references:
  • the CO-TRAINED attacker's win rate vs the same defender (the equilibrium),
  • the PPO best-response number from exploitability.py, if present in the run.

If the LLM attacker wins MORE than the co-trained attacker, an out-of-policy-
class adversary confirms (and quantifies) the defender's exploitability — a
materially stronger claim than a same-class PPO best-response alone.

Runnable with or without an LLM: without --llm (or with no provider reachable)
the attacker is the scripted ExpertAttacker fallback, and the report says so —
useful as a control, but not an out-of-class result.

Usage:
  python -m red_team.probe --run-dir models/sweep/seed_1 --episodes 50 --llm --provider ollama --model llama3.2:3b
  python -m red_team.probe --defender-model D.zip --episodes 30      # scripted fallback
Run from src/server/rl (so the flat sibling modules import).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _llm_config(args) -> Dict[str, Any]:
    from config_loader import get_config
    cfg = dict(get_config().get_llm_config())
    cfg["enabled"] = bool(args.llm)
    if args.provider:
        cfg["provider"] = args.provider
    if args.model:
        cfg["model"] = args.model
    return cfg


def showcase_episode(attacker, defender_model, seed: int, curriculum_level: int = 2) -> Dict[str, Any]:
    """Run ONE attacker-vs-defender episode and return the labeled step trace
    (what the Red-vs-Blue demo animates)."""
    from shared_honeypot_env import SharedHoneypotEnv, StatefulOpponent
    opp = StatefulOpponent(defender_model, deterministic=True)
    env = SharedHoneypotEnv(mode="attacker", opponent_model=opp,
                            curriculum_level=curriculum_level)
    env.reset(seed=seed)
    attacker.clear_trace()
    attacker.reset()
    obs, _ = env.reset()
    done = False
    while not done:
        act, _ = attacker.predict(obs, deterministic=True)
        obs, reward, term, trunc, info = env.step(act)
        if hasattr(attacker, "observe_reward"):
            attacker.observe_reward(reward)
        done = term or trunc
    return {
        "outcome": ("attacker_win" if info.get("attacker_win")
                    else "defender_win" if info.get("defender_win") else "draw"),
        "steps": info.get("step", env.current_step),
        "trace": list(attacker.trace),
    }


def main():
    p = argparse.ArgumentParser(description="Out-of-class (LLM) exploitability probe")
    p.add_argument("--run-dir", default=None,
                   help="Dir with attacker_best.zip / defender_best.zip")
    p.add_argument("--defender-model", default=None)
    p.add_argument("--attacker-model", default=None,
                   help="Co-trained attacker for the equilibrium reference")
    p.add_argument("--episodes", type=int, default=50)
    p.add_argument("--seed", type=int, default=2024)
    p.add_argument("--llm", action="store_true", help="Use the LLM (else scripted fallback)")
    p.add_argument("--provider", default=None, help="ollama|anthropic|gemini|openai")
    p.add_argument("--model", default=None)
    p.add_argument("--out", default=None)
    args = p.parse_args()

    def_path = args.defender_model or (
        os.path.join(args.run_dir, "defender_best.zip") if args.run_dir else None)
    att_path = args.attacker_model or (
        os.path.join(args.run_dir, "attacker_best.zip") if args.run_dir else None)
    if not def_path or not os.path.exists(def_path):
        sys.exit(f"  defender model not found: {def_path}")

    from exploitability import load_frozen, run_match
    from red_team.llm_attacker import RedTeamAttacker

    llm_cfg = _llm_config(args)
    attacker = RedTeamAttacker(llm_config=llm_cfg, seed=args.seed)
    kind = "LLM" if attacker.used_llm else "scripted-fallback"
    print(f"\n  Red-team attacker: {kind}"
          + (f" ({llm_cfg.get('provider')}/{llm_cfg.get('model')})" if attacker.used_llm else ""))
    print(f"  Defender under test: {def_path}")
    print(f"  Episodes: {args.episodes}\n")

    frozen_def = load_frozen(def_path)

    # LLM attacker vs RL defender (attacker is scripted-interface → _run_match
    # calls .predict/.reset; the defender is wrapped as the RL opponent).
    res = run_match(attacker, frozen_def, args.episodes, seed=args.seed)
    llm_att_wr = res["att_win_rate"]

    report: Dict[str, Any] = {
        "defender_model":   def_path,
        "attacker_kind":    kind,
        "llm":              attacker.used_llm,
        "provider":         llm_cfg.get("provider") if attacker.used_llm else None,
        "model":            llm_cfg.get("model") if attacker.used_llm else None,
        "episodes":         args.episodes,
        "llm_attacker_win_rate": round(llm_att_wr, 3),
    }

    # Reference 1: co-trained attacker vs the same defender (the equilibrium).
    if att_path and os.path.exists(att_path):
        eq = run_match(load_frozen(att_path), frozen_def, args.episodes, seed=args.seed)
        report["cotrained_attacker_win_rate"] = round(eq["att_win_rate"], 3)
        report["out_of_class_delta"] = round(llm_att_wr - eq["att_win_rate"], 3)

    # Reference 2: the PPO best-response number, if the run was probed.
    expl = os.path.join(args.run_dir, "exploitability_report.json") if args.run_dir else None
    if expl and os.path.exists(expl):
        try:
            with open(expl) as f:
                er = json.load(f)
            report["ppo_best_response_win_rate"] = (
                er.get("defender_exploitability", {}) or {}).get("exploitability")
        except (OSError, json.JSONDecodeError):
            pass

    # A clean single-episode labeled trace for the demo / write-up.
    show = showcase_episode(attacker, frozen_def.model, seed=args.seed + 1)
    report["showcase_episode"] = show

    # ── Print ────────────────────────────────────────────────────────────────
    print("  ── Result ─────────────────────────────────────────────")
    print(f"  {kind} attacker win rate vs defender : {llm_att_wr:.3f}")
    if "cotrained_attacker_win_rate" in report:
        print(f"  co-trained attacker win rate         : {report['cotrained_attacker_win_rate']:.3f}")
        print(f"  out-of-class delta                   : {report['out_of_class_delta']:+.3f}")
    if report.get("ppo_best_response_win_rate") is not None:
        print(f"  PPO best-response win rate           : {report['ppo_best_response_win_rate']:.3f}")
    print(f"\n  Showcase episode: {show['outcome']} in {show['steps']} steps")
    for t in show["trace"][:12]:
        print(f"    [{t['step']:>2}] {t['action_name']:<20} {t['technique_id']:<10} ({t['source']})  {t['reasoning']}")
    print()

    out = args.out or (os.path.join(args.run_dir, "red_team_probe.json")
                       if args.run_dir else "red_team_probe.json")
    with open(out, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"  Report saved → {out}\n")


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
