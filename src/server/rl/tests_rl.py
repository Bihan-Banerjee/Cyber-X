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
def sustained_containment_wins_no_instant_eviction():
    """A single justified hard block knocks the attacker back but does NOT
    evict (no instant kill). The defender wins only after the configured
    number of evidence-backed containments."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_WAIT, D_HARD_BLOCK, STAGE_FOOTHOLD, STAGE_RECON,
    )

    class IdleAttacker:
        def predict(self, obs, deterministic=True):
            return A_WAIT, None

    env = SharedHoneypotEnv(mode="defender", curriculum_level=2,
                            opponent_model=IdleAttacker())
    env.reset(seed=11)
    env.true_state["persistence"] = False
    assert env.rw.containments_to_win == 2

    # First containment — knock-back, not a win
    env.true_state["stage"] = STAGE_FOOTHOLD
    env.true_state["evidence"] = 8.0
    _, _, term, _, info = env.step(D_HARD_BLOCK)
    assert env.true_state["stage"] == STAGE_RECON, "no-persistence block → RECON"
    assert env.true_state["justified_containments"] == 1
    assert not term, "one containment is not a win"

    # Second containment — sustained control → defender win
    env.true_state["stage"] = STAGE_FOOTHOLD
    env.true_state["evidence"] = 8.0
    _, _, term, _, info = env.step(D_HARD_BLOCK)
    assert env.true_state["justified_containments"] == 2
    assert term and info["defender_win"] and not info["attacker_win"]


@test
def persistence_softens_containment():
    """A hard block against a persistent attacker only knocks it to FOOTHOLD
    (it keeps a foothold); without persistence it goes back to RECON."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_WAIT, D_HARD_BLOCK, STAGE_PRIVILEGED,
        STAGE_FOOTHOLD, STAGE_RECON,
    )

    class IdleAttacker:
        def predict(self, obs, deterministic=True):
            return A_WAIT, None

    for persistence, expected in ((True, STAGE_FOOTHOLD), (False, STAGE_RECON)):
        env = SharedHoneypotEnv(mode="defender", curriculum_level=2,
                                opponent_model=IdleAttacker())
        env.reset(seed=5)
        env.true_state["stage"] = STAGE_PRIVILEGED
        env.true_state["persistence"] = persistence
        env.true_state["evidence"] = 8.0
        env.step(D_HARD_BLOCK)
        assert env.true_state["stage"] == expected, \
            f"persistence={persistence} → expected stage {expected}"


