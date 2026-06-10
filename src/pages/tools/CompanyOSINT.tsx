import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search, Filter } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CompanyResult {
  company: string;
  domain?: string;
  subdomains: string[];
  emails: string[];
  socialProfiles: Array<{ platform: string; url: string; found: boolean }>;
  cloudAssets: Array<{ provider: string; asset: string; status: string }>;
  techStack: string[];
  certData: Array<{ cn: string; issuer: string; date: string }>;
}

const CompanyOSINT = () => {
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompanyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"subdomains" | "emails" | "social" | "cloud" | "tech">("subdomains");
  const [filter, setFilter] = useState("");

  const handleScan = async () => {
    if (!company.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/company-osint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), domain: domain.trim() || undefined }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "OSINT failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "Company OSINT failed");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = (arr: string[]) => filter ? arr.filter((x) => x.toLowerCase().includes(filter.toLowerCase())) : arr;

  return (
    <CyberpunkCard title="COMPANY OSINT">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">COMPANY NAME</label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corporation"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">DOMAIN (optional)</label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          onClick={handleScan}
          disabled={isLoading || !company.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gathering Intel...</> : <><Search className="w-4 h-4 mr-2" />Run OSINT</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Subdomains", value: result.subdomains.length, tab: "subdomains" },
                { label: "Emails", value: result.emails.length, tab: "emails" },
                { label: "Social", value: result.socialProfiles.filter((p) => p.found).length, tab: "social" },
                { label: "Cloud", value: result.cloudAssets.length, tab: "cloud" },
                { label: "Tech", value: result.techStack.length, tab: "tech" },
              ].map((s) => (
                <button
                  key={s.tab}
                  onClick={() => setActiveTab(s.tab as typeof activeTab)}
                  className={`glass-panel rounded p-3 text-center transition-colors ${activeTab === s.tab ? "border border-cyber-red/50" : "hover:bg-cyber-cyan/5"}`}
                >
                  <p className="text-xl font-bold text-cyber-cyan">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyber-cyan" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter results..."
                className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan text-xs h-8"
              />
            </div>

            <div className="glass-panel rounded p-4">
              {activeTab === "subdomains" && (
                <>
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">SUBDOMAINS ({result.subdomains.length})</h3>
                  <div className="max-h-64 overflow-auto space-y-1">
                    {filtered(result.subdomains).map((s, i) => (
                      <div key={i} className="text-xs font-mono text-cyber-cyan bg-black/40 px-2 py-1 rounded">{s}</div>
                    ))}
                    {filtered(result.subdomains).length === 0 && <p className="text-gray-500 text-sm">No subdomains found</p>}
                  </div>
                </>
              )}

              {activeTab === "emails" && (
                <>
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">EMAILS ({result.emails.length})</h3>
                  <div className="max-h-64 overflow-auto space-y-1">
                    {filtered(result.emails).map((e, i) => (
                      <div key={i} className="text-xs font-mono text-cyber-cyan bg-black/40 px-2 py-1 rounded">{e}</div>
                    ))}
                    {filtered(result.emails).length === 0 && <p className="text-gray-500 text-sm">No emails found</p>}
                  </div>
                </>
              )}

              {activeTab === "social" && (
                <>
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">SOCIAL PROFILES</h3>
                  <div className="space-y-2">
                    {result.socialProfiles.map((p, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded border ${p.found ? "bg-green-500/10 border-green-500/30" : "bg-gray-500/5 border-gray-500/20 opacity-50"}`}>
                        <span className="text-sm font-bold text-cyber-cyan">{p.platform}</span>
                        <div className="flex items-center gap-2">
                          {p.found && <span className="text-xs font-mono text-gray-300 truncate max-w-48">{p.url}</span>}
                          <span className={`text-xs font-bold ${p.found ? "text-green-400" : "text-gray-500"}`}>{p.found ? "FOUND" : "NOT FOUND"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "cloud" && (
                <>
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">CLOUD ASSETS</h3>
                  <div className="space-y-2">
                    {result.cloudAssets.map((a, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-black/40 border border-cyber-cyan/10">
                        <span className="text-xs font-bold text-cyber-cyan">{a.provider}</span>
                        <span className="text-xs font-mono text-gray-300 flex-1 mx-3 truncate">{a.asset}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${a.status === "public" ? "text-red-400 bg-red-500/10 border-red-500/30" : a.status === "exists" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" : "text-gray-400 bg-gray-500/10 border-gray-500/30"}`}>
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "tech" && (
                <>
                  <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">TECH STACK</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.techStack.map((t, i) => (
                      <span key={i} className="px-3 py-1 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-xs text-cyber-cyan font-bold">{t}</span>
                    ))}
                    {result.techStack.length === 0 && <p className="text-gray-500 text-sm">No tech stack detected</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CompanyOSINT;
