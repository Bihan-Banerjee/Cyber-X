import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, User } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const ALL_PLATFORMS = ["GitHub", "Reddit", "Twitter", "Instagram", "LinkedIn", "HackerNews", "YouTube", "TikTok", "Twitch", "Pinterest", "Steam"];

interface SocialProfile {
  platform: string;
  found: boolean;
  url?: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  isPrivate?: boolean;
}

interface SocialResult {
  handle: string;
  profiles: SocialProfile[];
  crossLinks: string[];
}

const SocialMediaOSINT = () => {
  const [handle, setHandle] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(ALL_PLATFORMS));
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SocialResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: string) => {
    const next = new Set(selectedPlatforms);
    next.has(p) ? next.delete(p) : next.add(p);
    setSelectedPlatforms(next);
  };

  const handleScan = async () => {
    if (!handle.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/social-osint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim(), platforms: [...selectedPlatforms] }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "OSINT failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Social media OSINT failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CyberpunkCard title="SOCIAL MEDIA OSINT">
      <div className="space-y-6">
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm">
          <span>Results use public APIs and HTTP status checks. Accuracy may vary due to API rate limits.</span>
        </div>

        <div>
          <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">USERNAME / HANDLE</label>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="johndoe"
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">PLATFORMS</label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${selectedPlatforms.has(p) ? "bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/50" : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !handle.trim() || selectedPlatforms.size === 0}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Search className="w-4 h-4 mr-2" />Search Platforms</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{result.profiles.filter((p) => p.found).length}</p>
                <p className="text-xs text-gray-400 mt-1">Profiles Found</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className="text-2xl font-bold text-cyber-cyan">{result.profiles.length}</p>
                <p className="text-xs text-gray-400 mt-1">Platforms Checked</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.profiles.map((profile, i) => (
                <div key={i} className={`glass-panel rounded p-4 border ${profile.found ? "border-cyber-cyan/30" : "border-gray-500/10 opacity-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-cyber-cyan" />
                      <span className="font-bold text-cyber-cyan">{profile.platform}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${profile.found ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-500 border-gray-500/30"}`}>
                      {profile.found ? (profile.isPrivate ? "PRIVATE" : "PUBLIC") : "NOT FOUND"}
                    </span>
                  </div>
                  {profile.found && (
                    <div className="space-y-1 text-xs">
                      {profile.displayName && <p className="text-gray-300">{profile.displayName}</p>}
                      {profile.bio && <p className="text-gray-400 truncate">{profile.bio}</p>}
                      {profile.followers !== undefined && <p className="text-gray-400">Followers: {profile.followers.toLocaleString()}</p>}
                      {profile.url && <p className="font-mono text-cyber-cyan/70 truncate">{profile.url}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {result.crossLinks.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">CROSS-LINKS</h3>
                {result.crossLinks.map((l, i) => (
                  <p key={i} className="text-xs font-mono text-cyber-cyan">{l}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default SocialMediaOSINT;
