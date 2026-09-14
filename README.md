# CyberX

CyberX is a self-hosted cybersecurity platform that combines a large catalog of offensive and defensive security tools with a research-grade multi-agent reinforcement learning (MARL) engine and a live honeypot telemetry pipeline. It is built for authorized security testing, capture-the-flag practice, security research, and education. The frontend is a React single-page application; the backend is an Express API that fronts the scanners and proxies a Python service that runs the RL stack; a Docker Compose stack provides honeypots and an Elasticsearch based telemetry bridge.

The project has two distinct halves that share one interface:

1. A practical toolbox: over one hundred network, web, cloud, OSINT, cryptography, forensics, and steganography tools, plus interactive dashboards and attack maps.
2. A research core: an attacker versus defender game trained with independent PPO, curriculum learning, and league self-play, evaluated with exploitability and cross-play analysis, and connected to a real honeypot so a simulator-trained defender can be tested against real telemetry.

## Table of contents

1. Architecture
2. Technology stack
3. Repository layout
4. Getting started
5. Configuration
6. Application walkthrough (pages)
7. Security tool catalog
8. The reinforcement learning stack (RL Play)
9. Autonomous red team
10. Honeypot and telemetry pipeline
11. Dashboards and artifacts
12. API reference
13. Security and safety posture
14. Testing and continuous integration
15. Reproducibility and provenance
16. Honest framing and limitations
17. Roadmap
18. License and attribution

## 1. Architecture

CyberX runs as four cooperating layers. Each can run independently; the app degrades gracefully when an upper layer is absent.

```
 Browser (React SPA, Vite, port 8080)
        |
        |  /api/scan, /api/honeypot, /api/map, /api/signal, /api/rl
        v
 Express API (Node, TypeScript, port 5000)
        |                         |
        |  scanners (in-process)  |  /api/rl/*  proxied (SSE-aware)
        v                         v
 79 scanner modules         Flask RL API (Python, port 5001)
                                  |
                                  |  reads/writes run artifacts, serves metrics
                                  v
                            MARL stack (PyTorch, Stable-Baselines3)

 Honeypot stack (Docker Compose): Cowrie, Dionaea, Zeek
        -> Logstash -> Elasticsearch (9200) -> Kibana (5601)
        Telemetry adapter feeds the trained defender for shadow evaluation.
 Optional local LLM: Ollama (11434) drives the autonomous red team.
```

Design principles:

- Live first, replay fallback. Dashboards try the live API and fall back to baked JSON artifacts in `public/rl-artifacts/`, so the site is fully browsable with no backend running.
- Separation of concerns. The Express server never runs Python; it proxies the Flask RL API, streaming Server-Sent Events through unbuffered so live views update in real time.
- Safe by default. Egress filtering, request validation, optional authentication, and loopback-only honeypot targeting are on or available out of the box.

## 2. Technology stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI), React Router, Chart.js and react-chartjs-2, lucide-react icons.
- Backend: Node with Express, TypeScript compiled with `tsc`, run in development with `tsx`. Axios for the RL proxy, Multer for uploads, express-rate-limit for throttling, dotenv for configuration.
- RL and research: Python 3.11 or 3.12, PyTorch, Stable-Baselines3 and sb3-contrib (RecurrentPPO), Gymnasium, NumPy, Flask for the RL API.
- Data and telemetry: Elasticsearch, Kibana, Logstash, Cowrie, Dionaea, Zeek, all orchestrated with Docker Compose. Optional Ollama for local LLM inference.
- Tooling: ESLint, GitHub Actions CI, node:test via tsx for server tests, a hand-rolled Python test runner for the RL stack.

## 3. Repository layout

