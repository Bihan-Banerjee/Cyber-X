import { Link } from "react-router-dom";
import React, { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import {
  Scan,
  Activity,
  Monitor,
  Globe,
  Search,
  Server,
  ArrowLeftRight,
  MapPin,
  FolderSearch,
  Bug,
  Zap,
  ShieldAlert,
  Database,
  Container,
  Boxes,
  Hash,
  Key,
  Lock,
  Shield,
  Image,
  Music,
  FileSearch,
  FileImage,
  Mail,
  SearchCode,
  Network,
} from "lucide-react";

const PAGE_SIZE = 6;

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
    icon: Activity,
    name: "Service Detection",
    description: "Identify running services and version information",
    path: "/tools/service-detect",
    category: "Network",
  },
  {
    icon: Monitor,
    name: "OS Fingerprinting",
    description: "Detect operating system and device information",
    path: "/tools/os-fingerprint",
    category: "Network",
  },
  {
    icon: Globe,
    name: "Subdomain Enumeration",
    description: "Discover subdomains and map attack surface",
    path: "/tools/subdomains",
    category: "Recon",
  },
  {
    icon: Search,
    name: "WHOIS Lookup",
    description: "Query domain registration and ownership data",
    path: "/tools/whois",
    category: "Recon",
  },
  {
    icon: Server,
    name: "DNS Reconnaissance",
    description: "Enumerate DNS records and zone information",
    path: "/tools/dns-recon",
    category: "Recon",
  },
  {
    icon: ArrowLeftRight,
    name: "Reverse IP Lookup",
    description: "Find domains hosted on the same IP address",
    path: "/tools/reverse-ip",
    category: "Network",
  },
  {
    icon: MapPin,
    name: "IP Geolocation",
    description: "Trace IP addresses to physical locations",
    path: "/tools/ip-geo",
    category: "Network",
  },
  {
    icon: FolderSearch,
    name: "Directory Fuzzer",
    description: "Discover hidden directories and files",
    path: "/tools/dir-fuzzer",
    category: "Web",
  },
  {
    icon: Bug,
    name: "Vulnerability Fuzzer",
    description: "Test for common web vulnerabilities",
    path: "/tools/vuln-fuzzer",
    category: "Web",
  },
  {
    icon: Zap,
    name: "API Scanner",
    description: "Scan APIs for security misconfigurations",
    path: "/tools/api-scanner",
    category: "Web",
  },
  {
    icon: ShieldAlert,
    name: "Broken Authentication",
    description: "Test authentication and session management",
    path: "/tools/broken-auth",
    category: "Web",
  },
  {
    icon: Database,
    name: "S3 Bucket Finder",
    description: "Discover exposed AWS S3 storage buckets",
    path: "/tools/s3-finder",
    category: "Cloud",
  },
  {
    icon: Container,
    name: "Container Scanner",
    description: "Audit Docker containers for vulnerabilities",
    path: "/tools/container-scan",
    category: "Cloud",
  },
  {
    icon: Boxes,
    name: "Kubernetes Enumeration",
    description: "Enumerate K8s clusters and configurations",
    path: "/tools/k8s-enum",
    category: "Cloud",
  },
  {
    icon: Hash,
    name: "Hash Cracker",
    description: "Crack and identify cryptographic hashes",
    path: "/tools/hash-cracker",
    category: "Crypto",
  },
  {
    icon: Key,
    name: "Cipher Tool",
    description: "Encode, decode, and analyze classical ciphers",
    path: "/tools/ciphers",
    category: "Crypto",
  },
  {
    icon: Lock,
    name: "RSA/AES Tool",
    description: "Encrypt and decrypt using RSA and AES",
    path: "/tools/rsa-aes",
    category: "Crypto",
  },
  {
    icon: Shield,
    name: "JWT Decoder",
    description: "Decode and analyze JSON Web Tokens",
    path: "/tools/jwt",
    category: "Crypto",
  },
  {
    icon: Image,
    name: "Image Steganography",
    description: "Hide and extract data within images",
    path: "/tools/stego-image",
    category: "Forensics",
  },
  {
    icon: Music,
    name: "Audio Steganography",
    description: "Embed secret data in audio files",
    path: "/tools/stego-audio",
    category: "Forensics",
  },
  {
    icon: FileSearch,
    name: "Steganography Extractor",
    description: "Extract hidden data from media files",
    path: "/tools/stego-extract",
    category: "Forensics",
  },
  {
    icon: FileImage,
    name: "Image Metadata Viewer",
    description: "Analyze EXIF data and image metadata",
    path: "/tools/image-exif",
    category: "Forensics",
  },
  {
    icon: Mail,
    name: "Email Breach Check",
    description: "Check if email addresses have been compromised",
    path: "/tools/breach-check",
    category: "Intel",
  },
  {
    icon: SearchCode,
    name: "Google Dork Generator",
    description: "Generate advanced search queries for OSINT",
    path: "/tools/google-dorks",
    category: "Recon",
  },
  {
    icon: Network,
    name: "Packet Analyzer",
    description: "Capture and analyze network traffic packets",
    path: "/tools/packet-analyzer",
    category: "Network",
  }
];

  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(tools.length / PAGE_SIZE);

  const paginatedTools = tools.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);


  return (
    <CyberpunkCard title="SECURITY TOOLS">
      <div className="grid md:grid-cols-2 gap-4">
        {paginatedTools.map((tool) => (
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
      {/* Pagination Controls */}
      <div className="flex justify-center gap-2 pt-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 bg-cyber-cyan text-black rounded disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-cyber-cyan px-2 py-1">{page}/{totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-1 bg-cyber-cyan text-black rounded disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </CyberpunkCard>
  );
};


export default Tools;
