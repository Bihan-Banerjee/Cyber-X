import { useState, useCallback } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw, ShieldCheck } from "lucide-react";

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const AMBIGUOUS = "0O1lI";

interface Config {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

function generatePassword(config: Config): string {
  let charset = "";
  if (config.uppercase) charset += UPPERCASE;
  if (config.lowercase) charset += LOWERCASE;
  if (config.numbers) charset += NUMBERS;
  if (config.symbols) charset += SYMBOLS;

  if (config.excludeAmbiguous) {
    charset = charset.split("").filter((c) => !AMBIGUOUS.includes(c)).join("");
  }

  if (!charset) return "";

  const array = new Uint32Array(config.length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((n) => charset[n % charset.length])
    .join("");
}

function calculateEntropy(config: Config): number {
  let charsetSize = 0;
  if (config.uppercase) charsetSize += config.excludeAmbiguous ? UPPERCASE.split("").filter((c) => !AMBIGUOUS.includes(c)).length : UPPERCASE.length;
  if (config.lowercase) charsetSize += config.excludeAmbiguous ? LOWERCASE.split("").filter((c) => !AMBIGUOUS.includes(c)).length : LOWERCASE.length;
  if (config.numbers) charsetSize += config.excludeAmbiguous ? NUMBERS.split("").filter((c) => !AMBIGUOUS.includes(c)).length : NUMBERS.length;
  if (config.symbols) charsetSize += SYMBOLS.length;
  if (charsetSize === 0) return 0;
  return Math.log2(Math.pow(charsetSize, config.length));
}

function formatCrackTime(entropy: number): string {
  // 10 billion guesses per second
  const guessesPerSecond = 1e10;
  const avgGuesses = Math.pow(2, entropy - 1);
  const seconds = avgGuesses / guessesPerSecond;

  if (seconds < 1) return "< 1 second";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31536000 * 1000) return `${Math.round(seconds / 31536000)} years`;
  if (seconds < 31536000 * 1e6) return `${(seconds / 31536000 / 1000).toFixed(1)} thousand years`;
  if (seconds < 31536000 * 1e9) return `${(seconds / 31536000 / 1e6).toFixed(1)} million years`;
  return `${(seconds / 31536000 / 1e9).toFixed(1)} billion years`;
}

function strengthLabel(entropy: number): { label: string; color: string; width: string } {
  if (entropy < 28) return { label: "Very Weak", color: "bg-red-500", width: "w-1/5" };
  if (entropy < 36) return { label: "Weak", color: "bg-orange-500", width: "w-2/5" };
  if (entropy < 60) return { label: "Moderate", color: "bg-yellow-500", width: "w-3/5" };
  if (entropy < 128) return { label: "Strong", color: "bg-green-500", width: "w-4/5" };
  return { label: "Very Strong", color: "bg-cyber-cyan", width: "w-full" };
}

const PasswordGenerator = () => {
  const [config, setConfig] = useState<Config>({
    length: 24,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [password, setPassword] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    setPassword(generatePassword(config));
  }, [config]);

  const handleCopy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const entropy = calculateEntropy(config);
  const strength = strengthLabel(entropy);
  const crackTime = formatCrackTime(entropy);

  const atLeastOne = config.uppercase || config.lowercase || config.numbers || config.symbols;

  return (
    <CyberpunkCard title="PASSWORD GENERATOR">
      <div className="space-y-6">
        {/* Length slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-cyber-cyan tracking-wider">PASSWORD LENGTH</label>
            <span className="text-cyber-cyan font-bold font-mono text-lg">{config.length}</span>
          </div>
          <input
            type="range"
            min={8}
            max={128}
            value={config.length}
            onChange={(e) => setConfig((c) => ({ ...c, length: Number(e.target.value) }))}
            className="w-full accent-cyber-red"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>8</span>
            <span>128</span>
          </div>
        </div>

        {/* Character set options */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: "uppercase", label: "Uppercase (A-Z)" },
            { key: "lowercase", label: "Lowercase (a-z)" },
            { key: "numbers", label: "Numbers (0-9)" },
            { key: "symbols", label: "Symbols (!@#$...)" },
            { key: "excludeAmbiguous", label: "Exclude Ambiguous (0/O, 1/l/I)" },
          ] as { key: keyof Config; label: string }[]).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={config[key] as boolean}
                onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.checked }))}
                className="w-4 h-4 accent-cyber-cyan"
              />
              <span className="text-sm text-gray-300 group-hover:text-cyber-cyan transition-colors">{label}</span>
            </label>
          ))}
        </div>

        {!atLeastOne && (
          <p className="text-xs text-red-400">Select at least one character set.</p>
        )}

        {/* Entropy and strength */}
        <div className="glass-panel rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 tracking-wider">STRENGTH</span>
            <span className={`text-sm font-bold ${strength.color.replace("bg-", "text-").replace("bg-cyber-cyan", "text-cyber-cyan")}`}>
              {strength.label}
            </span>
          </div>
          <div className="h-2 bg-black/50 rounded-full overflow-hidden">
            <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300 rounded-full`} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Entropy: <span className="text-cyber-cyan font-mono">{entropy.toFixed(1)} bits</span></span>
            <span>Crack time: <span className="text-cyber-cyan">{crackTime}</span></span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!atLeastOne}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold tracking-wider"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          GENERATE PASSWORD
        </Button>

        {/* Password display */}
        {password && (
          <div className="glass-panel rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyber-cyan" />
                <h3 className="text-cyber-cyan font-bold tracking-wide">YOUR PASSWORD</h3>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="bg-black/60 border border-cyber-cyan/20 rounded p-4 text-center">
              <p className="text-cyber-cyan font-mono text-xl font-bold tracking-widest break-all select-all">
                {password}
              </p>
            </div>
            <p className="text-xs text-gray-500 text-center">{password.length} characters — click the password to select all</p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default PasswordGenerator;
