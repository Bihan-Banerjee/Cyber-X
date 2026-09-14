# CyberX — RL + Honeypot Integration: Structure & Testing Guide

This document explains, in detail, how the **reinforcement-learning (RL)
defender** and the **honeypot** subsystems are wired into the rest of CyberX,
what each moving part does, and **how to run and verify the whole "RL ↔ honeypot"
loop** end to end.

> TL;DR of the integration: a honeypot catches real attacks → the events land in
> Elasticsearch → a Python adapter turns them into the observation the trained RL
> defender was trained on → the defender recommends a defensive action → the UI
> shows that recommendation and deep-links to the matching CyberX tool. The same
> RL data also powers a research dashboard (RL Arena).

---

## 1. The big picture

```
                      ┌─────────────────────────────────────────────────────────┐
                      │                     BROWSER (Vite :8080)                  │
                      │  /command-center   /honeypots   /rl-arena                 │
                      │      │                │              │                    │
                      │  DefenderCopilot  DefenderCopilot   RLArena               │
                      └──────┼────────────────┼──────────────┼────────────────────┘
                             │  all frontend calls go to API_BASE_URL (Express :5000)
                             ▼
                ┌──────────────────────────────────────────────┐
                │            EXPRESS BACKEND  (:5000)            │
                │  /api/scan/*       (security tools)            │
                │  /api/honeypot/*   (Docker + ES queries)       │
                │  /api/rl/*  ──────►  STREAMING PROXY ──────────┼──┐
                └──────────────────────────────────────────────┘  │
                                                                    ▼
                                          ┌─────────────────────────────────────┐
                                          │      FLASK RL API  (api.py :5001)     │
                                          │  /status /metrics/history             │
                                          │  /exploitability /plots/<name>        │
                                          │  /telemetry/suggest                   │
                                          │  /telemetry/stream  (SSE)  ◄── hero    │
                                          │  /demo/stream (SSE) /leaderboard …     │
                                          └───────────┬───────────────────────────┘
                                                      │ TelemetryAdapter + DefenderAdvisor
                                                      ▼
              ┌──────────────────────────────────────────────────────────────┐
              │     HONEYPOT STACK (docker-compose.honeypot.yml)               │
              │  Cowrie(2222/2223) Dionaea(21,445…) Zeek                       │
              │        │  logs                                                  │
              │        ▼                                                        │
              │  Logstash ──► Elasticsearch (:9200, honeypot-* indices) ◄───────┤ queried by Flask
              │  Kibana(:5601)            Ollama(:11434, optional LLM)          │
              └──────────────────────────────────────────────────────────────┘
```

**Key design fact:** the Flask RL server, the honeypot containers and
Elasticsearch are **local-only** (they need a GPU / Docker / lots of RAM). They
are **not** part of the hosted deployment. So every RL dashboard is built
**live-first with an artifact fallback**: if the live backend answers it uses
real data; otherwise it reads committed snapshots in
[`public/rl-artifacts/`](../public/rl-artifacts). That is why the dashboards still
work on the hosted site and on a laptop with nothing running.

### Ports at a glance

| Service | Port | Started by |
|---|---|---|
| Vite dev server (frontend) | 8080 | `npm run fe:dev` |
| Express backend | 5000 | `npm run be:dev` |
| Flask RL API | 5001 | `python api.py` |
| Elasticsearch | 9200 | docker compose |
| Kibana | 5601 | docker compose |
| Logstash | 5044 / 9600 | docker compose |
| Cowrie honeypot | 2222 (SSH), 2223 (Telnet) | docker compose |
| Dionaea honeypot | 21, 42, 135, 4445→445, 1433, 3306, 5060 | docker compose |
| Ollama (optional LLM) | 11434 | docker compose |

---

## 2. The data flow of the "RL honeypot thingy", step by step

1. **An attacker hits a honeypot.** e.g. someone SSHes to `localhost:2222`
   (Cowrie) and tries passwords / runs commands.
