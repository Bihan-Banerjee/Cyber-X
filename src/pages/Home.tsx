import { Link } from "react-router-dom";
import { Shield, Terminal, Activity } from "lucide-react";

const Home = () => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Hero section */}
      <div className="text-center mb-16">
        <h1 className="text-6xl md:text-8xl font-bold mb-6 cyber-glow-red tracking-wider">
          CYBERX
        </h1>
        <p className="text-xl md:text-2xl text-cyber-cyan mb-8 tracking-wide">
          Advanced Cybersecurity Platform
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/dashboard"
            className="px-8 py-4 bg-cyber-red text-white rounded font-bold tracking-wider hover:bg-cyber-deepRed transition-all animate-pulse-glow"
          >
            LAUNCH DASHBOARD
          </Link>
          <Link
            to="/tools"
            className="px-8 py-4 border-2 border-cyber-cyan text-cyber-cyan rounded font-bold tracking-wider hover:bg-cyber-cyan/10 transition-all"
          >
            EXPLORE TOOLS
          </Link>
        </div>
      </div>

      {/* Features grid */}
      <div className="grid md:grid-cols-3 gap-8 mt-20">
        <div className="glass-panel rounded-lg p-8 text-center hover:scale-105 transition-transform">
          <Shield className="w-16 h-16 text-cyber-red mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cyber-cyan mb-2 tracking-wide">SECURITY TOOLS</h3>
          <p className="text-gray-400">
            Port scanning, vulnerability assessment, and penetration testing utilities
          </p>
        </div>

        <div className="glass-panel rounded-lg p-8 text-center hover:scale-105 transition-transform">
          <Terminal className="w-16 h-16 text-cyber-red mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cyber-cyan mb-2 tracking-wide">THREAT INTEL</h3>
          <p className="text-gray-400">
            Real-time threat intelligence, breach monitoring, and OSINT capabilities
          </p>
        </div>

        <div className="glass-panel rounded-lg p-8 text-center hover:scale-105 transition-transform">
          <Activity className="w-16 h-16 text-cyber-red mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cyber-cyan mb-2 tracking-wide">HONEYPOTS</h3>
          <p className="text-gray-400">
            Deploy and monitor honeypots to track attackers and analyze threats
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
