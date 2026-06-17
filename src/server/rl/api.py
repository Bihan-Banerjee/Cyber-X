"""
api.py  –  CyberX RL Flask API  (v3.0)
========================================
Exposes the MARL training system over HTTP so the React frontend
(RLTraining.tsx) can start/stop training, poll status, stream live
metrics, run the red-vs-blue showcase, and query the trained defender
against live honeypot telemetry.

Endpoints:
  GET  /api/rl/status              – current training state + history
  POST /api/rl/train/start         – start a training run (async)
  POST /api/rl/train/stop          – gracefully stop training
  GET  /api/rl/metrics             – full training_history.json
  GET  /api/rl/metrics/latest      – only the most recent iteration
  GET  /api/rl/metrics/live        – alias of /metrics/latest (frontend)
  GET  /api/rl/leaderboard         – Elo leaderboard
  GET  /api/rl/paper/table         – latest results as markdown table
  GET  /api/rl/logs/stream         – SSE stream of live log lines
  GET  /api/rl/logs/latest         – drain recent log lines (non-SSE)
  POST /api/rl/oracle/query        – query LLM oracle ad-hoc
  POST /api/rl/demo/start          – start a best-vs-best showcase match
  GET  /api/rl/demo/stream         – SSE stream of per-step match events
  POST /api/rl/telemetry/suggest   – defender action suggestion from live
                                     Elasticsearch telemetry (shadow mode)
  GET  /api/rl/telemetry/stream    – SSE: rolling defender suggestion over the
                                     live honeypot telemetry feed
  GET  /api/rl/metrics/history     – full training_history.json (chart arrays)
  GET  /api/rl/exploitability      – aggregated NashConv / best-response report
  GET  /api/rl/plots/<name>        – serve a results PNG (training_curves, …)
"""

import glob
import json
import logging
import os
import queue
import statistics
import threading
import time
from datetime import datetime
from typing import Optional

from flask import (
    Flask, Response, jsonify, request, send_from_directory, stream_with_context,
)
from flask_cors import CORS

from config_loader import get_config

app = Flask(__name__)
CORS(app)

logger = logging.getLogger(__name__)

# ── Global state ───────────────────────────────────────────────────────────────
_trainer         = None
_training_thread: Optional[threading.Thread] = None
_is_training     = False
_stop_flag       = threading.Event()
_log_queue: queue.Queue = queue.Queue(maxsize=500)
_config          = get_config()

_demo_thread: Optional[threading.Thread] = None
_demo_running    = False
_demo_queue: queue.Queue = queue.Queue(maxsize=2000)

_advisor         = None   # cached DefenderAdvisor (telemetry shadow mode)
_advisor_path    = None

_SAVE_DIR        = "./models/cyberx_marl"
_RESULTS_DIR     = os.path.join(_SAVE_DIR, "results")


# ── Log handler that pushes to the SSE queue ──────────────────────────────────

class QueueLogHandler(logging.Handler):
    def emit(self, record):
        try:
            _log_queue.put_nowait({
                "time":  datetime.utcnow().isoformat(),
                "level": record.levelname,
                "msg":   self.format(record),
            })
        except queue.Full:
            pass


logging.getLogger().addHandler(QueueLogHandler())


# ══════════════════════════════════════════════════════════════════════════════
#   TRAINING ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/rl/status", methods=["GET"])
def get_status():
    history = _load_history()
    return jsonify({
        "is_training":      _is_training,
        "has_models":       _trainer is not None,
        "curriculum_level": _trainer._curr_level if _trainer else 0,
        "iterations_done":  len(history.get("iterations", [])),
        "latest_metrics":   _latest_metrics(),
        "demo_running":     _demo_running,
    })


