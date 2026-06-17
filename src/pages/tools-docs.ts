import { Scan, Activity, Monitor, Globe, Search, Server, ArrowLeftRight, MapPin, FolderSearch, Bug, Zap, ShieldAlert, Database, Container, Boxes, Hash, Key, Lock, Shield, Image, Music, Video, FileSearch, FileImage, Mail, SearchCode, Network, ShieldCheck, Terminal, FileCode, Binary, Fingerprint, Cpu, Smartphone, Wifi, Users, AlertTriangle, BookOpen, Code, Target, Eye } from "lucide-react";

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
  | "packet-capturer"
  | "base64-encoder"
  | "reverse-shell-generator"
  | "ssl-analyzer"
  | "http-header-analyzer"
  | "email-header-analyzer"
  | "cve-search"
  | "file-hash-calculator"
  | "password-generator"
  | "username-enumerator"
  | "malware-hash-lookup"
  | "sql-injection-tester"
  | "xss-payload-generator"
  | "website-tech-fingerprinter"
  | "cidr-calculator"
  | "wordlist-generator"
  | "json-beautifier"
  | "ct-log-search"
  | "spoofed-email-checker"
  | "ip-reputation-checker"
  | "url-encoder"
  | "hex-viewer"
  | "string-extractor"
  | "file-type-identifier"
  | "default-credentials-db"
  | "exploit-db-search"
  | "cookie-analyzer"
  | "ssrf-tester"
  | "csrf-poc-generator"
  | "traceroute"
  | "bgp-asn-lookup"
  | "pgp-key-generator"
  | "entropy-analyzer"
  | "phone-number-osint"
  | "domain-reputation"
  | "waf-bypass-generator"
  | "robots-txt-analyzer"
  | "number-base-converter"
  | "regex-tester"
  | "snmp-scanner"
  | "waf-detector"
  | "arp-host-discovery"
  | "password-strength-analyzer"
  | "bcrypt-generator"
  | "ssl-cert-decoder"
  | "xxe-payload-generator"
  | "open-redirect-finder"
  | "web-crawler"
  | "shodan-banner-grabber"
  | "log-analyzer"
  | "pdf-forensics"
  | "binary-analyzer"
  | "hash-identifier"
  | "mask-attack-builder"
  | "phishing-url-detector"
  | "epoch-converter"
  | "http-request-builder"
  | "apk-analyzer"
  | "wifi-handshake-cracker"
  | "azure-blob-finder"
  | "gcp-bucket-finder"
  | "rop-gadget-finder"
  | "buffer-overflow-calc"
  | "homoglyph-generator"
  | "dark-web-checker"
  | "disk-image-analyzer"
  | "adb-generator"
  | "bluetooth-scanner"
  | "company-osint"
  | "text-diff"
  | "aws-metadata-tester"
  | "cloud-iam-auditor"
  | "cloud-asset-enumerator"
  | "mobile-permission-auditor"
  | "evil-twin-detector"
  | "social-media-osint"
  | "pastebin-monitor"
  | "code-obfuscator"
  | "credential-checker"
  | "payload-encoder"
  | "xxe-ssti-library";

