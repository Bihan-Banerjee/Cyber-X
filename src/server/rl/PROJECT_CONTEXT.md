# CyberX MARL — Project Context & Handoff

> Handoff doc for continuing work on the CyberX reinforcement-learning stack
> in a fresh session. Written 2026-06-11. Branch: `rl_upgrade`.
> **Updated 2026-08-05 on branch `rl_integration` (off `master`) — see §17,
> which supersedes §12's "next steps" and parts of §11.**

---

## 0. TL;DR / Current status

CyberX is a cyber-security simulator with a **2-agent MARL core** (Attacker
vs Defender) living in `src/server/rl/`. Over this work the RL stack was
refactored from a broken/duplicated state into a production-grade,
seeded, config-driven system, and the *environment itself* was redesigned
into a realistic **APT-vs-SOC game** (now at **v4.3**).

**What works now (verified):** clean architecture, reproducible seeding,
persistent parallel env pools, league self-play, BC warm-start, crash
auto-restart, 17/17 unit tests, scripted-agent game balance (decidable
both ways), eval that doesn't destabilize cuDNN, and — as of the first clean
full run — **convergence**: a 50-iteration run that does NOT collapse and
settles into stable, diverse, decisive play (see §15).

**Convergence, balance, AND exploitability are all measured now.** Three early
runs each hit a *degenerate attractor* (camping → reward-farming); each was
fixed structurally with a unit-test guard. v4.2 ran clean but attacker-favored
80/20; **v4.3** (`3289d4c`) fixed a phishing/decoy bug + under-rewarded defender
detection and brought it to contested **~56/44**. Then **5 full training runs**
held at **attacker 0.60 ± 0.04 / defender 0.40 ± 0.04**, 0% draws, diverse
strategies, no collapse (§15). Finally, a **5-run exploitability evaluation**
(§15) gives the objective verdict: **NashConv 0.36 ± 0.06** — the *attacker*
converges near a best-response (gap 0.11 ± 0.10) while the *defender* stays
**0.25 ± 0.07 exploitable** (a best-response attacker beats it 0.80 ± 0.01).
**Reward tuning is DONE; the defender is the identified weak link.**

**What this means in plain terms:** the game converges reliably to a stable,
contested, non-degenerate equilibrium that is *decent but not airtight* — the
defender is under-trained relative to its own potential (a dedicated defender
can win 0.56 vs the attacker, but the co-trained one manages ~0.45). The fix is
**not** more reward tuning — it's better *training* (PFSP / PSRO) to close the
defender's best-response gap.

**Publishability (asked & assessed):** good enough **now** for a workshop /
benchmark / experience paper, framed on the reward-design-pitfalls finding +
the exploitability methodology (NOT "we trained agents that work" — the
algorithm is standard PPO+league). NOT yet a top main-track result. The three
highest-leverage additions, in order: (1) true multi-seed (the 5 runs are all
seed 42 — replicate variance, not seed variance; rerun `--seed 1..5` or call
them "5 independent runs"), (2) ablations (curriculum/BC/league off →
NashConv delta), (3) one improvement result (PFSP closing the defender gap,
NashConv before/after). See §16.

