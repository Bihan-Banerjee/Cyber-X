import React from "react";
import { TOOLS_META, TOOLS_DETAILS, ToolId } from "./tools-docs";
import {
  LayoutDashboard,
  Wrench,
  Brain,
  ShieldAlert,
  Globe2,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

// ---------------- TYPES ----------------

export type TopicId =
  | "overview"
  | "tools"
  | "rlGym"
  | "honeypot"
  | "globe"
  | "workflows"
  | ToolId;

export interface TopicMeta {
  id: TopicId;
  title: string;
  category: string;
  icon?: any;
}

// ---------------- CORE TOPICS ----------------

const CORE_TOPICS: TopicMeta[] = [
  { 
    id: "overview", 
    title: "Platform Overview", 
    category: "Core",
    icon: LayoutDashboard
  },
  { 
    id: "tools", 
    title: "Pentesting Tool Suite", 
    category: "Offense",
    icon: Wrench
  },
  { 
    id: "rlGym", 
    title: "RL Training Gym", 
    category: "AI",
    icon: Brain
  },
  { 
    id: "honeypot", 
    title: "Honeypot & Attack Feed", 
    category: "Intel",
    icon: ShieldAlert
  },
  { 
    id: "globe", 
    title: "Global Map & Filters", 
    category: "Visual",
    icon: Globe2
  },
  { 
    id: "workflows", 
    title: "Suggested Workflows", 
    category: "Playbooks",
    icon: Workflow
  },
];


// ---------------- TOOL TOPICS ----------------

const TOOL_TOPICS: TopicMeta[] = TOOLS_META.map((tool) => ({
  id: tool.id,
  title: tool.name,
  category: `Tool: ${tool.category}`,
  icon: tool.icon,
}));

export const TOPICS: TopicMeta[] = [...CORE_TOPICS, ...TOOL_TOPICS];

// ---------------- TOOL CONTENT ----------------

const renderToolContent = (toolId: ToolId): JSX.Element => {
  const tool = TOOLS_META.find((t) => t.id === toolId);
  const details = TOOLS_DETAILS[toolId];

  if (!tool || !details) {
    return <div className="guide-empty">Tool documentation not found.</div>;
  }

  return (
    <>
      <div className="guide-tool-header">
        <h2>{tool.name}</h2>
        <p className="guide-tool-desc">{tool.description}</p>

        <div className="guide-tool-meta">
          <span className="guide-tag category">{tool.category}</span>
          <span className="guide-tag difficulty">{tool.difficulty}</span>
          <Link
              to={tool.path}
              className="guide-launch-btn"
            >
              Open Tool →
            </Link>
        </div>
      </div>

      <hr />

      <h3>How To Use</h3>
      <p>{details.usage}</p>

      <h3>Technical Details</h3>
      <p>{details.details}</p>

      {details.example && (
        <>
          <h3>Example Output</h3>
          <pre>{details.example}</pre>
        </>
      )}

      {details.prerequisites?.length > 0 && (
        <>
          <h3>Prerequisites</h3>
          <ul>
            {details.prerequisites.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </>
      )}

      {details.outputs?.length > 0 && (
        <>
          <h3>Expected Outputs</h3>
          <ul>
            {details.outputs.map((out, i) => (
              <li key={i}>{out}</li>
            ))}
          </ul>
        </>
      )}

      {details.warning && (
        <div className="guide-warning">
          <strong>Warning:</strong> {details.warning}
        </div>
      )}
    </>
  );
};

// ---------------- CORE CONTENT ----------------

const CORE_CONTENT: Record<string, JSX.Element> = {
  overview: (
  <>
    <h2>Platform Overview</h2>

    <pre>{`██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗
██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝
██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗
██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝
╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗
 ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝
            T O   C Y B E R X`}</pre>

    <p>
      CyberX is a unified cyber-operations platform that combines offensive
      tooling, defensive deception, artificial intelligence, and global
      visualization into a single interactive environment.
    </p>

    <p>
      It is designed as both a research system and a practical training ground
      for modern cybersecurity workflows.
    </p>

    <hr />

    <h3>Design Philosophy</h3>

    <p>
      CyberX is built around the idea that modern cyber defense and offense
      cannot be studied in isolation.
    </p>

    <ul>
      <li>Real attackers generate data.</li>
      <li>AI agents learn from real behavior.</li>
      <li>Humans explore, test, and validate.</li>
      <li>Visualization connects everything.</li>
    </ul>

    <p>
      The platform emphasizes realism, automation, and continuous learning.
    </p>

    <hr />

    <h3>High-Level Architecture</h3>

    <pre>{`      
                 ┌───────────────┐
                 │  Global Globe │
                 └───────┬───────┘
                         │
 ┌─────────────┐   ┌─────▼─────┐     ┌──────────────┐
 │ Tool Suite  │◄──► Honeypot  │◄────► RL Training  │
 │ (Standalone)│   │ Simulator │     │ Gym          │
 └─────────────┘   └─────┬─────┘     └─────┬────────┘
                         │                 │
                         └──── Logs ───────┘
                                (ELK)`}</pre>

    <p>
      Each major module operates independently, yet shares intelligence through
      common logging and analytics pipelines.
    </p>

    <hr />

    <h3>Core Modules</h3>

    <ul>
      <li>
        <strong>Pentesting Tool Suite</strong> — Standalone browser-based
        security toolkit for CTFs, labs, forensics, and OSINT.
      </li>
      <li>
        <strong>Honeypot Simulator</strong> — Defensive deception system that
        captures real attacker behavior.
      </li>
      <li>
        <strong>RL Training Gym</strong> — Reinforcement learning environments
        for training autonomous pentesting agents.
      </li>
      <li>
        <strong>Global Map</strong> — 3D visualization of infrastructure health,
        telecom coverage, and attack activity.
      </li>
      <li>
        <strong>Guide & Documentation</strong> — Integrated technical knowledge
        base.
      </li>
    </ul>

    <hr />

    <h3>Closed-Loop Learning Core</h3>

    <pre>
Real Attackers<br />
      ↓<br />
Honeypot Simulator<br />
      ↓<br />
Structured Logs<br />
      ↓<br />
RL Training Gym<br />
      ↓<br />
Trained Agents<br />
      ↓<br />
Improved Deception & Insight<br />
      ↺<br />
    </pre>

    <p>
      This loop ensures CyberX continuously adapts to emerging attack patterns.
    </p>

    <hr />

    <h3>Who CyberX Is For</h3>

    <ul>
      <li>Students learning cybersecurity</li>
      <li>CTF players</li>
      <li>Researchers studying attacker behavior</li>
      <li>Red teamers practicing techniques</li>
      <li>Blue teamers modeling threats</li>
    </ul>

    <hr />

    <h3>Key Characteristics</h3>

    <ul>
      <li>Browser-based interface</li>
      <li>Modular architecture</li>
      <li>Scalable via Docker & Kubernetes</li>
      <li>Ethical and sandboxed</li>
      <li>Extensible by design</li>
    </ul>

    <hr />

    <h3>Vision</h3>

    <p>
      CyberX aims to evolve into a living cyber range where real-world threats,
      artificial intelligence, and human curiosity intersect.
    </p>

    <p>
      Not just a tool.  
      Not just a lab.  
      But a cyber ecosystem.
    </p>
  </>
),


  tools: (
  <>
    <h2>Pentesting Tool Suite</h2>

    <p>
      The Pentesting Tool Suite is a standalone, comprehensive collection of
      offensive security, forensic, cryptographic, and OSINT utilities
      accessible through a unified web interface.
    </p>

    <p>
      It is designed for hands-on practice, CTF competitions, lab-based
      learning, and real-world security research, without requiring any
      external setup or local tool installation.
    </p>

    <hr />

    <h3>Design Philosophy</h3>

    <p>
      The suite emphasizes breadth, usability, and repeatability. Rather than
      exposing raw command-line tools, CyberX wraps each capability behind a
      clean UI while preserving technical depth.
    </p>

    <ul>
      <li>Browser-accessible tools</li>
      <li>Consistent input/output format</li>
      <li>No local dependencies required</li>
      <li>Safe for lab and educational environments</li>
    </ul>

    <hr />

    <h3>Tool Categories</h3>

    <h3>Reconnaissance & OSINT</h3>
    <ul>
      <li>Port scanning</li>
      <li>Service and version detection</li>
      <li>OS fingerprinting</li>
      <li>WHOIS lookup</li>
      <li>DNS reconnaissance</li>
      <li>Subdomain enumeration</li>
      <li>Reverse IP lookup</li>
      <li>IP geolocation</li>
      <li>Google dork generator</li>
    </ul>

    <h3>Web Application Security</h3>
    <ul>
      <li>Directory and file fuzzing</li>
      <li>Vulnerability fuzzers (SQLi, XSS, command injection)</li>
      <li>API security scanner</li>
      <li>Broken authentication testing</li>
    </ul>

    <h3>Network & Traffic Analysis</h3>
    <ul>
      <li>Packet capture</li>
      <li>Packet analyzer</li>
      <li>Service enumeration</li>
      <li>Network mapping</li>
    </ul>

    <h3>Cloud & Container Security</h3>
    <ul>
      <li>Public S3 bucket discovery</li>
      <li>Container image scanning</li>
      <li>Kubernetes enumeration</li>
    </ul>

    <h3>Cryptography & Encoding</h3>
    <ul>
      <li>Hash identification and cracking</li>
      <li>JWT decoding</li>
      <li>Classical cipher encode/decode</li>
      <li>RSA/AES encryption and decryption</li>
    </ul>

    <h3>Forensics & Steganography</h3>
    <ul>
      <li>Image metadata viewer</li>
      <li>Image steganography</li>
      <li>Audio steganography</li>
      <li>Video steganography</li>
      <li>Document steganography</li>
    </ul>

    <h3>Threat Intelligence</h3>
    <ul>
      <li>Email breach checking</li>
      <li>Credential exposure lookups</li>
      <li>Basic malware artifact inspection</li>
    </ul>

    <hr />

    <h3>Unified User Experience</h3>

    <p>
      All tools follow a consistent workflow:
    </p>

    <ol>
      <li>Provide input (target, file, or text)</li>
      <li>Configure optional parameters</li>
      <li>Execute tool</li>
      <li>View structured results</li>
      <li>Export output if needed</li>
    </ol>

    <p>
      This consistency reduces cognitive overhead and improves productivity
      during competitions and investigations.
    </p>

    <hr />

    <h3>CTF & Learning Focus</h3>

    <p>
      The suite is particularly well-suited for:
    </p>

    <ul>
      <li>Capture The Flag competitions</li>
      <li>Security coursework</li>
      <li>Self-paced practice labs</li>
      <li>Interview preparation</li>
    </ul>

    <p>
      Students can move seamlessly between cryptography, web exploitation,
      forensics, and OSINT challenges from one platform.
    </p>

    <hr />

    <h3>Extensible Architecture</h3>

    <p>
      New tools can be added by defining metadata, UI schema, and execution
      logic, allowing the suite to grow over time.
    </p>

    <p>
      This makes CyberX a living toolkit rather than a static collection.
    </p>

    <hr />

    <h3>Security & Ethics</h3>

    <ul>
      <li>Intended for authorized environments only</li>
      <li>No automatic scanning of public targets</li>
      <li>Rate limiting and sandboxed execution</li>
    </ul>

    <p>
      CyberX promotes responsible and ethical security testing.
    </p>
  </>
),


  rlGym: (
      <>
        <h2>RL Training Gym</h2>

        <p>
          The RL Training Gym is the offensive learning engine of CyberX. It trains
          reinforcement learning agents to perform realistic penetration testing
          against dynamic cyber ranges using real attacker behavior collected by
          the Honeypot Simulator.
        </p>

        <p>
          Together, the Honeypot Simulator and RL Gym form a closed-loop learning
          system where real-world attacks continuously improve AI agents, and
          trained agents refine deception and defensive strategies.
        </p>

        <hr />

        <h3>System Architecture Overview</h3>

        <pre>
    Gymnasium Environment ──► RL Algorithms (PPO / DQN / DDQN) ──► Training Loop<br />
            │<br />
            └──► Cyber Range (Docker VMs + Vulnerabilities)
        </pre>

        <p>
          The RL Gym exposes cyber-attack scenarios as reinforcement learning
          environments. Each episode represents a full penetration attempt
          against a simulated network.
        </p>

        <hr />

        <h3>Technology Stack</h3>

        <ul>
          <li><strong>Gymnasium (Python)</strong>: Environment specification.</li>
          <li><strong>Stable Baselines3</strong>: PPO, DQN, A2C, SAC algorithms.</li>
          <li><strong>PyTorch / TensorFlow</strong>: Neural network backends.</li>
          <li><strong>Cyber Range</strong>: Dockerized vulnerable machines.</li>
          <li><strong>Metasploit RPC</strong>: Real exploit execution.</li>
          <li><strong>Node Bridge</strong>: REST/WebSocket interface.</li>
          <li><strong>TensorBoard</strong>: Live training visualization.</li>
        </ul>

        <hr />

        <h3>Environment Design (Gymnasium Spec)</h3>

        <pre>{`class CyberXGym(gym.Env):
    def __init__(self):
        self.action_space = spaces.Discrete(50)
        self.observation_space = spaces.Box(
            low=0, high=255,
            shape=(network_size + host_states),
            dtype=np.uint8
        )

    def reset(self):
        self.network = CyberRange(num_hosts=5)
        return self._get_state()

    def step(self, action):
        if action == 0:
            result = self.network.scan(target_host)
        elif action in [10,11,12]:
            result = self.network.exploit(action - 10)

        reward = self._compute_reward(result)
        done = self._is_terminal(result)
        return self._get_state(), reward, done, {}`}</pre>

        <p>
          Each reset creates a new randomized network with different vulnerabilities,
          operating systems, and credentials.
        </p>

        <hr />

        <h3>Action Space</h3>

        <ul>
          <li><strong>Reconnaissance</strong>: Nmap variants, DNS enum, WHOIS.</li>
          <li><strong>Exploitation</strong>: Metasploit modules.</li>
          <li><strong>Lateral Movement</strong>: Pivoting, credential reuse.</li>
          <li><strong>Post-Exploitation</strong>: Privilege escalation, data access.</li>
        </ul>

        <p>
          Total: 50 discrete actions.
        </p>

        <hr />

        <h3>Observation Space</h3>

        <pre>
    [
      host1_open_ports,
      host1_os_fingerprint,
      host2_reachability,
      credentials_found,
      privilege_level,
      network_graph_state
    ]
        </pre>

        <p>
          Observations encode the evolving state of the network and compromised hosts.
        </p>

        <hr />

        <h3>Reward Function</h3>

        <pre>
    root_access      → +100 <br />
    user_access      → +50<br />
    service_found    → +10<br />
    time_penalty     → -1
        </pre>

        <p>
          Rewards encourage efficient compromise while penalizing wasted actions.
        </p>

        <hr />

        <h3>Training Loop</h3>

        <pre>{`from stable_baselines3 import PPO

model = PPO("MlpPolicy", env, verbose=1,
            tensorboard_log="./tb_logs/")

model.learn(total_timesteps=1e6)
model.save("cyberx_pentester")`}</pre>

        <p>
          Large-scale training typically runs on GPU nodes and may take several days
          depending on environment complexity.
        </p>

        <hr />

        <h3>Live Monitoring</h3>

        <ul>
          <li>Reward curves</li>
          <li>Episode length</li>
          <li>Action distributions</li>
          <li>Policy entropy</li>
        </ul>

        <p>
          All metrics are streamed to TensorBoard and visualized in the React dashboard.
        </p>

        <hr />

        <h3>UI Integration</h3>

        <ul>
          <li>Start/stop training jobs</li>
          <li>View live episode traces</li>
          <li>Compare agent vs human runs</li>
          <li>Export trained policies</li>
        </ul>

        <hr />

        <h3>Honeypot ↔ RL Gym Integration</h3>

        <pre>
    Honeypot Logs → Scenario Generator → RL Gym Episodes
          → Trained Agents → Honeypot Adaptation
        </pre>

        <p>
          Real attack chains are converted into training scenarios. Agents learn to
          reproduce attacker behavior and improve efficiency.
        </p>

        <hr />

        <h3>Example Episode from Honeypot Data</h3>

        <pre>
    Real Attacker:<br />
    ssh root@honeypot → whoami → cat /etc/passwd → wget shell.sh<br />
<br />
    RL Scenario:<br />
    SSH brute → enum users → download payload<br />
<br />
    Agent Actions:<br />
    [brute_ssh, enum_users, download_payload]<br />
<br />
    Reward: +80
        </pre>

        <hr />

        <h3>Deployment & Scale</h3>

        <pre>
    Docker Swarm / Kubernetes<br />
    ├── honeypot-cluster<br />
    ├── gym-compute (GPU nodes)<br />
    ├── elasticsearch<br />
    ├── node-api<br />
    └── react-frontend
        </pre>

        <p>
          Training workloads scale horizontally across GPU-enabled nodes.
        </p>

        <hr />

        <h3>Current Metrics</h3>

        <ul>
          <li>75% success rate on medium scenarios.</li>
          <li>500k steps required for convergence.</li>
          <li>Real-time globe latency under 200ms.</li>
        </ul>

        <hr />

        <h3>Unique Advantages</h3>

        <ul>
          <li>Trained on real attacker behavior.</li>
          <li>Multi-protocol environments.</li>
          <li>Adaptive deception feedback.</li>
          <li>Visualized in 3D globe.</li>
          <li>Production-scale deployment.</li>
        </ul>

        <p>
          CyberX agents do not learn from static datasets. They learn from
          the same adversaries attacking real infrastructure.
        </p>
      </>
    ),

  
      honeypot: (
      <>
        <h2>Honeypot Simulator & Attack Feed</h2>
    
        <p>
          The Honeypot Simulator is the defensive deception engine of CyberX.
          It captures real-world attacker behavior, processes it into structured
          intelligence, and feeds it directly into the RL Training Gym.
        </p>
    
        <p>
          Together, the Honeypot and RL Gym form a closed-loop cyber learning
          system: real attackers generate data → agents learn from that data →
          insights improve future deception strategies.
        </p>
    
        <hr />
    
        <h3>System Architecture Overview</h3>
    
        <pre>
    Real Internet Attacker ──► Honeypot Simulator ──► Log Processing ──► RL Gym<br />
           ↑                                                     ↓<br />
           └─────────── Honeypot Data ───────────────────────────┘
        </pre>
    
        <p>
          The Honeypot Simulator performs defensive deception, while the RL Gym
          performs offensive training. Both continuously exchange intelligence.
        </p>
    
        <hr />
    
        <h3>Technology Stack</h3>
    
        <ul>
          <li>
            <strong>Cowrie (Python)</strong>: SSH/Telnet honeypot simulating
            a full Unix shell environment.
          </li>
          <li>
            <strong>Node.js / Express</strong>: Orchestrates honeypot instances,
            aggregates logs, exposes REST APIs.
          </li>
          <li>
            <strong>Elasticsearch + Kibana (ELK)</strong>: Stores structured logs
            for querying and analytics.
          </li>
          <li>
            <strong>Docker Compose</strong>: Isolated multi-protocol honeypot
            containers with varied OS personalities.
          </li>
          <li>
            <strong>Redis</strong>: Real-time queue for log processing and
            honeypot state coordination.
          </li>
          <li>
            <strong>React Dashboard</strong>: Visualization and control interface.
          </li>
        </ul>
    
        <hr />
    
        <h3>Deployment Model</h3>
    
        <p>
          Using Docker Compose, multiple honeypots are deployed simultaneously
          across different protocols and operating system personalities.
        </p>
    
        <ul>
          <li>cowrie-ssh (Ubuntu persona)</li>
          <li>cowrie-telnet (Legacy IoT persona)</li>
          <li>cowrie-ftp (Misconfigured file server persona)</li>
          <li>Custom OS fingerprints (CentOS, embedded devices)</li>
        </ul>
    
        <p>
          Each instance exposes unique fake file systems, users, services, and
          configuration artifacts to increase realism and engagement time.
        </p>
    
        <hr />
    
        <h3>Attack Capture Flow</h3>
    
        <p>
          When a real attacker connects to the honeypot (e.g., SSH brute-force),
          Cowrie captures every interaction in structured format.
        </p>
    
        <pre>
    2026-02-14 23:45:12 [SSH] 203.0.113.42 LOGIN FAILED root:password123<br />
    2026-02-14 23:45:15 [SHELL] 203.0.113.42 whoami → "ubuntu"<br />
    2026-02-14 23:45:18 [DOWNLOAD] 203.0.113.42 wget evilscript.sh
        </pre>
    
        <p>
          Logged events include:
        </p>
    
        <ul>
          <li>IP address and geolocation</li>
          <li>Authentication attempts</li>
          <li>Executed shell commands</li>
          <li>File uploads/downloads</li>
          <li>Exploit payload attempts</li>
          <li>Session duration and behavior patterns</li>
        </ul>
    
        <hr />
    
        <h3>Log Processing & Aggregation</h3>
    
        <p>
          The Node.js backend continuously processes raw honeypot logs into
          structured intelligence summaries.
        </p>
    
        <pre>
        {`{ 
          "top_attackers": ["203.0.113.42: 152 attempts"],
          "common_commands": ["whoami", "uname -a", "cat /etc/passwd"],
          "payloads": ["shellshock", "dirtycow"],
          "countries": {"CN": "45%", "RU": "23%", "US": "12%"}
        }`}
        </pre>
    
        <p>
          Redis queues enable near real-time ingestion and transformation,
          while Elasticsearch supports large-scale querying and analytics.
        </p>
    
        <hr />
    
        <h3>Adaptive Simulation Layer</h3>
    
        <p>
          Custom Cowrie plugins dynamically adjust responses based on attacker
          behavior to increase engagement time and realism.
        </p>
    
        <ul>
          <li>If attacker runs <strong>nmap</strong> → return believable open ports</li>
          <li>If attacker attempts exploit → simulate partial vulnerability</li>
          <li>If payload executed → drop controlled fake shell</li>
          <li>Adjust filesystem artifacts based on attacker focus</li>
        </ul>
    
        <p>
          Future versions will incorporate RL Gym outputs to automatically refine
          deception responses using reinforcement learning policies.
        </p>
    
        <hr />
    
        <h3>Multi-Protocol Support</h3>
    
        <ul>
          <li>SSH</li>
          <li>Telnet</li>
          <li>FTP</li>
          <li>HTTP (planned)</li>
        </ul>
    
        <p>
          Each protocol exposes distinct attack surfaces and attracts different
          attacker profiles.
        </p>
    
        <hr />
    
        <h3>Real-Time Visualization</h3>
    
        <p>
          Attack events are streamed to:
        </p>
    
        <ul>
          <li>Live Attack Feed dashboard</li>
          <li>Global Globe (Attack Vector Mode)</li>
          <li>Threat summary panels</li>
        </ul>
    
        <p>
          Geographic origin data enables attack path mapping and clustering.
        </p>
    
        <hr />
    
        <h3>Data Export & RL Integration</h3>
    
        <p>
          Honeypot logs can be exported in JSON or CSV format and converted
          into structured RL training datasets.
        </p>
    
        <p>
          Example transformations include:
        </p>
    
        <ul>
          <li>Command sequence → action space mapping</li>
          <li>Session success → reward signal</li>
          <li>Exploit chains → multi-step policy training</li>
        </ul>
    
        <p>
          This enables AI agents to learn directly from real attacker behavior,
          creating a feedback-driven cyber training loop.
        </p>
    
        <hr />
    
        <h3>Closed-Loop Learning System</h3>
    
        <p>
          The Honeypot Simulator and RL Gym form the defensive core of CyberX.
        </p>
    
        <ul>
          <li>Real attackers generate raw behavior data.</li>
          <li>RL agents train on real-world tactics.</li>
          <li>Insights refine honeypot deception logic.</li>
          <li>Improved honeypots capture higher-quality attacker behavior.</li>
        </ul>
    
        <p>
          This continuous cycle strengthens both automated offense simulation
          and defensive deception intelligence.
        </p>
    
        <hr />
    
        <h3>Security Considerations</h3>
    
        <ul>
          <li>All honeypots run in isolated containers.</li>
          <li>No outbound attack traffic is permitted.</li>
          <li>Strict network sandboxing prevents lateral movement.</li>
          <li>Resource throttling protects host infrastructure.</li>
        </ul>
    
        <p>
          The honeypot is intentionally vulnerable in appearance,
          but securely sandboxed in implementation.
        </p>
      </>
    ),


  globe: (
      <>
        <h2>Global Map & Filters</h2>

        <p>
          The Global Map is a real-time, interactive 3D cyber-intelligence surface.
          It visualizes worldwide network health, telecommunications coverage, and
          threat activity through layered geospatial rendering.
        </p>

        <p>
          Built on a WebGL-powered rotating globe, this module transforms raw
          infrastructure and security telemetry into an intuitive operational view.
          You can rotate, zoom, filter, and layer multiple datasets to explore
          global patterns.
        </p>

        <hr />

        <h3>Core Architecture</h3>
        <p>
          The globe renders country polygons, city-level markers, hex-bin overlays,
          and animated arcs in real time. Each dataset is processed and mapped to
          geographic coordinates before being projected onto the spherical model.
        </p>

        <ul>
          <li>
            <strong>Polygon Layers</strong>: Country-level overlays for signal and
            outage visualization.
          </li>
          <li>
            <strong>Point Markers</strong>: City-level telemetry and coverage nodes.
          </li>
          <li>
            <strong>Hex Bins</strong>: Density representation for 5G infrastructure.
          </li>
          <li>
            <strong>Animated Arcs</strong>: Attack source → destination mapping.
          </li>
        </ul>

        <hr />

        <h3>Available Map Modes</h3>

        <h3>1. Global Signal Strength</h3>
        <p>
          Displays estimated broadband signal strength across all countries. Each
          region is color-coded based on average connectivity metrics.
        </p>

        <ul>
          <li><strong>Green</strong>: Strong, stable connectivity</li>
          <li><strong>Yellow</strong>: Moderate signal or congestion</li>
          <li><strong>Red</strong>: Weak signal or service disruption</li>
        </ul>

        <p>
          Hover over a country to view detailed metrics including:
        </p>

        <ul>
          <li>Average latency</li>
          <li>Packet loss indicators</li>
          <li>Service uptime percentage</li>
          <li>Regional broadband health score</li>
        </ul>

        <p>
          This mode is useful for infrastructure analysis, outage detection,
          and global connectivity benchmarking.
        </p>

        <hr />

        <h3>2. 5G Coverage & Operator View</h3>
        <p>
          Visualizes global 5G deployment density using a hexagonal bin overlay.
          Each hex represents infrastructure concentration within that region.
        </p>

        <p>
          Operator information is displayed dynamically and includes:
        </p>

        <ul>
          <li>Carrier name</li>
          <li>Network type (NSA / SA)</li>
          <li>Spectrum band classification</li>
          <li>Deployment density score</li>
        </ul>

        <p>
          Zooming into urban regions reveals high-density clusters, while rural
          zones show sparse or developing infrastructure.
        </p>

        <p>
          This mode supports telecom research, infrastructure comparison,
          and coverage gap analysis.
        </p>

        <hr />

        <h3>3. Attack Vector Mapping (Under Development)</h3>
        <p>
          The Attack Vector mode will integrate directly with the Honeypot
          Simulator and live attack feed to visualize hostile activity patterns.
        </p>

        <p>
          Planned features include:
        </p>

        <ul>
          <li>Animated arcs from source country to honeypot target</li>
          <li>Protocol-based filtering (SSH, HTTP, FTP, etc.)</li>
          <li>Time-range filtering for spike analysis</li>
          <li>Heatmap clustering of repeated origin regions</li>
          <li>Replay capability for selected attack sessions</li>
        </ul>

        <p>
          Once fully implemented, this mode will allow analysts to correlate
          infrastructure health with active threat flows in real time.
        </p>

        <hr />

        <h3>Navigation & Interaction Controls</h3>

        <ul>
          <li>Drag to rotate the globe</li>
          <li>Scroll or pinch to zoom</li>
          <li>Hover to reveal contextual tooltips</li>
          <li>Toggle layers via control panel</li>
          <li>Switch modes using the map selector</li>
        </ul>

        <p>
          The globe automatically optimizes rendering based on zoom level,
          reducing visual clutter and improving clarity at different scales.
        </p>

        <hr />

        <h3>Use Cases</h3>

        <ul>
          <li>
            <strong>Infrastructure Monitoring</strong>: Identify global outages
            or weak connectivity zones.
          </li>
          <li>
            <strong>Telecom Analysis</strong>: Compare 5G deployment strategies
            across operators and regions.
          </li>
          <li>
            <strong>Threat Intelligence</strong>: (Upcoming) Track attack
            patterns geographically.
          </li>
          <li>
            <strong>Educational Demonstrations</strong>: Visualize how global
            cyber activity intersects with infrastructure.
          </li>
        </ul>

        <hr />

        <h3>Performance & Rendering</h3>
        <p>
          The globe is GPU-accelerated via WebGL and dynamically adjusts
          rendering resolution based on viewport size and zoom level.
        </p>

        <p>
          Heavy datasets such as 5G hex bins and attack arcs are conditionally
          loaded to preserve performance and responsiveness.
        </p>

        <p>
          For best experience, use a modern browser with hardware acceleration enabled.
        </p>
      </>
    ),


  workflows: (
  <>
    <h2>Suggested Workflows</h2>

    <p>
      Workflows describe how CyberX modules are combined into complete
      offensive and defensive pipelines.
    </p>

    <p>
      Rather than isolated features, CyberX operates as a coordinated system
      where intelligence, tooling, and learning continuously reinforce each other.
    </p>

    <hr />

    <h3>Workflow 1 — Live Attacks → Agent Training</h3>

    <ol>
      <li>Honeypot captures real attacker session</li>
      <li>Logs converted into scenario</li>
      <li>Scenario loaded into RL Gym</li>
      <li>Agent trains on episode</li>
      <li>Policy saved and evaluated</li>
    </ol>

    <p>
      Outcome: Agents learn real-world attack chains.
    </p>

    <hr />

    <h3>Workflow 2 — Tool Discovery → Honeypot Adaptation</h3>

    <ol>
      <li>Analyst runs tools against cyber range</li>
      <li>Common exploit paths identified</li>
      <li>Honeypot configured to emulate those paths</li>
      <li>Attackers interact with realistic decoys</li>
    </ol>

    <hr />

    <h3>Workflow 3 — Agent vs Human Benchmarking</h3>

    <ol>
      <li>Human performs pentest</li>
      <li>Agent performs same scenario</li>
      <li>Compare success rate, steps, and time</li>
    </ol>

    <hr />

    <h3>Workflow 4 — Infrastructure Awareness</h3>

    <ol>
      <li>Observe globe anomalies</li>
      <li>Inspect honeypot feed</li>
      <li>Launch targeted tool scans</li>
    </ol>

    <hr />

    <h3>Workflow 5 — Continuous Improvement Loop</h3>

    <pre>
Honeypot → RL Gym → Agents → Tool Suite → Honeypot
    </pre>

    <p>
      Each loop improves realism, intelligence, and automation.
    </p>

    <hr />

    <h3>Who Benefits</h3>

    <ul>
      <li>Students learning pentesting</li>
      <li>Researchers studying attacker behavior</li>
      <li>Blue teams modeling threats</li>
      <li>Red teams testing playbooks</li>
    </ul>
  </>
),

};

// ---------------- EXPORT CONTENT ----------------

export const GUIDE_CONTENT: Record<string, JSX.Element> = { ...CORE_CONTENT };

TOOLS_META.forEach((tool) => {
  GUIDE_CONTENT[tool.id] = renderToolContent(tool.id);
});
