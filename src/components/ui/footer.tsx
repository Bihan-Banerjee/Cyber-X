import { Github, Linkedin, Instagram, Globe, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative border-t border-cyber-red/30 bg-black/40 backdrop-blur-md">

      {/* Thin Neon Line */}
      <div className="h-[1px] w-full bg-gradient-to-r from-cyber-red via-cyber-cyan to-cyber-red opacity-60" />

      <div className="max-w-7xl mx-auto px-6 py-8 grid gap-10 md:grid-cols-4">

        {/* BRAND */}
        <div className="md:col-span-1">
          <h2 className="text-lg font-bold text-cyber-cyan tracking-wider">
            CYBERX
          </h2>

          <p className="text-gray-400 text-xs leading-relaxed mt-2 max-w-xs">
            Unified cyber-operations platform for pentesting, honeypots,
            RL agents and real-time threat visualization.
          </p>

          <p className="text-gray-500 text-[11px] mt-3">
            © 2026 CYBERX
          </p>
        </div>

        {/* QUICK LINKS */}
        <div>

          <ul className="space-y-1 text-xs">
            {[
              { name: "Home", path: "/" },
              { name: "Dashboard", path: "/dashboard" },
              { name: "Tools", path: "/tools" },
              { name: "Honeypot", path: "/honeypot" },
            ].map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className="text-gray-400 hover:text-cyber-cyan transition-colors"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>

          <ul className="space-y-1 text-xs">
            {[
              { name: "RL Gym", path: "/rl-gym" },
              { name: "Global Map", path: "/map" },
              { name: "Guide", path: "/guide" },
            ].map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className="text-gray-400 hover:text-cyber-cyan transition-colors"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* SOCIALS */}
        <div>
          <h3 className="text-cyber-red text-sm font-semibold tracking-wide mb-3">
            CONNECT
          </h3>

          <div className="flex gap-3">

            <a href="https://github.com/Bihan-Banerjee" target="_blank" className="social-icon-sm">
              <Github size={18} />
            </a>

            <a href="https://www.linkedin.com/in/bihan-banerjee-70905228b/" target="_blank" className="social-icon-sm">
              <Linkedin size={18} />
            </a>

            <a href="https://www.instagram.com/banerjee.bihan" target="_blank" className="social-icon-sm">
              <Instagram size={18} />
            </a>

            <a href="https://bihan-banerjee.github.io/Portfolio-Website/" target="_blank" className="social-icon-sm">
              <Globe size={18} />
            </a>

            <a href="mailto:bihanbanerjee26@gmail.com" className="social-icon-sm">
              <Mail size={18} />
            </a>

          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
