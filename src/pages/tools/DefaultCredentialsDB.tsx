import { useState, useMemo } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface CredEntry {
  vendor: string;
  device: string;
  username: string;
  password: string;
  category: string;
}

const CREDS: CredEntry[] = [
  // Routers - Cisco
  { vendor: "Cisco", device: "IOS Router", username: "cisco", password: "cisco", category: "Router" },
  { vendor: "Cisco", device: "IOS Router", username: "admin", password: "admin", category: "Router" },
  { vendor: "Cisco", device: "Linksys E-Series", username: "admin", password: "admin", category: "Router" },
  { vendor: "Cisco", device: "Small Business", username: "cisco", password: "cisco", category: "Router" },
  // Routers - Netgear
  { vendor: "Netgear", device: "Nighthawk Series", username: "admin", password: "password", category: "Router" },
  { vendor: "Netgear", device: "ProSafe Switches", username: "admin", password: "password", category: "Router" },
  { vendor: "Netgear", device: "WG102 AP", username: "admin", password: "password", category: "Router" },
  // Routers - TP-Link
  { vendor: "TP-Link", device: "TL-WR Series", username: "admin", password: "admin", category: "Router" },
  { vendor: "TP-Link", device: "TL-ER Series", username: "admin", password: "admin", category: "Router" },
  { vendor: "TP-Link", device: "Archer Series", username: "admin", password: "admin", category: "Router" },
  // Routers - D-Link
  { vendor: "D-Link", device: "DIR Series", username: "admin", password: "", category: "Router" },
  { vendor: "D-Link", device: "DGS Switches", username: "admin", password: "admin", category: "Router" },
  { vendor: "D-Link", device: "DES Switches", username: "admin", password: "", category: "Router" },
  // Routers - Asus
  { vendor: "Asus", device: "RT-AC Series", username: "admin", password: "admin", category: "Router" },
  { vendor: "Asus", device: "RT-N Series", username: "admin", password: "admin", category: "Router" },
  // Routers - Ubiquiti
  { vendor: "Ubiquiti", device: "UniFi AP", username: "ubnt", password: "ubnt", category: "Router" },
  { vendor: "Ubiquiti", device: "EdgeRouter", username: "ubnt", password: "ubnt", category: "Router" },
  { vendor: "Ubiquiti", device: "AirOS", username: "ubnt", password: "ubnt", category: "Router" },
  // Cameras - Hikvision
  { vendor: "Hikvision", device: "IP Camera", username: "admin", password: "12345", category: "Camera" },
  { vendor: "Hikvision", device: "DVR/NVR", username: "admin", password: "12345", category: "Camera" },
  { vendor: "Hikvision", device: "PTZ Camera", username: "admin", password: "12345", category: "Camera" },
  // Cameras - Dahua
  { vendor: "Dahua", device: "IP Camera", username: "admin", password: "admin", category: "Camera" },
  { vendor: "Dahua", device: "NVR", username: "admin", password: "admin", category: "Camera" },
  { vendor: "Dahua", device: "DVR", username: "admin", password: "admin", category: "Camera" },
  // Databases
  { vendor: "MySQL", device: "MySQL Server", username: "root", password: "", category: "Database" },
  { vendor: "MySQL", device: "MySQL Server", username: "root", password: "root", category: "Database" },
  { vendor: "PostgreSQL", device: "PostgreSQL", username: "postgres", password: "", category: "Database" },
  { vendor: "PostgreSQL", device: "PostgreSQL", username: "postgres", password: "postgres", category: "Database" },
  { vendor: "Microsoft", device: "MSSQL Server", username: "sa", password: "", category: "Database" },
  { vendor: "Microsoft", device: "MSSQL Server", username: "sa", password: "sa", category: "Database" },
  { vendor: "Oracle", device: "Oracle DB", username: "system", password: "manager", category: "Database" },
  { vendor: "Oracle", device: "Oracle DB", username: "sys", password: "change_on_install", category: "Database" },
  { vendor: "MongoDB", device: "MongoDB", username: "", password: "", category: "Database" },
  // Web Apps
  { vendor: "Jenkins", device: "Jenkins CI", username: "admin", password: "admin", category: "Web App" },
  { vendor: "Jenkins", device: "Jenkins CI", username: "jenkins", password: "jenkins", category: "Web App" },
  { vendor: "Apache", device: "Tomcat Manager", username: "admin", password: "tomcat", category: "Web App" },
  { vendor: "Apache", device: "Tomcat Manager", username: "tomcat", password: "tomcat", category: "Web App" },
  { vendor: "Apache", device: "Tomcat Manager", username: "admin", password: "admin", category: "Web App" },
  { vendor: "Oracle", device: "WebLogic Console", username: "weblogic", password: "weblogic", category: "Web App" },
  { vendor: "Oracle", device: "WebLogic Console", username: "system", password: "weblogic", category: "Web App" },
  { vendor: "cPanel", device: "cPanel/WHM", username: "root", password: "root", category: "Web App" },
  { vendor: "Plesk", device: "Plesk Panel", username: "admin", password: "admin", category: "Web App" },
  { vendor: "Joomla", device: "Joomla CMS", username: "admin", password: "admin", category: "Web App" },
  { vendor: "WordPress", device: "WordPress", username: "admin", password: "admin", category: "Web App" },
  // Network Devices
  { vendor: "Juniper", device: "Junos Router", username: "root", password: "", category: "Network" },
  { vendor: "Fortinet", device: "FortiGate", username: "admin", password: "", category: "Network" },
  { vendor: "Palo Alto", device: "PAN-OS", username: "admin", password: "admin", category: "Network" },
  { vendor: "HP", device: "ProCurve Switch", username: "manager", password: "", category: "Network" },
  { vendor: "Mikrotik", device: "RouterOS", username: "admin", password: "", category: "Network" },
  { vendor: "Aruba", device: "ArubaOS", username: "admin", password: "admin", category: "Network" },
  // Printers
  { vendor: "HP", device: "LaserJet", username: "admin", password: "", category: "Printer" },
  { vendor: "Xerox", device: "WorkCentre", username: "admin", password: "1111", category: "Printer" },
];

