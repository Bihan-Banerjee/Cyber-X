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

interface ToolInfo {
  icon: any;
  name: string;
  description: string;
  path: string;
  category: string;
  usage: string;
  details: string;
}

const Tools = () => {
  const tools: ToolInfo[] = [
    {
      icon: Scan,
      name: "Port Scanner",
      description: "Scan networks for open ports and services",
      path: "/tools/port-scanner",
      category: "Network",
      usage: "Enter target IP address or hostname in the target field. Specify port range (e.g., 1-1000 or 80,443,8080). Select TCP and/or UDP protocols. Adjust timeout and concurrency settings for faster/slower scans. Click 'Start Scan' to begin.",
      details: "Identifies which network ports are open on a target system. Essential for network reconnaissance and security auditing. Open ports can indicate running services that may have vulnerabilities.",
    },
    {
      icon: Activity,
      name: "Service Detection",
      description: "Identify running services and version information",
      path: "/tools/service-detect",
      category: "Network",
      usage: "Enter target IP address. Optionally specify which ports to check (defaults to common ports). Tool will probe each open port and attempt to identify the service name and version number running on it.",
      details: "Detects what software is running on open ports (e.g., Apache web server, SSH daemon, MySQL database). Helps identify outdated versions with known vulnerabilities.",
    },
    {
      icon: Monitor,
      name: "OS Fingerprinting",
      description: "Detect operating system and device information",
      path: "/tools/os-fingerprint",
      category: "Network",
      usage: "Enter target IP address in the input field. Tool analyzes network responses (TCP/IP stack behavior, TTL values, window sizes) to determine the operating system. Results show OS type, version, and confidence level.",
      details: "Uses TCP/IP stack characteristics to identify if target is Windows, Linux, macOS, etc. Different operating systems have unique network signatures that can be detected.",
    },
    {
      icon: Globe,
      name: "Subdomain Enumeration",
      description: "Discover subdomains and map attack surface",
      path: "/tools/subdomains",
      category: "Recon",
      usage: "Enter a root domain name (e.g., example.com) without http://. Tool will use DNS queries and wordlists to find active subdomains like mail.example.com, dev.example.com, api.example.com. Results show IP addresses and status.",
      details: "Discovers hidden subdomains that may contain forgotten or vulnerable services. Organizations often have many subdomains for different purposes (mail, admin, staging) that may be less secured.",
    },
    {
      icon: Search,
      name: "WHOIS Lookup",
      description: "Query domain registration and ownership data",
      path: "/tools/whois",
      category: "Recon",
      usage: "Enter a domain name (e.g., example.com) in the query field. Tool retrieves public registration information including registrar, registration/expiration dates, nameservers, and registrant contact details if not privacy-protected.",
      details: "Reveals who registered a domain, when it expires, and technical contact information. Useful for OSINT investigations, domain research, and identifying related infrastructure.",
    },
    {
      icon: Server,
      name: "DNS Reconnaissance",
      description: "Enumerate DNS records and zone information",
      path: "/tools/dns-recon",
      category: "Recon",
      usage: "Enter domain name to query. Tool automatically retrieves all DNS record types: A records (IP addresses), MX records (mail servers), TXT records (SPF, DKIM), NS records (nameservers), CNAME records, and more. Export results for analysis.",
      details: "Maps all DNS records for a domain, revealing mail servers, subdomains, and network configurations. DNS records contain valuable information about an organization's infrastructure.",
    },
    {
      icon: ArrowLeftRight,
      name: "Reverse IP Lookup",
      description: "Find domains hosted on the same IP address",
      path: "/tools/reverse-ip",
      category: "Network",
      usage: "Enter an IP address in the input field. Tool queries databases to discover all domains pointing to that IP address. Useful for finding websites on shared hosting or identifying related infrastructure owned by same entity.",
      details: "Useful for finding related websites or discovering shared hosting environments. Multiple domains on one IP often indicates shared hosting or related organizations.",
    },
    {
      icon: MapPin,
      name: "IP Geolocation",
      description: "Trace IP addresses to physical locations",
      path: "/tools/ip-geo",
      category: "Network",
      usage: "Enter an IP address or use 'auto' to check your own IP. Tool looks up the IP in geolocation databases and displays country, region, city, ISP name, organization, latitude/longitude coordinates, and timezone.",
      details: "Determines approximate physical location of an IP address using geolocation databases maintained by companies like MaxMind. Accuracy varies but typically accurate to city level.",
    },
    {
      icon: FolderSearch,
      name: "Directory Fuzzer",
      description: "Discover hidden directories and files",
      path: "/tools/dir-fuzzer",
      category: "Web",
      usage: "Enter the website URL (e.g., https://example.com). Tool tests thousands of common directory and file names (admin, backup, config, .git, etc.) looking for accessible resources. Results show found paths with HTTP status codes.",
      details: "Brute-forces common directory/file names to discover hidden web resources like admin panels, backup files, configuration files, or development directories that shouldn't be publicly accessible.",
    },
    {
      icon: Bug,
      name: "Vulnerability Fuzzer",
      description: "Test for common web vulnerabilities",
      path: "/tools/vuln-fuzzer",
      category: "Web",
      usage: "Enter target website URL. Tool automatically sends test payloads to detect SQL injection, cross-site scripting (XSS), command injection, path traversal, and other common vulnerabilities. Review findings and severity levels in results.",
      details: "Sends malicious payloads to detect security flaws like injection attacks. Tests for OWASP Top 10 vulnerabilities including SQL injection, XSS, and insecure configurations.",
    },
    {
      icon: Zap,
      name: "API Scanner",
      description: "Scan APIs for security misconfigurations",
      path: "/tools/api-scanner",
      category: "Web",
      usage: "Enter API base URL (e.g., https://api.example.com). Optionally provide API key if authentication is required. Tool discovers endpoints, tests authentication mechanisms, checks for rate limiting, and identifies exposed sensitive data.",
      details: "Identifies exposed API endpoints, weak authentication, and common API security issues like lack of rate limiting, verbose error messages, or exposed sensitive data in responses.",
    },
    {
      icon: ShieldAlert,
      name: "Broken Authentication",
      description: "Test authentication and session management",
      path: "/tools/broken-auth",
      category: "Web",
      usage: "Enter the login page URL, a test username, and test password. Tool attempts various authentication bypass techniques, tests password policies, checks for weak session management, and identifies authentication vulnerabilities.",
      details: "Checks for broken authentication including weak password requirements, predictable session tokens, insecure password reset mechanisms, and vulnerable login implementations.",
    },
    {
      icon: Database,
      name: "S3 Bucket Finder",
      description: "Discover exposed AWS S3 storage buckets",
      path: "/tools/s3-finder",
      category: "Cloud",
      usage: "Enter company name, brand, or keyword. Tool generates common S3 bucket naming patterns (company-backup, company-assets, company-data) and checks if they exist and are publicly accessible. Lists found buckets with permission status.",
      details: "Finds misconfigured AWS S3 buckets that may leak sensitive data or allow unauthorized access. Many organizations inadvertently expose backup files, logs, or customer data through misconfigured S3 permissions.",
    },
    {
      icon: Container,
      name: "Container Scanner",
      description: "Audit Docker containers for vulnerabilities",
      path: "/tools/container-scan",
      category: "Cloud",
      usage: "Enter Docker image name with tag (e.g., nginx:latest, ubuntu:20.04). Tool pulls image metadata and scans for known CVEs (security vulnerabilities), outdated packages, hardcoded secrets, and security misconfigurations. View detailed vulnerability reports.",
      details: "Analyzes Docker images for security vulnerabilities and compliance issues. Checks base images and installed packages against vulnerability databases to identify security risks.",
    },
    {
      icon: Boxes,
      name: "Kubernetes Enumeration",
      description: "Enumerate K8s clusters and configurations",
      path: "/tools/k8s-enum",
      category: "Cloud",
      usage: "Enter Kubernetes API server endpoint URL (e.g., https://cluster.example.com:6443). Provide authentication token if required. Tool lists all accessible pods, services, deployments, configmaps, secrets, and identifies security misconfigurations.",
      details: "Discovers Kubernetes cluster resources and identifies security misconfigurations like exposed dashboards, overly permissive RBAC roles, or containers running as root.",
    },
    {
      icon: Hash,
      name: "Hash Cracker",
      description: "Crack and identify cryptographic hashes",
      path: "/tools/hash-cracker",
      category: "Crypto",
      usage: "Paste one or more hash values (MD5, SHA1, SHA256, bcrypt, etc.) into the input field, one per line. Tool automatically detects hash types, searches rainbow tables, and attempts dictionary attacks to find plaintext values.",
      details: "Identifies hash types and attempts to reverse them using rainbow tables and dictionaries. Common for recovering passwords from leaked database dumps or CTF challenges.",
    },
    {
      icon: Key,
      name: "Cipher Tool",
      description: "Encode, decode, and analyze classical ciphers",
      path: "/tools/ciphers",
      category: "Crypto",
      usage: "Select cipher type from dropdown (Caesar, Vigenere, ROT13, Atbash, etc.). Choose encode or decode operation. Enter your text message. For keyed ciphers like Vigenere, enter the key. Click process to see results.",
      details: "Works with classical ciphers like Caesar, Vigenere, ROT13. Great for CTF challenges, cryptography learning, and solving historical ciphers. Includes frequency analysis tools.",
    },
    {
      icon: Lock,
      name: "RSA/AES Tool",
      description: "Encrypt and decrypt using RSA and AES",
      path: "/tools/rsa-aes",
      category: "Crypto",
      usage: "For RSA: Generate public/private key pairs, then encrypt messages with public key and decrypt with private key. For AES: Choose key size (128/192/256 bit), generate symmetric key, encrypt/decrypt messages. Copy and save keys securely.",
      details: "Modern encryption tool supporting RSA (public-key/asymmetric) for secure key exchange and AES (symmetric) for fast bulk encryption. Industry-standard algorithms used in HTTPS, VPNs, and secure communications.",
    },
    {
      icon: Shield,
      name: "JWT Decoder",
      description: "Decode and analyze JSON Web Tokens",
      path: "/tools/jwt",
      category: "Crypto",
      usage: "Paste JWT token (format: header.payload.signature) into the input field. Tool automatically decodes the header and payload (base64), displays claims like user ID, expiration time, and issuer. If you have the secret key, provide it to validate the signature.",
      details: "Decodes JWT tokens used in web authentication. Reveals claims and helps test security. JWTs are commonly used for API authentication and session management in modern web applications.",
    },
    {
      icon: Image,
      name: "Image Steganography",
      description: "Hide and extract data within images",
      path: "/tools/stego-image",
      category: "Forensics",
      usage: "To Hide: Upload cover image (PNG/JPEG), enter secret message text, optionally set password for encryption, click hide. Download resulting stego image. To Extract: Upload stego image, enter password if used, click extract to reveal hidden message.",
      details: "Embeds secret data in image pixels using LSB (Least Significant Bit) technique. Data is invisible to naked eye but can be extracted with this tool. Useful for covert communication.",
    },
    {
      icon: Music,
      name: "Audio Steganography",
      description: "Embed secret data in audio files",
      path: "/tools/stego-audio",
      category: "Forensics",
      usage: "To Hide: Upload WAV audio file, type secret message, optionally add password protection, generate stego audio. To Extract: Upload the stego audio file, provide password if set, extract to retrieve hidden message. Works only with WAV format.",
      details: "Hides data in audio file samples using LSB technique. Imperceptible to human hearing, works with WAV format. Audio quality remains unchanged while carrying hidden payload.",
    },
    {
      icon: Video,
      name: "Video Steganography",
      description: "Extract hidden data from video files",
      path: "/tools/stego-video",
      category: "Forensics",
      usage: "To Hide: Upload video file (MP4/WebM), enter secret message, optionally encrypt with password, generate stego video. To Extract: Upload stego video, provide password if encrypted, extract hidden data. Video plays normally but contains hidden message.",
      details: "Embeds data in video file metadata. Useful for covert communication and data exfiltration. Video quality and playback remain normal while carrying hidden information.",
    },
    {
      icon: FileSearch,
      name: "Document Steganography",
      description: "Extract hidden data from document files",
      path: "/tools/stego-doc",
      category: "Forensics",
      usage: "To Hide: Upload document (PDF/DOC/DOCX/ODT/TXT), enter secret message, optionally add password, generate stego document. To Extract: Upload stego document, provide password if encrypted, click extract. Uses whitespace encoding for text files.",
      details: "Uses whitespace and metadata to hide data in documents. Works with multiple formats including PDF, Word, and plain text. Hidden data survives document viewing and editing.",
    },
    {
      icon: FileImage,
      name: "Image Metadata Viewer",
      description: "Analyze EXIF data and image metadata",
      path: "/tools/image-exif",
      category: "Forensics",
      usage: "Upload image file (JPEG/PNG/TIFF). Tool extracts all metadata including: camera make/model, photo settings (ISO, aperture, shutter speed), GPS coordinates (if available), timestamp, software used, and thumbnail. View GPS location on map if embedded.",
      details: "Reveals hidden metadata in photos including GPS coordinates showing exactly where photo was taken - major privacy risk! Also shows camera info, edit history, and creation date. Essential for digital forensics.",
    },
    {
      icon: Mail,
      name: "Email Breach Check",
      description: "Check if email addresses have been compromised",
      path: "/tools/breach-check",
      category: "Intel",
      usage: "Enter email address in the search field. Tool checks against databases of known data breaches (HaveIBeenPwned, leaked credential dumps). Results show which breaches exposed your email, when they occurred, what data was compromised (passwords, credit cards, etc.).",
      details: "Searches data breach databases to see if your credentials have been exposed online in security breaches. If found, immediately change passwords on affected accounts.",
    },
    {
      icon: SearchCode,
      name: "Google Dork Generator",
      description: "Generate advanced search queries for OSINT",
      path: "/tools/google-dorks",
      category: "Recon",
      usage: "Use custom builder to combine operators: site: (specific domain), filetype: (document type), intitle: (page title), inurl: (URL contains), intext: (page content). Or choose from pre-made templates. Click 'Generate Dork' then 'Search Google' or 'OSINT Scrape' to find results.",
      details: "Creates Google search queries to find exposed files, login pages, and sensitive information. Combines search operators to discover publicly accessible but not easily findable resources like backup files, configuration files, or database dumps.",
    },
    {
      icon: Network,
      name: "Packet Analyzer",
      description: "Analyze network traffic packets",
      path: "/tools/packet-analyzer",
      category: "Network",
      usage: "Upload PCAP/PCAPNG capture file or paste packet data. Tool parses network traffic, identifies protocols (HTTP, DNS, TCP, UDP), extracts source/destination IPs and ports, displays packet contents, and generates statistics about traffic patterns and anomalies.",
      details: "Parses network capture files to understand traffic flow and identify security issues like unencrypted credentials, suspicious connections, or malware communication. Compatible with Wireshark capture files.",
    },
    {
      icon: Network,
      name: "Packet Capturer",
      description: "Capture and download network traffic packets",
      path: "/tools/packet-capturer",
      category: "Network",
      usage: "Select network interface from dropdown (WiFi, Ethernet, etc.). Optionally enter BPF filter (e.g., 'tcp port 80' or 'host 192.168.1.1') to capture specific traffic. Click 'Start Capture' to begin recording packets. Click 'Stop' when done, then download as PCAP file for analysis in Wireshark.",
      details: "Live packet capture tool. Creates PCAP files for analysis in Wireshark or similar tools. Useful for network troubleshooting, security analysis, and understanding network protocols. Requires appropriate network permissions.",
    },
  ];

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(
    new Set(["Network", "Recon", "Web", "Cloud", "Crypto", "Forensics", "Intel"])
  );
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

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
    setPage(1);
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

  // Handle mouse move for tooltip
  const handleMouseMove = (e: React.MouseEvent, toolPath: string) => {
    setHoveredTool(toolPath);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredTool(null);
  };

  // Filter and sort tools
  const getProcessedTools = () => {
    let processed = [...tools];

    if (searchQuery) {
      processed = processed.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilters.size > 0) {
      processed = processed.filter((tool) => categoryFilters.has(tool.category));
    }

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

  const hoveredToolData = tools.find((t) => t.path === hoveredTool);

  return (
    <>
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
                  onMouseMove={(e) => handleMouseMove(e, tool.path)}
                  onMouseLeave={handleMouseLeave}
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

      {/* Cyberpunk Tooltip */}
      {hoveredTool && hoveredToolData && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 10}px`,
            maxWidth: '420px',
          }}
        >
          <div className="bg-black/95 border border-cyber-cyan/40 rounded-lg p-4 shadow-2xl backdrop-blur-sm">
            <div className="border-b border-cyber-cyan/30 pb-2 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <hoveredToolData.icon className="w-5 h-5 text-cyber-cyan" />
                <h4 className="text-cyber-cyan font-bold text-sm tracking-wide">
                  {hoveredToolData.name}
                </h4>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(hoveredToolData.category)}`}>
                {hoveredToolData.category}
              </span>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-cyber-red font-bold mb-1 tracking-wide">⚡ HOW TO USE:</p>
                <p className="text-gray-300 leading-relaxed">{hoveredToolData.usage}</p>
              </div>
              
              <div>
                <p className="text-cyber-red font-bold mb-1 tracking-wide">📋 DETAILS:</p>
                <p className="text-gray-300 leading-relaxed">{hoveredToolData.details}</p>
              </div>
            </div>

            {/* Cyberpunk accent lines */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyber-cyan via-cyber-red to-cyber-cyan opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyber-red via-cyber-cyan to-cyber-red opacity-50"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default Tools;
