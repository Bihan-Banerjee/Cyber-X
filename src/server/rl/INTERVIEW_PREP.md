# CyberX RL Project — Plain-English Explainer & Interview Prep

> This doc explains the Attacker-vs-Defender AI part of CyberX (`src/server/rl/`)
> in everyday language, defines every technical term used, tells the real story
> of what was hard and how it got fixed, and prepares you to defend it in an
> interview — including the questions designed to catch people who don't
> actually understand their own project.
>
> Ground rule for this whole document: **nothing here is stated unless it
> actually happened.** Where a result is preliminary or a claim would be a
> stretch, it says so explicitly. Use this doc to sound confident, not to sound
> impressive by overclaiming — the two are different, and interviewers who ask
> good follow-ups can tell.

---

## 1. What is this, in one paragraph?

Imagine teaching two AI programs to play a game against each other, forever,
where one plays a **hacker breaking into a computer network** and the other
plays a **security team defending it**. Neither is told the rules explicitly —
they learn by playing thousands of practice games, getting a small reward for
smart moves and a penalty for dumb ones, and slowly getting better at
out-thinking each other. Over time you get an AI hacker that knows how to
sneak around quietly, and an AI defender that knows when to investigate a
hunch versus when to actually shut something down. That's the project. It's
called **Multi-Agent Reinforcement Learning (MARL)** applied to
cybersecurity, and it sits inside a bigger app called CyberX.

---

## 2. Why does this exist? What problem is it exploring?

Real Security Operations Centers (SOCs) face a hard trade-off every day:
**react too fast and you block real customers by mistake (false positives);
react too slow and the attacker gets away with the data (a breach).**
Humans write rules to balance this, but rules are rigid and attackers adapt.

The idea explored here: **what if you could train an AI defender by having it
play against an AI attacker millions of times, so it learns the right balance
of "wait and gather evidence" vs. "act now" through experience, the same way
a chess AI learns strategy by playing itself?** This is a *research
prototype* investigating that idea — not a finished product that defends real
networks today (more on that honesty distinction in §6).

---

## 3. The core idea, no jargon

Two AI "brains" (called **agents**) take turns making moves in a simulated
computer network:

- **The Attacker** tries to break in, quietly gather permissions, and either
  steal data or cause damage, without getting caught.
- **The Defender** watches for suspicious signals, decides whether to
  investigate them, and decides when it has *enough proof* to actually block
  or contain the attacker.