```
src/
  pages/                React pages (Home, Dashboard, CommandCenter, Tools,
                        HoneypotMonitor, RLArena, RedVsBlue, ConnectivityMap, Guide)
  pages/tools/          ~110 individual tool UIs
  components/           Shared UI, CyberpunkCard, DefenderCopilot, WorldMap, shadcn/ui
  data/                 navigation.ts, defenderActionMap.ts, tool docs
  routes/               app-router.tsx
  lib/                  api.ts, rlData.ts (live-first/replay data layer)
  server/
    index.ts            Express entrypoint (CORS, headers, auth, rate limit, RL proxy)
    routes/             scan.ts (111 endpoints), honeypot.ts, signal.ts, mapData.ts
    scanners/           79 scanner implementations
    utils/              ssrfGuard.ts, safeError.ts, validateTarget.ts, activityLogger.ts
    middleware/         rateLimiter.ts
    honeypot/           honeypotManager.ts (Docker control)
    security.test.ts    automated security tests
    rl/                 the Python MARL stack (see section 8)
docker/                 docker-compose.honeypot.yml, cowrie, logstash, zeek configs
public/rl-artifacts/    baked JSON snapshots for the replay fallback
.github/workflows/      CI
.env.example            environment template
```

## 4. Getting started

Prerequisites: Node 20 or newer, Python 3.11 or 3.12 with a virtual environment, and optionally Docker Desktop for the honeypot stack and Ollama for the local LLM.

Install and configure:

```bash
npm install
cp .env.example .env
```

For the Python side, create and populate a virtual environment, then install the RL requirements:

```bash
python -m venv venv
venv/Scripts/python -m pip install -r src/server/rl/requirements.txt
```

Run the frontend and Express backend together:

```bash
npm run dev
```

This starts Vite on port 8080 and the Express API on port 5000. To run them separately use `npm run fe:dev` and `npm run be:dev`. Build for production with `npm run build`, then serve the compiled server with `npm run start`.

Run the RL API (optional; enables live RL dashboards and training control):

```bash
cd src/server/rl
python api.py
```

Start the honeypot and telemetry stack (optional):

```bash
docker compose -f docker/docker-compose.honeypot.yml up -d
```

This brings up Cowrie (SSH honeypot on port 2222), Dionaea, Zeek, Logstash, Elasticsearch (port 9200), Kibana (port 5601), and optionally Ollama (port 11434).

## 5. Configuration

All server configuration is read from `.env` (loaded by the Express server through dotenv). The template in `.env.example` documents every variable:

- `PORT`: Express port, default 5000.
- `RL_API_URL`: the Flask RL API the `/api/rl` proxy forwards to, default `http://localhost:5001`.
- `CORS_ORIGINS`: comma separated allowlist of frontend origins. Set this to your real origin in production; it defaults to local dev origins.
- `CYBERX_API_KEY`: optional. When set, every `/api/*` request except `/health` must send a matching `X-API-Key` header. Leave unset for local development; set it before exposing the backend.
- `CYBERX_ALLOW_PRIVATE_TARGETS`: set to `1` only in a trusted local lab to allow scanners to reach private, loopback, and link-local addresses. Leave unset on any instance reachable by others.
- Optional third-party API keys enable individual OSINT and threat-intelligence tools (for example Hunter, VirusTotal, AbuseIPDB, NumVerify).
- `VITE_API_BASE_URL`: frontend build-time variable pointing at the backend.

RL hyperparameters live in `src/server/rl/config.json` and are validated at load time by `config_loader.py`. That file controls PPO settings, curriculum thresholds, the league configuration including PFSP, and optional reward overrides.

## 6. Application walkthrough (pages)

The primary navigation exposes the following pages.

### Home

Landing page that introduces the platform and links into the main areas.

### Dashboard

High-level view of platform activity and status, summarizing recent tool runs and system state.

### Command Center

Operational console that aggregates recent tool activity from the in-memory activity log, surfaces system resources, and provides quick links into deeper areas such as the RL Arena. It polls a lightweight recent-activity endpoint that is deliberately exempt from the scan rate limiter.

### Tools

The full catalog of security tools, organized for discovery. Each tool has its own focused UI. Tools that require network access or server-side processing call the Express `/api/scan` endpoints; pure utilities such as encoders, converters, and generators run entirely in the browser. See section 7 for the catalog.