@app.route("/api/rl/train/start", methods=["POST"])
def start_training():
    global _trainer, _training_thread, _is_training, _stop_flag

    if _is_training:
        return jsonify({"error": "Training already in progress"}), 409

    data               = request.json or {}
    n_iterations       = data.get("iterations",    _config.training.n_iterations)
    timesteps_per_iter = data.get("timesteps",     _config.training.timesteps_per_iter)
    eval_episodes      = data.get("eval_episodes", _config.training.eval_episodes)
    run_bc             = data.get("run_bc_phase",  _config.training.run_bc_phase)
    run_llm            = data.get("run_llm_phase", _config.training.run_llm_oracle_phase)
    save_dir           = data.get("save_dir", "./models/cyberx_marl")
    seed               = data.get("seed")

    llm_cfg = _config.get_llm_config()
    _stop_flag.clear()

    def _train():
        global _trainer, _is_training
        _is_training = True
        try:
            from trainer import MARLTrainer
            _trainer = MARLTrainer(
                save_dir   = save_dir,
                llm_config = llm_cfg,
                seed       = seed,
            )
            _trainer.train(
                n_iterations         = n_iterations,
                timesteps_per_iter   = timesteps_per_iter,
                eval_episodes        = eval_episodes,
                run_bc_phase         = run_bc,
                run_llm_oracle_phase = run_llm,
            )
        except Exception as exc:
            logger.error("Training failed: %s", exc, exc_info=True)
        finally:
            _is_training = False

    _training_thread = threading.Thread(target=_train, daemon=True)
    _training_thread.start()

    return jsonify({
        "message":    "Training started",
        "iterations": n_iterations,
        "timesteps":  timesteps_per_iter,
    })


@app.route("/api/rl/train/stop", methods=["POST"])
def stop_training():
    global _is_training
    _stop_flag.set()
    if _trainer is not None:
        _trainer._pause_requested = True   # finish current iteration, then save
    return jsonify({"message": "Stop signal sent. Training will finish current iteration."})


@app.route("/api/rl/metrics", methods=["GET"])
def get_metrics():
    return jsonify(_load_history())


@app.route("/api/rl/metrics/latest", methods=["GET"])
@app.route("/api/rl/metrics/live", methods=["GET"])     # frontend alias
def get_latest_metrics():
    return jsonify(_latest_metrics())


@app.route("/api/rl/metrics/history", methods=["GET"])
def get_metrics_history():
    """Parallel-array training history for the convergence charts:
    {iterations[], curriculum_levels[], att_win_rates[], def_win_rates[],
     att_elo[], def_elo[], timestamps[]}. Empty arrays if no run yet."""
    history = _load_history()
    if not history:
        history = {k: [] for k in (
            "iterations", "curriculum_levels", "att_win_rates",
            "def_win_rates", "att_elo", "def_elo", "timestamps")}
    return jsonify(history)


@app.route("/api/rl/exploitability", methods=["GET"])
def get_exploitability():
    """Aggregate every exploitability_report.json under the results dir into
    the NashConv / best-response summary (mean ± std + per-run rows)."""
    return jsonify(_aggregate_exploitability())


@app.route("/api/rl/plots/<path:name>", methods=["GET"])
def get_plot(name: str):
    """Serve a results PNG. `training_progress` is aliased to training_curves.png
    for backward compatibility with the original frontend."""
    if name in ("training_progress", "training_progress.png"):
        name = "training_curves.png"
    if not name.endswith(".png"):
        name += ".png"
    abs_dir = os.path.abspath(_RESULTS_DIR)
    if not os.path.exists(os.path.join(abs_dir, name)):
        return jsonify({"error": f"plot '{name}' not found"}), 404
    return send_from_directory(abs_dir, name, mimetype="image/png")


@app.route("/api/rl/leaderboard", methods=["GET"])
def get_leaderboard():
    elo_path = "./models/cyberx_marl/results/elo_ratings.json"
    if not os.path.exists(elo_path):
        return jsonify({"leaderboard": []})
    with open(elo_path) as f:
        elo_data = json.load(f)
    ratings = elo_data.get("ratings", {})
    board   = sorted(ratings.items(), key=lambda x: -x[1])
    return jsonify({
        "leaderboard": [{"agent": k, "elo": round(v)} for k, v in board]
    })


