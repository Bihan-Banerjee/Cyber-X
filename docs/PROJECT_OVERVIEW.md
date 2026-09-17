# CyberX: Complete Project Overview

A plain-language guide to the whole project: what it is, why it was built, how it
works, the choices made and the alternatives, the mistakes found and fixed, the
difficulties, the limitations, and a set of interview-style questions with
answers. If you read only one document to understand CyberX, read this one.

## Table of contents

1. What CyberX is, in one paragraph
2. Why it was built (purpose)
3. What it can do (capabilities)
4. How it is built (architecture)
5. The technology used, and why (with alternatives)
6. Key design decisions and the alternatives considered
7. Mistakes that were made and how they were removed
8. Difficulties faced
9. Limitations (the honest list)
10. What can be done next (future work)
11. Probable interview questions and answers

---

## 1. What CyberX is, in one paragraph

CyberX is a single web application that combines three things most projects keep
separate: a large suite of hands-on security tools (port scanners, OSINT
lookups, crypto utilities, forensics parsers, and so on), a machine-learning
research piece where an attacker agent and a defender agent learn to play a
cyber-security game against each other, and a set of visual dashboards (a 3D
globe, a honeypot activity feed, and a command center). It has a React frontend,
a Node/Express backend that runs the tools, and a separate Python service that
runs the reinforcement-learning agents.

## 2. Why it was built (purpose)

The goal was a portfolio-grade project that shows breadth and depth at once:

- Breadth: build and wire up a genuinely large number of real security tools, so
  the app is actually useful, not a toy.
- Depth: take one hard problem (can a defender agent be trained to withstand an
  attacker agent?) and go deep enough to produce an honest, measured research
  result rather than a hand-wavy demo.
- Presentation: make all of it visible and interactive, because a result that is
  buried in JSON does not communicate. Hence the dashboards and the 3D globe.

A secondary purpose, which became a theme, was honesty. Several tools originally
returned fake data that looked real. A large part of the recent work was finding
those, making them real where possible, and clearly labeling the rest. Being
able to say "here is exactly what is real and what is illustrative" is itself a
portfolio asset.

## 3. What it can do (capabilities)

### Security tool suite (100+ tools, 13 categories)

The Tools page is a searchable, filterable, paginated catalog. Categories:
Network, Recon, Web, Cloud, Crypto, Forensics, Intel, Exploitation, Password,
Social Engineering, Utilities, Mobile, Wireless. A few representative tools:

- Network: port scanner, service detection, OS fingerprint, traceroute, SNMP
  scan, banner grabber, host discovery, WAF detector.
- Recon: WHOIS/RDAP, DNS recon, subdomain enumeration, certificate-transparency
  search, tech fingerprinting, robots.txt analysis, web crawler.
- Web: SQL injection tester, XSS tester, SSRF tester, open-redirect finder,
  directory fuzzer, cookie analyzer, HTTP header analyzer, CSRF PoC generator.
- Crypto: hash cracker and generator, cipher tools, RSA/AES, JWT decoder, PGP,
  entropy analyzer, SSL certificate decoder.
- Forensics: hex viewer, string extractor, file-type identifier, PDF forensics,
  binary analyzer (PE/ELF/Mach-O), disk-image (MBR) analyzer, log analyzer,
  steganography for image/audio/document/video.
- Intel/OSINT: email breach check, IP and domain reputation, phone OSINT,
  company OSINT, social-media OSINT, pastebin monitor, dark-web index search.
- Cloud: S3/Azure/GCP bucket finders, Kubernetes enumeration, container image
  analysis, AWS metadata SSRF tester, IAM policy auditor.

Roughly 79 backend scanner modules serve about 90 REST endpoints. Around 30 of
the tools run entirely in the browser (encoders, converters, calculators,
payload libraries) and need no backend at all.

### Reinforcement-learning arena (attacker vs defender)

