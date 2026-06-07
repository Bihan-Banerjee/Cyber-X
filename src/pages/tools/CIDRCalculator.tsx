import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
import { Network } from "lucide-react";

interface CIDRResult {
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  wildcardMask: string;
  firstHost: string;
  lastHost: string;
  usableHosts: number;
  totalAddresses: number;
  prefix: number;
  ipClass: string;
  ipType: string;
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function intToIp(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

function getIPClass(ip: string): string {
  const first = parseInt(ip.split(".")[0], 10);
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D (Multicast)";
  return "E (Reserved)";
}

function getIPType(ip: string): string {
  const parts = ip.split(".").map(Number);
  if (parts[0] === 10) return "Private";
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return "Private";
  if (parts[0] === 192 && parts[1] === 168) return "Private";
  if (parts[0] === 127) return "Loopback";
  if (parts[0] === 169 && parts[1] === 254) return "Link-local";
  if (parts[0] >= 224 && parts[0] < 240) return "Multicast";
  return "Public";
}

function calculateCIDR(input: string): CIDRResult | null {
  const parts = input.trim().split("/");
  const ip = parts[0];
  const prefix = parts[1] !== undefined ? parseInt(parts[1], 10) : 32;

  const ipParts = ip.split(".");
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
    return null;
  }
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const ipInt = ipToInt(ip);
  const networkInt = (ipInt & mask) >>> 0;
  const broadcastInt = (networkInt | ~mask) >>> 0;
  const firstHostInt = prefix < 31 ? networkInt + 1 : networkInt;
  const lastHostInt = prefix < 31 ? broadcastInt - 1 : broadcastInt;
  const totalAddresses = Math.pow(2, 32 - prefix);
  const usableHosts = prefix < 31 ? totalAddresses - 2 : totalAddresses;

  return {
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    subnetMask: intToIp(mask),
    wildcardMask: intToIp(~mask >>> 0),
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    usableHosts,
    totalAddresses,
    prefix,
    ipClass: getIPClass(ip),
    ipType: getIPType(ip),
  };
}

const CIDRCalculator = () => {
  const [input, setInput] = useState("192.168.1.0/24");
  const [result, setResult] = useState<CIDRResult | null>(() => calculateCIDR("192.168.1.0/24"));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setInput(value);
    setError(null);
    if (!value.trim()) {
      setResult(null);
      return;
    }
    const r = calculateCIDR(value);
    if (!r) {
      setError("Invalid CIDR notation. Example: 192.168.1.0/24");
      setResult(null);
    } else {
      setResult(r);
    }
  };

  const rows: { label: string; value: string | number }[] = result
    ? [
        { label: "Network Address", value: result.networkAddress },
        { label: "Broadcast Address", value: result.broadcastAddress },
        { label: "Subnet Mask", value: result.subnetMask },
        { label: "Wildcard Mask", value: result.wildcardMask },
        { label: "First Usable Host", value: result.firstHost },
        { label: "Last Usable Host", value: result.lastHost },
        { label: "Usable Hosts", value: result.usableHosts.toLocaleString() },
        { label: "Total Addresses", value: result.totalAddresses.toLocaleString() },
        { label: "CIDR Prefix", value: `/${result.prefix}` },
        { label: "IP Class", value: result.ipClass },
        { label: "IP Type", value: result.ipType },
      ]
    : [];

  return (
    <CyberpunkCard title="CIDR CALCULATOR">
      <div className="space-y-6">
        <div>
          <label className="block text-xs text-cyber-cyan tracking-wider mb-2">
            CIDR NOTATION
          </label>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="192.168.1.0/24"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            />
            <div className="flex items-center px-3 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded">
              <Network className="w-4 h-4 text-cyber-cyan" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Enter an IP address with optional CIDR prefix (e.g. 10.0.0.0/8)</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="glass-panel rounded p-4">
            <h3 className="text-cyber-cyan font-bold tracking-wide mb-4">NETWORK DETAILS</h3>
            <div className="space-y-2">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-cyber-cyan/10 last:border-0">
                  <span className="text-sm text-gray-400">{label}</span>
                  <span className="text-cyber-cyan font-mono font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="glass-panel rounded p-4">
            <h3 className="text-cyber-cyan font-bold tracking-wide mb-3">HOST RANGE</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center p-3 bg-green-500/10 border border-green-500/20 rounded">
                <p className="text-xs text-gray-400 mb-1">First Host</p>
                <p className="text-green-400 font-mono font-bold">{result.firstHost}</p>
              </div>
              <div className="text-cyber-cyan text-xl">→</div>
              <div className="flex-1 text-center p-3 bg-green-500/10 border border-green-500/20 rounded">
                <p className="text-xs text-gray-400 mb-1">Last Host</p>
                <p className="text-green-400 font-mono font-bold">{result.lastHost}</p>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              {result.usableHosts.toLocaleString()} usable host addresses
            </p>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default CIDRCalculator;
