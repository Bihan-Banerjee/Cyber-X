import React from 'react';
import { 
  TOOLS_META, 
  TOOLS_DETAILS, 
  ToolId 
} from './tools-docs'; // Ensure this path matches where you saved tools-docs.ts

// Combine original IDs with Tool IDs
export type TopicId =
  | 'overview'
  | 'tools'
  | 'rlGym'
  | 'honeypot'
  | 'globe'
  | 'workflows'
  | ToolId;

export interface TopicMeta {
  id: TopicId;
  title: string;
  category: string;
  icon?: any; // Added optional icon support
}

// 1. Define Core Topics
const CORE_TOPICS: TopicMeta[] = [
  { id: 'overview',  title: 'Platform Overview',          category: 'Core' },
  { id: 'tools',     title: 'Pentesting Tool Suite',      category: 'Offense' },
  { id: 'rlGym',     title: 'RL Training Gym',            category: 'AI' },
  { id: 'honeypot',  title: 'Honeypot & Attack Feed',     category: 'Intel' },
  { id: 'globe',     title: 'Global Map & Filters',       category: 'Visual' },
  { id: 'workflows', title: 'Suggested Workflows',        category: 'Playbooks' },
];

// 2. Convert Tools to Topics
const TOOL_TOPICS: TopicMeta[] = TOOLS_META.map((tool) => ({
  id: tool.id,
  title: tool.name,
  category: `Tool: ${tool.category}`, // Namespaced category for clarity
  icon: tool.icon
}));

// 3. Export Combined Topics
export const TOPICS: TopicMeta[] = [...CORE_TOPICS, ...TOOL_TOPICS];

// 4. Helper to generate Tool Content JSX
const renderToolContent = (toolId: ToolId): JSX.Element => {
  const tool = TOOLS_META.find(t => t.id === toolId);
  const details = TOOLS_DETAILS[toolId];

  if (!tool || !details) return <div>Tool documentation not found.</div>;

  return (
    <>
      <div className="guide-tool-header">
        <h2>{tool.name}</h2>
        <p><em>{tool.description}</em></p>
        <div style={{ margin: '1rem 0', display: 'flex', gap: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
          <span>Category: <strong>{tool.category}</strong></span>
          <span>Difficulty: <strong>{tool.difficulty}</strong></span>
        </div>
      </div>

      <hr />

      <h3>How to Use</h3>
      <p>{details.usage}</p>

      <h3>Technical Details</h3>
      <p>{details.details}</p>

      {details.example && (
        <>
          <h3>Example Output</h3>
          <pre style={{ 
            background: 'rgba(0,0,0,0.3)', 
            padding: '1rem', 
            borderRadius: '4px', 
            overflowX: 'auto',
            border: '1px solid rgba(255,255,255,0.1)' 
          }}>
            {details.example}
          </pre>
        </>
      )}

      {details.prerequisites && details.prerequisites.length > 0 && (
        <>
          <h3>Prerequisites</h3>
          <ul>
            {details.prerequisites.map((req, i) => <li key={i}>{req}</li>)}
          </ul>
        </>
      )}

      {details.outputs && details.outputs.length > 0 && (
        <>
          <h3>Expected Outputs</h3>
          <ul>
            {details.outputs.map((out, i) => <li key={i}>{out}</li>)}
          </ul>
        </>
      )}

      {details.warning && (
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          borderLeft: '4px solid #eab308', 
          background: 'rgba(234, 179, 8, 0.1)' 
        }}>
          <strong>Warning:</strong> {details.warning}
        </div>
      )}
    </>
  );
};