2. **Logs are shipped to Elasticsearch.** Cowrie/Dionaea/Zeek write JSON logs;
   **Logstash** ingests them into `honeypot-*` indices in **Elasticsearch**.
3. **Flask reads the recent events.**
   [`telemetry_adapter.py`](../src/server/rl/telemetry_adapter.py) →
   `TelemetryAdapter.fetch_events()` queries
   `POST http://localhost:9200/honeypot-*/_search` for the last few minutes.
4. **Events → observation.** `TelemetryAdapter.summarize()` counts failed logins,
   suspicious commands, port-scans, privilege-escalation attempts, downloads,
   distinct sessions/IPs, then `build_observation()` maps those into the **12-dim
   defender observation** the policy was trained on (see the env doc in
   [`PROJECT_CONTEXT.md`](../src/server/rl/PROJECT_CONTEXT.md) §8).
5. **The trained defender recommends an action.** `DefenderAdvisor` loads the
   trained `RecurrentPPO` model and threads its LSTM state across calls, returning
   one of the 12 defender actions (`monitor`, `investigate`, `threat_hunt`,
   `isolate_host`, `hard_block`, …).
6. **Flask streams it out.** `GET /api/rl/telemetry/stream` (SSE) emits one
   `{events_summary, observation, action, action_name}` event every few seconds.
7. **Express forwards the stream.** The `/api/rl` proxy in
   [`index.ts`](../src/server/index.ts) now **streams** SSE through (it used to
   buffer — that was fixed for this integration).
8. **The UI shows it.** [`DefenderCopilot.tsx`](../src/components/DefenderCopilot.tsx)
   subscribes via `EventSource`, renders the recommended action, the MITRE D3FEND
   technique, the triggering telemetry, and a **"Run in CyberX →"** button that
   deep-links to the matching tool via
   [`defenderActionMap.ts`](../src/data/defenderActionMap.ts).

If any live piece is missing, the Copilot falls back to
[`public/rl-artifacts/copilot_sample.json`](../public/rl-artifacts/copilot_sample.json)
and shows a **REPLAY** badge instead of **LIVE**.

---

## 3. File-by-file structure

### 3.1 Frontend (`src/`)

| Path | Role |
|---|---|
| [`pages/CommandCenter.tsx`](../src/pages/CommandCenter.tsx) | **Unified view** (`/command-center`): live honeypot threat feed + Defender Copilot + RL health (NashConv, training status) + recent tool activity. Ties all three subsystems together. |
| [`pages/RLArena.tsx`](../src/pages/RLArena.tsx) | **Research dashboard** (`/rl-arena`, alias `/rl-training`): convergence curves, Elo leaderboard, exploitability/NashConv panel, animated best-vs-best demo replay, training control. Replaced the old broken `RLTraining.tsx`. |
| [`pages/HoneypotMonitor.tsx`](../src/pages/HoneypotMonitor.tsx) | **Honeypot SOC** (`/honeypots`): per-honeypot status + start/stop, recent attacks, and an embedded `<DefenderCopilot />`. |
| [`components/DefenderCopilot.tsx`](../src/components/DefenderCopilot.tsx) | The hero widget. Subscribes to the telemetry SSE; renders the recommendation + tool deep link; replay fallback. |
| [`data/defenderActionMap.ts`](../src/data/defenderActionMap.ts) | Maps the 12 defender actions → label, **MITRE D3FEND** technique, and the CyberX tool route. Also the action↔technique grounding table for the paper. |
| [`lib/rlData.ts`](../src/lib/rlData.ts) | `fetchRL()` — live-first, artifact-fallback fetch helper + shared TypeScript types. Returns `{ data, source: "live" \| "replay" }`. |
| [`lib/api.ts`](../src/lib/api.ts) | `API_BASE_URL` (defaults to `http://localhost:5000`). |
| [`routes/app-router.tsx`](../src/routes/app-router.tsx) | Routes, incl. `/command-center`, `/rl-arena`, `/rl-training`, `/honeypots`. |
| [`data/navigation.ts`](../src/data/navigation.ts) | Top nav items. |

