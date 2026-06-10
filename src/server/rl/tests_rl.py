#!/usr/bin/env python3
"""
tests_rl.py  –  Lightweight self-tests for the CyberX RL stack
===============================================================
No pytest dependency — plain asserts, exits non-zero on failure.

Run from src/server/rl:
    python tests_rl.py
"""

import sys
import traceback

import numpy as np

PASSED, FAILED = [], []


def test(fn):
    """Run a test function, record the result."""
    try:
        fn()
        PASSED.append(fn.__name__)
        print(f"  PASS  {fn.__name__}")
    except Exception:
        FAILED.append(fn.__name__)
        print(f"  FAIL  {fn.__name__}")
        traceback.print_exc()
    return fn


# ══════════════════════════════════════════════════════════════════════════════

@test
def env_passes_sb3_checker():
    from stable_baselines3.common.env_checker import check_env
    from shared_honeypot_env import SharedHoneypotEnv
    for mode in ("attacker", "defender"):
        check_env(SharedHoneypotEnv(mode=mode, curriculum_level=2), warn=False)


@test
def seeded_trajectories_are_identical():
    from baselines import ScriptedDefender
    from shared_honeypot_env import SharedHoneypotEnv

    def rollout(seed, n_episodes=5):
        env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                                opponent_model=ScriptedDefender())
        trace = []
        obs, _ = env.reset(seed=seed)
        for _ in range(n_episodes):
            done = False
            while not done:
                # Fixed cyclic policy — exercises every action
                action = env.current_step % 10
                obs, r, term, trunc, info = env.step(action)
                trace.append((tuple(np.round(obs, 6)), round(r, 6),
                              term, trunc, info["def_action"]))
                done = term or trunc
            obs, _ = env.reset()
        return trace

    assert rollout(42) == rollout(42), "same seed → different trajectories"
    assert rollout(42) != rollout(43), "different seeds → identical trajectories"


@test
def stateful_opponent_threads_and_resets_state():
    from shared_honeypot_env import StatefulOpponent

    class FakeModel:
        def __init__(self):
            self.seen_states = []

        def predict(self, obs, state=None, deterministic=True):
            self.seen_states.append(state)
            return np.array([3]), ("h", "c")   # fake next lstm state

    fake = FakeModel()
    opp = StatefulOpponent(fake)
    obs = np.zeros(8, dtype=np.float32)

    a, _ = opp.predict(obs)
    assert a == 3
    opp.predict(obs)
    assert fake.seen_states == [None, ("h", "c")], "state not threaded"
    opp.reset()
    opp.predict(obs)
    assert fake.seen_states[-1] is None, "reset() did not clear state"


@test
def win_conditions_are_exclusive_and_rewards_bounded():
    from baselines import RandomDefender
    from shared_honeypot_env import SharedHoneypotEnv

    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                            opponent_model=RandomDefender())
    obs, _ = env.reset(seed=7)
    rng = np.random.default_rng(7)
    for _ in range(40):   # 40 episodes of random attacker play
        done = False
        while not done:
            obs, r, term, trunc, info = env.step(int(rng.integers(0, 10)))
            assert np.isfinite(r) and abs(r) <= 40, f"reward out of range: {r}"
            assert obs.shape == (8,) and obs.min() >= 0.0 and obs.max() <= 1.0
            done = term or trunc
        assert not (info["attacker_win"] and info["defender_win"]), \
            "both sides won the same episode"
        if info["defender_win"]:
            assert info["justified_blocks"] >= 1, \
                "defender won without a justified block"
        obs, _ = env.reset()


@test
def rate_limit_persists_for_duration():
    from shared_honeypot_env import SharedHoneypotEnv

    class BlockingDefender:
        """Rate-limits on step 1, hard-blocks on step 2, monitors after."""
        def __init__(self):
            self.t = 0
        def predict(self, observation, deterministic=True):
            self.t += 1
            return (1 if self.t == 1 else 3 if self.t == 2 else 0), None

    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                            opponent_model=BlockingDefender())
    env.reset(seed=3)
    # Force the justification thresholds: simulate prior suspicious activity
    env.true_state["suspicious_events"] = 6
    env.true_state["files_downloaded"] = 1

    env.step(9)   # defender rate-limits (justified: susp >= 2)
    assert env.true_state["rate_limit_steps"] > 0, "rate limit not applied"
    rl_after_limit = env.true_state["rate_limit_steps"]

    env.step(9)   # defender hard-blocks — v2 used to clear the rate limit here
    assert env.true_state["rate_limit_steps"] == rl_after_limit - 1, \
        "block clobbered the rate-limit duration counter"
    assert env.true_state["justified_blocks"] >= 1


@test
def curriculum_mask_remaps_to_wait():
    from shared_honeypot_env import SharedHoneypotEnv
    env = SharedHoneypotEnv(mode="attacker", curriculum_level=0)
    env.reset(seed=1)
    # Action 5 (backdoor) is outside the level-0 attacker mask [0, 3, 4, 9]
    _, _, _, _, info = env.step(5)
    assert info["att_action"] == 9, "out-of-mask action was not remapped to wait"


