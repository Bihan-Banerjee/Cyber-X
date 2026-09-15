"""
provenance.py  –  Per-run experiment provenance for CyberX MARL
================================================================
Writes a `run_manifest.json` into each run's save_dir capturing everything
needed to reproduce (or at least honestly cite) the run: the git commit, a
hash of the resolved config, the master seed, the reward overrides in effect,
and the versions of the RL libraries that produce the numbers.

Before this, every published figure lived in a gitignored models dir with no
record of which commit, seed, or config produced it — the exported artifacts
could not be regenerated from the repository. The manifest is the fix.

Nothing here is on the training hot path; it runs once per run.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

_RL_DIR = os.path.dirname(os.path.abspath(__file__))

# Libraries whose versions actually change results.
_TRACKED_PACKAGES = (
    "torch", "stable_baselines3", "sb3_contrib", "gymnasium", "numpy",
)


def _git_sha() -> Optional[str]:
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=_RL_DIR,
            stderr=subprocess.DEVNULL, text=True,
        ).strip()
        dirty = subprocess.call(
            ["git", "diff", "--quiet"], cwd=_RL_DIR,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ) != 0
        return f"{sha}{'-dirty' if dirty else ''}"
    except Exception:
        return None


def _package_versions() -> Dict[str, Optional[str]]:
    from importlib.metadata import PackageNotFoundError, version
    out: Dict[str, Optional[str]] = {}
    for pkg in _TRACKED_PACKAGES:
        try:
            out[pkg] = version(pkg)
        except PackageNotFoundError:
            out[pkg] = None
    return out


def config_hash(resolved_config: Dict[str, Any]) -> str:
    """Stable SHA-256 over the resolved config (comment keys included is fine —
    they don't change between runs). Lets two runs be compared for config
    identity without diffing the whole file."""
    blob = json.dumps(resolved_config, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


def write_run_manifest(
    save_dir: str,
    seed: int,
    resolved_config: Dict[str, Any],
    reward_overrides: Optional[Dict[str, Any]] = None,
    extra: Optional[Dict[str, Any]] = None,
    overwrite: bool = False,
) -> str:
    """Write `<save_dir>/run_manifest.json`. On resume the original is kept
    (overwrite=False) so the manifest always reflects the run's origin."""
    os.makedirs(save_dir, exist_ok=True)
    path = os.path.join(save_dir, "run_manifest.json")
    if os.path.exists(path) and not overwrite:
        return path

    # config_loader.resolved() returns raw config.json, so it shows the file
    # defaults (seed 42, pfsp off) even for a `--seed N --pfsp` run — misleading
    # read alone, and it makes the config hash identical across arms. Overlay the
    # effective CLI overrides onto a copy so the stored config and its hash are
    # accurate and the PFSP arm is distinguishable from its uniform control.
    resolved = copy.deepcopy(resolved_config)
    resolved["seed"] = seed
    if extra and "pfsp_enabled" in extra and isinstance(resolved.get("league"), dict):
        pfsp = resolved["league"].get("pfsp")
        if isinstance(pfsp, dict):
            pfsp["enabled"] = extra["pfsp_enabled"]

    manifest = {
        "generated_at":     datetime.now(timezone.utc).isoformat(),
        "git_sha":          _git_sha(),
        "seed":             seed,
        "config_hash":      config_hash(resolved),
        "reward_overrides": reward_overrides or {},
        "python":           sys.version.split()[0],
        "packages":         _package_versions(),
        "argv":             sys.argv,
        "resolved_config":  resolved,
    }
    if extra:
        manifest.update(extra)

    with open(path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)
    return path