### 3.2 Express backend (`src/server/`)

| Path | Role |
|---|---|
| [`index.ts`](../src/server/index.ts) | App entry (:5000). Mounts `/api/scan`, `/api/honeypot`, `/api/map`, `/api/signal`, and the **streaming** `/api/rl` proxy to Flask. |
| [`honeypot/honeypotManager.ts`](../src/server/honeypot/honeypotManager.ts) | Docker lifecycle (start/stop containers) + Elasticsearch queries for status/attacks/stats. |
| [`routes/honeypot.ts`](../src/server/routes/honeypot.ts) | REST: `/api/honeypot/status`, `/attacks/recent`, `/attacks/stats`, `/start/:type`, `/stop/:type`. |

### 3.3 Python RL stack (`src/server/rl/`)

| Path | Role |
|---|---|
| [`api.py`](../src/server/rl/api.py) | Flask API (:5001). Training control, metrics, leaderboard, demo SSE, **`/exploitability`**, **`/metrics/history`**, **`/plots/<name>`**, **`/telemetry/suggest`**, **`/telemetry/stream`**. |
| [`telemetry_adapter.py`](../src/server/rl/telemetry_adapter.py) | `TelemetryAdapter` (ES → 12-dim obs) + `DefenderAdvisor` (trained model inference, LSTM state threaded). The honeypot↔RL bridge. |
| [`shared_honeypot_env.py`](../src/server/rl/shared_honeypot_env.py) | The MARL environment (the game). `DEF_ACTION_NAMES` defines the action order the map relies on. |
| [`export_artifacts.py`](../src/server/rl/export_artifacts.py) | Snapshots a real run into `public/rl-artifacts/` (history, exploitability, leaderboard, training plot, **`--demo`** recorded episode). |
| [`shadow_eval.py`](../src/server/rl/shadow_eval.py) | Offline shadow-mode evaluation: replay a honeypot window through the trained defender vs an analyst heuristic. The paper's Phase-D result. |
| [`tests_rl.py`](../src/server/rl/tests_rl.py) | 17 self-tests (run after any env/RL change). |
| [`requirements.txt`](../src/server/rl/requirements.txt) | Python deps (torch, sb3-contrib, gymnasium, flask, …). |

### 3.4 Committed artifacts ([`public/rl-artifacts/`](../public/rl-artifacts))

These let the dashboards work with **no backend** (hosted site / cold laptop):
`metrics_history.json`, `exploitability.json`, `leaderboard.json`,
`training_curves.png`, `demo_episode.json`, `copilot_sample.json`,
`shadow_eval.json`, `manifest.json`. Regenerate with `export_artifacts.py`.

### 3.5 Honeypot infra (`docker/`)

[`docker-compose.honeypot.yml`](../docker/docker-compose.honeypot.yml) — Cowrie,
Dionaea, Zeek, Elasticsearch, Kibana, Logstash, Ollama.

---

## 4. One-time setup

### 4.1 Frontend / backend (Node)
```powershell
cd D:\EXTRA\Cyber-X
npm install
```