Each agent is a neural network that has never seen the "rules" written down —
it only sees numbers describing the current situation (how suspicious things
look, what stage of the attack it's at, etc.) and picks an action. After each
game ("episode"), it gets a score. Over hundreds of thousands of games, it
adjusts itself to get a higher score next time. That adjustment process is
called **training**, and the mathematical method used to do the adjusting is
called **Reinforcement Learning (RL)**.

Because there are *two* learning agents improving at the same time (as
opposed to one AI learning against a fixed, unchanging opponent), this is
**Multi-Agent** RL — and it's a genuinely harder problem, because the "rules
of the game" keep shifting under both players as they both get smarter.

---

## 4. Glossary — every technical term, defined simply, with *why* it was chosen

### Core RL concepts

**Reinforcement Learning (RL)** — A way of training an AI by trial and error:
it takes an action, gets a reward or penalty, and gradually learns which
actions lead to the best long-term score. Unlike normal machine learning,
there's no "correct answer" dataset — the AI generates its own experience by
playing.

**Agent** — The AI player. Here there are two: the Attacker agent and the
Defender agent, each with its own separate brain (separate neural network).

**Environment** — The simulated world the agents act in (here: a simulated
computer network under attack). Built using **Gymnasium**, an industry-
standard Python library (successor to OpenAI's original "Gym") that defines a
common interface every RL environment follows — reset the world, take a
step, get back an observation/reward/done-flag. *Why chosen:* it's the
de-facto standard, so every RL algorithm library expects environments in this
shape — using anything else would mean writing custom glue code everywhere.

**Observation** — The numbers the agent sees each turn instead of the full
truth (e.g. the defender doesn't see the attacker's exact hidden stage, only
noisy warning signs). This is deliberately a **POMDP**: a "Partially
Observable" setup — realistic, because a real SOC never has perfect
visibility into what an attacker has actually done.

**Action** — One of the moves an agent can make on its turn. The attacker
has 14 possible moves (recon, exploit, escalate privileges, exfiltrate data,
etc.); the defender has 12 (monitor, investigate, rate-limit, contain, etc.).

**Reward** — A number added or subtracted after each move, telling the agent
"that was good" or "that was bad." Designing these numbers correctly turned
out to be the single hardest and most interesting part of this whole project
(see §6 — this is your best interview story).

**Policy** — The "strategy" the agent has learned; technically, the neural
network itself, which maps "what I currently see" → "what I should do."

### The specific algorithm: PPO / RecurrentPPO

**PPO (Proximal Policy Optimization)** — The specific RL training algorithm
used. It's one of the most widely-used, stable, general-purpose RL
algorithms (used by OpenAI, used to train game-playing and robotics agents
industry-wide). *Why chosen:* it's reliable and doesn't require exotic tuning
to avoid catastrophic training collapse, which matters a lot when you're
already fighting instability from having *two* learning agents at once (see
§6).

**LSTM (Long Short-Term Memory)** — A type of neural network layer that has
*memory* — it can remember things from earlier in the same game, not just
react to the current instant. *Why needed:* since neither agent sees the full
truth (POMDP, above), they need to remember clues from previous turns to
build up a picture over time — e.g. the defender needs to remember "I've seen
3 suspicious events building up" to decide whether it's justified to act now.
A memory-less network would forget everything every single step.

**RecurrentPPO** — PPO combined with an LSTM memory layer (from a library
called `sb3-contrib`, an extension pack for the popular **Stable-Baselines3**
RL library). This is the actual algorithm class used to train both agents.

**IPPO (Independent PPO)** — Since there are two agents, "independent" means
each one has its own separate brain training with its own separate copy of
PPO, rather than one shared brain trying to play both sides. *Why chosen:*
simpler and more standard for adversarial (attacker-vs-defender) setups than
having them share weights, which wouldn't make sense here since they have
opposite goals.

### Making self-play actually work

**Self-play** — Training an agent by having it play against a copy of
itself (or its own recent past versions), rather than against a fixed
scripted opponent. This is how AlphaGo and other famous game AIs got
superhuman: by only playing themselves, they can in principle get
arbitrarily good, since they always have an opponent exactly as skilled as
they currently are.

**The specialization trap (the reason plain self-play doesn't just work)** —
If an agent only ever trains against its *current* opponent, it can overfit
to that one specific opponent's quirks and forget how to beat simpler,
different strategies — like a chess player who gets great at beating one
specific rival's style but loses to a beginner playing something unexpected.
This is a well-documented failure mode in MARL research.

**Curriculum Learning** — Instead of throwing both agents into the full,
complex game immediately, they start on an easy, restricted version (few
actions, no background noise) and the game's complexity is gradually
unlocked as they prove they've mastered each stage. *Why chosen:* Jumping
straight to full complexity was tried and directly caused a training
collapse (see §6) — a smaller, staged unlock fixed it.

**League / league-style self-play** — Instead of *only* playing its current
opponent, each agent's training matches are mixed across: (a) simple
hard-coded "scripted" opponents that never change, (b) the *latest* version
of the opposing agent, and (c) a pool of *past frozen snapshots* of the
opposing agent ("ghosts") sampled from its whole history. *Why chosen:*
directly fixes the specialization trap above — the mix of old and current
opponents plus the "exploiter" scripted opponents means the agent can never
fully forget the basics or overfit to one specific rival.

**Fictitious Play / Ghost pool** — The general game-theory idea of training
against a *distribution* of past strategies rather than just the newest one.
The "ghosts" are just saved copies (files) of the opponent's policy from
earlier points in training, kept around and periodically sampled from.

**Behavioral Cloning (BC)** — Before self-play begins, each agent is given a
"warm start" by directly imitating a hand-written scripted expert's
decisions (supervised learning on the expert's example moves), rather than
starting from pure random behavior. *Why chosen:* pure random exploration in
a 14-action game with sparse rewards is extremely slow to get anywhere; BC
gives both agents a competent starting point so RL only has to improve
from there, not discover the entire game from scratch.

**Elo rating** — The same rating system used in chess, adapted here to track
each agent's relative skill over training time as a single trending number.
Used for monitoring/visualization, not for training decisions.

### Measuring whether it actually worked (the "did I cheat myself" checks)

**Self-play win rate** — The simplest measurement: when the two trained
agents play each other, who wins how often? This is easy to compute but
**can be misleading** — see the next term, and this distinction is one of
the most important things to understand about this project.

**Exploitability / Best-response evaluation** — The deeper, more rigorous
test. Self-play win rate only tells you how your two agents compare *to each
other* — it says nothing about whether either is actually *good*. The fix:
freeze one trained agent, then train a **brand-new opponent whose only job is
to find and exploit its weaknesses**. If that dedicated opponent can beat the
frozen agent far more than its original training partner could, the frozen
agent has a real, exploitable weak spot — even though it "won" in self-play.
This is a standard technique from game-theory-flavored RL research (used in
game AI research, e.g. Poker AI evaluation).

**NashConv** — A single combined number summarizing "how far are both agents
from an unbeatable equilibrium," built from the exploitability numbers of
*both* sides added together. Lower = closer to a genuinely balanced,
hard-to-exploit pair of strategies; higher = at least one side has an
exploitable weakness. Named after the mathematician John Nash (of "Nash
equilibrium," the game-theory concept for "neither player can do better by
changing strategy alone").

### Infrastructure / engineering terms

**Curriculum level / stage** — The three difficulty tiers agents progress
through (see Curriculum Learning above).

**Vectorized / parallel environments (SubprocVecEnv)** — Instead of running
one game at a time, 8 separate copies of the simulated environment run in
parallel worker processes so the GPU always has a full batch of experience
to learn from at once. *Why:* massively speeds up training — without this,
the GPU sits idle waiting for one slow environment to produce data.

**Checkpointing** — Periodically saving the agent's current brain to disk, so
training can be paused and resumed (e.g., after a crash) without starting
over.

**config.json / typed config** — All the numeric knobs (learning rates,
reward values, curriculum thresholds, etc.) live in one settings file with
validation, rather than being scattered and hard-coded across the codebase.
*Why:* makes every experiment reproducible and every setting auditable in
one place — standard good-engineering practice, and it directly fixed real
bugs where hardcoded values silently disagreed with the settings file.

**Seeding / reproducibility** — Every random number generator in the system
(the environment's randomness, the neural network's initialization, the
scripted opponents' randomness) is tied to a single starting "seed" number,
so re-running with the same seed reproduces the exact same training
trajectory. *Why it matters for research:* without this, you can never tell
whether a result was real or a fluke of randomness.

---

## 5. How it all fits together (plain-English architecture tour)

1. **The game** (`shared_honeypot_env.py`) — the simulated network, written
   as a Gymnasium environment. Defines what each agent can see, what moves
   they can make, and the scoring rules.
2. **The brains** (`agents.py`) — one `RLAgent` class used for both sides
   (they differ only in a few settings), wrapping RecurrentPPO.
3. **The scripted "practice partners"** (`baselines.py`) — six hand-written,
   non-learning bots (easy/medium/hard × attacker/defender) used for the BC
   warm-start, the league mix, and as a fixed yardstick for evaluation.
4. **The trainer** (`trainer.py`) — the main loop: run the curriculum, mix
   league opponents, train both agents, evaluate, save checkpoints, repeat
   for ~50 rounds ("iterations").
5. **The scoreboard** (`evaluator.py`) — runs head-to-head matches, computes
   win rates, Elo, and other statistics after every training round.
6. **The rigor check** (`exploitability.py`) — the best-response /
   NashConv tool described above, run *after* training completes to
   objectively grade the result.
7. **The web layer** (`api.py` + the Express server) — exposes training
   status, results, and a live "watch a match play out" demo stream to the
   rest of the CyberX web app.
8. **The real-world bridge** (`telemetry_adapter.py`) — a component that
   *could* take real honeypot log data (from Elasticsearch/Cowrie, a real
   open-source honeypot tool) and feed it to the trained defender for a
   recommendation, without ever training on real data. Built and unit-tested,
   but **not yet run against a live real-world feed** — be honest about this
   distinction if asked (§6/§8).

---

## 6. The real story: what was hard, and how it got fixed

This section is your best interview material. Anyone can say "I trained an
RL agent." Fewer people can explain *why it kept breaking* and how they
diagnosed it — that's what actually demonstrates understanding.

### Problem 1: The agents kept finding ways to "win" without actually playing the game

Three separate times, a full training run would look fine for a while, then
quietly go off the rails into what's called a **degenerate strategy** — the
agent stops trying to win and instead exploits a loophole in the scoring:

- **"Camping."** The reward for simply *surviving* at an advanced attack
  stage was, by accident, worth more (if you added it up over enough turns)
  than the reward for actually *completing* the attack. So the attacker AI
  rationally learned to reach an advanced stage and then just sit there
  forever, farming small rewards, instead of finishing the job. **Fix:**
  removed the "reward for existing," and only reward stage *transitions*
  and completing the actual objective — so sitting still stops paying.
- **"Reward farming."** Several individual actions (like "clear the logs")
  paid a small reward *every single time you used them*, even when doing so
  accomplished literally nothing (e.g., clearing logs when there was nothing
  to clear). The AI discovered it could just spam that one free action
  forever instead of playing the real game. **Fix:** rewrote the rule for
  the entire reward system: **no repeatable action is ever allowed to pay
  out just for being used — it must be tied to an actual change in the game
  state, capped, or scaled to the real outcome achieved.** Added automated
  tests that specifically try to "cheat" the reward function this way, so
  this class of bug can never silently return.
- **"Instant-eviction made attacking a losing bet."** Early on, if the
  defender caught the attacker, it could instantly and completely kick them
  out in one move. That made the *expected value* of attacking negative —
  even a decent attacker would statistically lose more than it gained by
  trying, so it gave up entirely. **Fix:** made containment a "knock-back"
  instead of an instant full eviction, requiring the defender to catch the
  attacker *multiple times* to actually win — more realistic (real
  incident response rarely fully evicts an APT in one action) and it removed
  the negative-EV trap.

**The one-sentence lesson (say this in an interview, it's genuinely a good
insight):** *"In reinforcement learning, the agent will always find and
exploit the literal letter of whatever you reward — if there's any way to
score points without actually achieving the intended goal, it will find it.
Debugging that required tracing actual game replays to see exactly what the
agent was doing turn-by-turn, not just staring at a win-rate graph."*

### Problem 2: The infrastructure itself crashed unpredictably

- **A GPU driver error (`CUDNN_STATUS_INTERNAL_ERROR`) crashed an
  overnight run hours in.** Root cause traced to the evaluation step: every
  training round, the code was moving the live training model back and
  forth between GPU and CPU memory to safely run evaluation matches in
  parallel, and repeatedly doing that reshuffle of the neural network's
  internal memory-layer weights was destabilizing the GPU driver. **Fix:**
  evaluation now runs on a separate, throwaway CPU copy of the brain, so the
  actual training model is never touched or moved.
- **Crashes left orphaned worker processes that ate all the RAM.** When
  training crashed, the ~16 parallel-environment worker processes (see
  "vectorized environments" above) weren't properly shut down, so each crash
  leaked several gigabytes of memory. A few crashes in a row could exhaust
  the machine's RAM and cause the *next* run to fail too, for an unrelated
  reason. **Fix:** added a proper cleanup step and an auto-restart
  supervisor that force-kills the entire crashed process tree before trying
  again, and automatically resumes from the last saved checkpoint.

**The lesson:** production ML isn't just "does the model learn" — a huge
fraction of real engineering effort goes into making the *system* around the
model reliable, resumable, and debuggable when things fail at 3am on an
unattended run.

### Problem 3: Reward tuning was a real balancing act, verified with data, not vibes

After fixing the collapses, the game briefly became too easy for the
attacker (~80% attacker win rate) — traced to two specific causes found by
reading actual match transcripts: one attack move was accidentally undetectable,
and the defender's detection-related actions paid too little compared to its
other options, so it never bothered using them. Fixing both concrete issues
(not blind "let's turn a bunch of numbers") brought the game to a stable,
contested state, confirmed by **five separate full training runs**, not
just one: **attacker win rate 0.60 ± 0.04, defender 0.40 ± 0.04, zero
draws, no collapse in any run.**

---

## 7. What this project IS and IS NOT (be upfront about this — it's a strength, not a weakness)

### It IS:
- A working, reproducible **research prototype / simulation** of an
  attacker-vs-defender training environment.
- A demonstration of hands-on MARL engineering: designing the game rules,
  diagnosing and fixing three distinct types of training collapse, and
  building the infrastructure (parallel training, checkpointing, crash
  recovery, config management) to run it reliably.
- Evaluated with **more rigor than the field's default** — most projects at
  this stage stop at self-play win rate; this one goes further and measures
  exploitability / NashConv, which is the harder, more honest metric.
- Backed by **5 full training runs**, giving a mean ± standard deviation, not
  a single lucky number.

### It is NOT:
- **Not a deployed or production-ready security tool.** It does not defend
  any real network today.
- **Not trained or validated on real attack data.** The simulation's numbers
  (attack success rates, how "loud" each action is, etc.) were hand-designed
  to be *plausible*, not calibrated against real breach/honeypot datasets.
  The telemetry adapter that *could* bridge to real data exists and is unit-
  tested, but has not been exercised against a live real-world feed.
- **Not using a novel algorithm.** The RL algorithm itself (PPO) is a
  standard, well-known industry technique — the contribution here is the
  environment design, the multi-agent training setup, the debugging/fixing
  of real failure modes, and the evaluation methodology — not inventing new
  math.
- **Not yet a peer-reviewed research result.** The seeds used across the "5
  runs" all share the same random seed value (they're 5 independently-run
  replicates, not 5 different seed values) — an honest researcher would note
  this distinction; it's a minor rigor gap, not a flaw in the actual result.
- **The defender currently has a known, measured weakness**: exploitability
  testing shows a best-response attacker can beat it about 80% of the time,
  versus the ~40% the co-trained attacker manages — meaning the defender's
  training left some room for it to be smarter. This is a known, quantified
  limitation, not a hidden one (see §9 for how to discuss this as a
  strength).

---

## 8. The pitch

### 30-second version (elevator pitch)
"I built a self-play multi-agent reinforcement learning system that trains an
AI attacker and an AI defender against each other in a simulated cyber
intrusion scenario — like AlphaGo, but for a hacker-vs-SOC-analyst game.
Along the way I hit and fixed three distinct kinds of training collapse where
the AI found loopholes in the reward system, and validated the final result
not just with win-rate but with a proper game-theoretic 'exploitability'
test, across five independent training runs."

### 2-minute version (if asked to go deeper)
"The project is a two-agent reinforcement learning simulation inside a larger
cybersecurity platform — one AI plays an advanced persistent threat attacker
progressing through a kill chain, the other plays a SOC defender that has to
decide when it has enough evidence to act. Both learn purely through
self-play using RecurrentPPO, a standard, well-proven RL algorithm, with an
LSTM so they can remember clues over time since neither sees the full game
state.

The interesting engineering problems weren't really about the algorithm —
they were about getting self-play to actually converge to something
meaningful instead of collapsing. Three times, the agents found a way to
rack up reward without actually playing the intended game — camping in a
safe state, spamming a free action, or the game math accidentally making
attacking a losing bet. I traced each one back to actual match replays,
diagnosed the exact reward-design bug, fixed it, and wrote automated tests
that would catch that class of exploit if it ever came back.

I also didn't stop at the easy metric. Self-play win rate can lie to you —
two agents can look 'balanced' while both are actually mediocre. So I built
a best-response / exploitability evaluation: freeze one agent, train a
brand-new opponent whose only job is to beat it, and see how much better it
does. That gave me an honest number — NashConv around 0.36 — and it revealed
something self-play alone would never have shown: the defender, despite
looking competitive in self-play, is meaningfully more exploitable than the
attacker. That's now the clearly-identified next thing to fix, and I know
exactly which lever to pull for it."

### If asked "what would you do next" (always have this ready)
"Two things. First, use that exploitability finding directly: prioritize the
defender's training against the specific opponent strategies it currently
loses to, instead of sampling opponents uniformly — a known technique called
prioritized self-play. Second, run a true multi-seed sweep with actually
different random seeds and add ablation experiments — turn off curriculum
learning, or the behavioral-cloning warm-start, one at a time — to prove
which pieces are actually responsible for the result, rather than just
observing that the combination works."

---

## 9. Anticipated cross-questions and how to defend them

**Q: "Is this just self-play, hasn't that been done a million times?"**
> Yes, self-play itself isn't novel — AlphaGo popularized it years ago. The
> value here is in applying it carefully to a security-specific game with
> partial observability and a stealth/detection trade-off, diagnosing three
> real training-collapse failure modes along the way, and evaluating the
> result with exploitability testing rather than stopping at self-play win
> rate, which is the part most similar projects skip.

**Q: "Your defender is 80% exploitable — doesn't that mean the project
failed?"**
> No — it means the evaluation is honest. If I'd only reported self-play win
> rate, you'd never have known that. Finding and quantifying that weakness
> *is* the result; it tells me exactly where to focus next (prioritized
> self-play against the defender's specific blind spot), instead of blindly
> tuning reward numbers with no idea whether it's helping.

**Q: "How do you know the agents actually learned something, and didn't just
get lucky / memorize a script?"**
> Two ways. First, they're evaluated against baseline scripted opponents
> they never specifically trained against in that exact form, and they beat
> the weak ones near-100% and contest the strong ones — that rules out pure
> memorization of one specific opponent. Second, the result held across five
> independent training runs with the same configuration, landing within a
> few percentage points each time (60% ± 4%), rather than being a one-off.

**Q: "Why RecurrentPPO / LSTM instead of a simpler feedforward network?"**
> Because the environment is partially observable — neither agent sees the
> full ground truth, only noisy hints. Without memory, the network can only
> react to the instant, not build up evidence over several turns the way a
> real analyst does. I confirmed this mattered by design, not by guessing —
> the defender's whole "investigate to build evidence, then act" mechanic
> only works if it can remember what it's already seen.

**Q: "Why not just use a bigger/different algorithm — DQN, SAC, a
transformer?"**
> PPO is the standard, well-validated choice for this kind of two-player
> game with continuous training — reliable convergence properties matter a
> lot here because I was already fighting instability from having *two*
> learning agents destabilizing each other's training environment
> simultaneously. Introducing a second unproven variable (an unusual
> algorithm) on top of that would have made debugging the actual collapses
> far harder to isolate. The interesting contribution here was never meant
> to be algorithmic novelty — it's the environment design, the training
> stability engineering, and the evaluation methodology.

**Q: "Isn't reward shaping just 'cheating' — you're hand-designing the
answer?"**
> Reward shaping defines the *goal*, not the *strategy* — I never told the
> agent what sequence of actions to take, only what outcomes matter (finish
> the objective, avoid getting caught / catch the attacker with evidence).
> The actual strategies — when to go stealthy, when to rush, when to
> investigate vs. contain — were entirely learned, and in fact repeatedly
> surprised me by finding loopholes I hadn't anticipated, which is direct
> evidence the reward function was defining a goal, not scripting a
> behavior.

**Q: "Would this work on a real network / is this deployable?"**
> Not today, and I'd say that clearly. This is a simulation with hand-
> designed dynamics — it demonstrates the training methodology and
> evaluation approach, not a production defender. There's a bridge component
> (`telemetry_adapter.py`) designed to take real honeypot log data and get an
> action recommendation from the trained defender in a safe "shadow mode"
> (suggest-only, never auto-acting), which is the honest next step toward
> realism — but it hasn't been run against live data yet.

**Q: "What was the single hardest bug and how did you find it?"**
> The GPU crash (`CUDNN_STATUS_INTERNAL_ERROR`) mid-training, hours into an
> overnight run. It wasn't in the RL logic at all — it was that evaluation
> was shuffling the live neural network between GPU and CPU memory every
> round to run matches safely in parallel, and that repeated reshuffling of
> the LSTM's internal memory layout was what actually destabilized the CUDA
> driver. Found it by isolating what changed between "training step" (fine)
> and "eval step" (crashed), and fixed it by having evaluation work on a
> disposable copy of the brain instead of the live one.

**Q: "What's NashConv, actually, in your own words — don't just say the
definition."**
> It answers "if I let a dedicated opponent train specifically to counter
> each of my agents, how much better could it do than what they already
> beat?" Add that gap up for both sides and you get NashConv. Zero would
> mean neither agent has any exploitable weakness left — a true equilibrium.
> Mine is 0.36, meaning there's still a real, measurable gap, concentrated
> almost entirely on the defender's side.

**Q: "Are your 5 runs really 5 seeds?"**
> Honestly, no — I should be precise here: all five used the same
> configured random seed value; they're five independently-executed training
> runs, so the variation between them comes from non-determinism in the GPU
> computation itself, not from deliberately varying the seed. It's still a
> meaningful robustness check (five separate executions landing within ±4%
> of each other), but a true seed sweep with different seed values is the
> more rigorous next step, and I know exactly how to do it.

---

## 10. Numbers to have cold (memorize these, they will be double-checked)

| Metric | Value | What it means in one breath |
|---|---|---|
| Attacker self-play win rate | **0.60 ± 0.04** (across 5 runs) | Attacker wins ~60% of self-play matches |
| Defender self-play win rate | **0.40 ± 0.04** | Contested, not one-sided |
| Draws | **0%** | Every game ends decisively — no stalling/collapse |
| NashConv | **0.36 ± 0.06** | Moderate exploitability gap remains ("decent," not "solved") |
| Attacker exploitability gap | **0.11** | Attacker is close to unbeatable-by-a-specialist |
| Defender exploitability gap | **0.25** (best-response beats it ~0.80 of the time) | Defender is the known, quantified weak point |
| Action space | **14 attacker / 12 defender actions** | Rich enough to require real strategy, not trivial |
| Observation | **12-dimensional, partially observable** | Neither side sees full ground truth |
| Training runs completed | **5 full runs, 50 iterations each** | Not a single lucky run |
