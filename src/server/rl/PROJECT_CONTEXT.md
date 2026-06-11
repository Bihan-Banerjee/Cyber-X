# CyberX MARL — Project Context & Handoff

> Handoff doc for continuing work on the CyberX reinforcement-learning stack
> in a fresh session. Written 2026-06-11. Branch: `rl_upgrade`.

---

## 0. TL;DR / Current status

CyberX is a cyber-security simulator with a **2-agent MARL core** (Attacker
vs Defender) living in `src/server/rl/`. Over this work the RL stack was
refactored from a broken/duplicated state into a production-grade,
seeded, config-driven system, and the *environment itself* was redesigned
twice into a realistic **APT-vs-SOC game (v4.2)**.

**What works now (verified):** clean architecture, reproducible seeding,
persistent parallel env pools, league self-play, BC warm-start, crash
auto-restart, 17/17 unit tests, scripted-agent game balance (decidable
both ways), eval that doesn't destabilize cuDNN.

**What is NOT yet verified:** a clean **50-iteration self-play
convergence**. Every full run so far surfaced a different *degenerate
attractor* (camping → farming). Each was diagnosed and fixed structurally,
but the final "does it converge to balanced skilled play" question is still
open and needs the next full run (blocked only by a local RAM/process issue
at time of writing — see §11).

**Last action:** committed `b16383b` (anti-farm + worker-leak fix). The
immediate next step is a fresh full run on a clean machine, watching the
action-frequency plots at curriculum transitions.

---

## 1. Project overview & stack

- **App:** React/TS frontend + Express server (`src/server/index.ts`, port
  5000) + a Python MARL stack in `src/server/rl/` exposed via a Flask API
  (`api.py`, port 5001), proxied through Express at `/api/rl/*`.
- **RL stack:** Gymnasium env, Stable-Baselines3 **RecurrentPPO** (LSTM
  policy, from `sb3_contrib`), PyTorch (CUDA).
- **Training paradigm:** Independent PPO (IPPO) — each side has its own
  policy. Curriculum learning → league-style self-play with fictitious-play
  ghosts → behavioral cloning (BC) warm-start from scripted experts. Optional
  LLM oracle (off by default).
- **The game:** an attacker advancing a MITRE-inspired kill chain against a
  SOC defender that must detect → investigate → contain. Full design in §8.

---

## 2. Hardware & local environment

- Windows 11, **RTX 4060 Laptop (8 GB VRAM)**, 16 GB DDR5 RAM, i7-13720H
  (14C/20T).
- Python venv at repo root: `venv\Scripts\python.exe`. Run RL scripts from
  `src/server/rl`.
- `torch 2.5.1+cu121`, CUDA 12.1. (If CUDA shows unavailable, it's the
  CPU-only torch wheel — reinstall from the cu121 index.)
- Windows consoles are cp1252; the entry scripts reconfigure stdout to UTF-8
  for the box-drawing banners. Keep that.

---

## 3. Branch / workflow rules (IMPORTANT)

- **Work only on `rl_upgrade`. Push to `rl_upgrade` only. NEVER merge to
  `master` — the user merges themselves.**
- Commit messages end with `Co-Authored-By: Claude ...`.
- Old model checkpoints in `models/cyberx_marl/` will **not load** after the
  v4 redesign (observation/action shapes changed, and the merged agent class
  changed pickle paths). Start fresh runs; don't try to resume old `.zip`s.

---

## 4. Starting state (what was inherited)

The `rl/` directory was a mix of working and broken code:
- Two agent files (`attacker_agent.py`, `defender_agent.py`) ~95% duplicated.
- Two dead env files (`honeypot_env.py` — real ES/SSH env; `honeypot_env_sim.py`)
  imported by nothing in the training path.
- Broken scripts that crashed on import (`pretrain_attacker.py`,
  `train_overnight.py`), an interactive wrapper, orphaned utils.