### Honeypots (Honeypot Monitor)

Live view of the honeypot deployment. It reports honeypot status, recent attacks, and aggregate statistics through the `/api/honeypot` routes, which are backed by a Docker-aware manager. This page is where real attacker interactions with Cowrie and the other honeypots become visible.

### RL Arena

The research showcase for the MARL stack. It renders training convergence curves, the exploitability and NashConv-style summary, the Elo leaderboard over archived checkpoints, the shadow-mode evaluation, and a best-versus-best demo replay. It also includes a before and after comparison card that places the PFSP league arm next to the uniform-league control, reporting the defender exploitability gap and win rate for each arm with the interquartile mean and ninety-five percent confidence intervals. A training control panel can start and stop runs when the live RL API is available. The page is live first with an artifact fallback, so it is fully populated even on a cold, backend-less deployment.

### Red vs Blue

An autonomous attacker versus defender arena. It streams a match step by step: on the red side, the attacker's chosen action, its MITRE ATT&CK technique, and a short natural-language rationale; on the blue side, the RL defender's recommended response mapped to MITRE D3FEND and deep-linked to the matching CyberX tool. It visualizes the kill chain, the attacker suspicion and defender evidence meters, a detection-race chart, per-tactic and per-response breakdowns, and a running match log. A headline out-of-class exploitability card compares the LLM attacker's win rate against the same-class PPO best-response and the co-trained equilibrium. Live mode streams from the RL API; replay mode animates a baked sample so the page works with no backend.

### Map Layers (Connectivity and World Map)

Geospatial and connectivity visualization layers that plot activity and relationships on a world map and a connectivity graph, backed by the `/api/map` routes.

### Guide

In-app documentation that explains the platform, the tool categories, and how to use the major features, so the app is self-describing without leaving the interface.

## 7. Security tool catalog

CyberX ships over one hundred tools. The Express backend exposes 111 endpoints backed by 79 scanner modules; the remaining tools are client-side utilities. The catalog groups as follows.

- Network scanning and reconnaissance: Port Scanner, OS Fingerprint, Service Detection, Banner Grabber, ARP Host Discovery, Traceroute, SNMP Scanner, Subdomain Enumeration, DNS Recon, WHOIS Lookup, Reverse IP Lookup, IP Geolocation, BGP and ASN Lookup, CIDR Calculator.
- Web application security: Directory Fuzzer, WAF Detector, WAF Bypass Generator, XSS Payload Generator, SQL Injection Tester, SSRF Tester, Open Redirect Finder, CSRF Proof-of-Concept Generator, XXE Payload Generator, HTTP Header Analyzer, HTTP Request Builder, Cookie Analyzer, Robots.txt Analyzer, Web Crawler, Website Technology Fingerprinter, Vulnerability Fuzzer, API Scanner, Broken Authentication Checker.
- TLS and certificates: SSL Analyzer, SSL Certificate Decoder.
- OSINT and threat intelligence: Company OSINT, Social Media OSINT, Username Enumerator, Phone Number OSINT, Email Breach Checker, Email Header Analyzer, Spoofed Email Checker, Domain Reputation, IP Reputation Checker, Dark Web Checker, Pastebin Monitor, Certificate Transparency Log Search, Google Dork Generator, Phishing URL Detector, Homoglyph Generator, CVE Search, Exploit DB Search, Malware Hash Lookup.
- Cloud and container security: AWS Metadata Tester, Azure Blob Finder, GCP Bucket Finder, S3 Bucket Finder, Cloud Asset Enumerator, Cloud IAM Auditor, Container Scanner, Kubernetes Enumerator.
- Cryptography and hashing: Hash Tool, Hash Identifier, File Hash Calculator, Hash Cracker, Mask Attack Builder, Wordlist Generator, BCrypt Generator, PGP Key Generator, RSAES Encryption, Cipher Tool, JWT Decoder, Password Generator, Password Strength Analyzer, Entropy Analyzer.
- Forensics and reverse engineering: Binary Analyzer, Disk Image Analyzer, PDF Forensics, File Type Identifier, Hex Viewer, String Extractor, ROP Gadget Finder, Buffer Overflow Calculator, Code Obfuscator, APK Analyzer, Mobile Permission Auditor, ADB Generator.
- Steganography: Image Steganography, Audio Steganography, Video Steganography, Document Steganography, Image Metadata Extractor.
- Wireless: Wifi Handshake Cracker, Bluetooth Scanner, Evil Twin Detector.
- Packet analysis: Packet Capturer, Packet Analyzer.
- Payloads and developer utilities: Reverse Shell Generator, Payload Encoder, Base64 Encoder, URL Encoder, JSON Beautifier, Regex Tester, Text Diff, Number Base Converter, Epoch Converter, Default Credentials Database.
- Log analysis: Log Analyzer.

