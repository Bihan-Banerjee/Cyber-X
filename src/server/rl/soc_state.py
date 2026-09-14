"""
soc_state.py  –  The SOC's own state, evolved from the defender's own actions
==============================================================================
The defender observation has twelve dimensions. Honeypot telemetry can only
supply five of them (anomalies, failed logins, egress, distinct hosts,
credential anomalies) — the other seven describe *the SOC's own posture*:
accumulated evidence, raised alerts, deployed decoys, whether a decoy tripped,
whether containment or a rate limit is active, and how far into the engagement
we are. Elasticsearch has no idea about any of that.

`TelemetryAdapter.build_observation` has always accepted a `defense_state` for
exactly this, and nothing ever supplied one. The consequence was severe and
measurable: with `evidence` pinned at 0 the policy could never reach its
containment branch, so seven of twelve dimensions were frozen constants and the
trained defender emitted a single action (`threat_hunt`) for every window of the
shadow evaluation. That is not a bad policy — in-sim, "anomalies present, no
evidence" is precisely when hunting is correct. It was a degenerate input.

`SocState` closes that loop. It is a deliberately small mirror of the defender
side of `SharedHoneypotEnv._exec_defender_action`: the recommended action feeds
back into the state that produces the next observation, so evidence accrues
while the SOC investigates, containment fires once evidence clears the bar (and
consumes it), and the recommendation moves on. Coefficients are read from the
env's own `RewardConfig` so the two cannot drift apart.

Scope: this models the *SOC's* posture, not the attacker's. Nothing here
executes against a real host — the recommendation is still advisory, and the
state advances on the assumption that a recommended action is carried out.
"""

from dataclasses import dataclass, field
from typing import Any, Dict

from shared_honeypot_env import (
    DEFAULT_REWARDS,
    D_DEPLOY_DECOY,
    D_HARD_BLOCK,
    D_INVESTIGATE,
    D_ISOLATE,
    D_MONITOR,
    D_RAISE_ALERT,
    D_RATE_LIMIT,
    D_ROTATE_CREDS,
    D_THREAT_HUNT,
    RewardConfig,
)


