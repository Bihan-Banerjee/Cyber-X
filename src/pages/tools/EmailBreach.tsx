import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface BreachResult {
  breach: string;
  date: string;
  severity: "high" | "medium" | "low";
}

const EmailBreach = () => {
  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [breaches, setBreaches] = useState<BreachResult[]>([]);
  const [checked, setChecked] = useState(false);

  const checkEmail = async () => {
    if (!email) return;

    setIsChecking(true);
    setBreaches([]);
    setChecked(false);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockBreaches: BreachResult[] = [
      { breach: "LinkedIn (2021)", date: "06/2021", severity: "high" },
      { breach: "Adobe (2013)", date: "10/2013", severity: "medium" },
      { breach: "Dropbox (2012)", date: "07/2012", severity: "low" },
    ];

    setBreaches(mockBreaches);
    setChecked(true);
    setIsChecking(false);
  };

  return (
    <CyberpunkCard title="EMAIL BREACH CHECK">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-cyan mb-2 tracking-wide">
              EMAIL ADDRESS
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="bg-black/50 border-cyber-red/30 text-cyber-cyan"
            />
          </div>

          <Button
            onClick={checkEmail}
            disabled={isChecking || !email}
            className="w-full bg-cyber-red hover:bg-cyber-deepRed text-white font-bold tracking-wider"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                CHECKING...
              </>
            ) : (
              "CHECK BREACHES"
            )}
          </Button>
        </div>

        {checked && (
          <div className="border-t border-cyber-red/30 pt-6">
            {breaches.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-bold text-yellow-500 tracking-wide">
                    {breaches.length} BREACH{breaches.length > 1 ? "ES" : ""} FOUND
                  </h3>
                </div>
                <div className="space-y-2">
                  {breaches.map((breach, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-black/30 rounded hover:bg-black/50 transition-colors"
                    >
                      <div>
                        <p className="text-cyber-cyan font-bold">{breach.breach}</p>
                        <p className="text-xs text-gray-400">Date: {breach.date}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-xs font-bold ${
                          breach.severity === "high"
                            ? "bg-red-500/20 text-red-400"
                            : breach.severity === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {breach.severity.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-green-500 tracking-wide mb-2">
                  NO BREACHES FOUND
                </h3>
                <p className="text-gray-400 text-sm">
                  This email has not been found in any known data breaches
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default EmailBreach;