@app.route("/api/rl/paper/table", methods=["GET"])
def get_paper_table():
    if _trainer is None:
        return jsonify({"table": "No training data available yet."}), 404
    return jsonify({"table": _trainer.evaluator.latest_summary_table()})


@app.route("/api/rl/logs/stream", methods=["GET"])
def stream_logs():
    """Server-Sent Events endpoint for live log streaming."""
    def generate():
        while True:
            try:
                entry = _log_queue.get(timeout=15)
                yield f"data: {json.dumps(entry)}\n\n"
            except queue.Empty:
                yield "data: {\"ping\": true}\n\n"   # keep-alive

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/api/rl/logs/latest", methods=["GET"])
def latest_logs():
    """Drain currently queued log lines (polling alternative to SSE)."""
    lines = []
    while len(lines) < 200:
        try:
            lines.append(_log_queue.get_nowait())
        except queue.Empty:
            break
    return jsonify({"logs": lines})


@app.route("/api/rl/oracle/query", methods=["POST"])
def oracle_query():
    """Ad-hoc LLM oracle query for the frontend 'ask the oracle' feature."""
    import numpy as np
    from llm_oracle import LLMOracle

    data = request.json or {}
    role = data.get("role", "attacker")
    obs  = np.array(data.get("observation", [0.0] * 8), dtype=np.float32)

    llm_cfg = _config.get_llm_config()
    if not llm_cfg.get("enabled", False):
        return jsonify({"error": "LLM oracle is disabled in config.json"}), 503

    oracle = LLMOracle(role, llm_cfg)
    action = oracle.query(obs, max_steps=100)
    if action is None:
        return jsonify({"error": "Oracle query failed"}), 502

    return jsonify({"action": action, "oracle_stats": oracle.stats()})


# ══════════════════════════════════════════════════════════════════════════════
#   SHOWCASE DEMO — best attacker vs best defender, streamed step by step
# ══════════════════════════════════════════════════════════════════════════════

def _model_path(role: str) -> Optional[str]:
    """Best snapshot if available, else the latest training weights."""
    best = (_config.get_best_attacker_path() if role == "attacker"
            else _config.get_best_defender_path())
    if os.path.exists(best):
        return best
    latest = f"./models/cyberx_marl/{role}_latest.zip"
    return latest if os.path.exists(latest) else None


def _demo_put(event: dict) -> None:
    try:
        _demo_queue.put_nowait(event)
    except queue.Full:
        pass


def _run_demo(att_path: str, def_path: str, n_episodes: int,
              seed: Optional[int], step_delay: float) -> None:
    global _demo_running
    try:
        import numpy as np
        from sb3_contrib import RecurrentPPO
        from shared_honeypot_env import (
            ATT_ACTION_NAMES, DEF_ACTION_NAMES,
            SharedHoneypotEnv, StatefulOpponent,
        )

        attacker = RecurrentPPO.load(att_path, device="cpu")
        defender = RecurrentPPO.load(def_path, device="cpu")
        env = SharedHoneypotEnv(
            mode="attacker",
            opponent_model=StatefulOpponent(defender),
            curriculum_level=2,
        )
        env.reset(seed=seed)

        for ep in range(1, n_episodes + 1):
            obs, _ = env.reset()
            lstm_state = None
            done, info = False, {}
            _demo_put({"type": "episode_start", "episode": ep,
                       "max_steps": env.max_steps})

            while not done:
                action, lstm_state = attacker.predict(
                    np.asarray(obs, dtype=np.float32).reshape(1, -1),
                    state=lstm_state, deterministic=True,
                )
                a = int(np.asarray(action).flat[0])
                obs, reward, term, trunc, info = env.step(a)
                done = term or trunc

                _demo_put({
                    "type":            "step",
                    "episode":         ep,
                    "step":            info["step"],
                    "att_action":      info["att_action"],
                    "att_action_name": ATT_ACTION_NAMES[info["att_action"]],
                    "def_action":      info["def_action"],
                    "def_action_name": DEF_ACTION_NAMES[info["def_action"]],
                    "stage":           info["stage"],
                    "suspicion":       info["suspicion"],
                    "evidence":        info["evidence"],
                    "egress_volume":   info["egress_volume"],
                    "decoys_deployed": info["decoys_deployed"],
                    "att_reward":      round(info["att_step_reward"], 2),
                    "def_reward":      round(info["def_step_reward"], 2),
                })
                if step_delay > 0:
                    time.sleep(step_delay)

            _demo_put({
                "type":           "episode_end",
                "episode":        ep,
                "attacker_win":   bool(info.get("attacker_win", False)),
                "defender_win":   bool(info.get("defender_win", False)),
                "ep_att_return":  round(info.get("ep_att_return", 0.0), 2),
                "ep_def_return":  round(info.get("ep_def_return", 0.0), 2),
                "first_detection_step": info.get("first_detection_step"),
                "false_positives": info.get("false_positives", 0),
            })
    except Exception as e:
        logger.error("Demo failed: %s", e, exc_info=True)
        _demo_put({"type": "error", "message": str(e)})
    finally:
        _demo_put({"type": "done"})
        _demo_running = False


