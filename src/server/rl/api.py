from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import threading
import json
import os
from datetime import datetime
from honeypot_env import HoneypotEnv
from attacker_agent import AttackerAgent
from defender_agent import DefenderAgent
from trainer import SelfPlayTrainer

app = Flask(__name__)
CORS(app)

# Global state
trainer = None
training_thread = None
is_training = False

@app.route('/api/rl/status', methods=['GET'])
def get_status():
    """Get RL training status"""
    return jsonify({
        'is_training': is_training,
        'has_models': trainer is not None,
        'training_history': trainer.training_history if trainer else {}
    })

@app.route('/api/rl/train/start', methods=['POST'])
def start_training():
    """Start RL training"""
    global trainer, training_thread, is_training
    
    if is_training:
        return jsonify({'error': 'Training already in progress'}), 400
    
    data = request.json
    n_iterations = data.get('iterations', 5)
    timesteps_per_iteration = data.get('timesteps', 10000)
    
    # Initialize trainer
    trainer = SelfPlayTrainer()
    
    # Start training in background thread
    def train():
        global is_training
        is_training = True
        try:
            trainer.train_self_play(
                n_iterations=n_iterations,
                timesteps_per_iteration=timesteps_per_iteration
            )
        finally:
            is_training = False
    
    training_thread = threading.Thread(target=train)
    training_thread.start()
    
    return jsonify({
        'message': 'Training started',
        'iterations': n_iterations,
        'timesteps': timesteps_per_iteration
    })

@app.route('/api/rl/train/stop', methods=['POST'])
def stop_training():
    """Stop ongoing training"""
    global is_training
    
    if not is_training:
        return jsonify({'error': 'No training in progress'}), 400
    
    is_training = False
    return jsonify({'message': 'Training stop requested'})

@app.route('/api/rl/evaluate', methods=['POST'])
def evaluate_agents():
    """Evaluate trained agents"""
    if not trainer:
        return jsonify({'error': 'No trained models available'}), 400
    
    data = request.json
    n_episodes = data.get('episodes', 5)
    
    attacker_results = trainer.attacker.evaluate(n_episodes=n_episodes)
    defender_results = trainer.defender.evaluate(n_episodes=n_episodes)
    
    return jsonify({
        'attacker': attacker_results,
        'defender': defender_results
    })

@app.route('/api/rl/history', methods=['GET'])
def get_training_history():
    """Get training history"""
    if not trainer:
        return jsonify({'error': 'No training data available'}), 404
    
    return jsonify(trainer.training_history)


@app.route('/api/rl/plots/training_progress', methods=['GET'])
def get_training_plot():
    """Serve latest training progress plot"""
    plot_path = './models/production/training_progress.png'
    if os.path.exists(plot_path):
        return send_file(plot_path, mimetype='image/png')
    return jsonify({'error': 'No training plot available yet'}), 404

@app.route('/api/rl/metrics/live', methods=['GET'])
def get_live_metrics():
    """Get real-time training metrics"""
    if not trainer:
        return jsonify({'error': 'No training in progress'}), 404
    
    history = trainer.training_history
    
    # Get last N data points for live updates
    n = min(10, len(history['iterations']))
    
    return jsonify({
        'iterations': history['iterations'][-n:],
        'attacker_rewards': history['attacker_rewards'][-n:],
        'defender_rewards': history['defender_rewards'][-n:],
        'attack_success_rates': history['attack_success_rates'][-n:],
        'detection_rates': history['detection_rates'][-n:],
        'current_iteration': history['iterations'][-1] if history['iterations'] else 0,
        'total_iterations': 100,  # or get from config
        'is_training': is_training
    })

@app.route('/api/rl/models/list', methods=['GET'])
def list_models():
    """List all saved models"""
    model_dir = './models/production'
    models = []
    
    if os.path.exists(model_dir):
        files = os.listdir(model_dir)
        for f in files:
            if f.endswith('.zip'):
                stat = os.stat(os.path.join(model_dir, f))
                models.append({
                    'name': f,
                    'size': stat.st_size,
                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
    
    return jsonify({'models': models})

@app.route('/api/rl/logs/latest', methods=['GET'])
def get_latest_logs():
    """Get last 50 lines of training logs"""
    # Read from a log file or in-memory buffer
    # For now, return dummy data
    return jsonify({
        'logs': [
            '🔴 Episode 100: Mean Reward = 650.0',
            '🔵 Episode 50: Mean Reward = 1120.0',
            '✅ Iteration 5 complete'
        ]
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
