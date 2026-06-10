#!/usr/bin/env python3
"""
tests_rl.py  –  Lightweight self-tests for the CyberX RL stack (v4 APT/SOC)
===========================================================================
No pytest dependency — plain asserts, exits non-zero on failure.

Run from src/server/rl:
    python tests_rl.py
"""

import sys
import traceback

import numpy as np

PASSED, FAILED = [], []


def test(fn):
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
    from shared_honeypot_env import SharedHoneypotEnv, ACTION_DIM, OBS_DIM
    for mode in ("attacker", "defender"):
        env = SharedHoneypotEnv(mode=mode, curriculum_level=2)
        assert env.action_space.n == ACTION_DIM
        assert env.observation_space.shape == (OBS_DIM,)
        check_env(env, warn=False)


@test
def seeded_trajectories_are_identical():
    from baselines import ScriptedDefender
    from shared_honeypot_env import SharedHoneypotEnv, ACTION_DIM

    def rollout(seed, n_episodes=5):
        env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                                opponent_model=ScriptedDefender())
        trace = []
        obs, _ = env.reset(seed=seed)
        for _ in range(n_episodes):
            done = False
            while not done:
                action = env.current_step % ACTION_DIM   # cyclic, hits every action
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
            return np.array([3]), ("h", "c")

    fake = FakeModel()
    opp = StatefulOpponent(fake)
    obs = np.zeros(12, dtype=np.float32)
    a, _ = opp.predict(obs)
    assert a == 3
    opp.predict(obs)
    assert fake.seen_states == [None, ("h", "c")], "state not threaded"
    opp.reset()
    opp.predict(obs)
    assert fake.seen_states[-1] is None, "reset() did not clear state"


@test
def win_conditions_exclusive_and_rewards_bounded():
    from baselines import RandomDefender
    from shared_honeypot_env import SharedHoneypotEnv

    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                            opponent_model=RandomDefender())
    obs, _ = env.reset(seed=7)
    rng = np.random.default_rng(7)
    for _ in range(60):
        done, info = False, {}
        while not done:
            obs, r, term, trunc, info = env.step(int(rng.integers(0, env.action_space.n)))
            assert np.isfinite(r) and abs(r) <= 45, f"reward out of range: {r}"
            assert obs.shape == (12,) and obs.min() >= 0.0 and obs.max() <= 1.0
            done = term or trunc
        assert not (info["attacker_win"] and info["defender_win"]), \
            "both sides won the same episode"
        obs, _ = env.reset()


@test
def stealth_evasion_lowers_suspicion():
    """Defense-evasion must reduce the attacker's suspicion when it succeeds."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, RewardConfig, A_DEFENSE_EVASION, D_MONITOR,
    )

    class NoOpDefender:
        def predict(self, obs, deterministic=True):
            return D_MONITOR, None

    # Force evasion to succeed so the assertion is deterministic
    rw = RewardConfig(evasion_success=1.0)
    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                            opponent_model=NoOpDefender(), rewards=rw)
    env.reset(seed=3)
    env.true_state["suspicion"] = 10.0
    before = env.true_state["suspicion"]
    env.step(A_DEFENSE_EVASION)
    assert env.true_state["suspicion"] < before, "evasion did not lower suspicion"


@test
def investigation_builds_evidence_and_block_evicts():
    """Investigating converts suspicion into evidence; a justified hard block
    fully evicts an attacker with no persistence → defender win."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_WAIT, D_INVESTIGATE, D_HARD_BLOCK, STAGE_FOOTHOLD,
    )

    # We drive the DEFENDER; a passive attacker that just sits at FOOTHOLD.
    class IdleAttacker:
        def predict(self, obs, deterministic=True):
            return A_WAIT, None

    env = SharedHoneypotEnv(mode="defender", curriculum_level=2,
                            opponent_model=IdleAttacker())
    env.reset(seed=11)
    env.true_state["stage"] = STAGE_FOOTHOLD
    env.true_state["suspicion"] = 25.0   # plenty of evidence to extract
    env.true_state["persistence"] = False

    # Investigate until evidence clears the hard-block threshold
    done = False
    for _ in range(10):
        env.true_state["suspicion"] = max(env.true_state["suspicion"], 20.0)
        _, _, term, trunc, info = env.step(D_INVESTIGATE)
        if env.true_state["evidence"] >= env.rw.contain_block_evid:
            break
        done = term or trunc
        if done:
            break
    assert env.true_state["evidence"] >= env.rw.contain_block_evid, "evidence never built"

    _, r, term, trunc, info = env.step(D_HARD_BLOCK)
    assert env.true_state["evicted"], "justified hard block did not evict"
    assert term and info["defender_win"] and not info["attacker_win"]


