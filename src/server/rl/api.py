"""
api.py  –  CyberX RL Flask API  (v2.0)
========================================
Exposes the MARL training system over HTTP so the React frontend
(RLTraining.tsx) can start/stop training, poll status, stream live
metrics, and fetch evaluation results.

Endpoints:
  GET  /api/rl/status              – current training state + history
  POST /api/rl/train/start         – start a training run (async)
  POST /api/rl/train/stop          – gracefully stop training
  GET  /api/rl/metrics             – full training_history.json
  GET  /api/rl/metrics/latest      – only the most recent iteration
  GET  /api/rl/leaderboard         – Elo leaderboard
  GET  /api/rl/paper/table         – latest results as markdown table
  GET  /api/rl/logs/stream         – SSE stream of live log lines
  POST /api/rl/oracle/query        – query LLM oracle ad-hoc
"""

import json
import os
import queue
import threading
import logging
from datetime import datetime
from typing import Optional
import time

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

from config_loader import RLConfig

app  = Flask(__name__)
CORS(app)

logger = logging.getLogger(__name__)

# ── Global state ───────────────────────────────────────────────────────────────
_trainer         = None
_training_thread: Optional[threading.Thread] = None
_is_training     = False
_stop_flag       = threading.Event()
_log_queue: queue.Queue = queue.Queue(maxsize=500)
_config          = RLConfig()


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
#   ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/rl/status", methods=["GET"])
def get_status():
    history = _load_history()
    return jsonify({
        "is_training":     _is_training,
        "has_models":      _trainer is not None,
        "curriculum_level": _trainer._curr_level if _trainer else 0,
        "iterations_done": len(history.get("iterations", [])),
        "latest_metrics":  _latest_metrics(),
    })


@app.route("/api/rl/train/start", methods=["POST"])
def start_training():
    global _trainer, _training_thread, _is_training, _stop_flag

    if _is_training:
        return jsonify({"error": "Training already in progress"}), 409

    data               = request.json or {}
    n_iterations       = data.get("iterations",        30)
    timesteps_per_iter = data.get("timesteps",   100_000)
    eval_episodes      = data.get("eval_episodes",     50)
    run_bc             = data.get("run_bc_phase",    True)
    run_llm            = data.get("run_llm_phase",  False)
    save_dir           = data.get("save_dir", "./models/cyberx_marl")

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
    _is_training = False
    return jsonify({"message": "Stop signal sent.  Training will finish current iteration."})


@app.route("/api/rl/metrics", methods=["GET"])
def get_metrics():
    return jsonify(_load_history())


@app.route("/api/rl/metrics/latest", methods=["GET"])
def get_latest_metrics():
    return jsonify(_latest_metrics())


@app.route("/api/rl/leaderboard", methods=["GET"])
def get_leaderboard():
    elo_path = "./models/cyberx_marl/results/elo_ratings.json"
    if not os.path.exists(elo_path):
        return jsonify({"leaderboard": []})
    with open(elo_path) as f:
        elo_data = json.load(f)
    ratings  = elo_data.get("ratings", {})
    board    = sorted(ratings.items(), key=lambda x: -x[1])
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
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/api/rl/oracle/query", methods=["POST"])
def oracle_query():
    """Ad-hoc LLM oracle query for the frontend 'ask the oracle' feature."""
    import numpy as np
    from llm_oracle import LLMOracle

    data  = request.json or {}
    role  = data.get("role", "attacker")
    obs   = np.array(data.get("observation", [0.0] * 8), dtype=np.float32)

    llm_cfg = _config.get_llm_config()
    if not llm_cfg.get("enabled", False):
        return jsonify({"error": "LLM oracle is disabled in config.json"}), 503

    oracle = LLMOracle(role, llm_cfg)
    action = oracle.query(obs, max_steps=100)
    if action is None:
        return jsonify({"error": "Oracle query failed"}), 502

    return jsonify({"action": action, "oracle_stats": oracle.stats()})


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


# ══════════════════════════════════════════════════════════════════════════════
#   ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port",  type=int,  default=5001)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print(f"🚀  CyberX RL API running on http://localhost:{args.port}")
    app.run(host="0.0.0.0", port=args.port, debug=args.debug, threaded=True)