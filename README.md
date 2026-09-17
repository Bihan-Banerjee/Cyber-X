# CyberX

CyberX is a unified cyber-operations platform that brings offensive tooling,
defensive deception, machine learning, and global visualization together in one
interactive web application. It combines a suite of 100+ security tools with a
reinforcement-learning red-team versus blue-team simulation, a honeypot activity
monitor, and a 3D world map, all behind a single cyberpunk-styled interface.

It is built as both a practical toolkit and a research and training environment
for modern security workflows.

> Status: active project. The security tools and the web application are fully
> functional. The reinforcement-learning stack is a controlled simulation of
> training dynamics (a workshop / experience-paper level result), not a
> deployment-ready defender. A small number of tools are clearly labeled as
> demo/simulated where real execution needs infrastructure a hosted web app
> cannot provide (see Honest status below).

---

## What is inside

CyberX is organized as a set of top-level views:

- **Security Tools** - a searchable, paginated catalog of 100+ tools across 13
  categories (Network, Recon, Web, Cloud, Crypto, Forensics, Intel,
  Exploitation, Password, Social Engineering, Utilities, Mobile, Wireless).
  Examples: port scanner, WHOIS/RDAP, DNS recon, subdomain enumeration, SSL/TLS
  analyzer, HTTP header and cookie auditors, SQLi/XSS/SSRF/open-redirect testers,
  hash cracking and generation, JWT decoding, steganography (image/audio/doc/
  video), file and binary forensics (hex, strings, PE/ELF/Mach-O, PDF, APK, disk
  image), packet analysis, and many OSINT lookups.
- **Command Center** - a single operational screen that ties the honeypot feed,
  the trained defender's live recommendation, RL system health, and recent tool
  activity together.
- **RL Arena** - the research showcase for the multi-agent RL core: convergence
  curves with confidence intervals, the exploitability result, a cross-play
  matrix and empirical Nash mixture, a seed-sweep comparison, and an animated
  best-versus-best replay.
- **Red vs Blue** - a live view of an attacker policy against the RL defender's
  recommendations with kill-chain progress, plus a replay fallback.
- **Honeypots** - a monitor for honeypot status and a recent-attack feed.
- **Map Layers** - a 3D globe (react-globe.gl) with signal-strength, 5G coverage,
  and attack-origin layers.
- **Guide** - in-app documentation for every tool and subsystem.
- **Dashboard** - a high-level activity and system overview.

---

## Architecture

Three cooperating processes:

```
Browser (React SPA, Vite)
        |
        |  /api/scan/*, /api/honeypot/*  (REST)
        v
Express API server (Node/TypeScript, port 5000)
        |
        |  /api/rl/*  (proxied, incl. Server-Sent Events)
        v
Python RL API (Flask, port 5001)  ->  Stable-Baselines3 RecurrentPPO agents
```

- The **frontend** is a React single-page app. It talks to the Express API for
  the security tools and honeypot data, and to the RL API (through an Express
  proxy) for training status and live agent streams.
- The **Express server** hosts the 90+ scan endpoints backed by ~79 scanner
  modules, plus honeypot and map-data routes. It applies a CORS allowlist,
  security headers, an optional API-key gate, per-endpoint rate limiting, an
  SSRF egress guard, and safe error handling.
- The **Python RL stack** (`src/server/rl`) is a 2-agent APT-attacker versus
  SOC-defender game trained with Independent PPO plus curriculum learning,
  league self-play, and behavioral-cloning warm-start, exposed via Flask.

The frontend is live-first with an artifact fallback: the RL dashboards render
from baked JSON snapshots when the Python stack is not running, so the app is
useful even without the RL backend.

---

## Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI),
React Router, Chart.js and Recharts, react-globe.gl and three.js, Leaflet,
Framer Motion, TanStack Query, react-hook-form, Zod, lucide-react.

**Backend:** Node.js, Express, TypeScript (tsx / NodeNext ESM), Multer,
express-rate-limit, CORS, Axios, sharp (image processing), whois, wav
encode/decode, dockerode.

**Reinforcement learning:** Python, Gymnasium, Stable-Baselines3 and
sb3-contrib (RecurrentPPO with an LSTM policy), PyTorch (CUDA), NumPy, SciPy,
Matplotlib, TensorBoard, Flask.

---

## Getting started

### Prerequisites

- Node.js 20+ (the server targets NodeNext ESM; Node 20/22/24 all work)
- npm
- Optional, only for the RL stack: Python 3.10+ and the packages in
  `src/server/rl/requirements.txt` (a CUDA-capable GPU helps for training)

