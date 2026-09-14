#!/usr/bin/env python3
"""
prune_artifacts.py  –  Retention policy for the models/ tree
=============================================================
Training keeps every ghost and checkpoint it ever wrote. `_save_ghost` drops a
ghost from the sampling pool once `ghost_pool_max` is exceeded but deliberately
leaves the file on disk for later analysis (trainer.py), and checkpoints are
never removed at all. Across seven runs that is several GB, and a multi-seed
sweep multiplies it by the number of seeds.

Keeping some history matters: crossplay.py needs archived checkpoints, and the
ghosts are the population it measures. So this prunes on a *stride* rather than
a cliff — keep everything recent, then thin the tail — instead of deleting old
snapshots outright.

Dry-run by default. Nothing is deleted without --apply.

Usage:
  python prune_artifacts.py                          # report only, whole tree
  python prune_artifacts.py --run-dir models/cyberx_marl --keep-recent 15
  python prune_artifacts.py --apply                  # actually delete
"""

import argparse
import os
import re
from collections import defaultdict

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_MODELS_DIR = os.path.join(_SCRIPT_DIR, "models")

# Never delete these: they are what the API serves, what exploitability.py
# probes, and what export_artifacts.py bakes.
PROTECTED = re.compile(r"(_best|_final|_latest)\.zip$")
ITER_RE   = re.compile(r"_(\d+)(?:_policy)?\.(zip|pt)$")


def _iter_num(path: str) -> int:
    m = ITER_RE.search(os.path.basename(path))
    return int(m.group(1)) if m else -1


def plan(root: str, keep_recent: int, stride: int):
    """Files to delete, grouped by the directory they live in.

    Within each pool, keep the `keep_recent` newest iterations in full, then
    every `stride`-th older one. Protected names are never candidates.
    """
    doomed, kept = [], []
    groups = defaultdict(list)
    for dirpath, _dirnames, filenames in os.walk(root):
        base = os.path.basename(dirpath)
        if base not in ("ghosts", "checkpoints"):
            continue
        for name in filenames:
            if not name.endswith((".zip", ".pt")) or PROTECTED.search(name):
                continue
            # att_12.zip and def_12.zip are separate series in one directory.
            series = ITER_RE.sub("", name)
            groups[(dirpath, series)].append(os.path.join(dirpath, name))

    for (dirpath, series), files in sorted(groups.items()):
        files.sort(key=_iter_num)
        recent = set(files[-keep_recent:]) if keep_recent else set()
        for f in files:
            n = _iter_num(f)
            if f in recent or (stride > 0 and n >= 0 and n % stride == 0):
                kept.append(f)
            else:
                doomed.append(f)
    return doomed, kept


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--run-dir", default=_MODELS_DIR,
                   help="tree to scan (default: the whole models/ dir)")
    p.add_argument("--keep-recent", type=int, default=10,
                   help="always keep this many newest iterations per pool")
    p.add_argument("--stride", type=int, default=5,
                   help="of the older ones, keep every Nth (0 = keep none)")
    p.add_argument("--apply", action="store_true",
                   help="actually delete; without this it only reports")
    args = p.parse_args()

    if not os.path.isdir(args.run_dir):
        raise SystemExit(f"not a directory: {args.run_dir}")

    doomed, kept = plan(args.run_dir, args.keep_recent, args.stride)
    freed = sum(os.path.getsize(f) for f in doomed if os.path.exists(f))
    held  = sum(os.path.getsize(f) for f in kept if os.path.exists(f))

    print(f"  scanned : {args.run_dir}")
    print(f"  keeping : {len(kept):4d} files  ({held / 1e9:.2f} GB) — "
          f"{args.keep_recent} newest per pool + every {args.stride}th older")
    print(f"  pruning : {len(doomed):4d} files  ({freed / 1e9:.2f} GB)")

    if not doomed:
        print("\n  nothing to prune.")
        return
    for f in doomed[:10]:
        print(f"    - {os.path.relpath(f, args.run_dir)}")
    if len(doomed) > 10:
        print(f"    ... and {len(doomed) - 10} more")

    if not args.apply:
        print("\n  DRY RUN — nothing deleted. Re-run with --apply to delete.")
        return

    removed = 0
    for f in doomed:
        try:
            os.remove(f)
            removed += 1
        except OSError as e:
            print(f"    could not remove {f}: {e}")
    print(f"\n  deleted {removed} files, freed {freed / 1e9:.2f} GB")


if __name__ == "__main__":
    main()