A two-agent game: an APT-style attacker versus a SOC-style defender, trained
with reinforcement learning. The RL Arena visualizes convergence curves,
exploitability, a cross-play matrix with an empirical Nash mixture, a multi-seed
comparison, and an animated best-versus-best replay. The Red vs Blue page shows
an attacker acting against the defender's live recommendations.

### Dashboards and visualization

- Command Center: honeypot feed, defender copilot, RL health, tool activity.
- Honeypot Monitor: honeypot status and a recent-attack feed.
- Map Layers: a 3D globe with signal-strength, 5G coverage, and attack-origin
  layers.
- Guide: in-app documentation for every tool and subsystem.

## 4. How it is built (architecture)

Three processes cooperate:

1. Frontend: a React single-page app built with Vite. It renders the UI and
   calls the backend over HTTP. It is "live-first with replay fallback": the RL
   dashboards try the live Python API first and fall back to committed JSON
   snapshots, so the app works even when the RL service is off.

2. Backend: a Node/Express server in TypeScript. It exposes the tool endpoints,
   honeypot routes, and map data. It also proxies RL requests to the Python
   service (including Server-Sent Events for live streams). It enforces the
   security controls (CORS, rate limits, API-key gate, SSRF guard, safe errors).

3. RL service: a Python Flask API that wraps the Gymnasium environment and the
   Stable-Baselines3 agents. Express proxies `/api/rl/*` to it.

Data flow for a tool: the browser posts to `/api/scan/<tool>`, Express validates
and rate-limits the request, the matching scanner module does the work (a network
call, a file parse, a third-party API query), and the JSON result flows back.

## 5. The technology used, and why (with alternatives)

- React + Vite + TypeScript. React for the component model and ecosystem; Vite
  for fast dev builds and simple static output; TypeScript for safety across a
  large codebase. Alternative considered: Next.js. It was not chosen because the
  app is a client-heavy SPA that talks to a separate API, so server-side
  rendering added complexity without a clear benefit here.
- Tailwind CSS + shadcn/ui (Radix primitives). Rapid, consistent styling and
  accessible components without shipping a heavy component framework. Alternative:
  Material UI or Chakra, which impose more opinionated design and larger bundles.
- Express on Node. Minimal, well understood, huge middleware ecosystem, and it
  shares TypeScript with the frontend. Alternatives: Fastify (faster, but the
  performance gap did not matter for this workload) or a Python backend (would
  have split the language surface even more).
- Stable-Baselines3 with RecurrentPPO (LSTM policy). A trusted, well-tested RL
  implementation so the research focus could be the environment and the
  evaluation, not re-implementing PPO. Alternatives: a hand-rolled PPO (more
  bugs, less credible) or RLlib (heavier, more infrastructure).
- Independent PPO (each agent has its own policy) plus league self-play and a
  behavioral-cloning warm-start. Alternative: fully centralized training
  (MAPPO). IPPO was chosen for simplicity and because the game is competitive,
  not cooperative.
- react-globe.gl + three.js for the 3D map. Alternative: a 2D Leaflet map (also
  present in the project for other uses), but the globe is the more striking
  visualization for global data.