### Install

```bash
npm install
```

### Run in development

```bash
# frontend + backend together
npm run dev

# or individually
npm run fe:dev   # Vite dev server on http://localhost:8080
npm run be:dev   # Express API on http://localhost:5000
```

Optionally, run the RL API:

```bash
cd src/server/rl
pip install -r requirements.txt
python api.py     # Flask on http://localhost:5001
```

### Build and run for production

```bash
npm run build     # builds the frontend and compiles the server to dist/
npm start         # runs the compiled server (node dist/server/index.js)
```

### Configuration

Copy `.env.example` to `.env` and adjust as needed. The most important settings
for a deployment:

- `CORS_ORIGINS` - controls which browser origins may call the API. Leave it
  unset (the default) to reflect any origin, so a deployed frontend works with no
  extra configuration. To restrict it, set a comma-separated allowlist of exact
  origins (a trailing slash is tolerated) or `*`. The API is unauthenticated by
  default, so set `CYBERX_API_KEY` if you need real access control.
- `VITE_API_BASE_URL` - set to your backend URL before building the frontend if
  the frontend and backend are on different origins.
- `CYBERX_API_KEY` - optional; if set, all `/api/*` calls must send a matching
  `X-API-Key` header.
- Optional third-party keys enrich a few tools: `ABUSEIPDB_API_KEY`,
  `VT_API_KEY`, `NUMVERIFY_API_KEY`, `HUNTER_API_KEY`. Tools work without them,
  with reduced data.

### Tests

```bash
npm run test:server        # server security tests (Node test runner)
cd src/server/rl && python tests_rl.py   # RL unit tests
```

---

## Project structure

```
src/
  pages/            React pages, including pages/tools/* (one file per tool)
  components/        shared UI, WorldMap, DefenderCopilot, CyberpunkCard, ...
  routes/            app-router.tsx (lazy-loaded routes)
  lib/               api base, RL data fetch helpers
  server/
    index.ts         Express app (CORS, rate limit, API-key gate, proxy)
    routes/          scan.ts (all tool endpoints), honeypot.ts, mapData.ts, ...
    scanners/        ~79 scanner modules (one concern each)
    utils/           ssrfGuard, safeError, rate limiter, activity logger
    rl/              Python MARL stack (Gymnasium env, SB3 training, Flask API)
docs/                deep-dive documentation
public/rl-artifacts/ baked RL result JSON for the live-first/replay dashboards
```

---

## Honest status

This project deliberately keeps an honest boundary between what runs for real
and what is illustrative:

- **Real:** the great majority of the tools do genuine work (real network scans,
  real API queries, real file/binary parsing, real crypto). Recent examples that
  were made real include the Packet Analyzer (parses real libpcap files), Email
  Breach Check (queries a live breach API), Reverse IP Lookup, OSINT Search
  (DuckDuckGo), Container Scanner (live Docker Hub metadata and image-config
  checks), and Kubernetes Enumeration (live Kubernetes REST API).
- **Demo / simulated (clearly labeled in the UI and guide):** the Packet
  Capturer shows synthetic packets because real live capture needs npcap/libpcap
  and administrator privileges a hosted web app cannot use.
- **Partial by design:** the Container Scanner reports real image metadata and
  configuration issues but does not run package-level CVE scanning (that needs a
  local scanner such as Trivy or Grype; the tool says so and gives the command).
- **Research framing:** the RL result is a reproducible, converged, contested
  attacker-versus-defender equilibrium with a measured exploitability gap. It is
  a study of training dynamics and reward-design pitfalls, not a claim of a
  production-grade autonomous defender. See the RL docs below.

---

## Security and responsible use

CyberX includes active security tools. Use them only against systems you own or
are explicitly authorized to test. Unauthorized scanning or testing may be
illegal. The honeypot and red-team components are intended for your own local
lab (loopback / private network) only. The server ships with a CORS allowlist,
an optional API-key gate, per-endpoint rate limits, an SSRF egress guard, safe
error messages, and no secrets in the repository.

---

## Documentation

- `docs/PROJECT_OVERVIEW.md` - a plain-language walkthrough of the whole project:
  what it does and why, the choices made and their alternatives, the mistakes
  found and fixed, difficulties, limitations, and interview-style questions.
- `docs/RL_HONEYPOT_INTEGRATION.md` - the simulation-to-real honeypot loop and
  runbook.
- `src/server/rl/PROJECT_CONTEXT.md` - the deep technical handoff for the
  reinforcement-learning stack (architecture, results, methodology).