@dataclass
class SocState:
    """Mutable SOC posture between telemetry ticks.

    Feed each tick's observed telemetry through `advance()` *after* the model
    has chosen an action; the next `as_defense_state()` reflects it.
    """

    rw: RewardConfig = DEFAULT_REWARDS

    evidence:           float = 0.0
    alerts:             int   = 0
    decoys_deployed:    int   = 0
    decoy_tripped:      bool  = False
    containment_active: bool  = False
    contain_cooldown:   int   = 0
    rate_limit_steps:   int   = 0
    credential_anomaly: bool  = False

    # Bookkeeping for reporting, not part of the observation.
    justified_containments: int = 0
    false_positives:        int = 0
    ticks:                  int = 0
    action_log: list = field(default_factory=list)

    # ── Observation input ──────────────────────────────────────────────────

    def as_defense_state(self) -> Dict[str, Any]:
        """The `defense_state` mapping `TelemetryAdapter.build_observation` wants."""
        return {
            "evidence":           self.evidence,
            "alerts":             self.alerts,
            "decoys_deployed":    self.decoys_deployed,
            "decoy_tripped":      self.decoy_tripped,
            "containment_active": self.containment_active,
            "rate_limited":       self.rate_limit_steps > 0,
        }

    # ── Dynamics ───────────────────────────────────────────────────────────

    def decay(self) -> None:
        """Per-tick aging, mirroring the env's step preamble: stale indicators
        fade, throttles expire, and containment lifts when its cooldown runs
        out. Without this the state ratchets up and never comes back down."""
        rw = self.rw
        self.evidence *= rw.evidence_decay
        if self.rate_limit_steps > 0:
            self.rate_limit_steps -= 1
        if self.contain_cooldown > 0:
            self.contain_cooldown -= 1
            if self.contain_cooldown == 0:
                self.containment_active = False

    def advance(self, action: int, summary: Dict[str, Any]) -> Dict[str, Any]:
        """Apply the recommended `action` given this tick's telemetry `summary`.

        Returns a small dict describing what the action achieved, so callers can
        show *why* the recommendation changed rather than just that it did.

        The env drives evidence gain off the hidden `suspicion` accumulator. No
        such quantity exists outside the simulator, so the SOC-visible anomaly
        count stands in for it — the same proxy `build_observation` already uses
        for the anomalies dimension.
        """
        rw = self.rw
        anomalies = float(
            summary.get("suspicious_commands", 0)
            + summary.get("port_scan", 0)
            + summary.get("priv_esc_attempts", 0)
        )
        failed_logins = float(summary.get("failed_logins", 0))
        if summary.get("priv_esc_attempts", 0) > 0:
            self.credential_anomaly = True

        self.ticks += 1
        headroom = max(0.0, rw.evidence_cap - self.evidence)
        outcome: Dict[str, Any] = {"action": action, "effect": "none", "evidence_gain": 0.0}

        if action == D_MONITOR:
            gain = min(rw.monitor_evidence_gain, headroom) if anomalies > 2.0 else 0.0
            self.evidence += gain
            outcome.update(effect="passive_watch" if gain else "quiet",
                           evidence_gain=gain)

        elif action == D_INVESTIGATE:
            gain = min(min(anomalies, rw.evidence_cap) * rw.investigate_fraction, headroom)
            self.evidence += gain
            outcome.update(effect="evidence_built" if gain > 0.3 else "nothing_to_find",
                           evidence_gain=gain)

        elif action == D_THREAT_HUNT:
            gain = min(rw.threat_hunt_gain, headroom) if anomalies > 0.3 else 0.0
            self.evidence += gain
            outcome.update(effect="hunt_hit" if gain > 0.1 else "hunt_dry",
                           evidence_gain=gain)

        elif action == D_RATE_LIMIT:
            if self.rate_limit_steps > 0:
                outcome.update(effect="already_throttled")
            elif anomalies >= 2.0 or failed_logins >= 3:
                self.rate_limit_steps = rw.rate_limit_duration
                outcome.update(effect="throttled")
            else:
                self.false_positives += 1
                outcome.update(effect="false_positive")

        elif action == D_DEPLOY_DECOY:
            if self.decoys_deployed < rw.rd_decoy_cap:
                self.decoys_deployed += 1
                outcome.update(effect="decoy_deployed")
            else:
                outcome.update(effect="decoy_cap_reached")

        elif action in (D_ISOLATE, D_HARD_BLOCK):
            need = (rw.contain_isolate_evid if action == D_ISOLATE
                    else rw.contain_block_evid)
            if self.contain_cooldown > 0:
                outcome.update(effect="response_in_progress")
            elif self.evidence >= need:
                self._contain()
                outcome.update(effect="contained",
                               containments=self.justified_containments)
            else:
                self.false_positives += 1
                outcome.update(effect="insufficient_evidence",
                               evidence_needed=need)

        elif action == D_RAISE_ALERT:
            if anomalies >= 2.0 or self.decoy_tripped:
                self.alerts += 1
                self.evidence = min(self.evidence + 1.0, rw.evidence_cap)
                outcome.update(effect="escalated", evidence_gain=1.0)
            else:
                self.false_positives += 1
                outcome.update(effect="false_positive")

        elif action == D_ROTATE_CREDS:
            if self.credential_anomaly:
                self.credential_anomaly = False
                outcome.update(effect="credentials_rotated")
            else:
                outcome.update(effect="no_credential_anomaly")

        else:
            # patch_harden / restore_backup / deception_response act on host
            # state this module deliberately does not model.
            outcome.update(effect="operational")

        self.evidence = min(self.evidence, rw.evidence_cap)
        outcome["evidence"] = round(self.evidence, 3)
        self.action_log.append(outcome)
        return outcome

    def _contain(self) -> None:
        """A justified containment consumes the evidence that justified it and
        starts a cooldown — the same economy the env uses to stop block-spam."""
        self.justified_containments += 1
        self.containment_active = True
        self.contain_cooldown = self.rw.contain_cooldown_steps
        self.evidence = 0.0

    def reset(self) -> None:
        """Clear posture between independent engagements."""
        self.evidence = 0.0
        self.alerts = 0
        self.decoys_deployed = 0
        self.decoy_tripped = False
        self.containment_active = False
        self.contain_cooldown = 0
        self.rate_limit_steps = 0
        self.credential_anomaly = False
        self.justified_containments = 0
        self.false_positives = 0
        self.ticks = 0
        self.action_log.clear()