@test
def camping_is_not_optimal():
    """THE regression guard for the v4.0 collapse: an attacker that reaches
    PRIVILEGED and then dwells must score strictly LESS than one that
    completes the objective. If camping ever pays more, RL rationally learns
    to never finish (which is exactly what happened at iteration 3)."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_WAIT, A_IMPACT, STAGE_PRIVILEGED, D_MONITOR,
    )

    class NoOpDefender:
        def predict(self, obs, deterministic=True):
            return D_MONITOR, None

    def run(finish):
        env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                                opponent_model=NoOpDefender())
        env.reset(seed=1)
        env.true_state["stage"] = STAGE_PRIVILEGED
        total = 0.0
        for t in range(env.max_steps):
            a = A_IMPACT if (finish and t == 0) else A_WAIT
            _, r, term, trunc, _ = env.step(a)
            total += r
            if term or trunc:
                break
        return total

    finish_return = run(True)
    camp_return = run(False)
    assert finish_return > camp_return, \
        f"camping ({camp_return:.1f}) must not beat finishing ({finish_return:.1f})"


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
def soc_state_closes_the_observation_loop():
    """The shadow evaluation fed the policy a frozen defense_state, so 7 of 12
    observation dims never moved and the defender emitted one action forever.
    SocState exists to close that loop; guard the three properties that matter:
    evidence accrues from investigation, containment fires once it clears the
    threshold and consumes it, and the state decays back down."""
    from soc_state import SocState
    from shared_honeypot_env import (
        DEFAULT_REWARDS, D_HARD_BLOCK, D_INVESTIGATE, D_ISOLATE, D_THREAT_HUNT,
    )

    busy = {"suspicious_commands": 6, "port_scan": 1, "priv_esc_attempts": 2,
            "failed_logins": 12, "downloads": 1, "n_sessions": 4, "n_src_ips": 3}
    quiet = {"suspicious_commands": 0, "port_scan": 0, "priv_esc_attempts": 0,
             "failed_logins": 0, "downloads": 0, "n_sessions": 0, "n_src_ips": 0}

    soc = SocState()
    assert soc.as_defense_state()["evidence"] == 0.0

    # Investigating a noisy window must build evidence.
    soc.advance(D_INVESTIGATE, busy)
    first = soc.evidence
    assert first > 0.0, "investigate built no evidence on a noisy window"

    # Containment must be refused below the threshold, and must not silently
    # succeed — that refusal is what makes the policy keep hunting.
    soc.evidence = DEFAULT_REWARDS.contain_isolate_evid - 0.5
    out = soc.advance(D_ISOLATE, busy)
    assert out["effect"] == "insufficient_evidence", out
    assert soc.justified_containments == 0

    # Above the threshold it fires and consumes the evidence that justified it.
    soc.evidence = DEFAULT_REWARDS.contain_isolate_evid + 1.0
    out = soc.advance(D_ISOLATE, busy)
    assert out["effect"] == "contained", out
    assert soc.justified_containments == 1
    assert soc.evidence == 0.0, "containment did not consume its evidence"
    assert soc.as_defense_state()["containment_active"] is True

    # A second containment in the same tick window is refused (cooldown), so
    # block-spam can't manufacture a win.
    out = soc.advance(D_HARD_BLOCK, busy)
    assert out["effect"] == "response_in_progress", out

    # Evidence must decay, or the state ratchets up and never returns.
    soc.evidence = 5.0
    soc.decay()
    assert soc.evidence < 5.0, "evidence did not decay"

    # A dry hunt on a quiet window yields nothing (non-farmable, per §9).
    soc.reset()
    out = soc.advance(D_THREAT_HUNT, quiet)
    assert out["effect"] == "hunt_dry" and soc.evidence == 0.0, out


@test
def pfsp_prioritizes_losses_without_starving_the_pool():
    """PFSP must concentrate on opponents that beat us AND keep full support.

    Both halves matter. Weighting toward hard opponents is the point; but a
    ghost that drops to zero probability can never be re-measured, and a league
    that collapses onto one opponent recreates exactly the specialization
    pressure it exists to prevent (PROJECT_CONTEXT.md §5, v3 league notes).
    """
    import random as _random
    from config_loader import get_config
    from trainer import MARLTrainer

    ghosts = ["ghosts/def_1.zip", "ghosts/def_2.zip", "ghosts/def_3.zip"]
    record = {
        # We lose almost every game to #1, win almost every game against #3.
        "rl:ghosts/def_1.zip": {"wins": 1, "losses": 19, "draws": 0},
        "rl:ghosts/def_2.zip": {"wins": 10, "losses": 10, "draws": 0},
        "rl:ghosts/def_3.zip": {"wins": 19, "losses": 1, "draws": 0},
    }

    trainer = MARLTrainer.__new__(MARLTrainer)          # no envs / no GPU
    trainer.cfg = get_config()
    trainer._opponent_record = {"attacker": record, "defender": {}}

    weights = trainer._pfsp_weights("attacker", ghosts)
    assert weights[0] > weights[1] > weights[2], (
        f"weights not ordered by loss rate: {weights}")
    assert all(w > 0.0 for w in weights), f"a ghost was starved: {weights}"

    # An opponent below min_games must keep the neutral weight rather than let
    # one lucky episode capture the distribution.
    sparse = dict(record)
    sparse["rl:ghosts/def_1.zip"] = {"wins": 0, "losses": 1, "draws": 0}
    trainer._opponent_record["attacker"] = sparse
    neutral = trainer._pfsp_weights("attacker", ghosts)
    assert neutral[0] == 0.5 ** trainer.cfg.league.pfsp_p, (
        f"sparse opponent did not fall back to neutral: {neutral[0]}")

    # Sampling honours the weights on average and always returns k distinct
    # ghosts (the mix relies on distinctness to fill its slots).
    trainer._opponent_record["attacker"] = record
    weights = trainer._pfsp_weights("attacker", ghosts)
    rng = _random.Random(0)
    counts = {g: 0 for g in ghosts}
    for _ in range(2000):
        picked = MARLTrainer._weighted_sample_without_replacement(
            ghosts, weights, 1, rng)
        assert len(picked) == 1
        counts[picked[0]] += 1
    assert counts[ghosts[0]] > counts[ghosts[2]], (
        f"hard opponent not sampled more often: {counts}")
    assert all(c > 0 for c in counts.values()), f"pool starved in sampling: {counts}"

    two = MARLTrainer._weighted_sample_without_replacement(
        ghosts, weights, 2, _random.Random(1))
    assert len(two) == 2 and len(set(two)) == 2, f"duplicate ghosts drawn: {two}"

    # Uniform sampling must still be reachable — it is the control arm.
    assert trainer.cfg.league.pfsp_enabled is False, (
        "config.json ships with PFSP on; the before/after baseline needs it off")


@test
def attack_grounding_matches_env_and_frontend():
    """The grounding table is cited in the paper and rendered in the Copilot.
    Those two must not drift from each other or from the env's action order."""
    import os
    import re
    from attack_grounding import ATTACKER_GROUNDING, DEFENDER_GROUNDING
    from shared_honeypot_env import ATT_ACTION_NAMES, DEF_ACTION_NAMES

    # 1. Order and names must match the env exactly — the tables are indexed by
    #    raw policy action id, so an off-by-one mislabels every recommendation.
    assert [g.action for g in ATTACKER_GROUNDING] == ATT_ACTION_NAMES, (
        "attacker grounding is out of sync with ATT_ACTION_NAMES")
    assert [g.action for g in DEFENDER_GROUNDING] == DEF_ACTION_NAMES[:12], (
        "defender grounding is out of sync with DEF_ACTION_NAMES")

    # 2. IDs must look like real ATT&CK / D3FEND identifiers, or be explicitly
    #    unmapped. An approximate ID in a paper table is worse than a blank.
    for g in ATTACKER_GROUNDING:
        assert g.technique is None or re.fullmatch(r"T\d{4}(\.\d{3})?", g.technique), \
            f"{g.action}: {g.technique!r} is not an ATT&CK technique id"
        assert (g.technique is None) == (g.name is None), \
            f"{g.action}: id and name must both be set or both be None"
    for g in DEFENDER_GROUNDING:
        assert g.technique is None or re.fullmatch(r"D3-[A-Z]{2,5}", g.technique), \
            f"{g.action}: {g.technique!r} is not a D3FEND technique id"
        assert (g.technique is None) == (g.name is None), \
            f"{g.action}: id and name must both be set or both be None"

    # 3. The frontend map must agree. Parsed rather than imported — there is no
    #    Node in this test run, and a regex over the literal is enough to catch
    #    the drift this guard exists for.
    ts_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "..", "..", "data", "defenderActionMap.ts")
    with open(os.path.abspath(ts_path), encoding="utf-8") as f:
        ts = f.read()
    entries = re.findall(
        r'action:\s*"([a-z_]+)",.*?d3fendId:\s*(null|"[^"]*"),\s*\n\s*'
        r'd3fend:\s*(null|"[^"]*"),',
        ts, re.S)
    assert len(entries) == 12, f"parsed {len(entries)} frontend entries, expected 12"

    for (ts_action, ts_id, ts_name), g in zip(entries, DEFENDER_GROUNDING):
        unquote = lambda v: None if v == "null" else v.strip('"')  # noqa: E731
        assert ts_action == g.action, f"order differs: {ts_action} vs {g.action}"
        assert unquote(ts_id) == g.technique, (
            f"{g.action}: frontend d3fendId {ts_id} != {g.technique}")
        assert unquote(ts_name) == g.name, (
            f"{g.action}: frontend d3fend {ts_name} != {g.name}")


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


