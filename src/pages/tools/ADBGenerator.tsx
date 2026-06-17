import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Copy, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

type Category = "all" | "device" | "app" | "file" | "shell" | "debug" | "forensics";

interface ADBCommand {
  category: Exclude<Category, "all">;
  command: string;
  description: string;
  tags?: string[];
}

const ADB_COMMANDS: ADBCommand[] = [
  // Device Info
  { category: "device", command: "adb devices -l", description: "List connected devices with transport info" },
  { category: "device", command: "adb shell getprop ro.build.version.release", description: "Get Android OS version" },
  { category: "device", command: "adb shell getprop ro.product.model", description: "Get device model" },
  { category: "device", command: "adb shell getprop ro.serialno", description: "Get device serial number" },
  { category: "device", command: "adb shell dumpsys battery", description: "Get battery status and health" },
  { category: "device", command: "adb shell wm size", description: "Get screen resolution" },
  { category: "device", command: "adb shell cat /proc/cpuinfo", description: "Get CPU information" },
  { category: "device", command: "adb shell df -h", description: "Show disk space usage" },
  // App Management
  { category: "app", command: "adb shell pm list packages", description: "List all installed packages" },
  { category: "app", command: "adb shell pm list packages -3", description: "List third-party packages only" },
  { category: "app", command: "adb install -r app.apk", description: "Install APK (replace existing)" },
  { category: "app", command: "adb uninstall com.example.app", description: "Uninstall app by package name" },
  { category: "app", command: "adb shell am start -n com.example/.MainActivity", description: "Launch app activity" },
  { category: "app", command: "adb shell am force-stop com.example.app", description: "Force-stop an application" },
  { category: "app", command: "adb shell dumpsys package com.example.app", description: "Dump package metadata" },
  { category: "app", command: "adb shell pm clear com.example.app", description: "Clear app data and cache" },
  // File Transfer
  { category: "file", command: "adb push local.txt /sdcard/local.txt", description: "Copy file to device" },
  { category: "file", command: "adb pull /sdcard/remote.txt local.txt", description: "Copy file from device" },
  { category: "file", command: "adb shell ls -la /sdcard/", description: "List files in /sdcard/" },
  { category: "file", command: "adb shell find /data -name '*.db' 2>/dev/null", description: "Find database files on device" },
  // Shell Access
  { category: "shell", command: "adb shell", description: "Open interactive shell on device" },
  { category: "shell", command: "adb shell su -c 'command'", description: "Run command as root" },
  { category: "shell", command: "adb shell env", description: "Display all environment variables" },
  { category: "shell", command: "adb shell netstat -tuln", description: "Show open network ports" },
  { category: "shell", command: "adb shell ps -A", description: "List all running processes" },
  // Debugging
  { category: "debug", command: "adb logcat", description: "Stream device log output" },
  { category: "debug", command: "adb logcat -d > device_log.txt", description: "Dump current log to file" },
  { category: "debug", command: "adb logcat *:E", description: "Show only error-level log entries" },
  { category: "debug", command: "adb bugreport bugreport.zip", description: "Generate full bug report" },
  { category: "debug", command: "adb shell am instrument -w com.example.test/androidx.test.runner.AndroidJUnitRunner", description: "Run instrumentation tests" },
  // Forensics
  { category: "forensics", command: "adb backup -all -apk -shared -f backup.ab", description: "Full device backup (requires user confirmation)" },
  { category: "forensics", command: "adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png", description: "Take screenshot and pull to host" },
  { category: "forensics", command: "adb shell screenrecord /sdcard/demo.mp4", description: "Record screen (Ctrl+C to stop)" },
  { category: "forensics", command: "adb shell dumpsys activity > activity_dump.txt", description: "Dump activity manager state" },
  { category: "forensics", command: "adb shell content query --uri content://sms/inbox", description: "Read SMS inbox (requires root or debug app)" },
  { category: "forensics", command: "adb shell sqlite3 /data/data/com.android.providers.contacts/databases/contacts2.db .dump", description: "Dump contacts database (root required)" },
];

const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: "all", label: "ALL", color: "bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/30" },
  { id: "device", label: "DEVICE INFO", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "app", label: "APP MGMT", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: "file", label: "FILE TRANSFER", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "shell", label: "SHELL ACCESS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: "debug", label: "DEBUGGING", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: "forensics", label: "FORENSICS", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

const ADBGenerator = () => {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = ADB_COMMANDS.filter((cmd) => {
    const matchCategory = activeCategory === "all" || cmd.category === activeCategory;
    const matchSearch =
      !search ||
      cmd.command.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCategoryColor = (cat: Exclude<Category, "all">) =>
    CATEGORIES.find((c) => c.id === cat)?.color || "bg-gray-500/20 text-gray-400 border-gray-500/30";

  return (
    <CyberpunkCard title="ADB COMMAND GENERATOR">
      <div className="space-y-6">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                activeCategory === cat.id
                  ? cat.color + " ring-1 ring-offset-1 ring-offset-black ring-current"
                  : "bg-black/30 text-gray-500 border-gray-600/30 hover:text-gray-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commands or descriptions..."
          className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
        />

        <p className="text-gray-500 text-xs">{filtered.length} command{filtered.length !== 1 ? "s" : ""} shown</p>

        {/* Commands */}
        <div className="space-y-3">
          {filtered.map((cmd, idx) => (
            <div key={idx} className="glass-panel rounded p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getCategoryColor(cmd.category)}`}>
                      {cmd.category.toUpperCase()}
                    </span>
                  </div>
                  <code className="block text-cyber-cyan font-mono text-sm break-all">{cmd.command}</code>
                  <p className="text-gray-400 text-xs mt-1">{cmd.description}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(cmd.command, idx)}
                  className="shrink-0 p-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan rounded border border-cyber-cyan/30 transition-colors"
                  title="Copy command"
                >
                  {copied === idx ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Cheat Sheet Reference */}
        <div className="glass-panel rounded p-4">
          <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">ADB QUICK REFERENCE</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
            <div>
              <p className="text-cyber-cyan font-bold mb-1">Connection Modes</p>
              <p>• USB: Connect via USB cable</p>
              <p>• TCP: <code className="text-cyber-cyan">adb connect &lt;ip&gt;:5555</code></p>
              <p>• Wireless: <code className="text-cyber-cyan">adb pair &lt;ip&gt;:port</code> (Android 11+)</p>
            </div>
            <div>
              <p className="text-cyber-cyan font-bold mb-1">Multiple Devices</p>
              <p>• <code className="text-cyber-cyan">adb -s &lt;serial&gt; &lt;cmd&gt;</code></p>
              <p>• <code className="text-cyber-cyan">adb -e &lt;cmd&gt;</code> (emulator only)</p>
              <p>• <code className="text-cyber-cyan">adb -d &lt;cmd&gt;</code> (USB device only)</p>
            </div>
            <div>
              <p className="text-cyber-cyan font-bold mb-1">Port Forwarding</p>
              <p>• <code className="text-cyber-cyan">adb forward tcp:8080 tcp:8080</code></p>
              <p>• <code className="text-cyber-cyan">adb reverse tcp:9090 tcp:9090</code></p>
            </div>
            <div>
              <p className="text-cyber-cyan font-bold mb-1">Server Control</p>
              <p>• <code className="text-cyber-cyan">adb start-server</code></p>
              <p>• <code className="text-cyber-cyan">adb kill-server</code></p>
              <p>• <code className="text-cyber-cyan">adb reconnect</code></p>
            </div>
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default ADBGenerator;