### 4.2 Python RL environment
A venv already exists at the repo root (`venv\`). If you need to (re)install:
```powershell
cd D:\EXTRA\Cyber-X
# (optional) python -m venv venv
.\venv\Scripts\python.exe -m pip install -r src\server\rl\requirements.txt
```
Sanity-check CUDA/torch:
```powershell
.\venv\Scripts\python.exe -c "import torch; print('cuda:', torch.cuda.is_available())"
```

### 4.3 Trained model (needed for live RL)
The Copilot/telemetry needs a trained defender `.zip`. Models live under
`src/server/rl/models/cyberx_marl/` (gitignored). The existing runs include
`results/run_four_a/defender_best.zip`. If you have no models, train a quick one:
```powershell
cd D:\EXTRA\Cyber-X\src\server\rl
..\..\..\venv\Scripts\python.exe run_training.py --iterations 3 --timesteps 3000 --seed 7 --save-dir ./models/smoke --no-auto-restart
```

---

## 5. Running & testing — three tiers

Pick the tier that matches what you want to verify. Each tier builds on the
previous one.

### Tier 1 — Frontend only (replay mode, no backend)

Verifies the UI, routing, artifacts and the replay fallback.

```powershell
cd D:\EXTRA\Cyber-X
npm run fe:dev
```
Open **http://localhost:8080** and check:

- `/rl-arena` — convergence curves, **NashConv ≈ 0.36**, leaderboard, and the
  **"Play recorded episode"** demo animates a real best-vs-best match. Top-right
  badge says **REPLAY**.
- `/honeypots` — the **DEFENDER COPILOT** card cycles recommendations with a
  **REPLAY** badge; the honeypot list is empty (no backend).
- `/command-center` — health cards show NashConv from the artifact; threat feed
  and tool activity show "stack offline" hints.

✅ **Pass:** all three pages render with data and no console errors; Copilot shows
a recommendation and a working **"Run in CyberX →"** link.

### Tier 2 — Live RL (Express + Flask, no honeypot)

Verifies the live RL endpoints and the streaming proxy. The Copilot will run the
**trained defender against empty telemetry** (ES absent → zero-ish observation),
which still exercises the full live pipeline.

**Terminal A — Flask RL API:**
```powershell
cd D:\EXTRA\Cyber-X\src\server\rl
..\..\..\venv\Scripts\python.exe api.py
# -> CyberX RL API running on http://localhost:5001
```
**Terminal B — Express + Vite together:**
```powershell
cd D:\EXTRA\Cyber-X
npm run dev
```
Smoke-test the endpoints (PowerShell):
```powershell
irm http://localhost:5001/api/rl/status
irm http://localhost:5001/api/rl/exploitability
irm http://localhost:5000/api/rl/exploitability      # through the Express proxy
# SSE through the proxy (Ctrl+C to stop) — you should see `data: {...}` lines:
curl.exe -N http://localhost:5000/api/rl/telemetry/stream
```
In the browser, `/rl-arena` and `/command-center` badges should now read
**LIVE**, and the Copilot should update on its own every few seconds.

✅ **Pass:** `/api/rl/*` returns JSON; the `curl -N` telemetry stream prints
repeating `data:` lines (proves the streaming proxy works); the Copilot shows
**LIVE** and changes over time.

> If the Copilot stays on **REPLAY** in the browser while `curl -N` works, it's a
> stale build — hard-refresh; if `curl -N` returns one blob and hangs, the
> streaming proxy didn't load (restart `npm run be:dev`).

### Tier 3 — Full loop with real honeypot telemetry

This is the real "RL honeypot thingy". Requires **Docker Desktop**.

**1. Start the honeypot + ELK stack:**
```powershell
cd D:\EXTRA\Cyber-X\docker
docker compose -f docker-compose.honeypot.yml up -d elasticsearch logstash cowrie
# (add dionaea zeek kibana if you want them; ES needs ~1-2 min to be ready)
```
Wait for Elasticsearch:
```powershell
irm http://localhost:9200/_cluster/health   # status should be green/yellow
```

**2. Generate some attack traffic against Cowrie:**
```powershell
# try a few bad logins / commands (any wrong password works; Cowrie logs it)
ssh -p 2222 root@localhost      # try passwords like 123456, then run: ls, wget http://x/y, sudo su
```
Generate a handful of sessions so the counters are non-trivial.

**3. Confirm events reached Elasticsearch:**
```powershell
irm "http://localhost:9200/honeypot-*/_count"
```
Should report a non-zero `count` after Logstash ingests (a few seconds lag).

**4. With Flask (Tier 2 Terminal A) + Express/Vite (Terminal B) running**, the
trained defender now reads **real** telemetry. Check the bridge directly:
```powershell
# one-shot suggestion from live ES:
irm -Method Post http://localhost:5000/api/rl/telemetry/suggest -ContentType 'application/json' -Body '{}'
# -> { action, action_name, observation: [...] }
```
Then open **`/honeypots`** or **`/command-center`**:
- The honeypot list shows Cowrie **running** with rising connection/attack counts.
- The **threat feed** lists your attack sessions (IP → port).
- The **Defender Copilot** (LIVE) recommends an action driven by the real
  telemetry (e.g. lots of failed logins → `rate_limit`; suspicious commands +
  privilege escalation → `isolate_host` / `threat_hunt`), with a tool deep link.

✅ **Pass:** real attacks appear in the feed AND the Copilot's recommendation
reflects the telemetry summary shown beneath it.

**Tear down:**
```powershell
cd D:\EXTRA\Cyber-X\docker
docker compose -f docker-compose.honeypot.yml down
```

---

## 6. Verifying the RL side (no UI)

```powershell
# 17 self-tests (no pytest needed) — run after any RL/env change:
cd D:\EXTRA\Cyber-X\src\server\rl
..\..\..\venv\Scripts\python.exe tests_rl.py        # expect "17 passed, 0 failed"

# Regenerate dashboard artifacts from a real run (+ recorded demo episode):
..\..\..\venv\Scripts\python.exe export_artifacts.py --demo

# Shadow-mode evaluation (paper Phase-D); --synthetic makes it runnable with no ES:
..\..\..\venv\Scripts\python.exe shadow_eval.py --synthetic 400 --out ..\..\..\public\rl-artifacts\shadow_eval.json
```

---

## 7. New / changed `/api/rl/*` endpoints (added for this integration)

| Endpoint | Method | Returns |
|---|---|---|
| `/api/rl/metrics/history` | GET | parallel-array training history for charts |
| `/api/rl/exploitability` | GET | aggregated NashConv / best-response (mean ± std + per-run) |
| `/api/rl/plots/<name>` | GET | results PNG (`training_progress` aliases `training_curves.png`; falls back to newest run subdir) |
| `/api/rl/telemetry/stream` | GET (SSE) | rolling defender suggestion over the live honeypot feed |
| `/api/rl/telemetry/suggest` | POST | one-shot defender suggestion (pre-existing) |

Express `/api/rl` proxy ([`index.ts`](../src/server/index.ts)) was upgraded to a
**streaming** proxy so the SSE endpoints flow through in real time.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Dashboards show **REPLAY** even with Flask up | Frontend can't reach Express, or Express can't reach Flask. Check `npm run be:dev` is on :5000 and `api.py` on :5001; check `API_BASE_URL`. |
| `curl -N …/telemetry/stream` returns one blob then hangs | Streaming proxy not loaded — restart `npm run be:dev`. |
| Copilot LIVE but always recommends `monitor` | Expected with **no honeypot/ES** (empty telemetry → zero observation). Do Tier 3 to feed real events. |
| Copilot/`suggest` → 404 "No trained defender" | No model. Train one (§4.3) or point at `results/run_four_a/defender_best.zip`. |
| `/api/rl/telemetry/suggest` errors about ES | Elasticsearch not up / no `honeypot-*` index yet. Start the stack and generate traffic. |
| `torch.cuda.is_available()` is False | CPU-only torch wheel installed — reinstall from the cu121 index (see `PROJECT_CONTEXT.md` §2). |
| ES container unhealthy / OOM | It needs ~1-2 GB. Close other apps; the compose sets a 512 MB heap. |
| Stale python training workers hog RAM | `Get-Process python` and kill leftovers before a new run. |

---

## 9. Where to read more

- RL system internals, the game design, training, and the research roadmap:
  [`src/server/rl/PROJECT_CONTEXT.md`](../src/server/rl/PROJECT_CONTEXT.md).
- The integration plan that produced this work:
  `~/.claude/plans/radiant-finding-emerson.md` (local).
