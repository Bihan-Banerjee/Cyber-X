/**
 * defenderActionMap.ts â€” the bridge between the trained RL defender and CyberX.
 *
 * The MARL defender policy emits one of 12 discrete actions (see
 * src/server/rl/shared_honeypot_env.py: DEF_ACTION_NAMES, in this exact order).
 * The Defender Copilot turns each recommendation into a concrete next step by
 * deep-linking to the matching CyberX tool, and tags it with the MITRE D3FEND
 * defensive technique it corresponds to.
 *
 * NOTE (paper): `d3fendId` / `d3fend` were verified against d3fend.mitre.org
 * (2026-08). src/server/rl/attack_grounding.py is the source of truth and
 * tests_rl.py asserts the two agree, so the paper table and these labels cannot
 * drift. Three original entries were wrong: Credential Rotation is D3-CRO (not
 * D3-CR), and D3FEND has no "Alerting" or "System Restore" technique â€” actions
 * with no real equivalent now carry a null id rather than an invented one.
 */

export interface DefenderActionInfo {
  /** canonical action name, matches DEF_ACTION_NAMES in the env */
  action: string;
  /** short human-readable label */
  label: string;
  /** what the defender is doing, in SOC terms */
  description: string;
  /** MITRE D3FEND technique id, or null where D3FEND has no equivalent */
  d3fendId: string | null;
  /** the official D3FEND technique name for `d3fendId` */
  d3fend: string | null;
  /** the CyberX tool to run next, or null for an operational-only action */
  tool: { name: string; path: string } | null;
  /** why this tool helps carry out the recommended action */
  toolRationale?: string;
  /** tailwind accent: "cyan" passive/observe, "red" active containment */
  tone: "cyan" | "red";
}

/**
 * Indexed by action id (0â€“11), in the exact order of DEF_ACTION_NAMES so a
 * raw policy action int maps directly: DEFENDER_ACTIONS[action].
 */
export const DEFENDER_ACTIONS: DefenderActionInfo[] = [
  {
    action: "monitor",
    label: "Monitor",
    description: "Passively watch telemetry; raise the baseline of what's observed.",
    d3fendId: "D3-NTA",
    d3fend: "Network Traffic Analysis",
    tool: { name: "Log Analyzer", path: "/tools/log-analyze" },
    toolRationale: "Parse auth/web logs for the anomalies the policy is reacting to.",
    tone: "cyan",
  },
  {
    action: "investigate",
    label: "Investigate",
    description: "Convert raw suspicion into hard evidence by digging into the activity.",
    d3fendId: "D3-NTA",
    d3fend: "Network Traffic Analysis",
    tool: { name: "Packet Analyzer", path: "/tools/packet-analyzer" },
    toolRationale: "Inspect the captured traffic behind the suspicious sessions.",
    tone: "cyan",
  },
  {
    action: "rate_limit",
    label: "Rate-Limit",
    description: "Throttle the source to slow brute-force / scanning without full block.",
    d3fendId: "D3-ISVA",
    d3fend: "Inbound Session Volume Analysis",
    tool: { name: "WAF Detector", path: "/tools/waf-detect" },
    toolRationale: "Confirm what filtering/WAF layer is in front of the target.",
    tone: "red",
  },
  {
    action: "deploy_decoy",
    label: "Deploy Decoy",
    description: "Stand up a decoy to bait and fingerprint the attacker.",
    d3fendId: "D3-DE",
    d3fend: "Decoy Environment",
    tool: { name: "Honeypot Control", path: "/honeypots" },
    toolRationale: "Spin up / manage a honeypot directly from the SOC dashboard.",
    tone: "cyan",
  },
  {
    action: "threat_hunt",
    label: "Threat Hunt",
    description: "Proactively hunt for the attacker's footprint across the estate.",
    d3fendId: "D3-NTA",
    d3fend: "Network Traffic Analysis",
    tool: { name: "IP Reputation Checker", path: "/tools/ip-reputation" },
    toolRationale: "Pivot on the source IP's abuse/proxy/Tor reputation.",
    tone: "cyan",
  },
  {
    action: "isolate_host",
    label: "Isolate Host",
    description: "Network-isolate the affected host to contain lateral movement.",
    d3fendId: "D3-NI",
    d3fend: "Network Isolation",
    tool: { name: "Host Discovery", path: "/tools/host-discovery" },
    toolRationale: "Identify the live host(s) on the segment to isolate.",
    tone: "red",
  },
  {
    action: "hard_block",
    label: "Hard Block",
    description: "Block the source outright once evidence is sufficient.",
    d3fendId: "D3-ITF",
    d3fend: "Inbound Traffic Filtering",
    tool: { name: "IP Reputation Checker", path: "/tools/ip-reputation" },
    toolRationale: "Verify the IP is malicious before adding a hard block rule.",
    tone: "red",
  },
  {
    action: "patch_harden",
    label: "Patch / Harden",
    description: "Reduce the exploited surface by patching or hardening the service.",
    d3fendId: "D3-AH",
    d3fend: "Application Hardening",
    tool: { name: "CVE Search", path: "/tools/cve-search" },
    toolRationale: "Find the CVE / patch for the exploited service.",
    tone: "cyan",
  },
  {
    action: "rotate_credentials",
    label: "Rotate Credentials",
    description: "Invalidate possibly-compromised credentials and reissue secrets.",
    d3fendId: "D3-CRO",
    d3fend: "Credential Rotation",
    tool: { name: "Password Generator", path: "/tools/password-gen" },
    toolRationale: "Generate strong replacement credentials.",
    tone: "red",
  },
  {
    action: "restore_backup",
    label: "Restore Backup",
    description: "Recover impacted systems from a known-good backup.",
    d3fendId: "D3-RDI",
    d3fend: "Restore Disk Image",
    tool: { name: "File Hash Calculator", path: "/tools/file-hash" },
    toolRationale: "Verify backup integrity by hash before restoring.",
    tone: "red",
  },
  {
    action: "raise_alert",
    label: "Raise Alert",
    description: "Escalate to the SOC / responders for human attention.",
    d3fendId: null,
    d3fend: null,
    tool: { name: "Command Center", path: "/command-center" },
    toolRationale: "Review the unified threat picture and act.",
    tone: "red",
  },
  {
    action: "deception_response",
    label: "Deception Response",
    description: "Engage active deception to mislead and study the attacker.",
    d3fendId: "D3-DE",
    d3fend: "Decoy Environment",
    tool: { name: "Honeypot Control", path: "/honeypots" },
    toolRationale: "Adjust honeypot deception from the SOC dashboard.",
    tone: "cyan",
  },
];

const BY_NAME: Record<string, DefenderActionInfo> = Object.fromEntries(
  DEFENDER_ACTIONS.map((a) => [a.action, a]),
);

/** Look up a defender action by its policy id (0â€“11) or canonical name. */
export function defenderAction(
  idOrName: number | string,
): DefenderActionInfo | undefined {
  if (typeof idOrName === "number") return DEFENDER_ACTIONS[idOrName];
  return BY_NAME[idOrName];
}


