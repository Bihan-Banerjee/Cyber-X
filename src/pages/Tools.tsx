import { Link, useSearchParams } from "react-router-dom";
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
  ShieldCheck,
  Terminal,
  FileCode,
  Binary,
  Fingerprint,
  Cpu,
  Smartphone,
  Wifi,
  Users,
  AlertTriangle,
  BookOpen,
  Code,
  Target,
  Eye,
  Radio,
  Globe2,
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
    // P1 tools
    { icon: Code, name: "Base64 Encoder", description: "Encode and decode Base64, Hex, URL, and Binary formats", path: "/tools/base64-encoder", category: "Crypto", usage: "Select encoding format (Base64, Hex, URL, Binary), choose encode or decode, paste your input, and click Process.", details: "Client-side encoding and decoding utility. No data is sent to the server." },
    { icon: Terminal, name: "Reverse Shell Generator", description: "Generate reverse shell payloads for 13+ languages", path: "/tools/reverse-shell", category: "Exploitation", usage: "Enter LHOST and LPORT, select a shell type, and copy the generated payload.", details: "Generates reverse shell one-liners for bash, Python, PHP, Perl, Ruby, PowerShell, Netcat, and more." },
    { icon: ShieldCheck, name: "SSL/TLS Analyzer", description: "Inspect certificate chain, cipher suites, and TLS misconfigs", path: "/tools/ssl-analyzer", category: "Network", usage: "Enter a domain name to perform a full TLS handshake analysis.", details: "Checks for self-signed certs, expiry, SHA-1 signatures, weak ciphers, and HSTS status." },
    { icon: Globe, name: "HTTP Header Analyzer", description: "Audit security headers and HTTP response details", path: "/tools/http-headers", category: "Web", usage: "Enter a URL to audit its HTTP response security headers.", details: "Checks Strict-Transport-Security, CSP, X-Frame-Options, and more with a security score." },
    { icon: Mail, name: "Email Header Analyzer", description: "Parse email headers and trace SPF/DKIM/DMARC hops", path: "/tools/email-headers", category: "Social Engineering", usage: "Paste raw email headers to visualise the hop chain and authentication results.", details: "Client-side parsing of Received: headers, SPF/DKIM/DMARC authentication results, and spoofing risk." },
    { icon: AlertTriangle, name: "CVE Search", description: "Search the NVD for CVEs by keyword or product", path: "/tools/cve-search", category: "Intel", usage: "Enter a keyword or CVE ID to search the NIST NVD database.", details: "Returns CVEs with CVSS scores, affected products, and references from the NVD API." },
    { icon: Hash, name: "File Hash Calculator", description: "Compute MD5, SHA1, SHA256, SHA512 for any file", path: "/tools/file-hash", category: "Forensics", usage: "Upload a file to compute MD5, SHA-1, SHA-256, and SHA-512 hashes.", details: "All hashing is server-side using Node.js crypto. Includes MIME detection and VirusTotal link." },
    { icon: Key, name: "Password Generator", description: "Generate cryptographically secure passwords with entropy scoring", path: "/tools/password-gen", category: "Password", usage: "Adjust length and character sets. The password generates automatically with entropy scoring.", details: "Uses crypto.getRandomValues. Shows entropy in bits and estimated crack time." },
    // P2 tools
    { icon: Search, name: "Username Enumerator", description: "Check username existence across 16 social platforms", path: "/tools/username-enum", category: "Recon", usage: "Enter a username to check its existence across GitHub, Reddit, Twitter, and 13 more platforms.", details: "HTTP status checks against 16 platforms. Results filter by Found/Not Found/Error." },
    { icon: Bug, name: "Malware Hash Lookup", description: "Check file hashes against MalwareBazaar and VirusTotal", path: "/tools/malware-hash", category: "Intel", usage: "Paste an MD5, SHA-1, or SHA-256 hash to query MalwareBazaar.", details: "Auto-detects hash type. Queries MalwareBazaar free API. Optional VirusTotal query with API key." },
    { icon: Database, name: "SQL Injection Tester", description: "Detect error-based, boolean-blind, and time-based SQLi", path: "/tools/sqli-test", category: "Web", usage: "Enter URL, parameter name, and HTTP method. Tests for error-based, boolean-blind, and time-based SQL injection.", details: "Tests 10 payloads and detects via DB error strings, response length differences, and delays > 2.5s." },
    { icon: Zap, name: "XSS Payload Generator", description: "Test for reflected XSS and browse context-specific payloads", path: "/tools/xss-test", category: "Web", usage: "Active Tester tab: test a URL for reflected XSS. Payload Library tab: browse and copy payloads by context.", details: "Detects reflection only. Payload library covers HTML, attribute, JS, URL, and filter-bypass contexts." },
    { icon: Fingerprint, name: "Tech Fingerprinter", description: "Detect CMS, frameworks, CDN, and server technologies", path: "/tools/tech-fingerprint", category: "Recon", usage: "Enter a URL to detect technologies from headers, meta tags, body patterns, and cookies.", details: "Detects 40+ technologies including WordPress, React, Cloudflare, and more with confidence scoring." },
    { icon: Network, name: "CIDR Calculator", description: "Calculate subnet masks, host ranges, and network addresses", path: "/tools/cidr-calc", category: "Utilities", usage: "Enter a CIDR block (e.g. 192.168.1.0/24) to instantly calculate all subnet details.", details: "Client-side bitwise arithmetic. No server request needed." },
    { icon: FileSearch, name: "Wordlist Generator", description: "Generate targeted wordlists with leet, years, and suffix mutations", path: "/tools/wordlist-gen", category: "Password", usage: "Add keywords, toggle mutations (leet, years, suffixes, capitalisation), and download the wordlist.", details: "Generates variants of each keyword. De-duplicates with a Set. Capped at 50,000 words." },
    { icon: FileCode, name: "JSON Beautifier", description: "Format, validate, and minify JSON and XML", path: "/tools/json-beautifier", category: "Utilities", usage: "Paste JSON or XML. The right panel shows formatted output. Toggle minify for compact output.", details: "Client-side formatting. JSON uses JSON.parse/stringify. XML uses DOMParser." },
    { icon: Search, name: "CT Log Search", description: "Discover subdomains via Certificate Transparency logs", path: "/tools/ct-search", category: "Recon", usage: "Enter a domain to query crt.sh for all SSL certificates ever issued, extracting unique subdomains.", details: "Queries the crt.sh CT log aggregator. Useful for subdomain discovery." },
    { icon: Mail, name: "Email Spoof Checker", description: "Check SPF, DKIM, DMARC and domain spoofability", path: "/tools/email-spoof-check", category: "Social Engineering", usage: "Enter a domain to check SPF, DMARC, and DKIM records and evaluate spoofability.", details: "DNS lookups for SPF, DMARC, and 10 common DKIM selectors. Spoofable verdict based on policy." },
    // P3 tools
    { icon: Shield, name: "IP Reputation Checker", description: "Check IP abuse score, proxy, VPN, and Tor status", path: "/tools/ip-reputation", category: "Intel", usage: "Enter an IP address to query AbuseIPDB for abuse reports and reputation data.", details: "Returns abuse confidence score, proxy/VPN/Tor flags, and ISP info. Requires ABUSEIPDB_API_KEY." },
    { icon: Code, name: "URL Encoder", description: "URL encode/decode, HTML entity, and Unicode escape utilities", path: "/tools/url-encoder", category: "Utilities", usage: "Paste text and apply URL encode/decode, HTML entity encode/decode, or Unicode escape transforms.", details: "Client-side character transformations. Useful for payload crafting and debugging." },
    { icon: Binary, name: "Hex Viewer", description: "Classic hex dump with entropy analysis and MIME detection", path: "/tools/hex-view", category: "Forensics", usage: "Upload a file to view the first 10 KB as a classic hex dump with entropy analysis.", details: "16 bytes per row: offset | hex | ASCII. Non-printable chars shown as dots." },
    { icon: FileSearch, name: "String Extractor", description: "Extract ASCII and Unicode strings from binary files", path: "/tools/string-extract", category: "Forensics", usage: "Upload a binary file to extract printable ASCII and UTF-16 strings, categorised by type.", details: "Categorises into URLs, emails, IPs, file paths, registry keys, and other." },
    { icon: FileImage, name: "File Type Identifier", description: "Identify file types by magic bytes and flag disguised files", path: "/tools/file-type", category: "Forensics", usage: "Upload a file to identify its real type from magic bytes and check for extension mismatch.", details: "Detects PDF, PNG, JPEG, ZIP, EXE, ELF, GIF, RAR, 7-Zip, and Office formats." },
    { icon: Database, name: "Default Credentials DB", description: "Searchable database of vendor default usernames and passwords", path: "/tools/default-creds", category: "Exploitation", usage: "Search by vendor or device type to find factory-default credentials.", details: "Covers routers, cameras, databases, and web apps. Static client-side database." },
    { icon: Bug, name: "Exploit-DB Search", description: "Search Exploit-DB for public exploits by keyword or CVE", path: "/tools/exploit-search", category: "Exploitation", usage: "Enter a product name or CVE to search Exploit-DB for public exploits.", details: "Queries the Exploit-DB search API. Results include type (Remote/Local/WebApps/DoS) and platform badges." },
    { icon: ShieldCheck, name: "Cookie Analyzer", description: "Audit cookies for HttpOnly, Secure, SameSite security flags", path: "/tools/cookie-analyze", category: "Web", usage: "Enter a URL to fetch its cookies and audit each one for missing security flags.", details: "Checks HttpOnly, Secure, SameSite, and expiry. Returns a security score." },
    { icon: Target, name: "SSRF Tester", description: "Test parameters for Server-Side Request Forgery vulnerabilities", path: "/tools/ssrf-test", category: "Web", usage: "Enter URL and parameter name. Tests SSRF payloads including internal IPs and AWS metadata.", details: "Detects SSRF by analysing responses for internal content and credential signatures." },
    { icon: Code, name: "CSRF PoC Generator", description: "Generate self-submitting HTML forms for CSRF proof-of-concept", path: "/tools/csrf-poc", category: "Web", usage: "Enter target URL, method, and parameters to generate a self-submitting CSRF proof-of-concept HTML page.", details: "Client-side HTML form generator. Useful for bug bounty PoC reports." },
    { icon: Activity, name: "Traceroute", description: "Trace the network path to a host hop by hop", path: "/tools/traceroute", category: "Network", usage: "Enter a hostname or IP to trace the network route with RTT per hop.", details: "Runs system traceroute/tracert and parses output. Timeouts shown as * * *." },
    { icon: Globe, name: "BGP / ASN Lookup", description: "Look up ASN details, prefixes, peers, and upstreams", path: "/tools/asn-lookup", category: "Network", usage: "Enter an IP or ASN (e.g. AS15169) to look up routing information.", details: "Queries the free BGPView API for prefixes, peers, upstreams, and downstreams." },
    { icon: Lock, name: "PGP Key Generator", description: "Generate PGP key pairs and encrypt/decrypt messages", path: "/tools/pgp-gen", category: "Crypto", usage: "Enter name, email, key type, and passphrase to generate a PGP key pair.", details: "UI framework for PGP key generation using the OpenPGP.js library." },
    { icon: Activity, name: "Entropy Analyzer", description: "Compute Shannon entropy and character frequency of text", path: "/tools/entropy", category: "Crypto", usage: "Paste text to instantly compute Shannon entropy and view the character frequency histogram.", details: "Client-side. High entropy (>7.5) often indicates encrypted or encoded data." },
    { icon: Smartphone, name: "Phone OSINT", description: "Validate and look up carrier, line type, and location for phone numbers", path: "/tools/phone-lookup", category: "Intel", usage: "Enter a phone number in international format to validate and look up carrier info.", details: "Uses libphonenumber-js. Carrier lookup requires NUMVERIFY_API_KEY." },
    { icon: Shield, name: "Domain Reputation", description: "Check a domain for phishing, malware, and spam listings", path: "/tools/domain-reputation", category: "Intel", usage: "Enter a domain to check it against PhishTank, DNSBL, and optional VirusTotal.", details: "Aggregates data from multiple reputation feeds. Returns a 0–100 score." },
    { icon: ShieldAlert, name: "WAF Bypass Generator", description: "Generate obfuscated XSS and SQLi payload variants", path: "/tools/waf-bypass", category: "Web", usage: "Paste a raw XSS or SQLi payload to generate 10-15 obfuscated variants.", details: "Client-side. Produces case mutations, encoding variants, and comment insertions." },
    { icon: Search, name: "Robots.txt Analyzer", description: "Fetch and parse robots.txt for interesting disallowed paths", path: "/tools/robots-analyze", category: "Recon", usage: "Enter a domain to fetch and parse its robots.txt, highlighting interesting disallowed paths.", details: "Highlights paths matching admin, backup, config, private, secret, internal, staging, upload, api." },
    { icon: Code, name: "Number Base Converter", description: "Convert between Binary, Octal, Decimal, Hex, and ASCII", path: "/tools/base-converter", category: "Utilities", usage: "Type in any field (Binary, Octal, Decimal, Hex). All others update instantly.", details: "Client-side bitwise conversion. Also shows the corresponding ASCII character." },
    { icon: Code, name: "Regex Tester", description: "Test and debug regular expressions with match highlighting", path: "/tools/regex-tester", category: "Utilities", usage: "Enter pattern, flags, and test string to see highlighted matches and captured groups.", details: "Client-side RegExp. Includes quick reference for email, IP, URL, and phone patterns." },
    { icon: Network, name: "SNMP Scanner", description: "Probe SNMP community strings and enumerate device OIDs", path: "/tools/snmp-scan", category: "Network", usage: "Enter target IP and community string to retrieve device information via SNMP.", details: "Queries sysDescr, sysName, sysLocation, sysUpTime OIDs. Flags 'public' community as high severity." },
    { icon: Shield, name: "WAF Detector", description: "Detect Web Application Firewalls from response signatures", path: "/tools/waf-detect", category: "Network", usage: "Enter a URL to detect WAF presence from response headers and body patterns.", details: "Detects Cloudflare, Akamai, Sucuri, ModSecurity, and AWS WAF from response signatures." },
    { icon: Scan, name: "Host Discovery", description: "Discover live hosts on a subnet via ARP and ICMP", path: "/tools/host-discovery", category: "Network", usage: "Enter a subnet CIDR (e.g. 192.168.1.0/24) to discover live hosts.", details: "Combines ARP cache lookup and TCP connect attempts on port 80." },
    { icon: ShieldCheck, name: "Password Strength Analyzer", description: "Score passwords with entropy, crack time, and pattern detection", path: "/tools/password-strength", category: "Password", usage: "Type a password to see live entropy, crack time estimates, and pattern detection.", details: "Client-side analysis. Estimates crack time at online throttled, offline MD5, and offline bcrypt speeds." },
    { icon: Hash, name: "Hash Generator", description: "Generate bcrypt, SHA-256, SHA-512, and MD5 hashes with verification", path: "/tools/hash-generate", category: "Crypto", usage: "Enter plaintext and select algorithm to generate hash. Use Verify tab to check a stored hash.", details: "bcrypt uses bcryptjs. SHA/MD5 use Node.js crypto. Generation time helps choose work factor." },
    { icon: Lock, name: "SSL Certificate Decoder", description: "Decode PEM certificates and extract subject, SANs, and fingerprints", path: "/tools/ssl-cert-decode", category: "Crypto", usage: "Paste a PEM certificate to decode its subject, issuer, validity, SANs, and fingerprints.", details: "Client-side PEM parsing. Extracts base fields without a full ASN.1 library." },
    { icon: Code, name: "XXE Payload Library", description: "Browse and copy XXE payloads for file read, SSRF, OOB, and DoS", path: "/tools/xxe-payloads", category: "Web", usage: "Browse payloads by category. Copy any payload with one click. Explanations included.", details: "Categories: Basic file read, SSRF, OOB DNS, OOB HTTP, Error-based, Billion laughs, PHP filters." },
    { icon: ArrowLeftRight, name: "Open Redirect Finder", description: "Test URL parameters for open redirect vulnerabilities", path: "/tools/open-redirect", category: "Web", usage: "Enter URL and parameter name. Tests for open redirect via malicious redirect payloads.", details: "Uses fetch with redirect:manual. Checks Location header against injected payloads." },
    { icon: Globe, name: "Web Crawler", description: "Crawl websites to map pages, forms, JS endpoints, and emails", path: "/tools/web-crawl", category: "Recon", usage: "Enter a starting URL with max depth and page limits to crawl and map a website.", details: "BFS crawling same-origin. Extracts links, forms, script sources, and email addresses." },
    { icon: Server, name: "Banner Grabber", description: "Grab service banners from open TCP ports", path: "/tools/banner-grab", category: "Recon", usage: "Enter a target and comma-separated ports to grab service banners from each.", details: "TCP connects and reads the first response. Parses known patterns for service/version." },
    { icon: FileSearch, name: "Log Analyzer", description: "Parse Apache, Nginx, and auth logs for anomalies and brute-force", path: "/tools/log-analyze", category: "Forensics", usage: "Upload a log file and select format. Shows stats, top IPs, and anomalies.", details: "Flags brute-force (>10 failed logins from one IP), 4xx spikes, and scanner user-agents." },
    { icon: FileSearch, name: "PDF Forensics", description: "Extract metadata and detect JavaScript and embedded objects in PDFs", path: "/tools/pdf-forensics", category: "Forensics", usage: "Upload a PDF to extract metadata and scan for JavaScript, embedded files, and suspicious features.", details: "Scans raw PDF bytes for /JavaScript, /Launch, /EmbeddedFile, /URI keywords." },
    { icon: Binary, name: "Binary Analyzer", description: "Parse PE, ELF, and Mach-O headers, imports, and section entropy", path: "/tools/binary-analyze", category: "Forensics", usage: "Upload an executable to identify format, architecture, imports, sections, and entropy.", details: "Parses PE, ELF, and Mach-O magic bytes. Entropy > 7.2 suggests packing." },
    { icon: Hash, name: "Hash Identifier", description: "Instantly identify hash algorithms by length and character pattern", path: "/tools/hash-identify", category: "Password", usage: "Paste a hash string to instantly see a ranked list of likely algorithms.", details: "Client-side. Identifies MD5, SHA-1, SHA-256, SHA-512, bcrypt, NTLM, Argon2, and more." },
    { icon: Key, name: "Mask Attack Builder", description: "Build Hashcat mask patterns and estimate keyspace crack time", path: "/tools/mask-builder", category: "Password", usage: "Click character class buttons to build a mask pattern and see crack time estimates.", details: "Exports ready-to-use Hashcat -a 3 command. Includes preset patterns." },
    { icon: AlertTriangle, name: "Phishing URL Detector", description: "Score URLs for typosquatting, homoglyphs, and phishing indicators", path: "/tools/phishing-check", category: "Intel", usage: "Enter a URL to score it against multiple phishing indicators.", details: "Checks typosquatting, IP in URL, length, @ symbol, subdomain depth, and suspicious keywords." },
    { icon: Activity, name: "Epoch Converter", description: "Convert Unix timestamps, ISO 8601, and human-readable dates", path: "/tools/epoch-converter", category: "Utilities", usage: "Enter any date/time format to convert. Current timestamp updates every second.", details: "Client-side JavaScript Date API. Supports all IANA timezone names." },
    { icon: Globe, name: "HTTP Request Builder", description: "Send custom HTTP requests with headers, body, and auth — like Postman", path: "/tools/http-request", category: "Utilities", usage: "Select method, enter URL, add headers and body, and send. Full response shown in the panel.", details: "Routes through backend to bypass browser CORS restrictions. Response capped at 1 MB." },
    // P4 tools
    { icon: Smartphone, name: "APK Analyzer", description: "Extract permissions, activities, and hardcoded strings from APK files", path: "/tools/apk-analyze", category: "Mobile", usage: "Upload an APK to extract permissions, activities, and scan for hardcoded strings.", details: "Reads the APK ZIP structure and parses AndroidManifest.xml. Flags dangerous permissions." },
    { icon: Wifi, name: "WiFi Handshake Cracker", description: "Attempt WPA handshake cracking with a custom wordlist", path: "/tools/wifi-crack", category: "Wireless", usage: "Upload a capture file and provide a wordlist to attempt WPA handshake cracking.", details: "Uses PBKDF2-SHA1 WPA PMK derivation. Limited to 1,000 words." },
    { icon: Database, name: "Azure Blob Finder", description: "Discover exposed Azure Blob Storage containers", path: "/tools/azure-blob-find", category: "Cloud", usage: "Enter a keyword to probe for public Azure Blob Storage containers.", details: "Generates naming patterns and tests each at *.blob.core.windows.net." },
    { icon: Database, name: "GCP Bucket Finder", description: "Discover exposed Google Cloud Storage buckets", path: "/tools/gcp-bucket-find", category: "Cloud", usage: "Enter a keyword to probe for public GCP Storage buckets.", details: "Tests names at storage.googleapis.com. Mirrors S3 Bucket Finder patterns." },
    { icon: Cpu, name: "ROP Gadget Finder", description: "Find RET-based gadgets in x86/x64 binaries for exploit chaining", path: "/tools/rop-gadgets", category: "Exploitation", usage: "Upload an x86/x64 binary to scan for ROP gadgets filterable by instruction type.", details: "Scans backwards from RET bytes. Exports as Python list for pwntools." },
    { icon: Target, name: "Buffer Overflow Calc", description: "Calculate offsets, build payloads, and size NOP sleds", path: "/tools/buffer-overflow", category: "Exploitation", usage: "Use Offset Calculator, Payload Builder, and NOP Sled tabs for buffer overflow exploit development.", details: "Client-side. Three tabs for offset calculation, payload skeleton, and NOP sled sizing." },
    { icon: Eye, name: "Homoglyph Generator", description: "Generate lookalike domain variants using Unicode substitution", path: "/tools/homoglyph-gen", category: "Social Engineering", usage: "Enter a domain to generate homoglyph substitution variants and typosquatting alternatives.", details: "Generates Unicode lookalikes for a, e, o, c, and more. Also produces typosquatting variants." },
    { icon: Eye, name: "Dark Web Checker", description: "Search indexed dark-web sources for mentions of a query", path: "/tools/dark-web-check", category: "Intel", usage: "Enter an email, domain, or keyword to search the Ahmia.fi dark-web index.", details: "Queries the Ahmia.fi indexed search engine. Not a real-time dark-web scan." },
    { icon: Database, name: "Disk Image Analyzer", description: "Parse MBR partition tables and identify filesystem types", path: "/tools/disk-analyze", category: "Forensics", usage: "Upload a disk image to parse the MBR and partition table.", details: "Reads the first 512 bytes. Checks boot signature and parses four partition entries." },
    { icon: Smartphone, name: "ADB Command Builder", description: "Build Android Debug Bridge commands with descriptions and copy", path: "/tools/adb-gen", category: "Mobile", usage: "Browse ADB commands by category and copy them with one click.", details: "Static client-side reference library with ~20 useful ADB commands." },
    { icon: Wifi, name: "Bluetooth Scanner", description: "Scan nearby Bluetooth devices using the Web Bluetooth API", path: "/tools/bt-scan", category: "Wireless", usage: "Click Scan to request Bluetooth permission and discover nearby devices.", details: "Uses the Web Bluetooth API. Requires Chrome or Edge on a Bluetooth-capable device." },
    { icon: Users, name: "Company OSINT", description: "Aggregate subdomains, emails, tech stack, and cloud assets for a company", path: "/tools/company-osint", category: "Intel", usage: "Enter a company name and domain to aggregate OSINT from multiple sources.", details: "Queries crt.sh, ipinfo.io, and optionally Hunter.io (HUNTER_API_KEY required)." },
    { icon: FileSearch, name: "Text Diff", description: "Compare two text blocks with line, word, and character diff modes", path: "/tools/text-diff", category: "Utilities", usage: "Paste text into both panels to see a colour-highlighted diff.", details: "Client-side line-by-line LCS diff. Toggle line/word/character modes." },
    { icon: Database, name: "AWS Metadata Tester", description: "Test SSRF parameters for AWS IMDS access and credential exposure", path: "/tools/aws-metadata", category: "Cloud", usage: "Enter URL and parameter to test for AWS IMDS SSRF vulnerabilities.", details: "Specifically targets the AWS Instance Metadata Service. Flags credential exposure." },
    { icon: ShieldCheck, name: "Cloud IAM Auditor", description: "Audit AWS IAM policies for wildcard actions and privilege escalation", path: "/tools/iam-audit", category: "Cloud", usage: "Paste an AWS IAM policy JSON to audit for dangerous permissions and wildcards.", details: "Flags wildcard actions, missing conditions, and dangerous privilege escalation patterns." },
    { icon: Database, name: "Cloud Asset Enumerator", description: "Enumerate exposed S3, Azure, GCP, and Firebase assets from a domain", path: "/tools/cloud-assets", category: "Cloud", usage: "Enter a domain and org name to probe cloud storage endpoints for public exposure.", details: "Tests S3, Azure Blob, GCP Storage, and Firebase Realtime DB endpoints." },
    { icon: Smartphone, name: "Mobile Permission Auditor", description: "Analyze Android and iOS permission lists for risk and dangerous combos", path: "/tools/permission-audit", category: "Mobile", usage: "Paste permissions and select platform to get a risk assessment.", details: "Client-side analysis. Flags dangerous Android permissions and risky combinations." },
    { icon: Wifi, name: "Evil Twin Detector", description: "Compare SSID/BSSID pairs for homoglyph and vendor spoofing", path: "/tools/evil-twin", category: "Wireless", usage: "Enter two SSID/BSSID pairs to compare for evil twin indicators.", details: "Checks for Unicode homoglyphs in SSID and OUI vendor mismatch in BSSID." },
    { icon: Users, name: "Social Media OSINT", description: "Extract public profile data from Reddit, GitHub, HackerNews, and more", path: "/tools/social-osint", category: "Intel", usage: "Enter a social media handle to check existence and extract public profile data.", details: "Public API queries for Reddit, GitHub, HackerNews. HTTP checks for others." },
    { icon: Eye, name: "Pastebin Monitor", description: "Search public paste sites for email, domain, or keyword mentions", path: "/tools/pastebin-search", category: "Intel", usage: "Enter a query to search psbdmp.ws for public paste mentions.", details: "Flags pastes containing credential patterns (email:password format) with red badges." },
    { icon: Code, name: "Code Obfuscator", description: "Minify and obfuscate JavaScript, and minify CSS", path: "/tools/code-obfuscator", category: "Utilities", usage: "Select JS Minifier, JS Obfuscator, or CSS Minifier tab and paste your code to transform it.", details: "Client-side basic minification and obfuscation with character count reduction display." },
    { icon: ShieldAlert, name: "Credential Checker", description: "Test credential lists against a login endpoint you own", path: "/tools/credential-check", category: "Password", usage: "Enter login endpoint and credential pairs. Requires disclaimer acceptance. Rate-limited to 5/min.", details: "Tests credentials against a login endpoint. All usage is logged. Requires system ownership." },
    { icon: Code, name: "Payload Encoder", description: "Encode payloads in Base64, Hex, XOR, PowerShell, and Python formats", path: "/tools/payload-encoder", category: "Exploitation", usage: "Paste a raw payload and switch between output format tabs to copy each encoded version.", details: "Client-side encoding in 6 formats: Base64, Hex, URL, XOR, PowerShell, Python bytes." },
    { icon: BookOpen, name: "XXE / SSTI Library", description: "Browse XXE and SSTI payload libraries for all major template engines", path: "/tools/xxe-ssti", category: "Web", usage: "Switch between XXE and SSTI tabs to browse and copy payloads for each attack type and engine.", details: "XXE: 7 categories. SSTI: detection and exploitation payloads for Jinja2, Twig, Smarty, Freemarker, Velocity, ERB." },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const setPage = (value: number | ((prev: number) => number)) => {
    const next = typeof value === "function" ? value(page) : value;
    setSearchParams((p) => { p.set("page", String(next)); return p; }, { replace: true });
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(
    new Set(["Network", "Recon", "Web", "Cloud", "Crypto", "Forensics", "Intel", "Exploitation", "Password", "Social Engineering", "Utilities", "Mobile", "Wireless"])
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
      Exploitation: "bg-red-900/20 text-red-300 border-red-900/50",
      Password: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      "Social Engineering": "bg-pink-500/20 text-pink-400 border-pink-500/50",
      Utilities: "bg-slate-500/20 text-slate-400 border-slate-500/50",
      Mobile: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
      Wireless: "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
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
      {hoveredTool && hoveredToolData && (() => {
        const TOOLTIP_W = 420;
        const TOOLTIP_H = 260; // estimated max height
        const MARGIN = 12;
        const flipX = tooltipPosition.x + TOOLTIP_W + MARGIN > window.innerWidth;
        const flipY = tooltipPosition.y + TOOLTIP_H + MARGIN > window.innerHeight;
        const left = flipX
          ? tooltipPosition.x - TOOLTIP_W - MARGIN
          : tooltipPosition.x + MARGIN;
        const top = flipY
          ? tooltipPosition.y - TOOLTIP_H - MARGIN
          : tooltipPosition.y + MARGIN;
        return (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: `${left}px`, top: `${top}px`, maxWidth: `${TOOLTIP_W}px` }}
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
        );
      })()}
    </>
  );
};

export default Tools;