// 5. Generate Content Map
const CORE_CONTENT: Record<string, JSX.Element> = {
  overview: (
    <>
      <h2>Platform Overview</h2>
      <p>
        CyberX is a unified cyber‑operations lab that combines offensive tooling,
        reinforcement‑learning training, live honeypots, and a global threat map
        into a single interface.
      </p>
      <p>
        Use this page as your reference: pick a topic on the left to learn what
        each module does and how to use it effectively.
      </p>
    </>
  ),

  tools: (
    <>
      <h2>Pentesting Tool Suite</h2>
      <p>
        The tool suite wraps scanners, enumerators, and exploit helpers behind a
        consistent UI so you can test lab targets safely and repeatably.
      </p>
      <p>
        Scroll down in the sidebar to view detailed documentation for specific tools
        (Port Scanners, Fuzzers, Crackers, etc.).
      </p>
      <ol>
        <li>Open the <strong>Security Tools</strong> page from the top navigation.</li>
        <li>Use the search bar and tags to find a tool by name, category, or use‑case.</li>
        <li>Select a card to see its description, inputs, and expected output.</li>
        <li>Run the tool against a chosen target and review logs in the result panel.</li>
      </ol>
    </>
  ),

  rlGym: (
    <>
      <h2>RL Training Gym</h2>
      <p>
        The RL gym exposes lab environments as episodes where agents can perform
        actions (scan, move, exploit) and receive rewards for meaningful progress.
      </p>
      <ol>
        <li>Navigate to the <strong>RL Gym</strong> section.</li>
        <li>Choose an environment (single host, small network, or scenario).</li>
        <li>Select or upload an agent policy/checkpoint and configure hyper‑parameters.</li>
        <li>Start training or evaluation and monitor reward, steps, and success rates.</li>
      </ol>
      <p>
        Compare agent runs with your manual pentests on the same environment to see
        where automation helps or fails.
      </p>
    </>
  ),

  honeypot: (
    <>
      <h2>Honeypot & Attack Feed</h2>
      <p>
        Honeypots are decoy services designed to attract real attackers so their
        behavior can be logged, studied, and used as training data.
      </p>
      <ol>
        <li>Open the <strong>Honeypot</strong> / <strong>Attack Feed</strong> page.</li>
        <li>Filter by time, protocol, or target service to focus on a slice of traffic.</li>
        <li>Inspect a single session to see IP info, commands, and payload attempts.</li>
        <li>Tag interesting sessions for replay inside the RL gym or for deeper forensics.</li>
      </ol>
      <p>
        Use this feed to understand what attackers are trying in the wild and to
        design new scenarios for agents and tools.
      </p>
    </>
  ),

  globe: (
    <>
      <h2>Global Map & Filters</h2>
      <p>
        The globe is a fullscreen 3D view of network health, outages, 5G coverage,
        and attack origins rendered as points, polygons, hexes, and arcs.
      </p>
      <ol>
        <li>Open the <strong>Map</strong> page from the navigation.</li>
        <li>Use the layer toggles in the top‑right to enable or disable overlays.</li>
        <li>Hover over markers, polygons, and hexes to see detailed tooltips.</li>
        <li>Drag to rotate, scroll or pinch to zoom, and explore regions of interest.</li>
      </ol>
      <ul>
        <li><strong>Signal Strength</strong>: quality per city as colored pulses.</li>
        <li><strong>Downtime</strong>: red polygons over impacted regions.</li>
        <li><strong>5G Coverage</strong>: blue hex‑bins showing density and strength.</li>
        <li><strong>Attack Origins</strong>: arcs from source countries into your lab.</li>
      </ul>
    </>
  ),

  workflows: (
    <>
      <h2>Suggested Workflows</h2>
      <p>
        Combine modules to build end‑to‑end workflows, from observation to training
        to testing and back.
      </p>
      <h3>From live attacks to training</h3>
      <ol>
        <li>Watch attack spikes and paths on the globe.</li>
        <li>Drill into matching honeypot sessions in the attack feed.</li>
        <li>Build or tweak an RL environment that reflects this behavior.</li>
        <li>Train or evaluate agents, then replay successful policies via the tool suite.</li>
      </ol>
      <h3>From lab testing to monitoring</h3>
      <ol>
        <li>Use the tool suite on a new lab service to map realistic attack paths.</li>
        <li>Expose similar decoy services as honeypots.</li>
        <li>Monitor how real attackers interact with these decoys on the globe.</li>
        <li>Feed these insights back into RL training and your own playbooks.</li>
      </ol>
    </>
  ),
};

// 6. Build final content record
export const GUIDE_CONTENT: Record<string, JSX.Element> = { ...CORE_CONTENT };

// Inject tool contents
TOOLS_META.forEach(tool => {
  GUIDE_CONTENT[tool.id] = renderToolContent(tool.id);
});