All tools that reach out over the network pass through target validation and, where applicable, the SSRF egress guard described in section 13.

## 8. The reinforcement learning stack (RL Play)

The research core lives in `src/server/rl/`. It models a cyber engagement as a two-player game between an advanced persistent threat attacker and a security operations center defender, and trains both with reinforcement learning.

Core components:

- Environment: `shared_honeypot_env.py` defines a Gymnasium environment with a shared observation and action space, kill-chain stages (reconnaissance, foothold, privileged, objective), attacker success probabilities, and a reward configuration. Win conditions are mutually exclusive and rewards are bounded. A `StatefulOpponent` wrapper threads LSTM hidden state across steps so opponents are not memoryless.
- Agents: `agents.py` builds RecurrentPPO agents (an LSTM policy) with a custom feature extractor. `baselines.py` provides scripted and expert opponents used for curriculum and evaluation.
- Trainer: `trainer.py` runs independent PPO with three mechanisms that keep training honest. Curriculum learning promotes agents through stages. League self-play re-rolls a per-worker opponent mix each iteration, mixing scripted exploiters, the latest opponent, and historical ghost snapshots. Prioritized Fictitious Self-Play (PFSP) samples ghost opponents in proportion to how badly the learner is losing to each one, concentrating training on the opponents that currently exploit it. A small probe estimates those win rates with cheap CPU-clone matches that never touch the live model.
- Evaluation: `evaluator.py` runs seeded matches on CPU clones. `exploitability.py` freezes an agent and trains a best-response opponent to measure how exploitable it is, reporting a best-response win-rate gap with a plateau estimator rather than a single maximum. `crossplay.py` builds an N-by-N cross-play matrix over archived checkpoints and solves for an empirical Nash equilibrium, which detects non-transitive rock-paper-scissors cycling that a single scalar rating would hide.
- Statistics: `stats_util.py` provides the interquartile mean, bootstrap confidence intervals, and sample standard deviation and standard error, following the recommendations of Agarwal and colleagues for small-sample reinforcement learning.
- Provenance: `provenance.py` writes a run manifest into each run directory capturing the git commit, a hash of the resolved configuration, the seed, and the versions of the key libraries, so any figure can be traced to the exact code and configuration that produced it.
- Multi-seed sweeps: `run_sweep.py` runs A/B arms across seeds (for example a PFSP arm and a uniform-league control), aggregates them with the interquartile mean and confidence intervals, and can compare two arms side by side.
- Orchestrator: `run_experiment.py` runs the entire before and after experiment in one resumable command: both training arms, per-run exploitability probes, the comparison, dashboard export, and an optional out-of-class LLM probe.
- Serving: `api.py` is the Flask API that serves metrics, exploitability, the leaderboard, shadow evaluation, and the sweep comparison, launches training as a subprocess, and streams live views. `export_artifacts.py` snapshots a finished run into `public/rl-artifacts/` for the replay fallback.

Typical commands, run from `src/server/rl` with the virtual environment active:

```bash
python run_training.py --mode dev --pfsp
python run_experiment.py --seeds 1 2 3 --iterations 30 --dry-run
python run_experiment.py --seeds 1 2 --iterations 30 --timesteps 30000
python run_experiment.py --seeds 1 2 3 --iterations 30 --llm --llm-model qwen2.5:3b
python exploitability.py --run-dir models/cyberx_marl/results/pfsp_seed1
python crossplay.py --run-dir models/cyberx_marl/results/pfsp_seed1
python tests_rl.py
```

## 9. Autonomous red team

The `src/server/rl/red_team/` package is a self-contained autonomous red team designed to be extracted into its own project later. It reuses the LLM oracle, the environment, and the telemetry adapter.

- `probe.py`: an out-of-policy-class exploitability probe. It freezes the trained RL defender and attacks it with an LLM-driven attacker (falling back to a scripted expert when no LLM is available), then reports the LLM attacker win rate next to the co-trained attacker equilibrium and the PPO best-response. If a fundamentally different kind of adversary beats the defender as effectively as the same-class best-response, the exploitability finding is materially stronger.
- `llm_attacker.py`: wraps the LLM oracle in the standard predict interface, with a per-step ATT&CK reasoning trace.
- `honeypot.py`: drives an ATT&CK playbook against the operator's own local Cowrie honeypot to generate real, self-labeled telemetry. It is restricted to loopback and private addresses, supports a dry run that prints the playbook without executing it, and refuses any public target.
- `calibrate.py`: grounds the environment's brute-force success probabilities in real honeypot login telemetry, reporting Wilson confidence intervals and emitting a paste-ready configuration override block. It refuses to emit an unsafe zero floor and does not fabricate probabilities the honeypot cannot observe.
- `playbook.py`: the Cowrie command sequences, with all ATT&CK identifiers sourced from the single verified grounding table so the demo, the interface, and the paper table cannot drift apart.

Any use of the honeypot driver must be against your own local honeypot. This is authorized, defensive, lab-style testing.

## 10. Honeypot and telemetry pipeline

The Docker Compose stack in `docker/` deploys the honeypots and the telemetry bridge:

- Cowrie: a medium-interaction SSH and Telnet honeypot that logs login attempts and command input.
- Dionaea: a honeypot that captures malware and exploitation attempts across several protocols.
- Zeek: passive network security monitoring.
- Logstash, Elasticsearch, and Kibana: ingestion, storage, and visualization of honeypot events. Logstash pipelines normalize Cowrie, Dionaea, and Zeek events into a common index.
- Ollama (optional): local LLM inference for the autonomous red team.

On the research side, `telemetry_adapter.py` queries Elasticsearch for recent honeypot events, condenses them into the counters the defender policy was trained on, and asks the trained defender for a recommended action. `soc_state.py` models the security operations center's own evolving state so the defender observation is not degenerate. `shadow_eval.py` replays a recorded telemetry window through the trained defender and reports how often its recommendation agrees with a documented analyst heuristic. Training on live telemetry is intentionally out of scope; policies are trained in the simulator and only run inference on real events.

## 11. Dashboards and artifacts

Every RL dashboard uses a live-first, replay-fallback pattern implemented in `src/lib/rlData.ts`. Each panel first tries the live Flask endpoint through the Express proxy; if that fails it loads a baked snapshot from `public/rl-artifacts/`. This keeps the entire research showcase browsable on a static deployment with no Python backend. The baked artifacts that ship with the repository are clearly marked as illustrative samples in both the JSON and the interface, and are replaced by real numbers as soon as a training run and the export step complete. The experiment orchestrator copies fresh comparison and probe results into the artifacts directory automatically.

## 12. API reference

The Express server exposes:

- `/api/scan/*`: 111 endpoints backing the tool catalog, rate limited and, when configured, gated by an API key.
- `/api/honeypot/*`: honeypot status, recent attacks, and statistics.
- `/api/map/*`: data for the map and connectivity layers.
- `/api/signal/*`: signaling support for real-time features.
- `/api/rl/*`: transparently proxied to the Flask RL API, with Server-Sent Events streamed unbuffered.
- `/health`: liveness check, exempt from the API key gate.

