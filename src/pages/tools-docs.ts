import { Scan, Activity, Monitor, Globe, Search, Server, ArrowLeftRight, MapPin, FolderSearch, Bug, Zap, ShieldAlert, Database, Container, Boxes, Hash, Key, Lock, Shield, Image, Music, Video, FileSearch, FileImage, Mail, SearchCode, Network } from "lucide-react";

export type ToolId = 
  | "port-scanner"
  | "service-detection"
  | "os-fingerprint"
  | "subdomains"
  | "whois"
  | "dns-recon"
  | "reverse-ip"
  | "ip-geo"
  | "dir-fuzzer"
  | "vuln-fuzzer"
  | "api-scanner"
  | "broken-auth"
  | "s3-finder"
  | "container-scan"
  | "k8s-enum"
  | "hash-cracker"
  | "ciphers"
  | "rsa-aes"
  | "jwt"
  | "stego-image"
  | "stego-audio"
  | "stego-video"
  | "stego-doc"
  | "image-exif"
  | "breach-check"
  | "google-dorks"
  | "packet-analyzer"
  | "packet-capturer";

export interface ToolMeta {
  id: ToolId;
  icon: any;
  name: string;
  description: string;
  path: string;
  category: "Network" | "Recon" | "Web" | "Cloud" | "Crypto" | "Forensics" | "Intel";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

export const TOOLS_META: ToolMeta[] = [
  {
    id: "port-scanner",
    icon: Scan,
    name: "Port Scanner",
    description: "Scan networks for open ports and services",
    path: "/tools/port-scanner",
    category: "Network",
    difficulty: "Beginner"
  },
  {
    id: "service-detection",
    icon: Activity,
    name: "Service Detection",
    description: "Identify running services and version information",
    path: "/tools/service-detect",
    category: "Network",
    difficulty: "Beginner"
  },
  {
    id: "os-fingerprint",
    icon: Monitor,
    name: "OS Fingerprinting",
    description: "Detect operating system and device information",
    path: "/tools/os-fingerprint",
    category: "Network",
    difficulty: "Intermediate"
  },
  {
    id: "subdomains",
    icon: Globe,
    name: "Subdomain Enumeration",
    description: "Discover subdomains and map attack surface",
    path: "/tools/subdomains",
    category: "Recon",
    difficulty: "Beginner"
  },
  {
    id: "whois",
    icon: Search,
    name: "WHOIS Lookup",
    description: "Query domain registration and ownership data",
    path: "/tools/whois",
    category: "Recon",
    difficulty: "Beginner"
  },
  {
    id: "dns-recon",
    icon: Server,
    name: "DNS Reconnaissance",
    description: "Enumerate DNS records and zone information",
    path: "/tools/dns-recon",
    category: "Recon",
    difficulty: "Intermediate"
  },
  {
    id: "reverse-ip",
    icon: ArrowLeftRight,
    name: "Reverse IP Lookup",
    description: "Find domains hosted on the same IP address",
    path: "/tools/reverse-ip",
    category: "Network",
    difficulty: "Intermediate"
  },
  {
    id: "ip-geo",
    icon: MapPin,
    name: "IP Geolocation",
    description: "Trace IP addresses to physical locations",
    path: "/tools/ip-geo",
    category: "Network",
    difficulty: "Beginner"
  },
  {
    id: "dir-fuzzer",
    icon: FolderSearch,
    name: "Directory Fuzzer",
    description: "Discover hidden directories and files",
    path: "/tools/dir-fuzzer",
    category: "Web",
    difficulty: "Intermediate"
  },
  {
    id: "vuln-fuzzer",
    icon: Bug,
    name: "Vulnerability Fuzzer",
    description: "Test for common web vulnerabilities",
    path: "/tools/vuln-fuzzer",
    category: "Web",
    difficulty: "Advanced"
  },
  {
    id: "api-scanner",
    icon: Zap,
    name: "API Scanner",
    description: "Scan APIs for security misconfigurations",
    path: "/tools/api-scanner",
    category: "Web",
    difficulty: "Advanced"
  },
  {
    id: "broken-auth",
    icon: ShieldAlert,
    name: "Broken Authentication",
    description: "Test authentication and session management",
    path: "/tools/broken-auth",
    category: "Web",
    difficulty: "Advanced"
  },
  {
    id: "s3-finder",
    icon: Database,
    name: "S3 Bucket Finder",
    description: "Discover exposed AWS S3 storage buckets",
    path: "/tools/s3-finder",
    category: "Cloud",
    difficulty: "Intermediate"
  },
  {
    id: "container-scan",
    icon: Container,
    name: "Container Scanner",
    description: "Audit Docker containers for vulnerabilities",
    path: "/tools/container-scan",
    category: "Cloud",
    difficulty: "Intermediate"
  },
  {
    id: "k8s-enum",
    icon: Boxes,
    name: "Kubernetes Enumeration",
    description: "Enumerate K8s clusters and configurations",
    path: "/tools/k8s-enum",
    category: "Cloud",
    difficulty: "Advanced"
  },
  {
    id: "hash-cracker",
    icon: Hash,
    name: "Hash Cracker",
    description: "Crack and identify cryptographic hashes",
    path: "/tools/hash-cracker",
    category: "Crypto",
    difficulty: "Intermediate"
  },
  {
    id: "ciphers",
    icon: Key,
    name: "Cipher Tool",
    description: "Encode, decode, and analyze classical ciphers",
    path: "/tools/ciphers",
    category: "Crypto",
    difficulty: "Beginner"
  },
  {
    id: "rsa-aes",
    icon: Lock,
    name: "RSA/AES Tool",
    description: "Encrypt and decrypt using RSA and AES",
    path: "/tools/rsa-aes",
    category: "Crypto",
    difficulty: "Intermediate"
  },
  {
    id: "jwt",
    icon: Shield,
    name: "JWT Decoder",
    description: "Decode and analyze JSON Web Tokens",
    path: "/tools/jwt",
    category: "Crypto",
    difficulty: "Beginner"
  },
  {
    id: "stego-image",
    icon: Image,
    name: "Image Steganography",
    description: "Hide and extract data within images",
    path: "/tools/stego-image",
    category: "Forensics",
    difficulty: "Intermediate"
  },
  {
    id: "stego-audio",
    icon: Music,
    name: "Audio Steganography",
    description: "Embed secret data in audio files",
    path: "/tools/stego-audio",
    category: "Forensics",
    difficulty: "Intermediate"
  },
  {
    id: "stego-video",
    icon: Video,
    name: "Video Steganography",
    description: "Extract hidden data from video files",
    path: "/tools/stego-video",
    category: "Forensics",
    difficulty: "Advanced"
  },
  {
    id: "stego-doc",
    icon: FileSearch,
    name: "Document Steganography",
    description: "Extract hidden data from document files",
    path: "/tools/stego-doc",
    category: "Forensics",
    difficulty: "Intermediate"
  },
  {
    id: "image-exif",
    icon: FileImage,
    name: "Image Metadata Viewer",
    description: "Analyze EXIF data and image metadata",
    path: "/tools/image-exif",
    category: "Forensics",
    difficulty: "Beginner"
  },
  {
    id: "breach-check",
    icon: Mail,
    name: "Email Breach Check",
    description: "Check if email addresses have been compromised",
    path: "/tools/breach-check",
    category: "Intel",
    difficulty: "Beginner"
  },
  {
    id: "google-dorks",
    icon: SearchCode,
    name: "Google Dork Generator",
    description: "Generate advanced search queries for OSINT",
    path: "/tools/google-dorks",
    category: "Recon",
    difficulty: "Intermediate"
  },
  {
    id: "packet-analyzer",
    icon: Network,
    name: "Packet Analyzer",
    description: "Analyze network traffic packets",
    path: "/tools/packet-analyzer",
    category: "Network",
    difficulty: "Advanced"
  },
  {
    id: "packet-capturer",
    icon: Network,
    name: "Packet Capturer",
    description: "Capture and download network traffic packets",
    path: "/tools/packet-capturer",
    category: "Network",
    difficulty: "Advanced"
  }
];

export interface ToolDetails {
  usage: string;
  details: string;
  example?: string;
  warning?: string;
  prerequisites?: string[];
  outputs?: string[];
}

export const TOOLS_DETAILS: Record<ToolId, ToolDetails> = {
  "port-scanner": {
    usage: "Enter target IP address or hostname in the target field. Specify port range (e.g., 1-1000 or 80,443,8080). Select TCP and/or UDP protocols. Adjust timeout and concurrency settings for faster/slower scans. Click 'Start Scan' to begin.",
    details: "Identifies which network ports are open on a target system. Essential for network reconnaissance and security auditing. Open ports can indicate running services that may have vulnerabilities.",
    outputs: ["Open ports list", "Service names (if detectable)", "Response times", "Port status (open/filtered/closed)"],
    warning: "Only scan systems you own or have explicit permission to test. Unauthorized scanning may be illegal.",
    prerequisites: ["Target IP or hostname", "Network connectivity to target"]
  },
  "service-detection": {
    usage: "Enter target IP address. Optionally specify which ports to check (defaults to common ports). Tool will probe each open port and attempt to identify the service name and version number running on it.",
    details: "Detects what software is running on open ports (e.g., Apache web server, SSH daemon, MySQL database). Helps identify outdated versions with known vulnerabilities.",
    outputs: ["Service name", "Version number", "Banner information", "Confidence level"],
    example: "Port 80: Apache httpd 2.4.41\nPort 22: OpenSSH 7.9"
  },
  "os-fingerprint": {
    usage: "Enter target IP address in the input field. Tool analyzes network responses (TCP/IP stack behavior, TTL values, window sizes) to determine the operating system. Results show OS type, version, and confidence level.",
    details: "Uses TCP/IP stack characteristics to identify if target is Windows, Linux, macOS, etc. Different operating systems have unique network signatures that can be detected.",
    outputs: ["OS family (Windows/Linux/macOS)", "Version/Release", "Kernel version (for Linux)", "Confidence percentage"],
    warning: "Firewalls and packet filtering can affect accuracy. Results are educated guesses, not guarantees."
  },
  "subdomains": {
    usage: "Enter a root domain name (e.g., example.com) without http://. Tool will use DNS queries and wordlists to find active subdomains like mail.example.com, dev.example.com, api.example.com. Results show IP addresses and status.",
    details: "Discovers hidden subdomains that may contain forgotten or vulnerable services. Organizations often have many subdomains for different purposes (mail, admin, staging) that may be less secured.",
    outputs: ["Subdomain list", "IP addresses", "HTTP status codes (if web servers)", "DNS record types"],
    example: "Found 23 subdomains:\n- mail.example.com (192.168.1.10)\n- dev.example.com (192.168.1.20)\n- admin.example.com (192.168.1.30)"
  },
  "whois": {
    usage: "Enter a domain name (e.g., example.com) in the query field. Tool retrieves public registration information including registrar, registration/expiration dates, nameservers, and registrant contact details if not privacy-protected.",
    details: "Reveals who registered a domain, when it expires, and technical contact information. Useful for OSINT investigations, domain research, and identifying related infrastructure.",
    outputs: ["Registrar", "Registration/Expiration dates", "Nameservers", "Registrant contact (if public)", "Domain status"],
    warning: "WHOIS data may be redacted due to privacy protection services (GDPR)."
  },
  "dns-recon": {
    usage: "Enter domain name to query. Tool automatically retrieves all DNS record types: A records (IP addresses), MX records (mail servers), TXT records (SPF, DKIM), NS records (nameservers), CNAME records, and more. Export results for analysis.",
    details: "Maps all DNS records for a domain, revealing mail servers, subdomains, and network configurations. DNS records contain valuable information about an organization's infrastructure.",
    outputs: ["A/AAAA records (IPs)", "MX records (mail servers)", "TXT records (SPF, DKIM)", "NS records", "CNAME records", "SOA records"],
    example: "MX records:\n- 10 mail.example.com\n- 20 backupmail.example.com"
  },
  "reverse-ip": {
    usage: "Enter an IP address in the input field. Tool queries databases to discover all domains pointing to that IP address. Useful for finding websites on shared hosting or identifying related infrastructure owned by same entity.",
    details: "Useful for finding related websites or discovering shared hosting environments. Multiple domains on one IP often indicates shared hosting or related organizations.",
    outputs: ["Domain list", "Hosting provider", "Name servers", "SSL certificates (if any)"],
    example: "IP 192.168.1.100 hosts:\n- example.com\n- test.com\n- staging.internal"
  },
  "ip-geo": {
    usage: "Enter an IP address or use 'auto' to check your own IP. Tool looks up the IP in geolocation databases and displays country, region, city, ISP name, organization, latitude/longitude coordinates, and timezone.",
    details: "Determines approximate physical location of an IP address using geolocation databases maintained by companies like MaxMind. Accuracy varies but typically accurate to city level.",
    outputs: ["Country", "Region/State", "City", "ISP", "Organization", "Coordinates", "Timezone"],
    warning: "Geolocation is approximate. VPNs and proxies will show different locations."
  },
  "dir-fuzzer": {
    usage: "Enter the website URL (e.g., https://example.com). Tool tests thousands of common directory and file names (admin, backup, config, .git, etc.) looking for accessible resources. Results show found paths with HTTP status codes.",
    details: "Brute-forces common directory/file names to discover hidden web resources like admin panels, backup files, configuration files, or development directories that shouldn't be publicly accessible.",
    outputs: ["Found directories", "Found files", "HTTP status codes", "Response sizes"],
    warning: "Can generate significant traffic. Use responsibly and only on authorized targets.",
    example: "Found:\n- /admin (401 Unauthorized)\n- /backup.zip (200 OK, 15MB)\n- /.git/ (403 Forbidden)"
  },
  "vuln-fuzzer": {
    usage: "Enter target website URL. Tool automatically sends test payloads to detect SQL injection, cross-site scripting (XSS), command injection, path traversal, and other common vulnerabilities. Review findings and severity levels in results.",
    details: "Sends malicious payloads to detect security flaws like injection attacks. Tests for OWASP Top 10 vulnerabilities including SQL injection, XSS, and insecure configurations.",
    outputs: ["Vulnerability type", "Parameter affected", "Payload used", "Confidence level", "CVSS score approximation"],
    warning: "This tool sends potentially harmful payloads. Only use on systems you own or have explicit permission to test.",
    prerequisites: ["Web application URL", "Optional: authentication cookies/tokens"]
  },
  "api-scanner": {
    usage: "Enter API base URL (e.g., https://api.example.com). Optionally provide API key if authentication is required. Tool discovers endpoints, tests authentication mechanisms, checks for rate limiting, and identifies exposed sensitive data.",
    details: "Identifies exposed API endpoints, weak authentication, and common API security issues like lack of rate limiting, verbose error messages, or exposed sensitive data in responses.",
    outputs: ["Discovered endpoints", "Authentication issues", "Rate limiting status", "Sensitive data exposure", "CORS misconfigurations"],
    warning: "Scanning APIs can trigger rate limiting or account lockouts. Use test accounts when possible."
  },
  "broken-auth": {
    usage: "Enter the login page URL, a test username, and test password. Tool attempts various authentication bypass techniques, tests password policies, checks for weak session management, and identifies authentication vulnerabilities.",
    details: "Checks for broken authentication including weak password requirements, predictable session tokens, insecure password reset mechanisms, and vulnerable login implementations.",
    outputs: ["Password policy strength", "Session token analysis", "Login bypass results", "Password reset flaws", "MFA implementation issues"],
    warning: "Multiple failed login attempts may lock accounts. Use test accounts."
  },
  "s3-finder": {
    usage: "Enter company name, brand, or keyword. Tool generates common S3 bucket naming patterns (company-backup, company-assets, company-data) and checks if they exist and are publicly accessible. Lists found buckets with permission status.",
    details: "Finds misconfigured AWS S3 buckets that may leak sensitive data or allow unauthorized access. Many organizations inadvertently expose backup files, logs, or customer data through misconfigured S3 permissions.",
    outputs: ["Bucket names", "Public/Private status", "File listing (if public)", "Region", "Owner (if discoverable)"],
    example: "Public buckets found:\n- company-backups (contains database backups)\n- company-media (contains user uploads)"
  },
  "container-scan": {
    usage: "Enter Docker image name with tag (e.g., nginx:latest, ubuntu:20.04). Tool pulls image metadata and scans for known CVEs (security vulnerabilities), outdated packages, hardcoded secrets, and security misconfigurations. View detailed vulnerability reports.",
    details: "Analyzes Docker images for security vulnerabilities and compliance issues. Checks base images and installed packages against vulnerability databases to identify security risks.",
    outputs: ["CVE list with severity", "Outdated packages", "Hardcoded secrets found", "Base image issues", "Remediation suggestions"],
    warning: "Large images may take time to analyze. Ensure Docker daemon is accessible."
  },
  "k8s-enum": {
    usage: "Enter Kubernetes API server endpoint URL (e.g., https://cluster.example.com:6443). Provide authentication token if required. Tool lists all accessible pods, services, deployments, configmaps, secrets, and identifies security misconfigurations.",
    details: "Discovers Kubernetes cluster resources and identifies security misconfigurations like exposed dashboards, overly permissive RBAC roles, or containers running as root.",
    outputs: ["Pods with security context", "Services (including NodePort/LoadBalancer)", "ConfigMaps and Secrets (if accessible)", "RBAC permissions", "Security misconfigurations"],
    warning: "Requires appropriate Kubernetes access. Only use on clusters you own."
  },
  "hash-cracker": {
    usage: "Paste one or more hash values (MD5, SHA1, SHA256, bcrypt, etc.) into the input field, one per line. Tool automatically detects hash types, searches rainbow tables, and attempts dictionary attacks to find plaintext values.",
    details: "Identifies hash types and attempts to reverse them using rainbow tables and dictionaries. Common for recovering passwords from leaked database dumps or CTF challenges.",
    outputs: ["Hash type detected", "Cracked plaintext (if found)", "Time taken", "Method used"],
    warning: "Only crack hashes you own or have permission to test. Use strong passwords to protect your own data."
  },
  "ciphers": {
    usage: "Select cipher type from dropdown (Caesar, Vigenere, ROT13, Atbash, etc.). Choose encode or decode operation. Enter your text message. For keyed ciphers like Vigenere, enter the key. Click process to see results.",
    details: "Works with classical ciphers like Caesar, Vigenere, ROT13. Great for CTF challenges, cryptography learning, and solving historical ciphers. Includes frequency analysis tools.",
    outputs: ["Encoded/Decoded text", "Frequency analysis", "Possible keys (for automatic cracking)"],
    example: "Caesar shift 3: HELLO → KHOOR"
  },
  "rsa-aes": {
    usage: "For RSA: Generate public/private key pairs, then encrypt messages with public key and decrypt with private key. For AES: Choose key size (128/192/256 bit), generate symmetric key, encrypt/decrypt messages. Copy and save keys securely.",
    details: "Modern encryption tool supporting RSA (public-key/asymmetric) for secure key exchange and AES (symmetric) for fast bulk encryption. Industry-standard algorithms used in HTTPS, VPNs, and secure communications.",
    outputs: ["Generated keys (PEM format)", "Encrypted/Decrypted data", "Key fingerprints/hashes"],
    warning: "Keep private keys secure. Never share them. Use appropriate key sizes for your security needs."
  },
  "jwt": {
    usage: "Paste JWT token (format: header.payload.signature) into the input field. Tool automatically decodes the header and payload (base64), displays claims like user ID, expiration time, and issuer. If you have the secret key, provide it to validate the signature.",
    details: "Decodes JWT tokens used in web authentication. Reveals claims and helps test security. JWTs are commonly used for API authentication and session management in modern web applications.",
    outputs: ["Header (algorithm, type)", "Payload claims", "Signature validation status", "Expiration status"],
    example: "Header: { 'alg': 'HS256', 'typ': 'JWT' }\nPayload: { 'user': 'admin', 'exp': 1640995200 }"
  },
  "stego-image": {
    usage: "To Hide: Upload cover image (PNG/JPEG), enter secret message text, optionally set password for encryption, click hide. Download resulting stego image. To Extract: Upload stego image, enter password if used, click extract to reveal hidden message.",
    details: "Embeds secret data in image pixels using LSB (Least Significant Bit) technique. Data is invisible to naked eye but can be extracted with this tool. Useful for covert communication.",
    outputs: ["Stego image (PNG format)", "Extracted message", "Success/failure status"],
    warning: "Compression may destroy hidden data. Use lossless formats (PNG, BMP) not JPEG."
  },
  "stego-audio": {
    usage: "To Hide: Upload WAV audio file, type secret message, optionally add password protection, generate stego audio. To Extract: Upload the stego audio file, provide password if set, extract to retrieve hidden message. Works only with WAV format.",
    details: "Hides data in audio file samples using LSB technique. Imperceptible to human hearing, works with WAV format. Audio quality remains unchanged while carrying hidden payload.",
    outputs: ["Stego audio (WAV)", "Extracted message"],
    prerequisites: ["WAV format audio file"],
    warning: "MP3 compression will destroy hidden data. Use WAV only."
  },
  "stego-video": {
    usage: "To Hide: Upload video file (MP4/WebM), enter secret message, optionally encrypt with password, generate stego video. To Extract: Upload stego video, provide password if encrypted, extract hidden data. Video plays normally but contains hidden message.",
    details: "Embeds data in video file metadata. Useful for covert communication and data exfiltration. Video quality and playback remain normal while carrying hidden information.",
    outputs: ["Stego video", "Extracted message"],
    warning: "Video re-encoding may remove hidden data. Use original formats."
  },
  "stego-doc": {
    usage: "To Hide: Upload document (PDF/DOC/DOCX/ODT/TXT), enter secret message, optionally add password, generate stego document. To Extract: Upload stego document, provide password if encrypted, click extract. Uses whitespace encoding for text files.",
    details: "Uses whitespace and metadata to hide data in documents. Works with multiple formats including PDF, Word, and plain text. Hidden data survives document viewing and editing.",
    outputs: ["Stego document", "Extracted message"],
    warning: "Some document viewers may strip whitespace or metadata."
  },
  "image-exif": {
    usage: "Upload image file (JPEG/PNG/TIFF). Tool extracts all metadata including: camera make/model, photo settings (ISO, aperture, shutter speed), GPS coordinates (if available), timestamp, software used, and thumbnail. View GPS location on map if embedded.",
    details: "Reveals hidden metadata in photos including GPS coordinates showing exactly where photo was taken - major privacy risk! Also shows camera info, edit history, and creation date. Essential for digital forensics.",
    outputs: ["Camera make/model", "Settings (ISO, aperture, shutter)", "GPS coordinates", "Timestamp", "Software used", "Thumbnail preview"],
    warning: "Social media platforms often strip EXIF data when uploading. Original files retain metadata."
  },
  "breach-check": {
    usage: "Enter email address in the search field. Tool checks against databases of known data breaches (HaveIBeenPwned, leaked credential dumps). Results show which breaches exposed your email, when they occurred, what data was compromised (passwords, credit cards, etc.).",
    details: "Searches data breach databases to see if your credentials have been exposed online in security breaches. If found, immediately change passwords on affected accounts.",
    outputs: ["Breach names", "Dates of breaches", "Data exposed", "Password change recommendations"],
    warning: "Use responsibly. Don't check emails without consent. Results may be disturbing."
  },
  "google-dorks": {
    usage: "Use custom builder to combine operators: site: (specific domain), filetype: (document type), intitle: (page title), inurl: (URL contains), intext: (page content). Or choose from pre-made templates. Click 'Generate Dork' then 'Search Google' or 'OSINT Scrape' to find results.",
    details: "Creates Google search queries to find exposed files, login pages, and sensitive information. Combines search operators to discover publicly accessible but not easily findable resources like backup files, configuration files, or database dumps.",
    outputs: ["Generated Google search URL", "Found results (when scraped)", "Filtered by type"],
    example: "site:example.com filetype:pdf confidential\nsite:example.com inurl:admin\nintitle:'index of' 'backup'",
    warning: "Automated Google searches may trigger CAPTCHAs. Use responsibly."
  },
  "packet-analyzer": {
    usage: "Upload PCAP/PCAPNG capture file or paste packet data. Tool parses network traffic, identifies protocols (HTTP, DNS, TCP, UDP), extracts source/destination IPs and ports, displays packet contents, and generates statistics about traffic patterns and anomalies.",
    details: "Parses network capture files to understand traffic flow and identify security issues like unencrypted credentials, suspicious connections, or malware communication. Compatible with Wireshark capture files.",
    outputs: ["Protocol hierarchy", "Top talkers (IPs)", "Conversation list", "Packet details", "Anomaly detection", "Extracted files"],
    prerequisites: ["PCAP/PCAPNG file"],
    warning: "Large captures may take time to analyze. Contains potentially sensitive network data."
  },
  "packet-capturer": {
    usage: "Select network interface from dropdown (WiFi, Ethernet, etc.). Optionally enter BPF filter (e.g., 'tcp port 80' or 'host 192.168.1.1') to capture specific traffic. Click 'Start Capture' to begin recording packets. Click 'Stop' when done, then download as PCAP file for analysis in Wireshark.",
    details: "Live packet capture tool. Creates PCAP files for analysis in Wireshark or similar tools. Useful for network troubleshooting, security analysis, and understanding network protocols. Requires appropriate network permissions.",
    outputs: ["PCAP file download", "Packet statistics during capture", "Live packet view"],
    prerequisites: ["Network interface access", "Administrator/root privileges (on some systems)"],
    warning: "Capturing network traffic may be restricted by law or policy. Only capture traffic on networks you own or have permission to monitor."
  }
};

export const TOOL_CATEGORIES = {
  Network: {
    description: "Tools for network discovery, scanning, and analysis",
    icon: Network
  },
  Recon: {
    description: "Information gathering and reconnaissance tools",
    icon: Search
  },
  Web: {
    description: "Web application security testing tools",
    icon: Globe
  },
  Cloud: {
    description: "Cloud infrastructure security assessment",
    icon: Database
  },
  Crypto: {
    description: "Cryptography tools for encryption and analysis",
    icon: Lock
  },
  Forensics: {
    description: "Digital forensics and steganography tools",
    icon: FileSearch
  },
  Intel: {
    description: "Threat intelligence and OSINT tools",
    icon: Mail
  }
};