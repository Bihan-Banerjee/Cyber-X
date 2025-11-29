import { Link } from "react-router-dom";
import { useState } from "react";
import CyberpunkCard from "@/components/CyberpunkCard";
import { Input } from "@/components/ui/input";
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
  Video,
  Mail,
  SearchCode,
  Network,
  ArrowUpDown,
  Filter,
} from "lucide-react";

const PAGE_SIZE = 8;

type SortField = "name" | "category";
type SortDirection = "asc" | "desc";

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
      icon: Video,
      name: "Video Steganography",
      description: "Extract hidden data from video files",
      path: "/tools/stego-video",
      category: "Forensics",
    },
    {
      icon: FileSearch,
      name: "Document Steganography",
      description: "Extract hidden data from document files",
      path: "/tools/stego-doc",
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
      description: "Capture and analyze network traffic packets (Work in Progress)",
      path: "/tools/packet-analyzer",
      category: "Network",
    },
  ];

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(
    new Set(["Network", "Recon", "Web", "Cloud", "Crypto", "Forensics", "Intel"])
  );

  // Get unique categories
  const categories = Array.from(new Set(tools.map((t) => t.category))).sort();

  // Toggle category filter
  const toggleCategoryFilter = (category: string) => {
    const newFilters = new Set(categoryFilters);
    if (newFilters.has(category)) {
      newFilters.delete(category);
    } else {
      newFilters.add(category);
    }
    setCategoryFilters(newFilters);
    setPage(1); // Reset to first page
  };

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 text-cyber-red">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Network: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      Recon: "bg-green-500/20 text-green-400 border-green-500/50",
      Web: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      Cloud: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
      Crypto: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      Forensics: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      Intel: "bg-pink-500/20 text-pink-400 border-pink-500/50",
    };
    return colors[category] || "bg-gray-500/20 text-gray-400 border-gray-500/50";
  };

  // Filter and sort tools
  const getProcessedTools = () => {
    let processed = [...tools];

    // Apply search filter
    if (searchQuery) {
      processed = processed.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (categoryFilters.size > 0) {
      processed = processed.filter((tool) => categoryFilters.has(tool.category));
    }

    // Sort tools
    processed.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return processed;
  };

  const processedTools = getProcessedTools();
  const totalPages = Math.ceil(processedTools.length / PAGE_SIZE);
  const paginatedTools = processedTools.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <CyberpunkCard title="SECURITY TOOLS">
      <div className="space-y-6">
        {/* Controls Section */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search tools by name, description, or category..."
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              SORT BY:
            </span>
            <button
              onClick={() => handleSort("name")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                sortField === "name"
                  ? "bg-cyber-cyan text-black font-bold"
                  : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
              }`}
            >
              Name{getSortIcon("name")}
            </button>
            <button
              onClick={() => handleSort("category")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                sortField === "category"
                  ? "bg-cyber-cyan text-black font-bold"
                  : "bg-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/30 border border-cyber-cyan/30"
              }`}
            >
              Category{getSortIcon("category")}
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-cyber-cyan tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" />
              CATEGORY:
            </span>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => toggleCategoryFilter(category)}
                className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                  categoryFilters.has(category)
                    ? getCategoryColor(category)
                    : "bg-gray-500/10 text-gray-500 border-gray-500/30 line-through"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Results Counter */}
          <div className="text-sm text-gray-400">
            Showing {paginatedTools.length} of {processedTools.length} tools
            {searchQuery && ` (filtered from ${tools.length} total)`}
          </div>
        </div>

        {/* Tools Grid */}
        {paginatedTools.length > 0 ? (
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h3 className="text-lg font-bold text-cyber-cyan tracking-wide truncate">
                        {tool.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded border flex-shrink-0 ${getCategoryColor(
                          tool.category
                        )}`}
                      >
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{tool.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No tools found matching your filters</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setCategoryFilters(new Set(categories));
                setPage(1);
              }}
              className="mt-4 px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan rounded transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 pt-6 border-t border-cyber-red/20">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-sm"
            >
              Prev
            </button>
            <span className="text-cyber-cyan px-3 py-2 font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </CyberpunkCard>
  );
};

export default Tools;