@app.route("/api/rl/demo/start", methods=["POST"])
def demo_start():
    """Run trained attacker vs trained defender; events go to /demo/stream."""
    global _demo_thread, _demo_running

    if _demo_running:
        return jsonify({"error": "Demo already running"}), 409

    data     = request.json or {}
    att_path = data.get("attacker_path") or _model_path("attacker")
    def_path = data.get("defender_path") or _model_path("defender")
    if not (att_path and os.path.exists(att_path) and
            def_path and os.path.exists(def_path)):
        return jsonify({"error": "No trained models found — run training first"}), 404

    n_episodes = int(data.get("episodes", 3))
    seed       = data.get("seed")
    step_delay = float(data.get("step_delay", 0.15))

    # Drain any stale events from a previous demo
    while not _demo_queue.empty():
        try:
            _demo_queue.get_nowait()
        except queue.Empty:
            break

    _demo_running = True
    _demo_thread = threading.Thread(
        target=_run_demo,
        args=(att_path, def_path, n_episodes, seed, step_delay),
        daemon=True,
    )
    _demo_thread.start()

    return jsonify({
        "message":  "Demo started",
        "episodes": n_episodes,
        "attacker": att_path,
        "defender": def_path,
    })


@app.route("/api/rl/demo/stream", methods=["GET"])
def demo_stream():
    """SSE stream of demo match events (start a demo first)."""
    def generate():
        while True:
            try:
                event = _demo_queue.get(timeout=10)
            except queue.Empty:
                if not _demo_running:
                    yield "data: {\"type\": \"done\"}\n\n"
                    return
                yield "data: {\"ping\": true}\n\n"
                continue
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") == "done":
                return

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
#   TELEMETRY SHADOW MODE — trained defender suggests actions on real events
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/rl/telemetry/suggest", methods=["POST"])
def telemetry_suggest():
    """Map live Elasticsearch honeypot events into the defender observation
    and return the trained defender's recommended action. Inference only —
    nothing is executed against the honeypot."""
    global _advisor, _advisor_path

    from telemetry_adapter import DefenderAdvisor, TelemetryAdapter

    model_path = _model_path("defender")
    if model_path is None:
        return jsonify({"error": "No trained defender found — run training first"}), 404

    data    = request.json or {}
    adapter = TelemetryAdapter(
        es_url = data.get("es_url", "http://localhost:9200"),
        window = data.get("window", "now-5m"),
    )
    obs = adapter.build_observation(
        defense_state = data.get("defense_state"),
        step_fraction = float(data.get("step_fraction", 0.5)),
    )

    if _advisor is None or _advisor_path != model_path:
        _advisor = DefenderAdvisor(model_path)
        _advisor_path = model_path
    if data.get("reset"):
        _advisor.reset()

    result = _advisor.suggest(obs)
    return jsonify({**result, "observation": obs.tolist()})