@test
def repeatable_actions_are_not_farmable():
    """No repeatable action may yield a positive episode return for merely
    being spammed. This is the regression guard for the farm-collapse cycle
    (defense_evasion 96%, rate_limit 93%): each previously-flat reward is now
    one-time, outcome-proportional, or capped, so spamming it from a clean
    state must net out non-positive after the per-step time cost."""
    from shared_honeypot_env import (
        SharedHoneypotEnv, A_PASSIVE_RECON, A_DEFENSE_EVASION, A_DUMP_CREDS,
        A_COLLECT, D_MONITOR, D_RATE_LIMIT, STAGE_PRIVILEGED,
    )

    class NoOpDefender:
        def predict(self, obs, deterministic=True):
            return D_MONITOR, None

    class IdleAttacker:
        def predict(self, obs, deterministic=True):
            return 13, None   # A_WAIT

    def att_spam(action, setup=None):
        env = SharedHoneypotEnv(mode="attacker", curriculum_level=2,
                                opponent_model=NoOpDefender())
        env.reset(seed=2)
        if setup:
            setup(env)
        total = 0.0
        for _ in range(env.max_steps):
            _, r, term, trunc, _ = env.step(action)
            total += r
            if term or trunc:
                break
        return total

    # Attacker farms: each must be non-positive when spammed
    assert att_spam(A_PASSIVE_RECON) <= 0.0, "recon spam is farmable"
    assert att_spam(A_DEFENSE_EVASION) <= 0.0, "evasion spam is farmable (no suspicion to clear)"
    assert att_spam(A_DUMP_CREDS, lambda e: e.true_state.update(stage=STAGE_PRIVILEGED)) <= 5.5, \
        "dump_credentials re-pays (should fire once ~+5 then waste)"
    assert att_spam(A_COLLECT, lambda e: e.true_state.update(stage=STAGE_PRIVILEGED)) <= 3.5, \
        "collect_data re-pays (should fire once ~+3 then waste)"

    # Defender spam vs an idle attacker must be non-positive for every
    # repeatable action (rate_limit, investigate, threat_hunt). Evidence-
    # building actions are headroom-capped, so once evidence saturates (or
    # there's nothing to detect) they stop paying.
    from shared_honeypot_env import D_INVESTIGATE, D_THREAT_HUNT
    for act, label in ((D_RATE_LIMIT, "rate_limit"),
                       (D_INVESTIGATE, "investigate"),
                       (D_THREAT_HUNT, "threat_hunt")):
        env = SharedHoneypotEnv(mode="defender", curriculum_level=2,
                                opponent_model=IdleAttacker())
        env.reset(seed=2)
        total = 0.0
        for _ in range(env.max_steps):
            _, r, term, trunc, _ = env.step(act)
            total += r
            if term or trunc:
                break
        assert total <= 0.0, f"{label} spam is farmable (return {total:.1f})"


# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\n  {len(PASSED)} passed, {len(FAILED)} failed\n")
    if FAILED:
        print("  Failed:", ", ".join(FAILED))
        sys.exit(1)
    sys.exit(0)