@test
def persistence_survives_containment():
    """With persistence established, a hard block knocks the attacker back to
    FOOTHOLD instead of fully evicting — the episode continues."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_WAIT, D_HARD_BLOCK, STAGE_PRIVILEGED, STAGE_FOOTHOLD,
    )

    class IdleAttacker:
        def predict(self, obs, deterministic=True):
            return A_WAIT, None

    env = SharedHoneypotEnv(mode="defender", curriculum_level=2,
                            opponent_model=IdleAttacker())
    env.reset(seed=5)
    env.true_state["stage"] = STAGE_PRIVILEGED
    env.true_state["persistence"] = True
    env.true_state["evidence"] = env.rw.contain_block_evid + 1.0

    env.step(D_HARD_BLOCK)
    assert not env.true_state["evicted"], "persistence should survive eviction"
    assert env.true_state["stage"] == STAGE_FOOTHOLD, "should be knocked to FOOTHOLD"


@test
def curriculum_mask_remaps_out_of_scope_actions():
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_LATERAL, A_WAIT, D_RESTORE_BACKUP, D_MONITOR,
    )
    # Attacker: lateral movement is outside the level-0 mask → WAIT
    env = SharedHoneypotEnv(mode="attacker", curriculum_level=0)
    env.reset(seed=1)
    _, _, _, _, info = env.step(A_LATERAL)
    assert info["att_action"] == A_WAIT, "attacker out-of-mask not remapped to WAIT"

    # Defender: restore-backup is outside the level-0 mask → MONITOR
    env = SharedHoneypotEnv(mode="defender", curriculum_level=0)
    env.reset(seed=1)
    _, _, _, _, info = env.step(D_RESTORE_BACKUP)
    assert info["def_action"] == D_MONITOR, "defender out-of-mask not remapped to MONITOR"


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
        env.step(0)
    lvl = env.set_curriculum_level(0)
    assert lvl == 0 and env.noise_rate == 0.0 and env.max_steps == 60


@test
def reward_config_is_overridable():
    from shared_honeypot_env import SharedHoneypotEnv, RewardConfig, A_IMPACT, STAGE_PRIVILEGED

    class NoOpDefender:
        def predict(self, obs, deterministic=True):
            return 0, None

    custom = RewardConfig(r_impact_win=100.0)
    env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                            opponent_model=NoOpDefender(), rewards=custom)
    env.reset(seed=11)
    env.true_state["stage"] = STAGE_PRIVILEGED
    _, r, term, _, info = env.step(A_IMPACT)
    assert info["attacker_win"] and r > 90.0, f"custom impact reward not applied (r={r})"


@test
def defender_observation_layout_matches_adapter():
    from shared_honeypot_env import defender_observation, OBS_DIM
    obs = defender_observation(
        observed_anomalies=100, evidence=100, failed_logins=100,
        step_fraction=0.5, egress_volume=100, alerts=100, decoys_deployed=100,
        decoy_tripped=True, containment_active=True, hosts_anomalous=100,
        credential_anomaly=True, rate_limited=True,
    )
    assert obs.shape == (OBS_DIM,) and obs.dtype == np.float32
    assert obs.min() >= 0.0 and obs.max() <= 1.0

    from telemetry_adapter import TelemetryAdapter
    got = TelemetryAdapter.summarize([
        {"_source": {"eventid": "cowrie.login.failed", "session": "s1",
                     "src_ip": "1.2.3.4"}},
        {"_source": {"eventid": "cowrie.command.input", "input": "sudo nmap -p-"}},
        {"_source": {"eventid": "cowrie.session.file_download"}},
    ])
    assert got["failed_logins"] == 1 and got["downloads"] == 1
    assert got["port_scan"] == 1 and got["priv_esc_attempts"] == 1


@test
def config_loads_and_validates():
    from config_loader import ConfigError, RLConfig, get_config
    cfg = get_config()
    assert cfg.ppo.gamma == 0.99
    assert set(cfg.ppo.ent_coef) == {"attacker", "defender"}
    assert cfg.curriculum.eval_episodes_for(2, 50) == 50
    assert cfg.league.ghost_pool_max > 0

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
    from agents import RLAgent
    from baselines import ScriptedAttacker, ScriptedDefender
    from config_loader import get_config
    from shared_honeypot_env import SharedHoneypotEnv
    from vec_env_factory import make_vec_env

    cfg = get_config()
    env = make_vec_env("attacker", 1, 0,
                       opponent_names=["scripted_defender"], use_subprocess=False)
    agent = RLAgent(env, "attacker", cfg.ppo, device="cpu", seed=0)
    bc_env = SharedHoneypotEnv(mode="attacker", curriculum_level=0,
                               opponent_model=ScriptedDefender())
    bc_env.reset(seed=0)
    agent.pretrain_on_expert(ScriptedAttacker(), bc_env,
                             num_episodes=4, epochs=1, batch_episodes=2)
    a, _ = agent.predict(np.zeros(12, dtype=np.float32))
    assert 0 <= a < env.action_space.n
    env.close()


@test
def evaluator_runs_on_cpu_clones():
    import shutil, tempfile
    import torch
    from agents import RLAgent
    from config_loader import get_config
    from evaluator import MARLEvaluator
    from vec_env_factory import make_vec_env

    device = "cuda" if torch.cuda.is_available() else "cpu"
    cfg = get_config()
    att_env = make_vec_env("attacker", 1, 0,
                           opponent_names=["scripted_defender"], use_subprocess=False)
    def_env = make_vec_env("defender", 1, 0,
                           opponent_names=["scripted_attacker"], use_subprocess=False)
    att = RLAgent(att_env, "attacker", cfg.ppo, device=device, seed=0)
    dfn = RLAgent(def_env, "defender", cfg.ppo, device=device, seed=1)
    att.predict(np.zeros(12, dtype=np.float32))   # trigger cuDNN LSTM flatten
    dfn.predict(np.zeros(12, dtype=np.float32))
    before = [p.data_ptr() for p in att.model.policy.parameters()]
    tmp = tempfile.mkdtemp()
    try:
        ev = MARLEvaluator(save_dir=tmp)
        m = ev.evaluate_iteration(
            iteration=1, attacker=att, defender=dfn,
            baselines_att={}, baselines_def={},
            n_episodes=2, curriculum_level=0, silent=True,
        )
        assert m["main_match"]["n_episodes"] == 2
        after = [p.data_ptr() for p in att.model.policy.parameters()]
        assert before == after, "eval moved/reallocated the live training model"
    finally:
        att_env.close(); def_env.close()
        shutil.rmtree(tmp, ignore_errors=True)


@test
def game_is_decidable_both_ways():
    """Robustness/balance check: across scripted matchups, BOTH the attacker
    and the defender must win some episodes (and not everything is a draw).
    A degenerate game where one side always wins would fail here."""
    from baselines import (
        ScriptedAttacker, ScriptedDefender, ExpertAttacker, ExpertDefender,
        RandomDefender,
    )
    from shared_honeypot_env import SharedHoneypotEnv

    def run(att_cls, def_cls, n=40, seed0=100):
        att_wins = def_wins = draws = 0
        env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                                opponent_model=def_cls())
        for k in range(n):
            attacker = att_cls()
            obs, _ = env.reset(seed=seed0 + k)
            attacker.seed(seed0 + k)
            done, info = False, {}
            while not done:
                a, _ = attacker.predict(obs)
                obs, _, term, trunc, info = env.step(int(a))
                done = term or trunc
            if info["attacker_win"]:
                att_wins += 1
            elif info["defender_win"]:
                def_wins += 1
            else:
                draws += 1
        return att_wins, def_wins, draws

    # Weak defender → attacker should win plenty
    aw1, dw1, dr1 = run(ScriptedAttacker, RandomDefender)
    # Strong defender → defender should win plenty
    aw2, dw2, dr2 = run(ScriptedAttacker, ExpertDefender)
    aw3, dw3, dr3 = run(ExpertAttacker, ExpertDefender)

    total_att = aw1 + aw2 + aw3
    total_def = dw1 + dw2 + dw3
    print(f"      decidability: scripted-vs-random {aw1}/{dw1}/{dr1}, "
          f"scripted-vs-expert {aw2}/{dw2}/{dr2}, "
          f"expert-vs-expert {aw3}/{dw3}/{dr3} (A/D/draw)")
    assert total_att >= 5, f"attacker almost never wins ({total_att})"
    assert total_def >= 5, f"defender almost never wins ({total_def})"
    assert aw1 >= 1, "attacker cannot beat a random defender — game too hard"


# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\n  {len(PASSED)} passed, {len(FAILED)} failed\n")
    if FAILED:
        print("  Failed:", ", ".join(FAILED))
        sys.exit(1)
    sys.exit(0)