@app.route("/api/rl/telemetry/stream", methods=["GET"])
def telemetry_stream():
    """SSE: roll the trained defender over the live honeypot telemetry feed.
    Each tick emits {events_summary, observation, action, action_name}. Powers
    the Defender Copilot without the frontend polling. Inference only."""
    global _advisor, _advisor_path

    es_url   = request.args.get("es_url", "http://localhost:9200")
    window   = request.args.get("window", "now-5m")
    interval = max(2.0, float(request.args.get("interval", 5.0)))

    def generate():
        global _advisor, _advisor_path
        from telemetry_adapter import DefenderAdvisor, TelemetryAdapter

        model_path = _model_path("defender")
        if model_path is None:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No trained defender found — run training first'})}\n\n"
            return

        if _advisor is None or _advisor_path != model_path:
            try:
                _advisor = DefenderAdvisor(model_path)
                _advisor_path = model_path
            except Exception as exc:  # noqa: BLE001
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
                return

        adapter = TelemetryAdapter(es_url=es_url, window=window)
        while True:
            try:
                summary = adapter.summarize(adapter.fetch_events())
                obs     = adapter.build_observation(step_fraction=0.5)
                result  = _advisor.suggest(obs)
                event   = {
                    "type":           "suggestion",
                    "time":           datetime.utcnow().isoformat(),
                    "events_summary": summary,
                    "observation":    obs.tolist(),
                    "action":         result["action"],
                    "action_name":    result["action_name"],
                }
                yield f"data: {json.dumps(event)}\n\n"
            except GeneratorExit:
                return
            except Exception as exc:  # noqa: BLE001
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            time.sleep(interval)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
#   HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _load_history() -> dict:
    path = "./models/cyberx_marl/training_history.json"
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def _latest_metrics() -> dict:
    metrics_path = "./models/cyberx_marl/results/training_metrics.json"
    if not os.path.exists(metrics_path):
        return {}
    with open(metrics_path) as f:
        all_m = json.load(f)
    return all_m[-1] if all_m else {}


def _mean_std(values: list) -> dict:
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None}
    return {
        "mean": round(statistics.fmean(vals), 3),
        "std":  round(statistics.pstdev(vals), 3) if len(vals) > 1 else 0.0,
    }


def _aggregate_exploitability() -> dict:
    """Collect every exploitability_report.json under the results dir and
    aggregate NashConv + per-side exploitability/gap into mean ± std."""
    reports = sorted(glob.glob(
        os.path.join(_RESULTS_DIR, "**", "exploitability_report.json"),
        recursive=True))
    runs, nashconv, att_e, att_g, def_e, def_g = [], [], [], [], [], []
    for path in reports:
        try:
            with open(path) as f:
                r = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        att = r.get("attacker_exploitability", {}) or {}
        dfd = r.get("defender_exploitability", {}) or {}
        nashconv.append(r.get("nashconv"))
        att_e.append(att.get("exploitability"))
        att_g.append(att.get("gap_over_equilibrium"))
        def_e.append(dfd.get("exploitability"))
        def_g.append(dfd.get("gap_over_equilibrium"))
        runs.append({
            "run":      os.path.basename(os.path.dirname(path)),
            "nashconv": r.get("nashconv"),
            "att_exploitability": att.get("exploitability"),
            "att_gap":  att.get("gap_over_equilibrium"),
            "def_exploitability": dfd.get("exploitability"),
            "def_gap":  dfd.get("gap_over_equilibrium"),
            "equilibrium": r.get("equilibrium"),
        })
    return {
        "n_runs":   len(runs),
        "nashconv": _mean_std(nashconv),
        "attacker": {"exploitability": _mean_std(att_e), "gap": _mean_std(att_g)},
        "defender": {"exploitability": _mean_std(def_e), "gap": _mean_std(def_g)},
        "runs":     runs,
    }


# ══════════════════════════════════════════════════════════════════════════════
#   ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--port",  type=int,
                        default=int(os.environ.get("RL_API_PORT", 5001)))
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print(f"CyberX RL API running on http://localhost:{args.port}")
    app.run(host="0.0.0.0", port=args.port, debug=args.debug, threaded=True)
