import { useState, useEffect } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

const EpochConverter = () => {
  const [unix, setUnix] = useState("");
  const [human, setHuman] = useState("");
  const [iso, setIso] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currentTs, setCurrentTs] = useState(Math.floor(Date.now() / 1000));
  const [addValue, setAddValue] = useState("");
  const [addUnit, setAddUnit] = useState<"seconds" | "minutes" | "hours" | "days">("days");
  const [addResult, setAddResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setCurrentTs(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const toHuman = (ts: number, tz: string): string => {
    try {
      return new Date(ts * 1000).toLocaleString("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return new Date(ts * 1000).toUTCString();
    }
  };

  const updateFromUnix = (val: string) => {
    setUnix(val);
    setError("");
    if (!val) { setHuman(""); setIso(""); return; }
    const ts = parseInt(val);
    if (isNaN(ts)) { setError("Invalid Unix timestamp"); return; }
    const d = new Date(ts * 1000);
    setHuman(toHuman(ts, timezone));
    setIso(d.toISOString());
  };

  const updateFromHuman = (val: string) => {
    setHuman(val);
    setError("");
    if (!val) { setUnix(""); setIso(""); return; }
    const d = new Date(val);
    if (isNaN(d.getTime())) { setError("Invalid date string"); return; }
    const ts = Math.floor(d.getTime() / 1000);
    setUnix(ts.toString());
    setIso(d.toISOString());
  };

  const updateFromISO = (val: string) => {
    setIso(val);
    setError("");
    if (!val) { setUnix(""); setHuman(""); return; }
    const d = new Date(val);
    if (isNaN(d.getTime())) { setError("Invalid ISO 8601 string"); return; }
    const ts = Math.floor(d.getTime() / 1000);
    setUnix(ts.toString());
    setHuman(toHuman(ts, timezone));
  };

  const loadCurrent = () => {
    const ts = Math.floor(Date.now() / 1000);
    updateFromUnix(ts.toString());
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    if (unix) {
      const ts = parseInt(unix);
      if (!isNaN(ts)) setHuman(toHuman(ts, tz));
    }
  };

  const calcAddResult = () => {
    if (!unix || !addValue) return;
    const ts = parseInt(unix);
    const val = parseFloat(addValue);
    if (isNaN(ts) || isNaN(val)) return;
    const multipliers = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
    const newTs = ts + Math.round(val * multipliers[addUnit]);
    setAddResult(`${newTs} → ${toHuman(newTs, timezone)}`);
  };

  return (
    <CyberpunkCard title="EPOCH CONVERTER">
      <div className="space-y-5">
        <div className="glass-panel rounded p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 tracking-wider">CURRENT UNIX TIMESTAMP</p>
            <p className="text-3xl font-bold text-cyber-cyan font-mono">{currentTs}</p>
          </div>
          <Button onClick={loadCurrent} size="sm"
            className="bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/30 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />Use Current
          </Button>
        </div>

        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">TIMEZONE</label>
          <select
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-2 text-sm focus:outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">UNIX TIMESTAMP</label>
            <Input
              value={unix}
              onChange={(e) => updateFromUnix(e.target.value)}
              placeholder="1700000000"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">HUMAN READABLE</label>
            <Input
              value={human}
              onChange={(e) => updateFromHuman(e.target.value)}
              placeholder="November 14, 2023 at 10:13 PM UTC"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            />
          </div>
          <div>
            <label className="block text-xs text-cyber-cyan tracking-wider mb-2">ISO 8601</label>
            <Input
              value={iso}
              onChange={(e) => updateFromISO(e.target.value)}
              placeholder="2023-11-14T22:13:20.000Z"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            />
          </div>
        </div>

        <div className="glass-panel rounded p-4">
          <h3 className="text-cyber-cyan font-bold tracking-wide mb-3 text-sm">TIMESTAMP CALCULATOR</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Add/subtract (use negative)</label>
              <Input
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="7"
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Unit</label>
              <select
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value as typeof addUnit)}
                className="bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded p-2 text-sm focus:outline-none"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <Button onClick={calcAddResult} disabled={!unix || !addValue}
              className="bg-cyber-red hover:bg-cyber-red/80 text-white font-bold">
              Calculate
            </Button>
          </div>
          {addResult && (
            <div className="mt-3 p-2 bg-black/40 rounded font-mono text-xs text-green-400 break-all">
              {addResult}
            </div>
          )}
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default EpochConverter;
