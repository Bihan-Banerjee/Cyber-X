import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Eye, EyeOff } from "lucide-react";

const charsetSize = (s: string): number => {
  let size = 0;
  if (/[a-z]/.test(s)) size += 26;
  if (/[A-Z]/.test(s)) size += 26;
  if (/[0-9]/.test(s)) size += 10;
  if (/[^a-zA-Z0-9]/.test(s)) size += 33;
  return size;
};

const calcEntropy = (s: string): number => {
  const cs = charsetSize(s);
  if (cs === 0) return 0;
  return Math.log2(Math.pow(cs, s.length));
};

const formatCrackTime = (seconds: number): string => {
  if (seconds < 1) return "< 1 second";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 86400 * 365) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 86400 * 365 * 1000) return `${Math.round(seconds / (86400 * 365))} years`;
  if (seconds < 86400 * 365 * 1e9) return `${(seconds / (86400 * 365)).toExponential(2)} years`;
  return "longer than age of universe";
};

const detectPatterns = (s: string): string[] => {
  const patterns: string[] = [];
  if (/(.)\1{2,}/.test(s)) patterns.push("Repeated characters");
  if (/qwerty|asdf|zxcv|1234|abcd/i.test(s)) patterns.push("Keyboard walk detected");
  if (/[a@][e3][i1][o0]/i.test(s)) patterns.push("L33tspeak substitution");
  if (/password|passw0rd|letmein|iloveyou|admin|welcome/i.test(s)) patterns.push("Common password word");
  if (/^[A-Z][a-z]+\d+$/.test(s)) patterns.push("Name + numbers pattern");
  if (s.length < 8) patterns.push("Too short (< 8 chars)");
  if (!/[^a-zA-Z0-9]/.test(s)) patterns.push("No special characters");
  if (!/[0-9]/.test(s)) patterns.push("No digits");
  if (!/[A-Z]/.test(s)) patterns.push("No uppercase letters");
  return patterns;
};

const getStrengthLabel = (score: number): { label: string; color: string; barColor: string } => {
  const labels = [
    { label: "Very Weak", color: "text-red-500", barColor: "bg-red-500" },
    { label: "Weak", color: "text-orange-400", barColor: "bg-orange-400" },
    { label: "Fair", color: "text-yellow-400", barColor: "bg-yellow-400" },
    { label: "Strong", color: "text-green-400", barColor: "bg-green-400" },
    { label: "Very Strong", color: "text-green-300", barColor: "bg-green-300" },
  ];
  return labels[Math.min(score, 4)];
};

const calcScore = (password: string): number => {
  let score = 0;
  const entropy = calcEntropy(password);
  if (entropy > 28) score++;
  if (entropy > 50) score++;
  if (entropy > 75) score++;
  if (entropy > 100) score++;
  const patterns = detectPatterns(password);
  score = Math.max(0, score - Math.floor(patterns.length / 2));
  return Math.min(4, score);
};

const PasswordStrengthAnalyzer = () => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const entropy = password ? calcEntropy(password) : 0;
  const cs = password ? charsetSize(password) : 0;
  const patterns = password ? detectPatterns(password) : [];
  const score = password ? calcScore(password) : 0;
  const strength = getStrengthLabel(score);

  const guesses = Math.pow(cs || 1, password.length || 0);
  const onlineThrottled = guesses / 1000;
  const offlineMD5 = guesses / 1e11;
  const offlineBcrypt = guesses / 100;

  return (
    <CyberpunkCard title="PASSWORD STRENGTH ANALYZER">
      <div className="space-y-5">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">PASSWORD</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password to analyze..."
              className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-3 text-lg font-mono pr-12 focus:outline-none focus:border-cyber-cyan/60"
              autoComplete="off"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-cyan/50 hover:text-cyber-cyan"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {password && (
          <>
            <div className="glass-panel rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-cyber-cyan tracking-wider">STRENGTH</span>
                <span className={`text-sm font-bold ${strength.color}`}>{strength.label}</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${strength.barColor}`}
                  style={{ width: `${(score / 4) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {["Very Weak", "Weak", "Fair", "Strong", "Very Strong"].map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-xl font-bold text-cyber-cyan font-mono">{entropy.toFixed(1)}</p>
                <p className="text-xs text-gray-400">Entropy (bits)</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-xl font-bold text-cyber-cyan font-mono">{cs}</p>
                <p className="text-xs text-gray-400">Charset Size</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-xl font-bold text-cyber-cyan font-mono">{password.length}</p>
                <p className="text-xs text-gray-400">Length</p>
              </div>
              <div className="glass-panel rounded p-3 text-center">
                <p className="text-xl font-bold text-cyber-cyan font-mono">{score}/4</p>
                <p className="text-xs text-gray-400">Score</p>
              </div>
            </div>

            <div className="glass-panel rounded p-4">
              <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">CRACK TIME ESTIMATES</h3>
              <div className="space-y-2">
                {[
                  { scenario: "Online (throttled, 1k/s)", time: onlineThrottled, icon: "🌐" },
                  { scenario: "Offline MD5 (100B/s)", time: offlineMD5, icon: "💻" },
                  { scenario: "Offline bcrypt (100/s)", time: offlineBcrypt, icon: "🔒" },
                ].map((s) => (
                  <div key={s.scenario} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{s.icon} {s.scenario}</span>
                    <span className={`text-xs font-mono font-bold ${
                      s.time < 86400 ? "text-red-400" :
                      s.time < 86400 * 365 ? "text-orange-400" :
                      s.time < 86400 * 365 * 100 ? "text-yellow-400" : "text-green-400"
                    }`}>
                      {formatCrackTime(s.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {patterns.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">PATTERNS DETECTED</h3>
                <div className="space-y-1">
                  {patterns.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-sm text-orange-400">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PasswordStrengthAnalyzer;