- `config.json` was decorative — trainer hardcoded constants that **disagreed**
  with it.
- Real correctness bugs: an epsilon-greedy warmup callback that **corrupted
  the PPO rollout buffer** (stored random actions with the real actions'
  rewards/log-probs); RL opponents acting **memoryless** (LSTM state never
  threaded); **zero seeding** anywhere; **no `Monitor` wrapper** (so SB3
  episode stats and the progress bar were permanently empty).
- Heavy per-iteration waste: env pools rebuilt up to 4× per iteration; ghost
  pool held ~30 full models in memory just to re-save them to disk.
- The TS proxy pointed at the wrong port (5000, itself) and dropped the
  `/api/rl` prefix — so **no** frontend RL call could have worked.

The original game (v2/v3): attacker won by merely *touching* ROOT; detection
thresholds were only crossed at the escalation that ended the episode, so the
defender could never respond and the upper kill chain was dead content.

---

## 5. Progressive changes — commit history (on `rl_upgrade`)

Read newest-last. Each line is one commit.

| Commit | What |
|---|---|
| `f4e57fe` | Removed dead/broken modules; salvaged ES-parsing into `telemetry_adapter.py` |
| `100509a` | Typed `config.json` + `config_loader.py` (dataclasses, loud validation) as single source of truth |
| `13f4912` | Seeded env (gymnasium `np_random`), `StatefulOpponent`, env_method hot-swap API, exclusive win conditions, `RewardConfig` |
| `544d0dc` | Unified `agents.py` (one `RLAgent`), **sequence-aware BC** (BPTT through the LSTM) |
| `c5972a5` | Persistent SubprocVecEnv pools, **league opponent mixing**, entropy-coef warmup (replaced the buffer-corrupting epsilon callback), path-only ghosts, `Monitor` wrap, best-model gating |
| `3304f0c` | Evaluator uses shared `StatefulOpponent` + seeded eval matches |
| `25ad30a` | API: port env var, alias routes, **demo SSE**, **telemetry suggest**; fixed the TS proxy port/prefix; config-driven entry |
| `0265b41` | `tests_rl.py` self-tests (no pytest dep) |
| `6269b9f` | **Eval on CPU clones** (stop migrating live cuDNN-LSTM models → was a `CUDNN_STATUS_INTERNAL_ERROR` source); **crash auto-restart** supervisor |
| `4b50938` | **v4 environment redesign** — realistic APT-vs-SOC (stealth economy, detect≠contain, counterplay, 14/12 actions, 12-dim obs) |
| `9401c98` | **v4.1** — fixed co-adaptation collapse: killed the **camping attractor**, softened eviction, smoother curriculum, BC refresh on promotion |
| `b16383b` | **v4.2** — eliminated **reward farms**; fixed SubprocVecEnv **worker leak on crash** |

Earlier commits (`af1f19e` and before) are the user's pre-existing work.

---

## 6. Current architecture (file-by-file)

All under `src/server/rl/`:

| File | Role |
|---|---|
| `shared_honeypot_env.py` | **The game.** `SharedHoneypotEnv` (Gymnasium), `RewardConfig` (all tunables), `StatefulOpponent`, observation builders, curriculum config. ~48 KB — the heart of the project. |
| `agents.py` | `RLAgent` (role-parameterized RecurrentPPO wrapper), `ResidualFeatureExtractor`, sequence-aware + flat BC. |
| `baselines.py` | 6 scripted agents (Random/Scripted/Expert × Att/Def), `OPPONENT_REGISTRY`, `SCRIPTED_POOL_BY_LEVEL`. They seed BC, anchor the league, and are eval baselines. |
| `trainer.py` | `MARLTrainer` — main loop, league mixing, curriculum promotion, BC + BC-refresh-on-promotion, ghost pool (path-only), checkpointing, pause/resume, `close()`. |
| `vec_env_factory.py` | `make_vec_env` — persistent SubprocVecEnv pools, `Monitor` + `torch.set_num_threads(1)` per worker, hot-swap-friendly `ForwardingMonitor`. |
| `evaluator.py` | `MARLEvaluator` — Elo, win-rate/TTD/kill-chain metrics, plots, CPU-clone eval, seeded matches. |
| `progress.py` | Live tqdm progress + rich post-iteration summary panels. |
| `config_loader.py` | Typed config dataclasses (`PPOConfig`, `CurriculumConfig`, `TrainingConfig`, `LeagueConfig`) + validation. |
| `config.json` | All hyperparameters / curriculum / league / seed. |
| `run_training.py` | CLI entry. Preset modes, `--seed`/`--n-envs`, crash-restart supervisor (kills worker tree on crash), UTF-8 stdout. |
| `api.py` | Flask API: training control, metrics, leaderboard, demo SSE, telemetry suggest. |
| `telemetry_adapter.py` | Maps real ES/Cowrie events → defender observation; runs the trained defender in shadow mode. |
| `llm_oracle.py` | Optional LLM action oracle (Anthropic/Gemini/Ollama/OpenAI), off by default. |
| `set_best_model.py` | CLI to promote a checkpoint to `*_best.zip`. |
| `tests_rl.py` | 17 self-tests (no pytest). **Run this first after any env change.** |

**Training flow:** `run_training.py` → supervisor spawns a `--worker` child →
`MARLTrainer.__init__` builds 2 persistent SubprocVecEnv pools + 2 `RLAgent`s →
BC phase (scripted experts) → per-iteration loop: roll league opponent mix →
`env_method` hot-swap → `learn()` both sides → eval on CPU clones → update
history / best-models / curriculum → save state. Curriculum promotion
hot-swaps the level on the live pools and runs a BC refresh.

---

## 7. Key infrastructure decisions & reasoning

- **One `RLAgent`, role-parameterized** (not two classes): the originals were
  95% identical. Role differences (ent_coef, extractor width) live in config.
- **Sequence-aware BC**: the original BC trained the LSTM as if stateless
  (shuffled transitions, zeroed state). Now episodes are batched whole and the
  LSTM is unrolled through time (BPTT), masking padded steps.
- **Persistent pools + `env_method` hot-swap**: rebuilding SubprocVecEnv costs
  ~5-10 s × up to 4×/iter on Windows. Pools are built once; opponents and
  curriculum level are swapped in place.
- **Path-only ghosts**: the ghost pool is a list of `.zip` paths (file copies
  of `*_latest.zip`), not in-memory models. Workers load them on CPU.
- **Entropy-coef warmup** (not epsilon-greedy): the old epsilon callback
  mutated `locals["actions"]` after `env.step()` but before the buffer add,
  corrupting PPO. Replaced by annealing `model.ent_coef` from the trainer.
- **Eval on CPU clones**: migrating live cuDNN-LSTM models CUDA→CPU→CUDA each
  iteration destabilized the cuDNN backward pass (a real `CUDNN_STATUS_INTERNAL_ERROR`
  mid-`backward()`). Eval now clones the policy to CPU (rebuilt from
  constructor params + CPU state_dict — `deepcopy` fails on cuDNN-flattened
  non-leaf LSTM weights) and never touches the training model.
- **Crash auto-restart supervisor**: laptop GPUs throw sporadic driver/cuDNN
  errors. State saves every iteration; the supervisor relaunches the child with
  `--resume` and (v4.2) `taskkill /T`'s the crashed child's worker tree so
  workers don't leak.
- **Everything seeded** end-to-end; `--seed` makes env-level trajectories
  reproducible (training-level up to cuDNN nondeterminism).

---

## 8. The game (v4.2 environment) — design in depth

`SharedHoneypotEnv`, mode = `attacker` | `defender`. One instance trains one
side; the opponent acts inside `step()` via an injected policy. **The attacker
acts first** (generates telemetry), then the defender observes and responds.

