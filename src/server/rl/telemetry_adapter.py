"""
telemetry_adapter.py  –  Real honeypot telemetry → trained defender policy
===========================================================================
Shadow-mode inference: maps live Cowrie/Elasticsearch events into the
defender observation used by SharedHoneypotEnv and asks the trained
defender policy for a recommended action.

Scope note: TRAINING on live telemetry is intentionally out of scope.
A real ES/SSH step costs 500ms+, the world is non-resettable and
non-stationary — useless for PPO. Policies are trained in the simulator
(shared_honeypot_env.py); this module only runs inference on real events.

The ES query / event-parsing logic is salvaged from the retired
honeypot_env.py (the v1 live-training environment).
"""

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import requests

from shared_honeypot_env import DEF_ACTION_NAMES, defender_observation

logger = logging.getLogger(__name__)

SUSPICIOUS_TOKENS = ("wget", "curl", "nc ", "bash", "chmod", "sudo", "su ")
SCAN_TOKENS       = ("nmap", "scan")
PRIV_ESC_TOKENS   = ("sudo", "su ")


class TelemetryAdapter:
    """Polls Elasticsearch for recent honeypot events and condenses them
    into the counter set the defender policy was trained on."""

    def __init__(
        self,
        es_url:  str = "http://localhost:9200",
        window:  str = "now-5m",
        timeout: int = 5,
    ):
        self.es_url  = es_url
        self.window  = window
        self.timeout = timeout

    def fetch_events(self) -> List[dict]:
        """Query recent honeypot events. Returns [] on any failure."""
        try:
            response = requests.post(
                f"{self.es_url}/honeypot-*/_search",
                json={
                    "size": 1000,
                    "query": {"range": {"@timestamp": {"gte": self.window}}},
                    "sort": [{"@timestamp": "desc"}],
                },
                timeout=self.timeout,
            )
            if response.status_code != 200:
                logger.warning("ES query failed: HTTP %d", response.status_code)
                return []
            return response.json().get("hits", {}).get("hits", [])
        except Exception as e:
            logger.warning("ES query failed: %s", e)
            return []

    @staticmethod
    def summarize(hits: List[dict]) -> Dict[str, Any]:
        """Condense raw ES hits into the counters the defender obs needs."""
        failed_logins       = 0
        suspicious_commands = 0
        port_scan           = 0
        priv_esc_attempts   = 0
        downloads           = 0
        sessions: set       = set()
        src_ips:  set       = set()

        for hit in hits:
            source  = hit.get("_source", {})
            eventid = source.get("eventid", "")

            if session := source.get("session"):
                sessions.add(session)
            if src_ip := source.get("src_ip"):
                src_ips.add(src_ip)

            if "login.failed" in eventid:
                failed_logins += 1
            if "command.input" in eventid:
                cmd = source.get("input", "").lower()
                if any(tok in cmd for tok in SUSPICIOUS_TOKENS):
                    suspicious_commands += 1
                if any(tok in cmd for tok in SCAN_TOKENS):
                    port_scan = 1
                if any(tok in cmd for tok in PRIV_ESC_TOKENS):
                    priv_esc_attempts += 1
            if "file_download" in eventid:
                downloads += 1

        return {
            "failed_logins":       failed_logins,
            "suspicious_commands": suspicious_commands,
            "port_scan":           port_scan,
            "priv_esc_attempts":   priv_esc_attempts,
            "downloads":           downloads,
            "n_sessions":          len(sessions),
            "n_src_ips":           len(src_ips),
        }

    def build_observation(
        self,
        defense_state: Optional[Dict[str, Any]] = None,
        step_fraction: float = 0.5,
    ) -> np.ndarray:
        """
        Build the 12-dim normalized v4 defender observation from live telemetry.

        ES events drive the attacker-derived signals (anomalies, failed
        logins, egress, distinct hosts, credential anomalies). The SOC's own
        state — accumulated evidence, deployed decoys, whether a decoy was
        tripped, containment/rate-limit status, alert count — cannot be read
        from raw honeypot logs; pass it in defense_state or leave it at 0.
        """
        ds      = defense_state or {}
        summary = self.summarize(self.fetch_events())
        # Observed anomalies = the attacker-noise proxy the SOC actually sees
        anomalies = (
            summary["suspicious_commands"]
            + summary["port_scan"]
            + summary["priv_esc_attempts"]
        )
        return defender_observation(
            observed_anomalies = anomalies,
            evidence           = float(ds.get("evidence", 0.0)),
            failed_logins      = summary["failed_logins"],
            step_fraction      = step_fraction,
            egress_volume      = summary["downloads"],
            alerts             = int(ds.get("alerts", 0)),
            decoys_deployed    = int(ds.get("decoys_deployed", 0)),
            decoy_tripped      = bool(ds.get("decoy_tripped", False)),
            containment_active = bool(ds.get("containment_active", False)),
            hosts_anomalous    = summary["n_src_ips"],
            credential_anomaly = summary["priv_esc_attempts"] > 0,
            rate_limited       = bool(ds.get("rate_limited", False)),
        )


class DefenderAdvisor:
    """Loads the trained defender once and threads LSTM state across calls,
    so consecutive suggestions see a coherent event history."""

    def __init__(self, model_path: str, device: str = "cpu"):
        from sb3_contrib import RecurrentPPO
        self._model = RecurrentPPO.load(model_path, device=device)
        self._state = None

    def reset(self) -> None:
        self._state = None

    def suggest(self, obs: np.ndarray, deterministic: bool = True) -> Dict[str, Any]:
        obs_arr = np.asarray(obs, dtype=np.float32).reshape(1, -1)
        action, self._state = self._model.predict(
            obs_arr, state=self._state, deterministic=deterministic
        )
        a = int(np.asarray(action).flat[0])
        return {"action": a, "action_name": DEF_ACTION_NAMES[a]}