export interface ToolMeta {
  id: ToolId;
  icon: any;
  name: string;
  description: string;
  path: string;
  category: "Network" | "Recon" | "Web" | "Cloud" | "Crypto" | "Forensics" | "Intel" | "Exploitation" | "Password" | "Social Engineering" | "Utilities" | "Mobile" | "Wireless";
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
  },
  // P1 tools
  { id: "base64-encoder", icon: Code, name: "Base64 Encoder", description: "Encode and decode Base64, Hex, URL, and Binary formats", path: "/tools/base64-encoder", category: "Crypto", difficulty: "Beginner" },
  { id: "reverse-shell-generator", icon: Terminal, name: "Reverse Shell Generator", description: "Generate reverse shell payloads for 13+ languages", path: "/tools/reverse-shell", category: "Exploitation", difficulty: "Intermediate" },
  { id: "ssl-analyzer", icon: ShieldCheck, name: "SSL/TLS Analyzer", description: "Inspect certificate chain, cipher suites, and TLS misconfigs", path: "/tools/ssl-analyzer", category: "Network", difficulty: "Intermediate" },
  { id: "http-header-analyzer", icon: Globe, name: "HTTP Header Analyzer", description: "Audit security headers and HTTP response details", path: "/tools/http-headers", category: "Web", difficulty: "Beginner" },
  { id: "email-header-analyzer", icon: Mail, name: "Email Header Analyzer", description: "Parse email headers and trace SPF/DKIM/DMARC hops", path: "/tools/email-headers", category: "Social Engineering", difficulty: "Intermediate" },
  { id: "cve-search", icon: AlertTriangle, name: "CVE Search", description: "Search the NVD for CVEs by keyword or product", path: "/tools/cve-search", category: "Intel", difficulty: "Beginner" },
  { id: "file-hash-calculator", icon: Hash, name: "File Hash Calculator", description: "Compute MD5, SHA1, SHA256, SHA512 for any file", path: "/tools/file-hash", category: "Forensics", difficulty: "Beginner" },
  { id: "password-generator", icon: Key, name: "Password Generator", description: "Generate cryptographically secure passwords with entropy scoring", path: "/tools/password-gen", category: "Password", difficulty: "Beginner" },
  // P2 tools
  { id: "username-enumerator", icon: Search, name: "Username Enumerator", description: "Check username existence across 16 social platforms", path: "/tools/username-enum", category: "Recon", difficulty: "Beginner" },
  { id: "malware-hash-lookup", icon: Bug, name: "Malware Hash Lookup", description: "Check file hashes against MalwareBazaar and VirusTotal", path: "/tools/malware-hash", category: "Intel", difficulty: "Beginner" },
  { id: "sql-injection-tester", icon: Database, name: "SQL Injection Tester", description: "Detect error-based, boolean-blind, and time-based SQLi", path: "/tools/sqli-test", category: "Web", difficulty: "Advanced" },
  { id: "xss-payload-generator", icon: Zap, name: "XSS Payload Generator", description: "Test for reflected XSS and browse context-specific payloads", path: "/tools/xss-test", category: "Web", difficulty: "Intermediate" },
  { id: "website-tech-fingerprinter", icon: Fingerprint, name: "Tech Fingerprinter", description: "Detect CMS, frameworks, CDN, and server technologies", path: "/tools/tech-fingerprint", category: "Recon", difficulty: "Beginner" },
  { id: "cidr-calculator", icon: Network, name: "CIDR Calculator", description: "Calculate subnet masks, host ranges, and network addresses", path: "/tools/cidr-calc", category: "Utilities", difficulty: "Beginner" },
  { id: "wordlist-generator", icon: FileSearch, name: "Wordlist Generator", description: "Generate targeted wordlists with leet, years, and suffix mutations", path: "/tools/wordlist-gen", category: "Password", difficulty: "Intermediate" },
  { id: "json-beautifier", icon: FileCode, name: "JSON Beautifier", description: "Format, validate, and minify JSON and XML", path: "/tools/json-beautifier", category: "Utilities", difficulty: "Beginner" },
  { id: "ct-log-search", icon: Search, name: "CT Log Search", description: "Discover subdomains via Certificate Transparency logs", path: "/tools/ct-search", category: "Recon", difficulty: "Beginner" },
  { id: "spoofed-email-checker", icon: Mail, name: "Email Spoof Checker", description: "Check SPF, DKIM, DMARC and domain spoofability", path: "/tools/email-spoof-check", category: "Social Engineering", difficulty: "Intermediate" },
  // P3 tools
  { id: "ip-reputation-checker", icon: Shield, name: "IP Reputation Checker", description: "Check IP abuse score, proxy, VPN, and Tor status", path: "/tools/ip-reputation", category: "Intel", difficulty: "Beginner" },
  { id: "url-encoder", icon: Code, name: "URL Encoder", description: "URL encode/decode, HTML entity, and Unicode escape utilities", path: "/tools/url-encoder", category: "Utilities", difficulty: "Beginner" },
  { id: "hex-viewer", icon: Binary, name: "Hex Viewer", description: "Classic hex dump with entropy analysis and MIME detection", path: "/tools/hex-view", category: "Forensics", difficulty: "Intermediate" },
  { id: "string-extractor", icon: FileSearch, name: "String Extractor", description: "Extract ASCII and Unicode strings from binary files", path: "/tools/string-extract", category: "Forensics", difficulty: "Intermediate" },
  { id: "file-type-identifier", icon: FileImage, name: "File Type Identifier", description: "Identify file types by magic bytes and flag disguised files", path: "/tools/file-type", category: "Forensics", difficulty: "Beginner" },
  { id: "default-credentials-db", icon: Database, name: "Default Credentials DB", description: "Searchable database of vendor default usernames and passwords", path: "/tools/default-creds", category: "Exploitation", difficulty: "Beginner" },
  { id: "exploit-db-search", icon: Bug, name: "Exploit-DB Search", description: "Search Exploit-DB for public exploits by keyword or CVE", path: "/tools/exploit-search", category: "Exploitation", difficulty: "Intermediate" },
  { id: "cookie-analyzer", icon: ShieldCheck, name: "Cookie Analyzer", description: "Audit cookies for HttpOnly, Secure, SameSite security flags", path: "/tools/cookie-analyze", category: "Web", difficulty: "Intermediate" },
  { id: "ssrf-tester", icon: Target, name: "SSRF Tester", description: "Test parameters for Server-Side Request Forgery vulnerabilities", path: "/tools/ssrf-test", category: "Web", difficulty: "Advanced" },
  { id: "csrf-poc-generator", icon: Code, name: "CSRF PoC Generator", description: "Generate self-submitting HTML forms for CSRF proof-of-concept", path: "/tools/csrf-poc", category: "Web", difficulty: "Intermediate" },
  { id: "traceroute", icon: Activity, name: "Traceroute", description: "Trace the network path to a host hop by hop", path: "/tools/traceroute", category: "Network", difficulty: "Beginner" },
  { id: "bgp-asn-lookup", icon: Globe, name: "BGP / ASN Lookup", description: "Look up ASN details, prefixes, peers, and upstreams", path: "/tools/asn-lookup", category: "Network", difficulty: "Intermediate" },
  { id: "pgp-key-generator", icon: Lock, name: "PGP Key Generator", description: "Generate PGP key pairs and encrypt/decrypt messages", path: "/tools/pgp-gen", category: "Crypto", difficulty: "Intermediate" },
  { id: "entropy-analyzer", icon: Activity, name: "Entropy Analyzer", description: "Compute Shannon entropy and character frequency of text", path: "/tools/entropy", category: "Crypto", difficulty: "Beginner" },
  { id: "phone-number-osint", icon: Smartphone, name: "Phone OSINT", description: "Validate and look up carrier, line type, and location for phone numbers", path: "/tools/phone-lookup", category: "Intel", difficulty: "Beginner" },
  { id: "domain-reputation", icon: Shield, name: "Domain Reputation", description: "Check a domain for phishing, malware, and spam listings", path: "/tools/domain-reputation", category: "Intel", difficulty: "Beginner" },
  { id: "waf-bypass-generator", icon: ShieldAlert, name: "WAF Bypass Generator", description: "Generate obfuscated XSS and SQLi payload variants", path: "/tools/waf-bypass", category: "Web", difficulty: "Advanced" },
  { id: "robots-txt-analyzer", icon: Search, name: "Robots.txt Analyzer", description: "Fetch and parse robots.txt for interesting disallowed paths", path: "/tools/robots-analyze", category: "Recon", difficulty: "Beginner" },
  { id: "number-base-converter", icon: Code, name: "Number Base Converter", description: "Convert between Binary, Octal, Decimal, Hex, and ASCII", path: "/tools/base-converter", category: "Utilities", difficulty: "Beginner" },
  { id: "regex-tester", icon: Code, name: "Regex Tester", description: "Test and debug regular expressions with match highlighting", path: "/tools/regex-tester", category: "Utilities", difficulty: "Beginner" },
  { id: "snmp-scanner", icon: Network, name: "SNMP Scanner", description: "Probe SNMP community strings and enumerate device OIDs", path: "/tools/snmp-scan", category: "Network", difficulty: "Intermediate" },
  { id: "waf-detector", icon: Shield, name: "WAF Detector", description: "Detect Web Application Firewalls from response signatures", path: "/tools/waf-detect", category: "Network", difficulty: "Intermediate" },
  { id: "arp-host-discovery", icon: Scan, name: "Host Discovery", description: "Discover live hosts on a subnet via ARP and ICMP", path: "/tools/host-discovery", category: "Network", difficulty: "Intermediate" },
  { id: "password-strength-analyzer", icon: ShieldCheck, name: "Password Strength Analyzer", description: "Score passwords with entropy, crack time, and pattern detection", path: "/tools/password-strength", category: "Password", difficulty: "Beginner" },
  { id: "bcrypt-generator", icon: Hash, name: "Hash Generator", description: "Generate bcrypt, SHA-256, SHA-512, and MD5 hashes with verification", path: "/tools/hash-generate", category: "Crypto", difficulty: "Beginner" },
  { id: "ssl-cert-decoder", icon: Lock, name: "SSL Certificate Decoder", description: "Decode PEM certificates and extract subject, SANs, and fingerprints", path: "/tools/ssl-cert-decode", category: "Crypto", difficulty: "Intermediate" },
  { id: "xxe-payload-generator", icon: Code, name: "XXE Payload Library", description: "Browse and copy XXE payloads for file read, SSRF, OOB, and DoS", path: "/tools/xxe-payloads", category: "Web", difficulty: "Advanced" },
  { id: "open-redirect-finder", icon: ArrowLeftRight, name: "Open Redirect Finder", description: "Test URL parameters for open redirect vulnerabilities", path: "/tools/open-redirect", category: "Web", difficulty: "Intermediate" },
  { id: "web-crawler", icon: Globe, name: "Web Crawler", description: "Crawl websites to map pages, forms, JS endpoints, and emails", path: "/tools/web-crawl", category: "Recon", difficulty: "Intermediate" },
  { id: "shodan-banner-grabber", icon: Server, name: "Banner Grabber", description: "Grab service banners from open TCP ports", path: "/tools/banner-grab", category: "Recon", difficulty: "Intermediate" },
  { id: "log-analyzer", icon: FileSearch, name: "Log Analyzer", description: "Parse Apache, Nginx, and auth logs for anomalies and brute-force", path: "/tools/log-analyze", category: "Forensics", difficulty: "Intermediate" },
  { id: "pdf-forensics", icon: FileSearch, name: "PDF Forensics", description: "Extract metadata and detect JavaScript and embedded objects in PDFs", path: "/tools/pdf-forensics", category: "Forensics", difficulty: "Intermediate" },
  { id: "binary-analyzer", icon: Binary, name: "Binary Analyzer", description: "Parse PE, ELF, and Mach-O headers, imports, and section entropy", path: "/tools/binary-analyze", category: "Forensics", difficulty: "Advanced" },
  { id: "hash-identifier", icon: Hash, name: "Hash Identifier", description: "Instantly identify hash algorithms by length and character pattern", path: "/tools/hash-identify", category: "Password", difficulty: "Beginner" },
  { id: "mask-attack-builder", icon: Key, name: "Mask Attack Builder", description: "Build Hashcat mask patterns and estimate keyspace crack time", path: "/tools/mask-builder", category: "Password", difficulty: "Intermediate" },
  { id: "phishing-url-detector", icon: AlertTriangle, name: "Phishing URL Detector", description: "Score URLs for typosquatting, homoglyphs, and phishing indicators", path: "/tools/phishing-check", category: "Intel", difficulty: "Beginner" },
  { id: "epoch-converter", icon: Activity, name: "Epoch Converter", description: "Convert Unix timestamps, ISO 8601, and human-readable dates", path: "/tools/epoch-converter", category: "Utilities", difficulty: "Beginner" },
  { id: "http-request-builder", icon: Globe, name: "HTTP Request Builder", description: "Send custom HTTP requests with headers, body, and auth — like Postman", path: "/tools/http-request", category: "Utilities", difficulty: "Intermediate" },
  // P4 tools
  { id: "apk-analyzer", icon: Smartphone, name: "APK Analyzer", description: "Extract permissions, activities, and hardcoded strings from APK files", path: "/tools/apk-analyze", category: "Mobile", difficulty: "Advanced" },
  { id: "wifi-handshake-cracker", icon: Wifi, name: "WiFi Handshake Cracker", description: "Attempt WPA handshake cracking with a custom wordlist", path: "/tools/wifi-crack", category: "Wireless", difficulty: "Advanced" },
  { id: "azure-blob-finder", icon: Database, name: "Azure Blob Finder", description: "Discover exposed Azure Blob Storage containers", path: "/tools/azure-blob-find", category: "Cloud", difficulty: "Intermediate" },
  { id: "gcp-bucket-finder", icon: Database, name: "GCP Bucket Finder", description: "Discover exposed Google Cloud Storage buckets", path: "/tools/gcp-bucket-find", category: "Cloud", difficulty: "Intermediate" },
  { id: "rop-gadget-finder", icon: Cpu, name: "ROP Gadget Finder", description: "Find RET-based gadgets in x86/x64 binaries for exploit chaining", path: "/tools/rop-gadgets", category: "Exploitation", difficulty: "Advanced" },
  { id: "buffer-overflow-calc", icon: Target, name: "Buffer Overflow Calc", description: "Calculate offsets, build payloads, and size NOP sleds", path: "/tools/buffer-overflow", category: "Exploitation", difficulty: "Advanced" },
  { id: "homoglyph-generator", icon: Eye, name: "Homoglyph Generator", description: "Generate lookalike domain variants using Unicode substitution", path: "/tools/homoglyph-gen", category: "Social Engineering", difficulty: "Intermediate" },
  { id: "dark-web-checker", icon: Eye, name: "Dark Web Checker", description: "Search indexed dark-web sources for mentions of a query", path: "/tools/dark-web-check", category: "Intel", difficulty: "Intermediate" },
  { id: "disk-image-analyzer", icon: Database, name: "Disk Image Analyzer", description: "Parse MBR partition tables and identify filesystem types", path: "/tools/disk-analyze", category: "Forensics", difficulty: "Advanced" },
  { id: "adb-generator", icon: Smartphone, name: "ADB Command Builder", description: "Build Android Debug Bridge commands with descriptions and copy", path: "/tools/adb-gen", category: "Mobile", difficulty: "Intermediate" },
  { id: "bluetooth-scanner", icon: Wifi, name: "Bluetooth Scanner", description: "Scan nearby Bluetooth devices using the Web Bluetooth API", path: "/tools/bt-scan", category: "Wireless", difficulty: "Intermediate" },
  { id: "company-osint", icon: Users, name: "Company OSINT", description: "Aggregate subdomains, emails, tech stack, and cloud assets for a company", path: "/tools/company-osint", category: "Intel", difficulty: "Advanced" },
  { id: "text-diff", icon: FileSearch, name: "Text Diff", description: "Compare two text blocks with line, word, and character diff modes", path: "/tools/text-diff", category: "Utilities", difficulty: "Beginner" },
  { id: "aws-metadata-tester", icon: Database, name: "AWS Metadata Tester", description: "Test SSRF parameters for AWS IMDS access and credential exposure", path: "/tools/aws-metadata", category: "Cloud", difficulty: "Advanced" },
  { id: "cloud-iam-auditor", icon: ShieldCheck, name: "Cloud IAM Auditor", description: "Audit AWS IAM policies for wildcard actions and privilege escalation", path: "/tools/iam-audit", category: "Cloud", difficulty: "Advanced" },
  { id: "cloud-asset-enumerator", icon: Database, name: "Cloud Asset Enumerator", description: "Enumerate exposed S3, Azure, GCP, and Firebase assets from a domain", path: "/tools/cloud-assets", category: "Cloud", difficulty: "Advanced" },
  { id: "mobile-permission-auditor", icon: Smartphone, name: "Mobile Permission Auditor", description: "Analyze Android and iOS permission lists for risk and dangerous combos", path: "/tools/permission-audit", category: "Mobile", difficulty: "Intermediate" },
  { id: "evil-twin-detector", icon: Wifi, name: "Evil Twin Detector", description: "Compare SSID/BSSID pairs for homoglyph and vendor spoofing", path: "/tools/evil-twin", category: "Wireless", difficulty: "Intermediate" },
  { id: "social-media-osint", icon: Users, name: "Social Media OSINT", description: "Extract public profile data from Reddit, GitHub, HackerNews, and more", path: "/tools/social-osint", category: "Intel", difficulty: "Intermediate" },
  { id: "pastebin-monitor", icon: Eye, name: "Pastebin Monitor", description: "Search public paste sites for email, domain, or keyword mentions", path: "/tools/pastebin-search", category: "Intel", difficulty: "Intermediate" },
  { id: "code-obfuscator", icon: Code, name: "Code Obfuscator", description: "Minify and obfuscate JavaScript, and minify CSS", path: "/tools/code-obfuscator", category: "Utilities", difficulty: "Intermediate" },
  { id: "credential-checker", icon: ShieldAlert, name: "Credential Checker", description: "Test credential lists against a login endpoint you own", path: "/tools/credential-check", category: "Password", difficulty: "Advanced" },
  { id: "payload-encoder", icon: Code, name: "Payload Encoder", description: "Encode payloads in Base64, Hex, XOR, PowerShell, and Python formats", path: "/tools/payload-encoder", category: "Exploitation", difficulty: "Intermediate" },
  { id: "xxe-ssti-library", icon: BookOpen, name: "XXE / SSTI Library", description: "Browse XXE and SSTI payload libraries for all major template engines", path: "/tools/xxe-ssti", category: "Web", difficulty: "Advanced" },
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
    details: "A Port Scanner is a fundamental network reconnaissance and vulnerability assessment tool used to discover open, closed, and filtered ports on a target system. Ports are logical communication endpoints that allow services and applications to exchange data over a network. Each service (such as web servers, SSH, FTP, databases, or mail servers) typically listens on a specific port number. By identifying which ports are open, a port scanner reveals what services may be running and potentially accessible from the network.\n\nThe tool works by sending specially crafted packets to target ports and analyzing the responses. For example, in a TCP SYN scan, the scanner sends a SYN packet and determines port status based on whether it receives a SYN-ACK (open), RST (closed), or no response (filtered). UDP scanning sends UDP packets and infers port states from ICMP error messages or lack of response. More advanced scanning techniques can attempt service fingerprinting, banner grabbing, and operating system detection.\n\nPort scanning plays a critical role in both offensive and defensive security. Penetration testers use it to map the attack surface of a target and prioritize potential entry points. System administrators and defenders use it to audit their infrastructure, verify firewall rules, and ensure that only necessary services are exposed. When combined with vulnerability scanners and exploitation frameworks, port scanning becomes the first step in a complete security assessment workflow.",
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
  },
  "base64-encoder": {
    usage: "Select encoding format (Base64, Hex, URL, Binary), choose encode or decode, paste your input, and click Process. Output appears instantly with byte length and a copy button.",
    details: "Client-side encoding and decoding utility supporting Base64, hexadecimal, URL percent-encoding, and binary. No data is sent to the server.",
    outputs: ["Encoded / decoded string", "Byte length"],
  },
  "reverse-shell-generator": {
    usage: "Enter your listener IP (LHOST) and port (LPORT), select a shell type from the dropdown, and copy the generated payload. Also shows the Netcat listener command.",
    details: "Generates ready-to-use reverse shell one-liners for 13 languages including bash, Python, PHP, Perl, Ruby, PowerShell, and Netcat. All substitution is client-side.",
    outputs: ["Reverse shell payload", "Netcat listener command"],
    warning: "Only use on systems you own or have explicit written permission to test.",
  },
  "ssl-analyzer": {
    usage: "Enter a domain name (e.g. example.com). The tool connects on port 443, retrieves the certificate chain, and checks cipher suites, protocol versions, expiry, and HSTS.",
    details: "Performs a live TLS handshake and flags: self-signed certs, expiry < 30 days, SHA-1 signatures, weak ciphers (RC4, DES, 3DES), missing HSTS, and old protocol versions.",
    outputs: ["Certificate chain", "Cipher suites", "Protocol versions", "HSTS status", "Vulnerability flags", "Overall grade"],
    warning: "Internal or private CAs will show as untrusted.",
    prerequisites: ["Domain reachable on port 443"],
  },
  "http-header-analyzer": {
    usage: "Enter a full URL (https://...). The tool sends a HEAD request and audits security-relevant response headers, scoring each one and providing remediation advice.",
    details: "Checks for: Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, and Permissions-Policy. Flags unsafe-inline/unsafe-eval in CSP.",
    outputs: ["Raw response headers", "Security header audit cards", "Overall score and grade"],
  },
  "email-header-analyzer": {
    usage: "Paste raw email headers from your email client (View Source / Show Original). The tool parses Received: hops, authentication results, and flags spoofing risk.",
    details: "Extracts the hop chain from Received: headers with timestamps and IPs. Parses Authentication-Results for SPF/DKIM/DMARC pass/fail. Flags spoofing risk when DMARC is absent or SPF fails.",
    outputs: ["Hop chain with IPs and timestamps", "SPF / DKIM / DMARC results", "Spoofing risk verdict"],
  },
  "cve-search": {
    usage: "Enter a keyword, product name, or CVE ID (e.g. 'apache log4j' or 'CVE-2021-44228'). Results from the NVD are shown as expandable cards with CVSS scores and affected products.",
    details: "Queries the NIST NVD API v2. Returns CVSS v3.1 scores where available (falls back to v3.0 and v2.0). Results are filterable by severity.",
    outputs: ["CVE list with CVSS scores", "Severity badges", "Affected products", "Reference URLs"],
  },
  "file-hash-calculator": {
    usage: "Drag and drop a file (or click to choose). MD5, SHA-1, SHA-256, and SHA-512 hashes are computed and shown with individual copy buttons. A VirusTotal search link is pre-filled with the SHA-256.",
    details: "All hashing is performed server-side using Node.js crypto. File type is detected from magic bytes. Hash values can be compared against known-good values to verify file integrity.",
    outputs: ["MD5", "SHA-1", "SHA-256", "SHA-512", "MIME type", "File size"],
  },
  "password-generator": {
    usage: "Adjust the length slider and toggle character sets (uppercase, lowercase, numbers, symbols, exclude-ambiguous). A new password is generated on every change. Click copy to use it.",
    details: "Uses crypto.getRandomValues for cryptographically secure generation. Displays entropy in bits and estimated crack time at 10 billion guesses per second.",
    outputs: ["Generated password", "Entropy in bits", "Estimated crack time"],
  },
  "username-enumerator": {
    usage: "Enter a username and click Enumerate. The tool checks 16 platforms simultaneously and shows Found / Not Found / Error for each. Click a result to open the profile in a new tab.",
    details: "Checks GitHub, Reddit, Twitter/X, Instagram, LinkedIn, TikTok, YouTube, Twitch, Pinterest, Medium, Keybase, HackerNews, GitLab, Bitbucket, Steam, and Pastebin via HTTP status codes.",
    outputs: ["Platform results with status", "Found / Not Found counts", "Profile URLs"],
    warning: "Some platforms rate-limit or block automated lookups.",
  },
  "malware-hash-lookup": {
    usage: "Paste an MD5, SHA-1, or SHA-256 hash. The tool auto-detects the hash type and queries MalwareBazaar. If a VirusTotal API key is configured, it also queries VirusTotal.",
    details: "Queries the free MalwareBazaar API (no key needed). Returns malware family, first/last seen dates, and detection count. Links to the VirusTotal report.",
    outputs: ["Verdict (Clean / Malicious / Unknown)", "Detection ratio", "Malware family", "VirusTotal permalink"],
  },
  "sql-injection-tester": {
    usage: "Enter the target URL and the parameter name to test (e.g. 'id'), select GET or POST, and click Test. The tool tries error-based, boolean-blind, and time-based injection payloads.",
    details: "Tests payloads like ' OR 1=1--, SLEEP(3)--, and UNION SELECT NULL--. Detects by database error strings, response length differences, and response time delays > 2.5s.",
    outputs: ["Vulnerable / Not Detected verdict", "Injection type", "Triggering payload", "Detected DB type", "Remediation recommendations"],
    warning: "Only test applications you own or have written permission to test.",
    prerequisites: ["Target URL with a parameter to test"],
  },
  "xss-payload-generator": {
    usage: "Active Tester tab: enter URL and parameter to test for reflected XSS. Payload Library tab: browse payloads by context (HTML, attribute, JavaScript, URL, filter bypass) and copy them.",
    details: "Reflection detection only — injects payloads and checks if they appear unencoded in the response. Cannot detect DOM-based or stored XSS.",
    outputs: ["Reflected XSS verdict", "Triggering payload", "Context type", "Payload library by context"],
    warning: "This tool detects reflection only, not JavaScript execution. Verify findings manually.",
  },
  "website-tech-fingerprinter": {
    usage: "Enter a full URL. The tool fetches the page and detects technologies from HTTP headers, HTML meta tags, body patterns, and cookie names.",
    details: "Detects 40+ technologies including CMS (WordPress, Drupal, Joomla), frameworks (React, Angular, Vue, Next.js), CDNs (Cloudflare, Fastly), analytics, and WAFs.",
    outputs: ["Technology list with category and confidence", "Server info", "CMS detected", "Analytics platforms", "CDN and WAF"],
  },
  "cidr-calculator": {
    usage: "Enter a CIDR block (e.g. 192.168.1.0/24) or a single IP address. All values update instantly with no server request needed.",
    details: "Client-side bitwise arithmetic. Calculates network address, broadcast address, subnet mask, wildcard mask, first and last usable host, usable host count, and IP class.",
    outputs: ["Network address", "Broadcast address", "Subnet mask", "Wildcard mask", "Host range", "Usable host count"],
  },
  "wordlist-generator": {
    usage: "Add keywords as chips (press Enter after each). Toggle mutations: leet substitutions, common years (2020–2025), common suffixes (123, !, _2024), and capitalisation variants. Download as .txt.",
    details: "Generates lowercase, uppercase, capitalised, reversed, leet, year-appended, and suffix-appended variants for each keyword. De-duplicates with a Set. Capped at 50,000 words.",
    outputs: ["Wordlist as downloadable .txt", "Word count"],
  },
  "json-beautifier": {
    usage: "Paste JSON or XML into the left panel. The right panel shows it formatted and colour-highlighted. Toggle between pretty-print and minify. Validation errors appear inline.",
    details: "Client-side formatting using JSON.parse / JSON.stringify for JSON and DOMParser for XML. No data is sent to the server.",
    outputs: ["Formatted output", "Validation result"],
  },
  "ct-log-search": {
    usage: "Enter a domain (e.g. example.com). The tool queries crt.sh to find all SSL certificates ever issued for that domain and its subdomains, extracting a unique list of discovered hostnames.",
    details: "Queries the crt.sh Certificate Transparency log aggregator. Useful for subdomain discovery — any subdomain that ever had an SSL cert will appear.",
    outputs: ["Certificate list with issuer and validity", "Unique discovered domains", "Downloadable domain list (.txt)"],
  },
  "spoofed-email-checker": {
    usage: "Enter a domain name. The tool performs DNS lookups for SPF, DMARC, and common DKIM selectors and evaluates whether the domain can be spoofed.",
    details: "SPF (v=spf1 TXT record), DMARC (_dmarc TXT record), and DKIM (10 common selectors). A domain is spoofable if DMARC is absent or has p=none without strict SPF enforcement.",
    outputs: ["SPF / DMARC / DKIM status cards", "Spoofable verdict", "Raw DNS record values", "Recommendations"],
  },
  "ip-reputation-checker": {
    usage: "Enter an IPv4 address. The tool queries AbuseIPDB for abuse reports and ipinfo.io for ASN and organisation data. Requires ABUSEIPDB_API_KEY env variable for full results.",
    details: "Returns abuse confidence score (0–100), proxy/VPN/Tor flags, country, ISP, and the number of recent reports from AbuseIPDB.",
    outputs: ["Abuse score gauge", "Proxy / VPN / Tor flags", "Country and ISP", "Recent report count"],
  },
  "url-encoder": {
    usage: "Paste text or a URL into the input. Use the buttons to apply URL encoding, URL decoding, double URL encode, HTML entity encode/decode, or Unicode escape/unescape.",
    details: "Client-side character-level transformations. Useful when crafting payloads that need to bypass filters or when debugging URL parsing issues.",
    outputs: ["Transformed string", "Character-level diff"],
  },
  "hex-viewer": {
    usage: "Upload any file. The tool shows the first 10 KB as a classic hex dump: offset | hex bytes | ASCII. Non-printable characters are shown as dots. Shannon entropy is also calculated.",
    details: "Classic hex editor layout with 16 bytes per row. Entropy bar helps identify packed, encrypted, or compressed sections. File type is detected from magic bytes.",
    outputs: ["Hex dump (offset | hex | ASCII)", "Shannon entropy", "Detected MIME type"],
  },
  "string-extractor": {
    usage: "Upload a binary file and optionally set a minimum string length (default 4). The tool extracts all printable ASCII and UTF-16 strings and categorises them by type.",
    details: "Scans the binary buffer for contiguous printable ASCII sequences and UTF-16LE (null-interleaved) sequences. Categorises into URLs, emails, IPs, file paths, registry keys, and other.",
    outputs: ["String list with offset and encoding", "Category counts", "Filterable by type"],
  },
  "file-type-identifier": {
    usage: "Upload any file. The tool reads the magic bytes and identifies the real file type, then compares it to the file extension. A warning is shown if there is a mismatch.",
    details: "Identifies PDF, PNG, JPEG, ZIP, EXE/PE, ELF, GIF, RAR, 7-Zip, and Office (OOXML) formats from the first few bytes. Extension mismatch can indicate a disguised malicious file.",
    outputs: ["Detected file type", "MIME type", "Magic bytes (hex)", "Extension match status"],
    warning: "A clean extension match does not guarantee the file is safe.",
  },
  "default-credentials-db": {
    usage: "Search by vendor name or device type in the search box. The table shows vendor, device, default username, and default password for routers, cameras, databases, and web apps.",
    details: "Static database of factory-default credentials. Includes Cisco, Netgear, TP-Link, D-Link, Hikvision, MySQL, PostgreSQL, MSSQL, Jenkins, Tomcat, and more.",
    outputs: ["Vendor", "Device / Software", "Default username", "Default password"],
    warning: "Change all default credentials immediately on any device you manage.",
  },
  "exploit-db-search": {
    usage: "Enter a product name, CVE ID, or keyword. Results from Exploit-DB are shown with type (Remote/Local/WebApps/DoS) and platform badges. Click a result to open the full exploit.",
    details: "Queries the Exploit-DB search API. Results include exploit ID, title, date, author, type, platform, and associated CVEs.",
    outputs: ["Exploit list with type and platform badges", "Exploit-DB URLs"],
    warning: "Exploits are for authorised security research only.",
  },
  "cookie-analyzer": {
    usage: "Enter a URL. The tool fetches the page and extracts all Set-Cookie headers, auditing each cookie for missing security flags.",
    details: "Checks each cookie for: HttpOnly (medium risk if missing), Secure (high if missing and not localhost), SameSite (medium if absent, high if SameSite=None without Secure), and excessive expiry.",
    outputs: ["Cookie table with flag status", "Issue list by severity", "Overall security score"],
  },
  "ssrf-tester": {
    usage: "Enter the target URL and the parameter name to test. The tool injects SSRF payloads (internal IPs, AWS metadata, IPv6 localhost) and checks for internal content in responses.",
    details: "Tests for Server-Side Request Forgery by injecting internal network addresses and cloud metadata endpoints. Flags responses that contain internal data or AWS credential signatures.",
    outputs: ["Vulnerable / Not Detected verdict", "Successful payloads", "Internal response detected flag", "Recommendations"],
    warning: "Only test applications you own or have permission to test.",
  },
  "csrf-poc-generator": {
    usage: "Enter the target URL, select GET or POST, add parameter name/value pairs, and click Generate. A self-submitting HTML form is produced that you can use as a CSRF proof-of-concept.",
    details: "Generates a complete HTML page with a hidden form that auto-submits on load. Useful for demonstrating CSRF vulnerabilities in bug bounty reports.",
    outputs: ["Self-submitting HTML CSRF PoC"],
    warning: "Only use against applications you own or have written permission to test.",
  },
  "traceroute": {
    usage: "Enter a hostname or IP address. The tool traces the network path by incrementing TTL values and recording each router hop. Timeouts are shown as * * *.",
    details: "Runs the system traceroute / tracert command and parses its output. Shows hop number, IP, hostname, and RTT for each hop.",
    outputs: ["Hop-by-hop table", "IP and hostname per hop", "RTT values"],
    warning: "Some hops will not respond to ICMP and will show as timeouts.",
  },
  "bgp-asn-lookup": {
    usage: "Enter an IP address or ASN (e.g. AS15169). The tool queries BGPView for routing information including announced prefixes, peers, upstreams, and downstreams.",
    details: "Queries the free BGPView API. Useful for understanding the routing infrastructure behind an IP address or organisation.",
    outputs: ["ASN name, country, and description", "Announced IP prefixes", "Peer and upstream ASNs"],
  },
  "pgp-key-generator": {
    usage: "Enter your name, email address, key type (RSA-4096 or Curve25519), and an optional passphrase. Click Generate to produce a key pair. Keep your private key secret.",
    details: "Requires the OpenPGP.js library for actual key generation. This tool provides the UI framework; full generation requires the openpgp npm package to be loaded.",
    outputs: ["Public key (PEM/ASCII-armored)", "Private key (PEM/ASCII-armored)"],
    warning: "Never share your private key. Store it securely.",
  },
  "entropy-analyzer": {
    usage: "Paste any text or data into the textarea. Shannon entropy is calculated instantly with a character frequency histogram and a verdict on the entropy level.",
    details: "Shannon entropy measures information density (bits per character). High entropy (>7.5) often indicates encrypted, compressed, or base64-encoded data.",
    outputs: ["Shannon entropy value (bits/char)", "Character frequency histogram", "Low / Medium / High verdict"],
  },
  "phone-number-osint": {
    usage: "Enter a phone number in international format (e.g. +1 202 555 0100). The tool validates the number and looks up carrier, line type, country, and timezone.",
    details: "Uses libphonenumber-js for parsing and validation. Carrier lookup requires the NUMVERIFY_API_KEY environment variable. Falls back to parsed data if no API key is set.",
    outputs: ["Formatted number", "Country and country code", "Carrier", "Line type (Mobile / Landline / VoIP)", "Timezone"],
  },
  "domain-reputation": {
    usage: "Enter a domain name. The tool checks it against PhishTank, DNSBL feeds, and VirusTotal (if a VT API key is configured) and returns a reputation score.",
    details: "Aggregates data from public reputation feeds. Checks for phishing listings (PhishTank), spam blacklists (DNSBL), and optional VirusTotal URL scanning.",
    outputs: ["Reputation score (0–100)", "Category tags", "Malicious / Phishing / Spam flags", "Source breakdown"],
  },
  "waf-bypass-generator": {
    usage: "Select XSS or SQLi tab, paste your raw payload, and click Generate. The tool produces 10–15 obfuscated variants using case mutation, encoding, and comment insertion.",
    details: "Client-side payload obfuscation. Useful for testing WAF rule effectiveness. Does not send traffic — generates strings only.",
    outputs: ["Obfuscated payload variants with copy buttons"],
    warning: "Only use against WAFs you are authorised to test.",
  },
  "robots-txt-analyzer": {
    usage: "Enter a domain name. The tool fetches and displays the robots.txt file and parses all rules, highlighting disallowed paths that may reveal sensitive locations.",
    details: "Interesting paths (admin, backup, config, private, secret, internal, staging, upload, api) are highlighted in amber as high-value recon findings.",
    outputs: ["Raw robots.txt", "Parsed rules", "Sitemap URLs", "Interesting disallowed paths"],
  },
  "number-base-converter": {
    usage: "Type a value into any of the four fields (Binary, Octal, Decimal, Hex). All other fields update instantly. Also converts to the corresponding ASCII character.",
    details: "Client-side bitwise conversion. Supports non-negative integers. Useful for exploit development and low-level protocol analysis.",
    outputs: ["Binary", "Octal", "Decimal", "Hexadecimal", "ASCII character"],
  },
  "regex-tester": {
    usage: "Enter your regex pattern, optional flags (g, i, m, s), and test string. All matches are highlighted in the test string. Captured groups are shown in a table.",
    details: "Client-side regex evaluation using JavaScript's RegExp. Includes a quick reference sidebar for common patterns (email, IP address, URL, phone number).",
    outputs: ["Highlighted matches", "Match count", "Captured groups table"],
  },
  "snmp-scanner": {
    usage: "Enter a target IP, community string (default: public), and SNMP version. The tool attempts to retrieve system information OIDs and flags weak community strings.",
    details: "Queries sysDescr, sysName, sysLocation, and sysUpTime OIDs. Flags the 'public' community string as a high-severity finding.",
    outputs: ["Device info (name, description, location, uptime)", "OID results", "Vulnerability flags"],
    warning: "Only scan devices you own or have permission to test.",
  },
  "waf-detector": {
    usage: "Enter a URL. The tool sends a normal request followed by a malicious request and compares the responses, looking for WAF-specific headers and response patterns.",
    details: "Detects Cloudflare (CF-RAY header), Akamai (AkamaiGHost header), Sucuri (X-Sucuri-ID), ModSecurity (Server header pattern), and AWS WAF (X-AMZ-WAF headers).",
    outputs: ["WAF Detected / Not Detected verdict", "WAF name and confidence", "Detection indicators"],
  },
  "arp-host-discovery": {
    usage: "Enter a subnet in CIDR notation (e.g. 192.168.1.0/24). The tool checks the ARP cache and attempts TCP connections to detect live hosts.",
    details: "Combines ARP cache lookup and TCP connection attempts on port 80 to discover live hosts. MAC vendor lookup is performed where possible.",
    outputs: ["Live host list with IP, MAC, vendor", "Hosts up / down counts"],
    warning: "Scanning private networks you do not own may be prohibited.",
  },
  "password-strength-analyzer": {
    usage: "Type a password into the input field. Strength, entropy, and crack time estimates update live. Pattern detection flags keyboard walks, repeated characters, and common words.",
    details: "Client-side analysis using entropy calculation and common password pattern heuristics. Estimates crack time at three attack speeds: online throttled, offline MD5, and offline bcrypt.",
    outputs: ["Strength score (0–4)", "Entropy in bits", "Crack time estimates", "Pattern flags"],
  },
  "bcrypt-generator": {
    usage: "Enter plaintext and select an algorithm (bcrypt, SHA-256, SHA-512, MD5). Click Generate to produce the hash. Use the Verify tab to check a plaintext against a stored hash.",
    details: "bcrypt uses bcryptjs at cost factor 10–14. SHA and MD5 use Node.js crypto. Generation time is shown to help choose an appropriate work factor.",
    outputs: ["Hash string", "Algorithm used", "Generation time"],
    warning: "Store the hash only, never the plaintext password.",
  },
  "ssl-cert-decoder": {
    usage: "Paste a PEM-encoded certificate into the textarea and click Decode. The tool extracts subject, issuer, serial number, validity window, SANs, and fingerprints.",
    details: "Client-side PEM parsing. Decodes the base64 DER content and extracts readable fields. Full ASN.1 parsing requires the pkijs or asn1js library.",
    outputs: ["Subject and issuer", "Validity dates", "SANs", "SHA-1 and SHA-256 fingerprints"],
  },
  "xxe-payload-generator": {
    usage: "Browse the payload library by category. Click copy on any payload to put it in your clipboard. Each payload includes an explanation of what it does and when to use it.",
    details: "Static payload reference library. Categories: Basic file read, SSRF via XXE, Error-based exfiltration, OOB with DNS callback, Billion laughs DoS, PHP filter wrapper.",
    outputs: ["XXE payloads with explanations", "Copy button per payload"],
    warning: "Only use against applications you own or have permission to test.",
  },
  "open-redirect-finder": {
    usage: "Enter the target URL and the parameter name to test (e.g. 'redirect'). The tool injects redirect payloads and checks whether the server sends a 3xx response to an external domain.",
    details: "Tests payloads: https://evil.com, //evil.com, /\\evil.com. Uses fetch with redirect:manual and checks the Location header.",
    outputs: ["Vulnerable / Not Detected verdict", "Redirect destination", "Triggering payload", "Severity"],
    warning: "Only test applications you own or have written permission to test.",
  },
  "web-crawler": {
    usage: "Enter a starting URL, optionally set max depth (default 3) and max pages (default 50). The crawler maps all reachable pages, links, forms, JS endpoints, and email addresses.",
    details: "BFS crawling scoped to the same origin. Extracts <a href> links, <form action> attributes, <script src> paths, and email addresses from page content.",
    outputs: ["Page list with status codes", "External links", "Form list with methods", "JS endpoints", "Email addresses found"],
  },
  "shodan-banner-grabber": {
    usage: "Enter a hostname or IP and a comma-separated list of ports. The tool connects to each port and records the service banner returned.",
    details: "Uses TCP connections to grab banners from SSH, FTP, SMTP, HTTP, and other protocols. Parses known banner patterns to identify service name and version.",
    outputs: ["Port → service → banner table", "Service name badges"],
    warning: "Port scanning and banner grabbing without permission may be illegal.",
  },
  "log-analyzer": {
    usage: "Upload a log file and select the format (auto, Apache, Nginx, auth, syslog, IIS). The tool parses the log and shows statistics, top IPs, and detected anomalies.",
    details: "Auto-detects log format from the first line. Flags: brute-force attempts (>10 failed logins from one IP), 4xx error spikes, and known scanner user-agents (sqlmap, nikto, nmap).",
    outputs: ["Summary stats", "Top IPs and paths", "Timeline", "Anomaly list with severity"],
  },
  "pdf-forensics": {
    usage: "Upload a PDF file. The tool scans for metadata and suspicious features including embedded JavaScript, launch actions, embedded files, and external URLs.",
    details: "Scans raw PDF bytes for dangerous keywords: /JavaScript, /JS, /Launch, /EmbeddedFile, /URI, /OpenAction. Extracts metadata fields from the document dictionary.",
    outputs: ["Metadata (title, author, creator, dates)", "Suspicious feature flags", "Embedded file list", "URL list"],
    warning: "PDFs with JavaScript or embedded files may be malicious. Handle with caution.",
  },
  "binary-analyzer": {
    usage: "Upload an executable (PE .exe/.dll, ELF, or Mach-O). The tool identifies the format, architecture, imports, sections, and entropy. High entropy may indicate packing.",
    details: "Parses PE magic bytes (MZ), ELF magic (0x7F ELF), and Mach-O magic. Computes Shannon entropy; entropy > 7.2 in the code section suggests the file may be packed or encrypted.",
    outputs: ["File format and architecture", "Import and export lists", "Section table with entropy", "Packed / signed flags", "Anomaly list"],
  },
  "hash-identifier": {
    usage: "Paste a hash string. The tool instantly identifies the most likely algorithm by length and character set, returning a ranked probability list.",
    details: "Client-side identification. Recognises MD5, SHA-1, SHA-256, SHA-512, bcrypt, NTLM, LM, SHA3-256, Argon2, and more based on format patterns.",
    outputs: ["Ranked algorithm list with probabilities"],
  },
  "mask-attack-builder": {
    usage: "Click character class buttons (?l, ?u, ?d, ?s, ?a) to build the mask pattern. The estimated keyspace, crack times, and Hashcat command line update instantly.",
    details: "Client-side keyspace calculator. Exports the mask as a ready-to-use Hashcat command (hashcat -a 3). Includes preset patterns for common password structures.",
    outputs: ["Mask pattern", "Estimated keyspace", "Crack time at 1M/s, 1G/s, 100G/s", "Hashcat command"],
  },
  "phishing-url-detector": {
    usage: "Enter a full URL to analyse. The tool scores it against multiple phishing indicators and returns a verdict of Safe, Suspicious, or Phishing.",
    details: "Checks: Levenshtein distance from popular domains, homoglyph characters, IP address in hostname, URL length, @ symbol, subdomain depth, suspicious keywords in path.",
    outputs: ["Score 0–100", "Verdict badge", "Indicator cards with descriptions"],
  },
  "epoch-converter": {
    usage: "Type in any field (Unix timestamp, human-readable date, ISO 8601) to convert. Select timezone from the dropdown. The current Unix timestamp updates every second.",
    details: "Client-side date/time conversion using the JavaScript Date API. Supports all IANA timezone names via the Intl API.",
    outputs: ["Unix timestamp", "Human-readable date", "ISO 8601 string", "Relative time"],
  },
  "http-request-builder": {
    usage: "Select HTTP method, enter URL, add headers as key-value pairs, enter an optional request body, and click Send. The full response is displayed including status code, headers, and body.",
    details: "Sends requests through the backend to bypass browser CORS restrictions. Response body is capped at 1 MB. Redirect chain is shown when following redirects.",
    outputs: ["Status code and text", "Response time", "Response headers", "Response body", "Redirect chain"],
  },
  "apk-analyzer": {
    usage: "Upload an APK file. The tool extracts the AndroidManifest.xml to list permissions, activities, services, and receivers. Dangerous permissions are highlighted in red.",
    details: "Reads the APK ZIP structure to locate and parse the binary AndroidManifest.xml. Scans the DEX bytecode for hardcoded strings, URLs, and API keys.",
    outputs: ["Package name and version", "Permission list with danger level", "Hardcoded strings", "Dangerous permissions highlighted"],
    warning: "Only analyse APKs you own or have permission to analyse.",
  },
  "wifi-handshake-cracker": {
    usage: "Upload a WPA handshake capture file and enter or select a wordlist. The tool derives PMK values using PBKDF2-SHA1 and tests them against the captured handshake.",
    details: "Implements WPA PMK derivation using Node.js crypto.pbkdf2 (PBKDF2-SHA1, 4096 iterations, SSID as salt). Limited to 1,000 words due to performance constraints.",
    outputs: ["Tried count", "Found / Not Found verdict", "Password (if found)", "Time taken"],
    warning: "Only crack handshakes from networks you own or have explicit permission to test. Unauthorised access to networks is illegal.",
  },
  "azure-blob-finder": {
    usage: "Enter a keyword (company name or brand). The tool generates common Azure Blob container naming patterns and probes each for public accessibility.",
    details: "Tests names like keyword, keyword-backup, keyword-data at *.blob.core.windows.net. A 200 response indicates a public container; 403 indicates it exists but is private.",
    outputs: ["Container list with public / private status", "Files listed (if public container)"],
    warning: "Only probe storage accounts you own or have written permission to test.",
  },
  "gcp-bucket-finder": {
    usage: "Enter a keyword. The tool generates common GCP bucket naming patterns and probes each at storage.googleapis.com for public accessibility.",
    details: "Tests names at https://storage.googleapis.com/<bucket>. Tries to list bucket contents via the Storage JSON API if the bucket is public.",
    outputs: ["Bucket list with public / private status"],
    warning: "Only probe buckets you own or have permission to test.",
  },
  "rop-gadget-finder": {
    usage: "Upload an x86 or x64 binary. The tool scans for RET-preceded byte sequences and presents them as usable ROP gadgets, filterable by instruction type.",
    details: "Scans backwards from RET bytes (0xC3) to find 1–5 instruction gadgets. Common types: pop r64; ret, xchg; ret, syscall; ret. Export as a Python list for pwntools.",
    outputs: ["Gadget list with address and instructions", "Category counts", "Python export"],
    warning: "For authorised security research and CTF use only.",
  },
  "buffer-overflow-calc": {
    usage: "Offset Calculator: paste a cyclic pattern and the value in the crash register to get the offset. Payload Builder: enter offset, bad chars, and shellcode size to get a Python skeleton.",
    details: "Three tabs: Offset Calculator (de Bruijn sequence offset lookup), Payload Builder (Python payload skeleton), NOP Sled Calculator (recommended NOP count for given buffer/shellcode sizes).",
    outputs: ["Buffer offset", "Python payload skeleton", "NOP sled recommendation"],
    warning: "For authorised security research and CTF use only.",
  },
  "homoglyph-generator": {
    usage: "Enter a domain name. The tool generates lookalike variants by substituting Latin characters with visually identical Unicode characters from Cyrillic, Greek, and other scripts.",
    details: "Generates homoglyph substitutions for a/а, e/е, o/о, c/с, and more. Also produces typosquatting variants: adjacent key swaps, doubled letters, missing letters, and TLD swaps.",
    outputs: ["Homoglyph variants with Unicode code points", "Typosquatting variants"],
    warning: "Homoglyph domains are used in phishing. Use this tool for defence and awareness only.",
  },
  "dark-web-checker": {
    usage: "Enter a search query (email, domain, or keyword) and click Search. The tool queries the Ahmia.fi indexed dark-web search engine for public mentions.",
    details: "Queries the Ahmia.fi dark-web search index, which crawls .onion sites. Results are indexed pages only — not a real-time scan of the dark web.",
    outputs: ["Mention list with source and snippet"],
    warning: "Results are from an index of publicly accessible .onion pages. This is not a live dark-web scan.",
  },
  "disk-image-analyzer": {
    usage: "Upload a disk image file (.img, .dd, .iso). The tool parses the MBR and partition table to identify partitions, filesystem types, and anomalies.",
    details: "Reads the first 512 bytes (MBR). Checks the 0x55 0xAA boot signature. Parses four 16-byte partition table entries at offset 0x1BE.",
    outputs: ["MBR validity", "Partition table", "Filesystem type per partition", "Anomaly flags"],
  },
  "adb-generator": {
    usage: "Browse commands by category (Device info, App management, File transfer, Shell, Debugging, Forensics) and click Copy on any command. Descriptions explain what each command does.",
    details: "Static reference library of useful ADB commands with explanations. All generation is client-side.",
    outputs: ["ADB commands with descriptions and copy buttons"],
  },
  "bluetooth-scanner": {
    usage: "Click Scan. Your browser will prompt you to grant Bluetooth access. Discovered devices show their name, ID, and advertised services. Requires Chrome or Edge.",
    details: "Uses the Web Bluetooth API (navigator.bluetooth.requestDevice). Works in Chrome and Edge on supported platforms. Firefox and Safari do not support Web Bluetooth.",
    outputs: ["Device name", "Device ID", "Advertised GATT services"],
    prerequisites: ["Chrome or Edge browser", "Bluetooth-capable device", "User permission grant"],
  },
  "company-osint": {
    usage: "Enter a company name and optionally its domain. The tool aggregates data from Certificate Transparency logs, IP info, and Hunter.io (if API key configured).",
    details: "Queries crt.sh for SSL certificate history, ipinfo.io for IP and ASN data. If HUNTER_API_KEY is set, queries Hunter.io for email format patterns.",
    outputs: ["Subdomain list", "Email format", "Social profile links", "Cloud asset mentions", "Tech stack"],
  },
  "text-diff": {
    usage: "Paste text into both panels. The diff is computed automatically. Toggle between line, word, and character diff modes. Added text is green, removed text is red.",
    details: "Client-side diff using a line-by-line LCS algorithm. Copy the result as a unified patch format with the copy button.",
    outputs: ["Coloured diff output", "Unified patch export"],
  },
  "aws-metadata-tester": {
    usage: "Enter the target URL and the parameter name to test. The tool injects AWS IMDS endpoint payloads and checks whether the response contains metadata or credentials.",
    details: "Specifically targets the AWS Instance Metadata Service (IMDS) endpoint 169.254.169.254 and its IPv6 equivalent. Flags responses containing AccessKeyId or SecretAccessKey.",
    outputs: ["Vulnerable / Not Detected verdict", "Successful payload", "Sensitive data / credentials flag", "Recommendations"],
    warning: "Only test applications and infrastructure you own or have written permission to test.",
  },
  "cloud-iam-auditor": {
    usage: "Paste an AWS IAM policy JSON document and click Audit. The tool analyses each statement and flags dangerous permissions, wildcards, and missing conditions.",
    details: "Flags: Effect:Allow + Action:['*'] (critical), Resource:['*'] without Condition (high), Principal:'*' (critical), sensitive actions without MFA conditions.",
    outputs: ["Issue list by severity", "Security score", "Wildcard statement count", "Dangerous action list"],
  },
  "cloud-asset-enumerator": {
    usage: "Enter a domain and optional organisation name. The tool probes common cloud storage endpoints derived from the name across AWS S3, Azure Blob, GCP, and Firebase.",
    details: "Generates candidate names and tests: *.s3.amazonaws.com, *.blob.core.windows.net, storage.googleapis.com/*, and *-default-rtdb.firebaseio.com. Reports public, private, or not-found.",
    outputs: ["Asset list grouped by cloud provider", "Status per asset (public / private / not found)"],
  },
  "mobile-permission-auditor": {
    usage: "Paste a list of Android or iOS permissions (one per line), select the platform, and click Audit. Each permission is rated and dangerous combinations are flagged.",
    details: "Uses a built-in permission database covering Android dangerous permissions and iOS NSUsageDescription keys. Flags risky combinations like READ_SMS + INTERNET (credential theft risk).",
    outputs: ["Permission risk table", "Dangerous permission highlights", "Risk combination warnings", "Overall risk level"],
  },
  "evil-twin-detector": {
    usage: "Enter two SSID and BSSID pairs to compare. The tool checks for homoglyph characters in the SSID and whether the BSSID OUI matches the claimed hardware vendor.",
    details: "Compares SSID strings for Unicode substitution attacks (e.g. Cyrillic characters that look like Latin). Checks the OUI (first 3 bytes of BSSID) against vendor lists.",
    outputs: ["SSID comparison with homoglyph flags", "BSSID OUI vendor check", "Suspected evil twin verdict"],
  },
  "social-media-osint": {
    usage: "Enter a social media handle and click Search. The tool queries public APIs for Reddit, GitHub, and HackerNews and checks existence on other platforms.",
    details: "Reddit, GitHub, and HackerNews have free public profile APIs. For other platforms, HTTP status codes are used. Rate limits and platform restrictions are noted.",
    outputs: ["Profile cards per platform", "Display name, bio, follower counts where available", "Note on API limitations"],
  },
  "pastebin-monitor": {
    usage: "Enter a search query (email, domain, or keyword), select the query type, and click Search. Results are checked for credential patterns and flagged accordingly.",
    details: "Queries the psbdmp.ws Pastebin archive API. Results containing email:password patterns are flagged with a red badge.",
    outputs: ["Paste result list with snippets", "Credential pattern flags"],
    warning: "Results may contain sensitive leaked data. Handle with discretion.",
  },
  "code-obfuscator": {
    usage: "Select a tab (JS Minifier, JS Obfuscator, CSS Minifier), paste your code, and click Process. The output shows the transformed code with a character count reduction percentage.",
    details: "Basic client-side transformations: whitespace/comment removal for minification, and variable renaming + string encoding for obfuscation.",
    outputs: ["Transformed code", "Character count before and after", "Reduction percentage"],
  },
  "credential-checker": {
    usage: "Enter the target login URL and optional login path. Add username/password pairs and click Test — but only after checking the disclaimer. This tool is rate-limited to 5 requests per minute.",
    details: "Tests credential pairs against a login endpoint. All usage is logged. Aggressive rate limiting is applied. The disclaimer checkbox is required to enable the tool.",
    outputs: ["Tested count", "Found count", "Per-credential result"],
    warning: "Only test against systems you own or have explicit written permission to test. Unauthorised credential stuffing is illegal in most jurisdictions.",
    prerequisites: ["Written permission from the system owner", "Acceptance of the disclaimer"],
  },
  "payload-encoder": {
    usage: "Paste a raw payload (text or hex shellcode) and select an output format tab. Each tab shows the encoded version with a one-click copy button.",
    details: "Output formats: Base64 (standard), Hex string (0x41 style), URL-encoded (%41), XOR with configurable key, PowerShell [System.Convert]::ToBase64String, Python bytes literal.",
    outputs: ["Encoded payload per format with copy buttons"],
  },
  "xxe-ssti-library": {
    usage: "Switch between the XXE and SSTI tabs. XXE payloads are grouped by attack type. SSTI payloads are grouped by template engine. Click copy on any payload.",
    details: "XXE categories: Basic file read, SSRF, OOB DNS, OOB HTTP, Error-based exfiltration, Billion laughs DoS, PHP filter wrapper. SSTI engines: Jinja2, Twig, Smarty, Freemarker, Velocity, ERB.",
    outputs: ["Payload library with copy buttons", "Engine and attack type labels"],
    warning: "For authorised security testing and CTF research only.",
  },
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
  },
  Exploitation: {
    description: "Offensive security tools for exploitation and payload generation",
    icon: Target
  },
  Password: {
    description: "Password generation, cracking, and analysis utilities",
    icon: Lock
  },
  "Social Engineering": {
    description: "Tools for social engineering reconnaissance and analysis",
    icon: Users
  },
  Utilities: {
    description: "General-purpose developer and security utilities",
    icon: Code
  },
  Mobile: {
    description: "Mobile application security and analysis tools",
    icon: Smartphone
  },
  Wireless: {
    description: "Wireless network security assessment tools",
    icon: Wifi
  },
};