The Flask RL API exposes training status and control, metrics and history, exploitability, the leaderboard, shadow evaluation, the sweep comparison, a paper-ready results table, log and demo streams, an oracle query endpoint, and telemetry suggestion and streaming endpoints.

## 13. Security and safety posture

Because CyberX performs real network actions, several protections are built in and should be understood before any exposure beyond localhost.

- SSRF egress guard: `utils/ssrfGuard.ts` blocks requests to private, loopback, link-local, and cloud-metadata addresses by default, and is applied to the URL-fetching scanners. A trusted-lab opt-out is available through an environment flag.
- Command-injection safety: scanners that shell out use argument-vector execution rather than a shell string, so metacharacters in a target cannot inject commands. The traceroute argument builder is unit tested for this property.
- Target validation: scanner targets are restricted to bare hostnames and IPv4 literals, rejecting whitespace and shell metacharacters as a defense-in-depth layer.
- Error sanitization: `utils/safeError.ts` returns generic error messages to clients when `NODE_ENV` is production, so internal file paths, command output, and upstream errors do not leak. The full error is still logged server-side.
- Authentication and CORS: an optional API key gate protects all API routes, and CORS is restricted to an explicit origin allowlist rather than being open.
- Rate limiting and upload limits: scan requests are throttled with an eviction-safe limiter, and file uploads are bounded in size and count.
- Honeypot and red-team scope: the honeypot driver targets loopback and private addresses only and refuses public hosts; the red team is scoped to the operator's own honeypot.

This project is intended for authorized testing, research, and education. Do not use it against systems you do not own or do not have explicit permission to test.

## 14. Testing and continuous integration

- Server security tests: `src/server/security.test.ts` runs with `npm run test:server` and covers the SSRF guard, injection-safe command building, target validation, and error sanitization.
- RL self-tests: `python tests_rl.py` covers the environment, reward invariants, the PFSP sampler and configuration, calibration recovery, and the grounding table, among others.
- Statistics tests: `python test_stats.py` covers the interquartile mean, bootstrap intervals, and the configuration hash.
- Type checking: `npx tsc -b` type-checks the entire frontend and server as a hard gate.
- Continuous integration: GitHub Actions runs type checking, the security tests, a scoped lint of the research and dashboard surface, and the CPU-only RL self-tests on every push.

## 15. Reproducibility and provenance

Each training run writes a manifest recording the git commit, a hash of the resolved configuration, the seed, and library versions. Multi-seed sweeps aggregate with the interquartile mean and bootstrap confidence intervals rather than a bare mean, and comparisons report overlapping intervals honestly rather than rounding a difference into significance. The export step regenerates the public artifacts from a real run so figures can be reproduced from the repository.

## 16. Honest framing and limitations

The reinforcement learning results are a controlled simulation of training dynamics, not a deployment-ready defender. The contributions are the methodology: reward-design analysis, exploitability and cross-play evaluation, the out-of-policy-class adversary, and the grounding of simulator parameters in real telemetry. Exploitability metrics are best-response win-rate gaps on a non-zero-sum game and are labeled as such rather than as a formal NashConv. The honeypot shadow evaluation is a small-sample, controlled study against a documented analyst heuristic, not a labeled production dataset. The network model abstracts lateral movement rather than simulating a full host graph. These limitations are stated deliberately; the honest framing is part of the value.

## 17. Roadmap

- Run the full multi-seed before and after sweep to replace illustrative dashboard samples with measured results.
- Run the out-of-class probe with a local LLM against a trained defender to produce the headline result.
- Expand automated coverage of the scanner routes and the frontend.
- Extend the environment toward a multi-host network model.
- Optional experiment tracking through Weights and Biases behind a configuration flag.

## 18. License and attribution

Add your chosen license here before publishing. Until a license is added, treat the repository as all rights reserved. CyberX is provided for authorized security testing, research, and education only; you are responsible for complying with all applicable laws and for obtaining permission before testing any system you do not own.