const CATEGORIES = ["All", ...Array.from(new Set(CREDS.map((c) => c.category))).sort()];

const DefaultCredentialsDB = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return CREDS.filter((c) => {
      const matchCategory = category === "All" || c.category === category;
      const matchQuery =
        !q ||
        c.vendor.toLowerCase().includes(q) ||
        c.device.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.password.toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
  }, [query, category]);

  return (
    <CyberpunkCard title="DEFAULT CREDENTIALS DATABASE">
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-cyan/50" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendor, device, username..."
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  category === cat
                    ? "bg-cyber-red text-white font-bold"
                    : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Showing {filtered.length} of {CREDS.length} entries
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyber-cyan/20">
                <th className="text-left text-cyber-cyan text-xs tracking-wider py-2 pr-4">VENDOR</th>
                <th className="text-left text-cyber-cyan text-xs tracking-wider py-2 pr-4">DEVICE / SOFTWARE</th>
                <th className="text-left text-cyber-cyan text-xs tracking-wider py-2 pr-4">USERNAME</th>
                <th className="text-left text-cyber-cyan text-xs tracking-wider py-2 pr-4">PASSWORD</th>
                <th className="text-left text-cyber-cyan text-xs tracking-wider py-2">CATEGORY</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={i}
                  className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5 transition-colors"
                >
                  <td className="py-2 pr-4 text-cyber-cyan font-mono text-xs">{c.vendor}</td>
                  <td className="py-2 pr-4 text-gray-300 text-xs">{c.device}</td>
                  <td className="py-2 pr-4">
                    <code className="bg-black/40 px-1.5 py-0.5 rounded text-yellow-400 text-xs">
                      {c.username || "(empty)"}
                    </code>
                  </td>
                  <td className="py-2 pr-4">
                    <code className="bg-black/40 px-1.5 py-0.5 rounded text-orange-400 text-xs">
                      {c.password || "(empty)"}
                    </code>
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">
                      {c.category}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                    No entries match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CyberpunkCard>
  );
};

export default DefaultCredentialsDB;