**Last action:** built + ran the **exploitability harness** (`exploitability.py`,
`32e82d7`) with a rich progress display (`eval_progress.py`, `8a198b4`);
analyzed all 5 seeds. The recommended next step is **PFSP** (close the defender
gap → lower NashConv → headline result), NOT further reward changes.

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
| `160a6be` | Added `PROJECT_CONTEXT.md` (this handoff doc) |
| `3289d4c` | **v4.3** — rebalanced toward defender: closed phishing/decoy hole, made detection rewards meaningful (non-farmable). Result: ~56/44 contested |
| `ac0f330` | Documented first clean 50-iter result + research-project roadmap (§16) |
| `72e9f2e` | Documented v4.3 contested result; reconciled doc to post-convergence state |
| `32e82d7` | **`exploitability.py`** — best-response / NashConv evaluation harness |
| `8a198b4` | **`eval_progress.py`** — rich progress display for the exploitability eval (ETA, overall bar, live curve) |

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
| `exploitability.py` | **Best-response / exploitability evaluation.** Freezes a trained best agent, trains a best-response opponent against it, reports per-side exploitability + gap-over-equilibrium + NashConv. The objective strength metric (self-play win rate can't measure this). |
| `eval_progress.py` | `ExploitProgress` — training-grade progress display for `exploitability.py` (header, equilibrium bars, per-iter step bar, live win-rate sparkline, overall ETA, NashConv verdict). |
| `progress.py` | Live tqdm progress + rich post-iteration summary panels (training). |
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
- **Full run:** `python run_training.py --mode full` (50 iters). **Done on
  v4.2 (converged, 80/20) and v4.3 (converged, 56/44 contested)** — see §15.
  The remaining verification is *multi-seed* (§16 Phase A), not a single run.

---

## 11. Known issues / open risks

- **The defender is exploitable (the #1 substantive open item).** 5-run
  exploitability: defender gap 0.25 ± 0.07 (a best-response attacker wins 0.80),
  attacker gap only 0.11. The defender is under-trained relative to its
  best-response potential. The targeted fix is **PFSP** (§16 Phase C), not reward
  tuning. NashConv 0.36 ± 0.06.
- **"5 seeds" are all seed 42** (replicate variance, not seed variance). For
  paper rigor, rerun `--seed 1..5` or describe as "5 independent runs."
- **Reward tuning is considered DONE** — do not chase 50/50 (see §15 verdict).
  If a *future* change reintroduces a degenerate attractor, the rule in §9 +
  the `camping_is_not_optimal` / `repeatable_actions_are_not_farmable` guards
  are the playbook.
- **Local RAM/process hygiene.** SubprocVecEnv spawns n_envs×2 (~16) worker
  processes (~0.5 GB each). Before a full run, ensure no stray python training
  processes (`Get-Process python`) or reboot — a leftover run can OOM a new
  one. v4.2's worker-tree-kill prevents *future* crashes from leaking, but
  pre-existing strays must be cleared manually.
- **Demo depth.** At the balanced config the defender catches the attacker
  early, so episodes are short (6–7 steps) and rarely reach the deep kill
  chain. For showcase episodes only, raise `max_steps` or ease detection;
  keep the trained-balance config for training.
- **Old checkpoints unloadable** (see §3).
- **LLM oracle** paths/prompts were updated to v4 but the oracle is off by
  default and untested against a live API this cycle.

---

## 12. Recommended next steps (in order)

Reward tuning AND exploitability measurement are done. The work is now
**closing the defender gap + rigor + writing** (see §16). In priority order:

1. **Build PFSP** (§16 Phase C) — THE next step. Exploitability showed the
   defender under-responds to the attacker; PFSP samples league opponents ∝
   loss-rate to target exactly that. Then re-run `exploitability.py` →
   "NashConv 0.36 → X" is a headline improvement result.
2. **True multi-seed** (`--seed 1..5`) + **W&B** + **ablations** (curriculum /
   BC / league / each reward mechanic off → NashConv delta) — the rigor a
   reviewer will want; turns "it works" into "here's why."
3. **Then** realism/grounding (ATT&CK + telemetry, §16 Phase D) and writing
   (§16 Phase F; workshop/benchmark/experience framing per §15).
4. **Watch for regressions** on any future run: a single action > 60% or
   episodes pinned at the step limit with high draws = a new attractor;
   reproduce it in `repeatable_actions_are_not_farmable` and apply §9.

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

The infrastructure, the game, and the *evaluation* are done. Reward tuning is
finished (5 runs hold ~60/40, no degenerate attractors — the camping/farming
playbook in §9 is the guard if one ever returns). Exploitability is measured
(NashConv 0.36 ± 0.06). The open work is now **scientific**, not tuning: the
exploitability result identified the **defender as the weak link** (gap 0.25),
so the next step is **PFSP** to close it (→ a "NashConv before/after"
improvement result), then true multi-seed + ablations, then writing it up as a
workshop/benchmark/experience paper framed on the reward-design-pitfalls finding
+ the exploitability methodology (§15, §16). Do not reward-tune further.

---

## 15. Full-run results (v4.2 → v4.3)

### v4.2 run — first clean convergence (attacker-favored)
The first non-collapsing full run (v4.2 code) **converged**: 0% draws,
episodes ~9 steps, action entropy att 2.49 / def 2.69 bits (max 3.81),
diverse coherent strategies. Convergence answered — **yes**. But it was
**attacker-favored ~80/20**, real skill not overfitting per baselines:
- RL attacker vs scripted/expert/random defenders: 0.72 / 0.86 / 1.00
- RL defender vs random/expert/scripted attackers: 0.98 / 0.80 / **0.34**
  (loses to the fast loud rush).

Two causes fixed in **v4.3** (commit `3289d4c`):
1. **Phishing bypassed decoys** (not in `ACTIVE_ATT_ACTIONS`) and was near-
   silent → a decoy-proof stealth route the attacker abused (37% of actions).
   Now decoy-trippable + noisier (0.4→0.8).
2. **The defender ignored its winning path** (investigate/threat_hunt →
   evidence → contain) because those paid far less than decoy/deception after
   the anti-farm pass. Detection rewards are now proportional to evidence
   actually gained (coefficient 0.7/point), still headroom-capped so
   non-farmable; threat_hunt strengthened (anti-stealth tool); deception
   trimmed.

### v4.3 run — CONTESTED & BALANCED (the target state)
The next full run (v4.3 code) came back **contested ~56/44** (self-play,
last-10 avg) — the 80/20 gap closed. Everything healthy held:
- 0% draws, episodes ~7 steps (decisive), entropy att 2.29 / def 2.55.
- Trajectory oscillates around balance (the *defender* led at iter 48,
  0.54/0.46) — normal self-play, not collapse.
- **The defender now actively uses `threat_hunt`** (its top action, 29–61%
  across L2) — exactly the detect→contain behavior the v4.3 reward fix was
  meant to induce. The attacker shifted off phish-spam onto exploit/escalate
  (phishing is no longer a free silent route).
- Baselines, both sides now ~0.44–0.64 vs scripted opponents (genuinely
  two-sided):
  - RL attacker vs scripted/expert/random def: 0.56 / 0.62 / 1.00
  - RL defender vs scripted/expert/random att: 0.44 / 0.64 / 1.00

**Verdict: reward tuning is DONE.** The game is balanced, stable, decisive,
diverse, and free of the camping/farming attractors. Do **not** chase exactly
50/50 — 56/44 is well within contested, self-play oscillates a few points
regardless, and further coefficient changes risk reintroducing a pathology.

Caveats / minor observations (not balance issues):
- This is a **single seed** — confirm across ≥5 seeds before treating 56/44 as
  *the* number (§16 Phase A).
- Privileged-stage % fell to ~0.30 and episodes are short (6–7 steps): the
  defender now catches the attacker early, so games rarely show the *deep*
  kill chain. Fine for balance; if you want longer cat-and-mouse for the
  **demo**, raise `max_steps` or ease detection *for showcase episodes only* —
  keep the trained-balance config as-is.

### 5-run aggregate (the `run_four_a..e` dirs)
Five full 50-iter runs (stored at `models/cyberx_marl/results/run_four_{a..e}`)
held the v4.3 equilibrium tightly:
- **Self-play: attacker 0.60 ± 0.04 / defender 0.40 ± 0.04**, 0% draws, episodes
  ~7 steps, entropy ~2.2/2.5 — stable, contested, no collapse on any run.
- NOTE: all five were launched at the **default seed 42** (per their
  `trainer_state.json`). They are *replicates* (variance from CUDA
  nondeterminism), not a true seed sweep. For paper rigor either rerun with
  `--seed 1..5` or describe them as "5 independent runs," not "5 seeds."

### Exploitability evaluation (5 runs) — the objective strength verdict
Ran `exploitability.py` on all five best-model pairs (`exploitability_report.json`
in each run dir). Aggregate:
- **NashConv = 0.36 ± 0.06** ("decent"; <0.15 strong, 0.15–0.35 decent, >0.5 brittle).
- **Attacker exploitability 0.56 ± 0.05, gap 0.11 ± 0.10** — the attacker
  converged *near a best-response*; a dedicated defender barely does better than
  the co-trained one.
- **Defender exploitability 0.80 ± 0.01, gap 0.25 ± 0.07** — a best-response
  attacker beats the defender 80% of the time (remarkably consistent). The
  defender is the **weak link**: under-trained relative to its own potential.
- Encouraging detail: a best-response *defender* wins **0.56** vs the attacker,
  so the game is NOT structurally attacker-rigged — the defender's co-trained
  ~0.45 just hasn't reached its ~0.56 ceiling. That 0.11–0.25 gap is what
  PFSP/PSRO should close.
- Caveat: exploitability = max over a noisy 150-ep curve, so ~0.02–0.03 inflated;
  some defender curves hadn't fully flattened (rerun `--br-iterations 40` for the
  final paper number).

### Publishability assessment (asked 2026-06)
Good enough **now** for a **workshop / benchmark / experience paper**, framed on
(1) the reward-design-pitfalls finding (camping / farming / instant-eviction +
the structural anti-farm rule) and (2) the exploitability methodology — NOT on
"we trained agents that work" (the algorithm is standard PPO+league). NOT yet a
top main-track result. Highest-leverage additions before submission, in order:
true multi-seed → ablations (curriculum/BC/league off → NashConv delta) → one
improvement result (PFSP closing the defender gap, NashConv before/after).
Integrity: present it as a controlled simulation of training dynamics, not a
deployment-ready defender; don't overclaim real-world security impact (dynamics
aren't calibrated to real data).

---

## 16. Roadmap to a proper research project

The engineering is research-grade; the *science* is what's missing. Phases are
roughly ordered; each is independently valuable.

### Phase A — Make the current result rigorous (do first; low effort, high credibility)
- **Multi-seed runs.** Everything is single-seed. Run ≥5 seeds per
  configuration, report **mean ± std** (or IQM / bootstrap CIs per Agarwal et
  al., *"Deep RL at the Edge of the Statistical Precipice"*, NeurIPS 2021).
  A single seed is not a result.
- **Frozen evaluation suite.** Fix a held-out set of opponents (the 6 scripted
  agents + a few archived RL checkpoints) and a fixed seed/episode count;
  report all numbers against it so runs are comparable.
- **Ablations.** Turn each component off and measure the delta: curriculum,
  BC warm-start, league mixing, entropy warmup, each major reward mechanic.
  This is what turns "it works" into "here's *why* it works."
- **W&B / experiment tracking.** `wandb` is already in `requirements.txt`
  (commented). Wire it behind a config flag — log win-rates, Elo, entropy,
  curriculum level, action distributions per iteration. Essential for
  comparing dozens of runs.
- **Hydra/Optuna.** Move config to Hydra for sweep-friendly overrides; use
  Optuna for principled reward/hyperparameter search instead of hand-tuning.

### Phase B — Evaluation science (the real research contribution)
- **Exploitability / approximate best-response.** ✅ **DONE** —
  `exploitability.py` implements it; ran on all 5 runs → NashConv 0.36 ± 0.06,
  defender is the weak link (see §15). Remaining polish: rerun defender probes at
  `--br-iterations 40` so curves flatten (removes the noise-max caveat) and
  report the converged number.
- **Cross-play matrix + empirical Nash.** Build an N×N win-rate matrix over
  archived checkpoints, compute the empirical Nash equilibrium / Nash-averaging
  (Balduzzi et al., *"Re-evaluating Evaluation"*). Detects non-transitivity
  (rock-paper-scissors cycling — which this game showed at v4.1).
- **Relative population performance / Elo with uncertainty.** The Elo is
  already there; add confidence and a transitivity check.

### Phase C — Stronger algorithms (once evaluation can measure improvement)
- **PSRO** (Policy-Space Response Oracles, Lanctot et al. 2017) — the
  principled framework this project is informally approximating. Each
  iteration computes a best-response to the current meta-Nash over the
  population. Would replace the ad-hoc league with theory.
- **PFSP** (Prioritized Fictitious Self-Play, AlphaStar) — sample league
  opponents ∝ difficulty/loss-rate instead of uniformly. Likely the single
  highest-leverage upgrade to fight the oscillation seen mid-training.
- **Proper action masking.** Swap RecurrentPPO for **MaskablePPO** (sb3-contrib)
  so invalid actions are masked at the logit level instead of remapped to a
  no-op. Cleaner credit assignment, faster learning.
- **Opponent modeling** in the observation (belief over opponent type/strategy)
  — a natural fit for the POMDP framing.

### Phase D — Realism & grounding (what makes it a *security* paper, not just MARL)
- **Ground actions/observations in MITRE ATT&CK.** Map each action to real
  technique IDs; map observations to real detection signals. Cite the mapping.
- **Calibrate dynamics from real data.** Success probabilities, noise levels,
  and detection rates should be justified from real honeypot/red-team data,
  not hand-picked. The `telemetry_adapter.py` + Cowrie/Elasticsearch path is
  the hook — validate the sim's distributions against real logs.
- **Multi-host topology.** Lateral movement is currently a counter; make it a
  real graph (network segments, trust relationships) for a richer kill chain.
- **Shadow-mode validation.** Run the trained defender over recorded real
  attacks via the telemetry adapter; measure how its recommendations compare
  to what analysts actually did. This is the practical-impact result.

### Phase E — Emergent-strategy & robustness analysis
- **Strategy taxonomy.** Cluster/label the emergent attacker and defender
  policies across seeds/iterations — do they rediscover known TTPs (smash-and-
  grab vs low-and-slow; investigate-then-contain vs deception-heavy)? This is a
  compelling qualitative result and the demo already visualizes it.
- **Robustness / transfer.** Test trained agents against held-out scripted
  strategies and hand-crafted adversarial ones; measure generalization.
- **The reward-design findings are themselves a contribution.** The three
  degenerate attractors (camping, reward-farming, instant-eviction −EV) and the
  structural anti-farm rule are a reusable lesson for reward design in
  security/adversarial MARL — worth a methods section.

### Phase F — Dissemination
- **Reproducibility package.** Pin deps, seed everything, provide a one-command
  repro script per figure; the eval plots are already paper-quality.
- **Paper framing options:** (1) systems/benchmark paper — "CyberX: a
  curriculum-driven APT-vs-SOC MARL environment + baselines"; (2) methods paper
  — reward-design pitfalls and fixes for adversarial security MARL; (3)
  applied/defensive — sim-trained defender recommendations validated on real
  telemetry. (1)+(3) is the strongest combined story for a security venue.
- **Targets:** workshops first (NeurIPS/ICML security or MARL workshops, CAMLIS,
  AISec at CCS), then a full venue (USENIX Security / ACSAC for the security
  angle, or AAMAS for the MARL angle).

### Suggested immediate order (updated 2026-06 — balance & exploitability DONE)
1. ✅ Balance loop done (v4.3, ~60/40 over 5 runs). ✅ Exploitability done
   (NashConv 0.36 ± 0.06; defender is the weak link, gap 0.25).
2. **Build PFSP** (Phase C) — THE recommended next step. The exploitability
   result points straight at it: the defender under-responds to the attacker.
   PFSP (sample league opponents ∝ loss-rate) targets exactly that gap. Then
   re-run exploitability → "NashConv 0.36 → X" is a headline improvement result.
   (Alternative: PSRO, which reuses `exploitability.py` as its inner loop — more
   principled, bigger build.)
3. **True multi-seed** (`--seed 1..5`) + **ablations** (curriculum/BC/league off
   → NashConv delta) — the rigor a reviewer will want. Wire **W&B** first so
   these are comparable.
4. Ground in ATT&CK + validate via telemetry (Phase D) for the security story.
5. Write it up: workshop/benchmark/experience paper framed on the reward-design
   pitfalls + exploitability methodology (see §15 publishability note).

---

## 17. Integration & PFSP work (2026-08-05, branch `rl_integration`)

Branch `rl_integration`, cut from `master` (which already carries the merged
`rl_upgrade` work, the streaming SSE proxy and `docs/RL_HONEYPOT_INTEGRATION.md`).
Four commits: `e095509`, `b2719e4`, `6c2b19c`, `75e75b8`.

### Two defects that invalidated existing results

**Live mode was worse than replay.** Runs are archived into
`results/run_four_{a..e}/`, but `/status`, `/metrics*` and `/leaderboard` still
read the save-dir root, where those files no longer exist. `fetchRL` treats any
200 as live, so starting Flask *replaced* the real 50-iteration dashboard with an
empty one. The newest-subdir fallback added to `/plots` in `4df8b36` was never
applied elsewhere. Fixed with `_resolve_run_dir()` / `_run_file()`; `_model_path()`
had the same bug, which is why the Copilot and demo 404'd with five runs of
weights on disk. New `/api/rl/health` reports which run and models are being
served.

**The shadow-mode defender was a constant policy.** The committed
`shadow_eval.json` reported 65% "reasonable agreement" while emitting
`threat_hunt` for all 20 windows — the score was high *because* the action was
constant. Root cause was the observation, not the policy: `shadow_eval.py`
hardcoded 8 of 12 dims (evidence pinned at 0, so the containment branch was
unreachable) and `hosts_anomalous / max_footholds` saturated at 1.0. In-sim,
"anomalies present, no evidence" is exactly when hunting is correct.

`soc_state.py` closes the loop: a `SocState` mirroring the defender half of the
env's step function, fed the recommended action so evidence accrues, containment
fires and consumes it, and the next observation reflects it. Reproduced the
original exactly (run_four_a, uniform synthetic window, frozen posture, one LSTM
rollout): `threat_hunt` 20/20, entropy −0.00. With the loop closed and episodes
segmented: 4 distinct actions, 1.71 bits, 1 justified containment. **The frozen
arm stays at 20/20 even on phase-varying telemetry — the frozen posture, not the
input, was the binding constraint.** Exact agreement drops 0.10 → 0.05 on the
legacy window and rises to 0.45 on phase-varying telemetry; the old number
measured nothing. `shadow_eval.py --baseline` keeps both arms in one report, and
a `constant_policy` flag now fires when entropy collapses.

### PFSP is built (§12's #1 item)

The blocker was per-opponent win rates. Training already generates them — the env
now tallies each episode against `_opponent_id` and the trainer drains it via
`env_method`. `_roll_opponent_mix` draws ghosts with `f_hard(1-win_rate) = x^p`.
Guards: `pfsp_min_games` keeps sparse opponents neutral, and a floor stops any
ghost being starved (which would recreate the specialization the league prevents).

Config: `league.pfsp {enabled:false, p:2.0, min_games:5}` — **off by default so
the uniform arm is the control**. Verified at `n_envs=8`: weights
`[0.111, 0.02, 0.028]` for win rates `[0.67, 0.91, 0.83]`. Note `n_envs=4` gives
**zero** ghost slots (4 − 3 scripted − 1 latest), so PFSP is inert there.

**The experiment has not been run** — that is the next step:
```
python run_sweep.py --tag uniform --seeds 1 2 3 --iterations 30 --no-pfsp
python run_sweep.py --tag pfsp    --seeds 1 2 3 --iterations 30 --pfsp
python exploitability.py --run-dir <each> --side defender --br-iterations 40
python run_sweep.py --compare pfsp uniform
```
Success = the defender's `gap_over_equilibrium` falls from 0.25 ± 0.07 and
NashConv below 0.36 ± 0.06. Report overlapping CIs as overlapping.

### Also landed

- `run_sweep.py` (true multi-seed + bootstrap CIs — retires the "5 seeds that
  are all seed 42" caveat), `crossplay.py` (N×N matrix, empirical Nash by
  fictitious play, transitivity violations — pure inference, cheapest result
  left), `wandb_logger.py` (opt-in), `--ablate {bc,curriculum,league,entropy_warmup}`.
- `exploitability.py` reports the trailing mean beside `max(curve)` and flags
  unconverged probes, removing the §15 noise-max caveat.
- `attack_grounding.py`: 26 actions → ATT&CK / D3FEND, IDs verified against the
  MITRE sites. **Three entries in the old frontend map were wrong**: Credential
  Rotation is `D3-CRO`, and D3FEND has no "Alerting" or "System Restore"
  technique — those are now explicitly unmapped. A test keeps the Python table,
  the env's action order and the TS map in sync.
- `/train/start` spawns `run_training.py` instead of running the trainer in a
  Flask thread — the in-process path skipped the crash supervisor *and* its
  worker-tree kill, so a driver fault orphaned `n_envs×2` workers.
- First CI (`.github/workflows/ci.yml`): `tsc` and `tests_rl.py` are hard gates;
  eslint is gated on the RL/dashboard surface and advisory on the full tree
  (~350 pre-existing `no-explicit-any` errors).
- `prune_artifacts.py` — stride retention for the ~4 GB `models/` tree
  (1.74 GB reclaimable). Dry-run by default; **not applied**.
- `export_artifacts.py --all` regenerates all seven artifacts with a sha256
  manifest. `copilot_sample.json` was **hand-authored** — the hosted site was
  showing invented "trained defender" output; it is now recorded from the model.

### Test count

**20** self-tests (was 17): added `soc_state_closes_the_observation_loop`,
`pfsp_prioritizes_losses_without_starving_the_pool`,
`attack_grounding_matches_env_and_frontend`.
