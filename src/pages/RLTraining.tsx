import { useState, useEffect } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Activity, Brain, TrendingUp, Zap, Play, Square, Download } from "lucide-react";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TrainingMetrics {
  iterations: number[];
  attacker_rewards: number[];
  defender_rewards: number[];
  attack_success_rates: number[];
  detection_rates: number[];
  current_iteration: number;
  total_iterations: number;
  is_training: boolean;
}

const RLTraining = () => {
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [plotUrl, setPlotUrl] = useState<string>('');

  useEffect(() => {
    fetchMetrics();
    fetchLogs();
    
    // Poll every 2 seconds during training
    const interval = setInterval(() => {
      fetchMetrics();
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/rl/metrics/live');
      const data = await response.json();
      setMetrics(data);
      setIsTraining(data.is_training);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/rl/logs/latest');
      const data = await response.json();
      setLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const startTraining = async () => {
    try {
      await fetch('/api/rl/train/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iterations: 10,
          timesteps: 50000,
        }),
      });
      setIsTraining(true);
    } catch (error) {
      console.error('Failed to start training:', error);
    }
  };

  const stopTraining = async () => {
    try {
      await fetch('/api/rl/train/stop', { method: 'POST' });
      setIsTraining(false);
    } catch (error) {
      console.error('Failed to stop training:', error);
    }
  };

  const chartData = metrics ? {
    labels: metrics.iterations,
    datasets: [
      {
        label: 'Attacker Reward',
        data: metrics.attacker_rewards,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Defender Reward',
        data: metrics.defender_rewards,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Agent Rewards Over Time' },
    },
    scales: {
      x: { title: { display: true, text: 'Iteration' } },
      y: { title: { display: true, text: 'Mean Reward' } },
    },
  };

  return (
    <div className="w-full max-w-7xl space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Brain}
          label="Current Iteration"
          value={metrics?.current_iteration || 0}
          total={metrics?.total_iterations || 100}
          color="text-cyber-cyan"
        />
        <StatCard
          icon={TrendingUp}
          label="Attacker Reward"
          value={metrics?.attacker_rewards.slice(-1)[0]?.toFixed(1) || '0'}
          color="text-red-400"
        />
        <StatCard
          icon={Activity}
          label="Defender Reward"
          value={metrics?.defender_rewards.slice(-1)[0]?.toFixed(1) || '0'}
          color="text-blue-400"
        />
        <StatCard
          icon={Zap}
          label="Training Status"
          value={isTraining ? 'Running' : 'Idle'}
          color={isTraining ? 'text-green-400' : 'text-gray-400'}
        />
      </div>

      {/* Control Panel */}
      <CyberpunkCard title="TRAINING CONTROL">
        <div className="flex gap-4">
          {!isTraining ? (
            <button
              onClick={startTraining}
              className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Training
            </button>
          ) : (
            <button
              onClick={stopTraining}
              className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors flex items-center gap-2"
            >
              <Square className="w-5 h-5" />
              Stop Training
            </button>
          )}
          
          <button
            onClick={() => window.open('/api/rl/plots/training_progress', '_blank')}
            className="px-6 py-3 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan rounded transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download Plot
          </button>
        </div>
      </CyberpunkCard>

      {/* Live Chart */}
      <CyberpunkCard title="REWARD CURVES">
        <div className="h-96">
          {chartData ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No training data yet. Start training to see live updates.
            </div>
          )}
        </div>
      </CyberpunkCard>

      {/* Training Logs */}
      <CyberpunkCard title="TRAINING LOGS">
        <div className="bg-black/50 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log, idx) => (
            <div key={idx} className="text-gray-300 mb-1">
              {log}
            </div>
          ))}
        </div>
      </CyberpunkCard>

      {/* Static Plot Image */}
      <CyberpunkCard title="FULL TRAINING PROGRESS">
        <img
          src="/api/rl/plots/training_progress"
          alt="Training Progress"
          className="w-full rounded"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>No plot available</text></svg>';
          }}
        />
      </CyberpunkCard>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, total, color }: any) => (
  <div className="glass-panel rounded p-6">
    <div className="flex items-center justify-between mb-4">
      <Icon className={`w-8 h-8 ${color}`} />
    </div>
    <div className={`text-3xl font-bold ${color} cyber-glow-red`}>
      {value}{total && `/${total}`}
    </div>
    <div className="text-sm text-gray-400 tracking-wide mt-2">{label}</div>
  </div>
);

export default RLTraining;