- For the tools, real data sources were chosen to avoid external cost and keys
  where possible: DuckDuckGo for search (Bing's API was retired), XposedOrNot for
  breach data (Have I Been Pwned's API is paid), the Docker Hub registry API for
  image metadata, and RDAP as a fallback for WHOIS. See the mistakes section for
  why several of these replaced fabricated data.

## 6. Key design decisions and the alternatives considered

- Live-first with replay fallback for the RL dashboards. This lets the deployed
  site show the research result without needing the GPU Python service running.
  The alternative (only-live) would make the hosted demo blank without a backend.
- One scanner module per tool, all behind one `/api/scan` router. This keeps each
  tool small and independently testable. The alternative (one giant handler) was
  actually the earlier state and had duplicated, shadowed routes; splitting made
  the audit tractable.
- Honesty over the appearance of completeness. When a tool could not be made real
  without heavy infrastructure (live packet capture, CVE scanning, a real
  cluster), it was clearly labeled as demo or partial rather than left to look
  fully real. This was a deliberate choice and is documented in the UI, the
  guide, and the README.
- Exploitability (best-response gap) as the headline RL metric, not Elo. Elo in
  the original code was just a rescaling of win rate and did not capture how
  beatable the defender is. Measuring a best-response gap is the honest way to
  say "the defender is 0.25 exploitable."

## 7. Mistakes that were made and how they were removed

This section is the most useful for interviews, because it is the real story of
the project maturing. Each item is a genuine problem that existed and was fixed.

### Tools that fabricated data (the biggest honesty problem)

Several tools used `Math.random()` or hard-coded mock data while advertising real
results. Found by reading every scanner and by running each endpoint against real
targets and noticing impossible outputs (for example, "captured 30 packets" on a
network interface that does not exist).

- IP Geolocation invented proxy/VPN/Tor flags with random numbers. Fixed to use
  only real provider fields; VPN/Tor are now honestly reported as not detectable
  from free geolocation data.
- Email Breach Check decided "breached or not" with a coin flip over a mock list.
  Fixed to query the XposedOrNot API for real breach records.
- Packet Analyzer ignored the uploaded capture file entirely and returned random
  packets. Fixed with a real libpcap parser (Ethernet/IPv4/IPv6/ARP/TCP/UDP,
  endianness handling). The frontend was also reading the binary file as text,
  which corrupted it; fixed to send base64.
- Reverse IP Lookup fabricated the co-hosted domain list. Fixed to use a real
  reverse-IP API; the PTR record was already real.
- OSINT Search returned placeholder results. Fixed to scrape real DuckDuckGo
  results (the previously used Bing API was retired).
- Container Scanner invented CVEs and image metadata. Fixed to pull real metadata
  and image config from the Docker Hub registry and derive real config-level
  issues (runs-as-root, mutable :latest tag, secrets in environment variables).
  CVE scanning is honestly deferred to a local scanner such as Trivy.
- Kubernetes Enumeration was fully mock and ignored the endpoint. Fixed to query
  the real Kubernetes REST API with the provided bearer token.
- Packet Capturer is simulated because real capture needs native libraries and
  admin rights; it is now clearly labeled as demo rather than pretending to be
  real.

### Backend and build bugs

- WHOIS was completely broken because of a Node module-interop issue. The import
  style that worked in the dev runner (tsx/esbuild) failed in the compiled
  NodeNext build with "does not provide an export named default". Fixed with
  `createRequire`, which loads the CommonJS module the same way in both. An RDAP
  (HTTPS) fallback was also added so WHOIS works on networks that block port 43.
- The SSL/TLS Analyzer failed the handshake on almost every site because it did
  not send SNI (the server name) in the TLS connection. Fixed by setting
  `servername`.
- The ASN lookup returned a 500 whenever its single provider had an outage,
  because the primary fetch was not wrapped in error handling. Fixed by guarding
  every provider call and adding a fallback provider.
- Traceroute returned a hard error when the command was killed on ICMP-filtered
  paths. Fixed to return the partial hops it did collect.
- CORS broke on the deployed site. Earlier hardening replaced an allow-any CORS
  policy with a localhost-only allowlist, which silently blocked the deployed
  frontend so every backend tool failed with a CORS error while client-side
  tools kept working. The first fix made the allowlist configurable, but it still
  required an environment variable to be set correctly on the host, and a missing
  or trailing-slash-mismatched value silently re-broke the deployed site. The
  final fix changed the default: with no CORS_ORIGINS set, the server reflects any
  origin (correct for an unauthenticated public demo, and it makes preview URLs
  work), while a configured value is still a strict allowlist. Origins are also
  compared with any trailing slash stripped so a common misconfiguration no longer
  blocks calls. Locking the API down is done with CYBERX_API_KEY, which is the
  real access control, rather than relying on CORS.
- Duplicate, shadowed routes. The main route file had a large block of duplicate
  endpoint definitions; the earlier de-duplication commented them out but left a
  few endpoints without their intended per-endpoint rate limiters. Documented and
  noted.

### Frontend bugs and performance

- Red vs Blue flickered and appeared to reload every loop, because the replay
  restart reset all state to empty and unmounted the whole view. Fixed by
  restarting the loop without blanking the page.
- The dashboards polled on intervals that kept running when the browser tab was
  hidden, and one dashboard's attempt to pause polling never worked because the
  interval captured a stale value. Fixed with a small polling hook that pauses on
  tab-hidden and resumes on tab-visible.
- The 3D globe bundled a 35 MB data file directly into the JavaScript, bloating
  the initial load. Fixed by moving it to a runtime fetch, and by splitting every
  route into its own lazily loaded chunk. The largest chunk dropped from about
  23.7 MB to about 2.6 MB.
- A stored cross-site-scripting risk: external breach descriptions were rendered
  as raw HTML. Fixed by stripping tags and rendering as text.

### RL correctness issues (summarized; full detail in the RL docs)

- A prediction-failure fallback drew a random action from the wrong range and
  counted the match as if it had been played, silently corrupting model selection
  and curriculum promotion. Fixed to use a seeded draw over the correct range and
  to mark such matches as errored.
- Observation scaling divisors did not match their caps, making the top third of
  some inputs invisible to the agents.
- The training launch ran in a daemon thread where a signal handler threw, the
  exception was swallowed, and the endpoint reported success for a run that never
  started.
- "Elo" was an affine rescaling of win rate, and "NashConv" was a win-rate
  heuristic on a non-zero-sum game. These were renamed and re-grounded, and a
  real cross-play matrix plus a best-response exploitability gap were added.
- The five published "seeds" were all seed 42, so they measured replicate
  variance, not seed variance. This is now stated honestly, and a multi-seed
  sweep driver was added.

## 8. Difficulties faced

- Multi-agent training kept collapsing into degenerate strategies (for example
  the attacker "camping" to farm reward). Each collapse had to be diagnosed and
  fixed structurally, then locked in with a unit test so it could not silently
  return.
- Measuring whether the defender is actually good is subtle in a non-zero-sum,
  non-transitive game. Simple win rate and Elo are misleading; the project moved
  to exploitability and cross-play, which are harder to compute but honest.
- JavaScript module interop (CommonJS versus ES modules) behaves differently
  under the dev runner and the compiled production build. A default import can
  work in development and crash in production. This caused the WHOIS build
  failure and needed the `createRequire` fix.
- Auditing 100+ tools by hand is a lot; the approach was to script the checks
  (cross-reference the tool catalog against routes, guide entries, and endpoints,
  then hit every endpoint with safe inputs) so gaps and failures surfaced
  objectively rather than by spot-checking.
- Deciding what to make real versus label as demo. Some tools genuinely cannot be
  real in a hosted web app (live packet capture, CVE scanning, a live cluster).
  The judgment was to make real everything that could be verified, and label the
  rest honestly.

## 9. Limitations (the honest list)

- The RL defender is exploitable: a best-response attacker beats it clearly. The
  RL result is a study of training dynamics and reward-design pitfalls, not a
  production-ready defender.
- The RL "seeds" published in the snapshots are replicates of one seed; true
  multi-seed variance is the recommended next step.
- Packet Capturer is simulated (real capture needs npcap/libpcap and admin).
- Container Scanner does not do package-level CVE scanning (use Trivy or Grype
  locally); it reports real metadata and config issues only.
- Kubernetes Enumeration is implemented against the real API but its success path
  could only be verified against a reachable cluster with a valid token, which
  was not available in the audit environment; error handling was verified.
- Some tools return richer data with an API key (AbuseIPDB, VirusTotal,
  NumVerify, Hunter); without keys they degrade gracefully.
- WHOIS over port 43 may be blocked on some networks; the RDAP fallback covers
  most of those cases but not every registry.
- Geolocation is approximate and provider-dependent.
- The DuckDuckGo based OSINT search depends on scraping an HTML endpoint, which
  can rate-limit or change format.
- The SSRF guard blocks IP-literals and known hostnames but does not resolve DNS,
  so a hostname that resolves to a private address can bypass it. Deepening this
  to async DNS resolution is a noted follow-up.

## 10. What can be done next (future work)

- Close the RL defender's exploitability gap with population-based training
  (PFSP or PSRO), and report the before/after as the headline improvement.
- Run a true multi-seed sweep and publish IQM with bootstrap confidence
  intervals.
- Integrate a real CVE scanner (Trivy) behind the Container Scanner.
- Verify Kubernetes Enumeration against a live cluster and add read-only RBAC
  presets.
- Add continuous integration (lint, typecheck, build, server and RL tests).
- Deepen the SSRF guard to resolve DNS before allowing a fetch.
- Add an autonomous LLM red-team agent as an out-of-policy-class adversary
  against the trained defender (design is discussed in the RL docs).

## 11. Probable interview questions and answers

### Project and design

Q: What is CyberX in one sentence?
A: A single web app that combines 100+ real security tools, a reinforcement-
learning attacker-versus-defender simulation, and visual dashboards, with a React
frontend, a Node/Express backend, and a Python RL service.

Q: Why three separate processes instead of one?
A: Separation of concerns and language fit. The tools and API are natural in
Node/TypeScript (shared types with the frontend). The RL work needs Python's ML
ecosystem. Keeping them separate lets each scale and fail independently, and the
Express proxy gives the frontend one origin to talk to.

Q: How does the app stay useful when the Python RL service is off?
A: The RL dashboards are live-first with a replay fallback: they try the live API
and fall back to committed JSON snapshots, so the hosted demo still renders real
past results.

Q: What was the hardest trade-off?
A: Deciding what to make real versus label as demo. Making everything look real
would have been dishonest; making only the easy things real would have been thin.
The rule was: make real anything verifiable, label the rest clearly.

### Frontend

Q: Why Vite and not Next.js?
A: The app is a client-heavy SPA calling a separate API. Server-side rendering
would add complexity without a clear benefit. Vite gives fast dev and simple
static output.

Q: How did you cut the initial bundle size?
A: Two changes. First, route-level code splitting with React.lazy and Suspense so
each page loads its own chunk. Second, moving a 35 MB globe data file out of the
JavaScript bundle into a runtime fetch. The largest chunk went from about 23.7 MB
to about 2.6 MB.

Q: You mentioned a polling bug. What was it?
A: Dashboards polled the backend on intervals that kept running when the tab was
hidden. One dashboard tried to pause using a state flag, but the interval closure
captured the old value, so it never actually paused (a classic stale-closure
bug). The fix was a small hook that clears the interval on tab-hidden and
re-runs on tab-visible, keeping the latest callback in a ref.

Q: How do you prevent XSS when showing third-party data?
A: Never render untrusted strings as raw HTML. A breach description from an
external API was being injected as HTML; it was changed to strip tags and render
as plain React text.

### Backend and security

Q: What security controls does the API have?
A: A CORS allowlist, security headers, an optional API-key gate, per-endpoint
rate limiting, an SSRF egress guard for URL-fetching tools, safe error messages
that do not leak internals, and no secrets in the repo (env-based config with an
.env.example).

Q: Tell me about a production bug you fixed.
A: Two good ones. The WHOIS tool crashed the production build because a CommonJS
module did not provide a default export under Node's native ESM loader, even
though it worked under the esbuild-based dev runner. I fixed it with
createRequire. Separately, CORS broke the deployed site: a hardening change had
replaced allow-any CORS with a localhost-only allowlist, which silently blocked
the deployed frontend, so every backend tool failed with a CORS error while
client-side tools kept working. My first fix made the allowlist configurable, but
that still depended on an env var being set correctly on the host, and it broke
again from a missing value and a trailing-slash mismatch. The lesson was that the
safe default matters: for an unauthenticated public demo I made an unset config
reflect any origin (so it just works, including preview URLs), kept a configured
value as a strict allowlist, normalized trailing slashes, and pointed real
lock-down at the API-key gate instead of treating CORS as the security boundary.

Q: How did you verify 100+ tools actually work?
A: I scripted it. First a static cross-reference (every tool has a route, a
component, a guide entry, and a valid endpoint). Then a runtime smoke test that
navigated every tool page and checked for console errors. Then a live endpoint
test that posted safe, authorized inputs (nmap's scan-me host, example.com,
read-only public APIs) to every endpoint and inspected the responses. That is how
the fabricated-data tools were caught.

Q: What is SSRF and how do you defend against it here?
A: Server-Side Request Forgery is when a user makes the server fetch a URL it
should not, such as an internal metadata endpoint. The tools that fetch a
user-supplied URL run it through a guard that blocks private, loopback, and
link-local addresses (with a lab opt-out flag). A known limitation is that the
guard does not resolve DNS, so a hostname pointing at a private IP can bypass it;
resolving DNS first is the planned improvement.

### Reinforcement learning

Q: What is the RL setup?
A: A two-agent competitive game: an APT-style attacker versus a SOC-style
defender. Each has its own policy (Independent PPO) using RecurrentPPO with an
LSTM, trained with curriculum learning, league self-play, and a behavioral-
cloning warm-start from scripted experts.

Q: Is the defender good?
A: It is decent but exploitable. Across runs the co-trained defender wins about
0.40 to 0.45, and a dedicated best-response attacker beats it about 0.80, so the
defender is roughly 0.25 exploitable. The honest headline is a reward-design and
exploitability study, not a production defender.

Q: Why not just report win rate or Elo?
A: In a non-zero-sum, non-transitive game those are misleading. The original Elo
was just a rescaling of win rate. The better measure is exploitability, the gap
between the defender and a best-response attacker, plus a cross-play matrix and an
empirical Nash mixture to expose non-transitive cycles.

Q: What went wrong during training and how did you catch it?
A: The agents repeatedly collapsed into degenerate strategies, such as the
attacker camping to farm reward. Each was diagnosed from the metrics, fixed
structurally in the environment or reward, and then locked in with a unit test so
the same collapse could not silently reappear. There were also silent correctness
bugs, like a prediction-failure fallback that drew a wrong-range random action and
counted the match as played, which corrupted model selection until it was fixed.

Q: What would you do to make the defender stronger?
A: Not more reward tuning. Population-based training (PFSP or PSRO) to explicitly
close the defender's best-response gap, then report NashConv or the exploitability
gap before and after as the improvement result.

### General and behavioral

Q: What are you most proud of in this project?
A: Turning it honest. I found a class of tools that returned convincing fake data
and either made them real (real pcap parsing, a real breach API, real Docker Hub
metadata, real Kubernetes queries) or labeled them clearly as demo. Being able to
state exactly what is real is more valuable than a demo that overclaims.

Q: What would you do differently if starting over?
A: Add continuous integration and a test harness from day one, and enforce the
"no fabricated data" rule up front so tools are real or explicitly labeled from
the start rather than audited in later.

Q: How big is the codebase and how is it organized?
A: A React frontend with a page per tool, a Node/Express backend with about 79
scanner modules behind one scan router, and a Python RL stack. Shared concerns
(SSRF guard, safe errors, rate limiting) live in server utilities, and deep
technical documentation lives in the docs folder.
