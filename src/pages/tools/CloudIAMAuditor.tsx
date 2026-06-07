import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface IAMIssue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  statementIndex?: number;
  affectedStatement?: string;
}

interface IAMResult {
  issues: IAMIssue[];
  score: number;
  wildcardStatements: number;
  dangerousActions: string[];
}

const getSeverityColor = (severity: string) => {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/50",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    info: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  };
  return colors[severity] || colors.info;
};

const EXAMPLE_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["*"],
      "Resource": ["*"]
    }
  ]
}`;

const CloudIAMAuditor = () => {
  const [policy, setPolicy] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IAMResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async () => {
    if (!policy.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/iam-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: policy.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Audit failed");
      }
      setResult(await response.json());
    } catch (err: any) {
      setError(err.message || "IAM audit failed");
    } finally {
      setIsLoading(false);
    }
  };

  const scoreColor = (s: number) => s >= 80 ? "text-green-400" : s >= 50 ? "text-yellow-400" : "text-red-400";
  const scoreBg = (s: number) => s >= 80 ? "bg-green-500/10 border-green-500/30" : s >= 50 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30";

  return (
    <CyberpunkCard title="CLOUD IAM AUDITOR">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm text-cyber-cyan tracking-wide">IAM POLICY JSON</label>
            <button
              onClick={() => setPolicy(EXAMPLE_POLICY)}
              className="text-xs text-cyber-cyan/60 hover:text-cyber-cyan underline"
            >
              Load example
            </button>
          </div>
          <textarea
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            placeholder='Paste IAM policy JSON here...'
            rows={10}
            className="w-full bg-black/50 border border-cyber-cyan/30 text-cyber-cyan rounded px-3 py-2 text-xs font-mono resize-y"
            disabled={isLoading}
          />
        </div>

        <Button
          onClick={handleAudit}
          disabled={isLoading || !policy.trim()}
          className="w-full bg-cyber-red hover:bg-cyber-red/80 text-white font-bold"
        >
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Auditing Policy...</> : <><ShieldCheck className="w-4 h-4 mr-2" />Audit Policy</>}
        </Button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className={`glass-panel rounded p-4 text-center border ${scoreBg(result.score)}`}>
                <p className={`text-3xl font-bold ${scoreColor(result.score)}`}>{result.score}</p>
                <p className="text-xs text-gray-400 mt-1">Security Score</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.issues.length > 0 ? "text-red-400" : "text-green-400"}`}>{result.issues.length}</p>
                <p className="text-xs text-gray-400 mt-1">Issues Found</p>
              </div>
              <div className="glass-panel rounded p-4 text-center">
                <p className={`text-2xl font-bold ${result.wildcardStatements > 0 ? "text-orange-400" : "text-green-400"}`}>{result.wildcardStatements}</p>
                <p className="text-xs text-gray-400 mt-1">Wildcard Stmts</p>
              </div>
            </div>

            {result.dangerousActions.length > 0 && (
              <div className="glass-panel rounded p-4">
                <h3 className="text-red-400 font-bold tracking-wide mb-3">DANGEROUS ACTIONS</h3>
                <div className="flex flex-wrap gap-2">
                  {result.dangerousActions.map((a, i) => (
                    <span key={i} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs font-mono text-red-400">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {result.issues.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-cyber-cyan font-bold tracking-wide">ISSUES ({result.issues.length})</h3>
                {result.issues.map((issue, i) => (
                  <div key={i} className={`p-3 rounded border ${getSeverityColor(issue.severity)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold">{issue.title}</span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2">{issue.description}</p>
                    {issue.affectedStatement && (
                      <pre className="text-xs font-mono bg-black/40 p-2 rounded text-gray-300 overflow-x-auto">
                        {issue.affectedStatement}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.issues.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
                <ShieldCheck className="w-4 h-4" />
                No critical issues found in this IAM policy.
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CloudIAMAuditor;