@test
def opponent_hot_swap_works():
    from baselines import OPPONENT_REGISTRY
    from shared_honeypot_env import SharedHoneypotEnv
    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2)
    env.reset(seed=5)
    for name in ("random_defender", "scripted_defender", "expert_defender"):
        assert env.set_scripted_opponent(name) == name
        assert type(env.opponent_model) is OPPONENT_REGISTRY[name]
        env.reset()
        env.step(0)   # must not raise
    lvl = env.set_curriculum_level(0)
    assert lvl == 0 and env.noise_rate == 0.0 and env.max_steps == 75


@test
def reward_config_is_overridable():
    from shared_honeypot_env import RewardConfig, SharedHoneypotEnv
    custom = RewardConfig(exfil_cap=1, exfil_after_cap=-9.0)
    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2, rewards=custom)
    env.reset(seed=11)
    env.true_state["kill_chain_level"] = 1   # USER access
    env.true_state["files_downloaded"] = 1   # already at custom cap
    _, r, _, _, info = env.step(3)           # exfil past cap
    if info["att_action"] == 3 and env.true_state["files_downloaded"] == 2:
        # not rate-limited / blocked this step → the cap penalty must show
        assert r < 0, f"post-cap exfil should be penalised, got r={r}"


@test
def defender_observation_layout_matches_adapter():
    from shared_honeypot_env import defender_observation
    obs = defender_observation(
        failed_logins=100, suspicious_events=100, is_blocked=True,
        step_fraction=0.5, files_downloaded=100, is_rate_limited=True,
        decoys_deployed=100, alerts_triggered=100,
    )
    assert obs.shape == (8,) and obs.dtype == np.float32
    assert obs.min() >= 0.0 and obs.max() <= 1.0, "normalization must clip to [0,1]"

    summary_keys = {"failed_logins", "suspicious_commands", "port_scan",
                    "priv_esc_attempts", "downloads", "n_sessions", "n_src_ips"}
    from telemetry_adapter import TelemetryAdapter
    got = TelemetryAdapter.summarize([
        {"_source": {"eventid": "cowrie.login.failed", "session": "s1",
                     "src_ip": "1.2.3.4"}},
        {"_source": {"eventid": "cowrie.command.input", "input": "sudo nmap -p-"}},
        {"_source": {"eventid": "cowrie.session.file_download"}},
    ])
    assert set(got) == summary_keys
    assert got["failed_logins"] == 1 and got["downloads"] == 1
    assert got["port_scan"] == 1 and got["priv_esc_attempts"] == 1


@test
def config_loads_and_validates():
    from config_loader import ConfigError, RLConfig, get_config
    cfg = get_config()
    assert cfg.ppo.gamma == 0.99
    assert set(cfg.ppo.ent_coef) == {"attacker", "defender"}
    assert cfg.curriculum.timesteps_for(0, 100_000) == 33_330 or \
           cfg.curriculum.timesteps_for(0, 100_000) >= 30_000
    assert cfg.curriculum.eval_episodes_for(2, 50) == 50   # 0 → fall back to base
    assert cfg.league.ghost_pool_max > 0

    # Validation must fail loudly on a missing key
    import json, os, tempfile
    with open(cfg.config_path) as f:
        raw = json.load(f)
    del raw["ppo"]["gamma"]
    fd, path = tempfile.mkstemp(suffix=".json"); os.close(fd)
    with open(path, "w") as f:
        json.dump(raw, f)
    try:
        RLConfig(path)
        assert False, "missing key should raise ConfigError"
    except ConfigError:
        pass
    finally:
        os.remove(path)


@test
def agents_build_and_bc_runs_one_epoch():
    """Smoke: RLAgent constructs on DummyVecEnv and sequence-BC does one
    epoch on a tiny expert dataset without erroring."""
    from agents import RLAgent
    from baselines import ScriptedAttacker, ScriptedDefender
    from config_loader import get_config
    from shared_honeypot_env import SharedHoneypotEnv
    from vec_env_factory import make_vec_env

    cfg = get_config()
    env = make_vec_env("attacker", 1, 0,
                       opponent_names=["scripted_defender"],
                       use_subprocess=False)
    agent = RLAgent(env, "attacker", cfg.ppo, device="cpu", seed=0)

    bc_env = SharedHoneypotEnv(mode="attacker", curriculum_level=0,
                               opponent_model=ScriptedDefender())
    bc_env.reset(seed=0)
    agent.pretrain_on_expert(ScriptedAttacker(), bc_env,
                             num_episodes=4, epochs=1, batch_episodes=2)
    a, _ = agent.predict(np.zeros(8, dtype=np.float32))
    assert 0 <= a <= 9
    env.close()


# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\n  {len(PASSED)} passed, {len(FAILED)} failed\n")
    if FAILED:
        print("  Failed:", ", ".join(FAILED))
        sys.exit(1)
    sys.exit(0)
