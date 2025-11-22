import { Link } from "react-router-dom";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Scan, Hash, Mail, Lock, Cloud } from "lucide-react";

const Tools = () => {
  const tools = [
    {
      icon: Scan,
      name: "Port Scanner",
      description: "Scan networks for open ports and services",
      path: "/tools/port-scanner",
      category: "Network",
    },
    {
      icon: Hash,
      name: "Hash Tool",
      description: "Generate and verify cryptographic hashes",
      path: "/tools/hash-tool",
      category: "Crypto",
    },
    {
      icon: Mail,
      name: "Email Breach Check",
      description: "Check if email addresses have been compromised",
      path: "/tools/email-breach",
      category: "Intel",
    },
    {
      icon: Lock,
      name: "Password Generator",
      description: "Generate secure passwords and passphrases",
      path: "/tools/password-gen",
      category: "Crypto",
    },
    {
      icon: Cloud,
      name: "Cloud Scanner",
      description: "Scan cloud storage for security issues",
      path: "/tools/cloud-scanner",
      category: "Cloud",
    },
  ];

  return (
    <CyberpunkCard title="SECURITY TOOLS">
      <div className="grid md:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="glass-panel rounded p-6 hover:scale-105 hover:border-cyber-cyan transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyber-red/20 rounded group-hover:bg-cyber-cyan/20 transition-colors">
                <tool.icon className="w-6 h-6 text-cyber-red group-hover:text-cyber-cyan transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-cyber-cyan tracking-wide">
                    {tool.name}
                  </h3>
                  <span className="text-xs px-2 py-1 bg-cyber-red/20 text-cyber-red rounded">
                    {tool.category}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{tool.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </CyberpunkCard>
  );
};

export default Tools;