### Kill chain (attacker stages)
`RECON(0) → FOOTHOLD(1) → PRIVILEGED(2) → OBJECTIVE(win)`
Plus capability flags: `recon_done`, `persistence`, `credentials`,
`data_staged`, `foothold_count`.

### Actions
- **Attacker (14):** passive_recon, active_scan, exploit_service, brute_force,
  phishing, establish_persistence, escalate_privilege, dump_credentials,
  lateral_movement, defense_evasion, collect_data, exfiltrate, execute_impact,
  wait.
- **Defender (12):** monitor, investigate, rate_limit, deploy_decoy,
  threat_hunt, isolate_host, hard_block, patch_harden, rotate_credentials,
  restore_backup, raise_alert, deception_response. (Action space is
  `Discrete(14)`; the defender's 12,13 remap to monitor.)

### Observations (12-dim each, L∞-normalized, per-perspective POMDP)
- **Attacker** sees: stage, step frac, last_success, last_detected, its own
  **suspicion "heat"** (it senses how noisy it's been), recon/persistence/
  credentials/data_staged flags, rate_limited, foothold count, patched_level.
- **Defender** sees: **noisy observed_anomalies** (benign traffic inflates it),
  **evidence** (hard proof), failed_logins, step, egress, alerts, decoys,
  decoy_tripped, containment_active, hosts_anomalous, credential_anomaly,
  rate_limited. It does **not** directly see the attacker's stage — it must
  investigate.

### Core mechanics (what makes it realistic)
1. **Stealth economy:** every attacker action emits **noise** into a hidden
   `suspicion` accumulator that decays each step. Loud actions (brute, exfil,
   impact) are easy to catch; quiet ones (phishing, passive recon) aren't.
   `defense_evasion` clears logs (reduces suspicion).
2. **Detection ≠ containment:** the defender sees only noisy anomalies. It must
   **investigate / threat_hunt** to convert suspicion → **evidence**.
   Containment only "counts" (and avoids a false-positive penalty) above an
   evidence threshold (isolate ≥3, hard_block ≥6).
3. **Containment economy:** a justified containment **consumes the evidence**
   that justified it + starts a 1-step cooldown (so blocking can't be spammed).
   It **knocks the attacker back** (never instant-evicts — that made attacking
   −EV). The defender wins by **sustained control**: `containments_to_win = 2`.
4. **Counterplay:** `persistence` softens knock-back (keeps a foothold);
   `credentials` enable lateral movement / boost escalation; `patch_harden`
   lowers exploit/escalation success; **decoys** trip noisy attackers into
   instant evidence. Each has a defender counter (restore_backup, rotate_creds,
   patch).
5. **Win conditions (exclusive):** attacker wins by completing the objective
   (execute_impact OR exfiltrate ≥ `exfil_objective_volume`=3). Defender wins by
   ≥2 justified containments. Timeout with neither = **draw** (a dwelling,
   unresolved breach).

### Curriculum (gradual unlock — important)
- **L0** (no noise, 60 steps): core path only — recon/exploit/escalate/impact
  vs monitor/investigate/decoy/isolate/hard_block.
- **L1** (low noise, 80 steps): the full APT kill chain + the SOC toolkit
  (~11 att / 8 def actions).
- **L2** (realistic noise, 100 steps): everything + league self-play.
The 5→11→14 gradual unlock exists because a one-step 5→14 jump (the original
v4.0) destroyed the level-0 policy and it never re-anchored.

### `RewardConfig`
Every coefficient is a field on the frozen `RewardConfig` dataclass at the top
of `shared_honeypot_env.py`, overridable per-instance. This is the **primary
tuning surface**.

---

## 9. The recurring bug pattern & the three collapse modes

This is the most important lesson for whoever continues. **RL is an optimizer;
it will find and exploit any positive-reward loop that beats the intended
objective.** Three full runs each surfaced a different degenerate attractor:

1. **Camping (v4.0 → fixed in v4.1).** Survival shaping paid +0.6/step at
   PRIVILEGED → camping ~90 steps = ~+54 vs +25 for winning. The attacker
   rationally climbed to privileged and *never finished* (impact/exfil 0%).
   **Fix:** zeroed survival shaping at foothold/privileged, added a small
   per-step `time_cost`. Progress is rewarded only on **stage transitions**.
   Guarded by `camping_is_not_optimal` test.

2. **Reward farms (v4.1 → fixed in v4.2).** Several actions paid a positive
   reward *every time*, with no precondition/cap/outcome: `defense_evasion`
   (+2 flat even with no suspicion to clear), `passive_recon` (+0.8 repeatable),
   `rate_limit` (+2.5/step off noise), decoy passive trickle, unguarded
   `dump_credentials`/`collect_data`. Runs **oscillated** between healthy play
   and farm-collapse (single action >90%, 100% draws). **Fix:** the structural
   rule below. Guarded by `repeatable_actions_are_not_farmable`.

3. **Instant-eviction −EV (fixed in v4.1).** Investigate→hard_block→instant-evict
   was faster/cheaper than the 6-step kill chain, making the attacker's EV of
   attacking negative → it gave up. **Fix:** no instant eviction; win on
   sustained containment.

### The structural rule (apply to any new reward)
> **No repeatable action may pay a positive reward for merely *trying*.**
Every positive reward must be one of:
- **one-time on a state change** (recon/scan fire once on `recon_done`;
  dump/collect once on their flag; persistence guarded by `not persistence`),
- **outcome-proportional** (evasion pays for suspicion *actually cleared*;
  monitor/investigate/threat_hunt capped by `evidence` headroom),
- **gated on activation** (rate_limit pays once, not while already throttled;
  patch only when `patched_level` increases), or
- **capped per episode** (decoys, alerts; past-cap and idle variants now cost).

If a future run shows any single action spiking > ~60%, it's almost certainly
a new farm. Reproduce it cheaply by extending
`repeatable_actions_are_not_farmable` in `tests_rl.py`.

---

## 10. Verification status & how to verify

- **Unit tests:** `cd src/server/rl && ../../../venv/Scripts/python.exe tests_rl.py`
  — 17 tests, no pytest. Covers SB3 env-checker, seeded determinism,
  StatefulOpponent, win-condition exclusivity, stealth/detection/persistence
  mechanics, curriculum mask remap, hot-swap, config validation, agent build +
  BC, eval on CPU clones (CUDA-aware), the `camping_is_not_optimal` and
  `repeatable_actions_are_not_farmable` guards, and a **scripted decidability**
  test (the game must be winnable both ways).
- **Decidability proxy** (printed by the test): scripted-vs-random 40/0,
  scripted-vs-expert 25/15, expert-vs-expert 11/29 (att/def/draw). This proves
  the *scripted* game is balanced — but the scripted defender is far weaker than
  a trained RL defender, so it does **not** prove RL convergence.
- **Smoke run:** `python run_training.py --iterations 3 --timesteps 3000 --seed 7
  --save-dir ./models/smoke --no-auto-restart`. A v4.1 smoke produced decisive
  balanced games (att 50-80%, def 20-50%, zero draws) at level 0 — good signal.
- **Full run:** `python run_training.py --mode full` (50 iters). **Not yet run
  to completion on v4.2.** This is the key open verification.

---

## 11. Known issues / open risks

- **OPEN: 50-iter convergence unproven.** Incentives are now correct in unit
  tests and the scripted game is balanced, but a clean full self-play run that
  converges to skilled balanced play has not been observed (each prior run hit a
  collapse, each now fixed). **This is the #1 thing to confirm next.**
- **Local RAM/process hygiene.** At handoff there was a live python process
  (PID 18908) + 16 SubprocVecEnv workers using ~8 GB, leaving ~1.4 GB free,
  which OOM'd a verification run. Before a full run: ensure no stray python
  training processes (`Get-Process python`), or reboot. v4.2's worker-tree-kill
  prevents *future* crashes from leaking, but pre-existing strays must be
  cleared manually.
- **Scripted balance is loud-rush-favored.** ScriptedAttacker (smash-and-grab)
  beats ExpertDefender 25/15, while the stealth path (ExpertAttacker) loses
  11/29. Realistic, but if you want the low-and-slow style equally viable for a
  demo, nudge `noise_exfil`/`noise_impact` down.
- **Old checkpoints unloadable** (see §3).
- **LLM oracle** paths/prompts were updated to v4 but the oracle is off by
  default and untested against a live API this cycle.

---

## 12. Recommended next steps (in order)

1. **Clear stray python processes / reboot**, confirm `>10 GB` free RAM.
2. **Run a full 50-iter run** with a fixed seed:
   `python run_training.py --mode full --seed 42`.
3. **Watch the action-frequency heatmaps** (`models/cyberx_marl/results/
   action_heatmap_iter*.png`) at each curriculum transition (the historical
   death zones: the L0→L1 and L1→L2 promotions). Healthy = a spread of actions,
   episodes resolving in <30 steps, both win-rates contested. Red flag = any
   single action > 60% or episode length pinned at the step limit with 100%
   draws.
4. **If a new farm appears:** identify the spiking action, add a reproducing
   case to `repeatable_actions_are_not_farmable`, apply the structural rule
   (§9), re-verify, commit.
5. **If it converges:** evaluate `*_best.zip` via the demo endpoint
   (`POST /api/rl/demo/start` → SSE `/api/rl/demo/stream`) and the paper-table
   endpoint; consider tuning scripted-balance for the stealth path; wire the
   telemetry adapter to a real honeypot for the shadow-mode demo.
6. **Optional robustness:** PFSP (prioritized fictitious self-play) weighting in
   the league if oscillation persists — sample ghosts ∝ loss-rate. Noted as
   future work in the original plan, not yet implemented.

---

## 13. Tuning-knob quick reference (all in `RewardConfig`)

| Symptom | Knob(s) |
|---|---|
| Defender too strong / attacker can't win | `containments_to_win` ↑ (2→3), `investigate_fraction` ↓, `contain_*_evid` ↑ |
| Attacker too strong | `investigate_fraction` ↑, attacker `noise_*` ↑, `decoy_trip_*` ↑ |
| A single action is being spammed (farm) | find it, make its reward one-time/proportional/capped (§9) |
| Stealth path unused / loud-rush dominant | `noise_exfil`/`noise_impact` ↓, `noise_escalate` ↓ |
| Camping returns | check survival shaping is ~0 and `time_cost` < 0 |
| Episodes all draws / too long | outcome rewards too weak vs step rewards; widen the win/loss gap |

PPO / curriculum / league knobs live in `config.json` (gamma, gae_lambda,
n_steps, batch, ent_coef per role, warmup, per-level timestep fractions,
`promo_threshold`/`promo_streak`/`max_stage_iterations`, `ghost_pool_max`,
`scripted_slots`/`latest_slots`, `seed`).

---

## 14. One-paragraph mental model for the next session

The infrastructure is solid and done; the open work is **game balance under
RL optimization**. The single recurring failure mode is *degenerate attractors*
— the agents find a way to score without playing. Two are fixed and guarded
(camping, farming); the discipline going forward is: **outcome-driven rewards
only, every repeatable positive reward must be tied to a state change / capped /
proportional, and every fix gets a unit-test guard.** Run the full 50-iter run,
read the action-frequency plots at the curriculum transitions, and treat any
>60% single-action spike as the next farm to eliminate.
