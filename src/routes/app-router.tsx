import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
const Home = lazy(() => import("@/pages/Home"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Tools = lazy(() => import("@/pages/Tools"));
const HoneypotMonitor = lazy(() => import("../pages/HoneypotMonitor"));
const PortScanner = lazy(() => import("@/pages/tools/PortScanner"));
const CipherTool = lazy(() => import("@/pages/tools/CipherTool"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const OSFingerprint = lazy(() => import("@/pages/tools/OSFingerprint"));
const WHOISLookup = lazy(() => import("@/pages/tools/WHOISLookup"));
const ServiceDetection = lazy(() => import("@/pages/tools/ServiceDetection"));
const SubdomainEnumeration = lazy(() => import("@/pages/tools/SubdomainEnumeration"));
const DNSRecon = lazy(() => import("@/pages/tools/DNSRecon"));
const APIScanner = lazy(() => import("@/pages/tools/APIScanner"));
const EmailBreachChecker = lazy(() => import("../pages/tools/EmailBreachChecker"));
const HashCracker = lazy(() => import("@/pages/tools/HashCracker"));
const DirectoryFuzzer = lazy(() => import("@/pages/tools/DirectoryFuzzer"));
const BrokenAuthChecker = lazy(() => import("@/pages/tools/BrokenAuthChecker"));
const ContainerScanner = lazy(() => import("@/pages/tools/ContainerScanner"));
const VulnerabilityFuzzer = lazy(() => import("@/pages/tools/VulnerabilityFuzzer"));
const S3BucketFinder = lazy(() => import("@/pages/tools/S3BucketFinder"));
const K8sEnumerator = lazy(() => import("@/pages/tools/K8sEnumerator"));
const JWTDecoder = lazy(() => import("@/pages/tools/JWTDecoder"));
const IPGeolocation = lazy(() => import("@/pages/tools/IPGeolocation"));
const ReverseIPLookup = lazy(() => import("@/pages/tools/ReverseIPLookup"));
const RSAESEncryption = lazy(() => import("@/pages/tools/RSAESEncryption"));
const PacketAnalyzer = lazy(() => import("@/pages/tools/PacketAnalyzer"));
const ImageMetadataExtractor = lazy(() => import("@/pages/tools/ImageMetaDataExtractor"));
const ImageSteganography = lazy(() => import("@/pages/tools/ImageSteganography"));
const AudioSteganography = lazy(() => import("@/pages/tools/AudioSteganography"));
const DocumentSteganography = lazy(() => import("@/pages/tools/DocumentSteganography"));
const VideoSteganography = lazy(() => import("@/pages/tools/VideoSteganography"));
const GoogleDorkGenerator = lazy(() => import("@/pages/tools/GoogleDorkGenerator"));
const PacketCapturer = lazy(() => import("@/pages/tools/PacketCapturer"));
const RLArena = lazy(() => import("@/pages/RLArena"));
const RedVsBlue = lazy(() => import("@/pages/RedVsBlue"));
const CommandCenter = lazy(() => import("@/pages/CommandCenter"));
const WorldMap = lazy(() => import('@/components/WorldMap'));
const Guide = lazy(() => import("@/pages/Guide"));
const Base64Encoder = lazy(() => import("@/pages/tools/Base64Encoder"));
const ReverseShellGenerator = lazy(() => import("@/pages/tools/ReverseShellGenerator"));
const SSLAnalyzer = lazy(() => import("@/pages/tools/SSLAnalyzer"));
const HTTPHeaderAnalyzer = lazy(() => import("@/pages/tools/HTTPHeaderAnalyzer"));
const EmailHeaderAnalyzer = lazy(() => import("@/pages/tools/EmailHeaderAnalyzer"));
const CVESearch = lazy(() => import("@/pages/tools/CVESearch"));
const FileHashCalculator = lazy(() => import("@/pages/tools/FileHashCalculator"));
const PasswordGenerator = lazy(() => import("@/pages/tools/PasswordGenerator"));
const UsernameEnumerator = lazy(() => import("@/pages/tools/UsernameEnumerator"));
const MalwareHashLookup = lazy(() => import("@/pages/tools/MalwareHashLookup"));
const SQLInjectionTester = lazy(() => import("@/pages/tools/SQLInjectionTester"));
const XSSPayloadGenerator = lazy(() => import("@/pages/tools/XSSPayloadGenerator"));
const WebsiteTechFingerprinter = lazy(() => import("@/pages/tools/WebsiteTechFingerprinter"));
const CIDRCalculator = lazy(() => import("@/pages/tools/CIDRCalculator"));
const WordlistGenerator = lazy(() => import("@/pages/tools/WordlistGenerator"));
const JSONBeautifier = lazy(() => import("@/pages/tools/JSONBeautifier"));
const CTLogSearch = lazy(() => import("@/pages/tools/CTLogSearch"));
const SpoofedEmailChecker = lazy(() => import("@/pages/tools/SpoofedEmailChecker"));
const IPReputationChecker = lazy(() => import("@/pages/tools/IPReputationChecker"));
const URLEncoder = lazy(() => import("@/pages/tools/URLEncoder"));
const HexViewer = lazy(() => import("@/pages/tools/HexViewer"));
const StringExtractor = lazy(() => import("@/pages/tools/StringExtractor"));
const FileTypeIdentifier = lazy(() => import("@/pages/tools/FileTypeIdentifier"));
const DefaultCredentialsDB = lazy(() => import("@/pages/tools/DefaultCredentialsDB"));
const ExploitDBSearch = lazy(() => import("@/pages/tools/ExploitDBSearch"));
const CookieAnalyzer = lazy(() => import("@/pages/tools/CookieAnalyzer"));
const SSRFTester = lazy(() => import("@/pages/tools/SSRFTester"));
const CSRFPoCGenerator = lazy(() => import("@/pages/tools/CSRFPoCGenerator"));
const Traceroute = lazy(() => import("@/pages/tools/Traceroute"));
const BGPASNLookup = lazy(() => import("@/pages/tools/BGPASNLookup"));
const PGPKeyGenerator = lazy(() => import("@/pages/tools/PGPKeyGenerator"));
const EntropyAnalyzer = lazy(() => import("@/pages/tools/EntropyAnalyzer"));
const PhoneNumberOSINT = lazy(() => import("@/pages/tools/PhoneNumberOSINT"));
const DomainReputation = lazy(() => import("@/pages/tools/DomainReputation"));
const WAFBypassGenerator = lazy(() => import("@/pages/tools/WAFBypassGenerator"));
const RobotsTxtAnalyzer = lazy(() => import("@/pages/tools/RobotsTxtAnalyzer"));
const NumberBaseConverter = lazy(() => import("@/pages/tools/NumberBaseConverter"));
const RegexTester = lazy(() => import("@/pages/tools/RegexTester"));
const SNMPScanner = lazy(() => import("@/pages/tools/SNMPScanner"));
const WAFDetector = lazy(() => import("@/pages/tools/WAFDetector"));
const ARPHostDiscovery = lazy(() => import("@/pages/tools/ARPHostDiscovery"));
const PasswordStrengthAnalyzer = lazy(() => import("@/pages/tools/PasswordStrengthAnalyzer"));
const BCryptGenerator = lazy(() => import("@/pages/tools/BCryptGenerator"));
const SSLCertDecoder = lazy(() => import("@/pages/tools/SSLCertDecoder"));
const XXEPayloadGenerator = lazy(() => import("@/pages/tools/XXEPayloadGenerator"));
const OpenRedirectFinder = lazy(() => import("@/pages/tools/OpenRedirectFinder"));
const WebCrawler = lazy(() => import("@/pages/tools/WebCrawler"));
const BannerGrabber = lazy(() => import("@/pages/tools/BannerGrabber"));
const LogAnalyzer = lazy(() => import("@/pages/tools/LogAnalyzer"));
const PDFForensics = lazy(() => import("@/pages/tools/PDFForensics"));
const BinaryAnalyzer = lazy(() => import("@/pages/tools/BinaryAnalyzer"));
const HashIdentifier = lazy(() => import("@/pages/tools/HashIdentifier"));
const MaskAttackBuilder = lazy(() => import("@/pages/tools/MaskAttackBuilder"));
const PhishingURLDetector = lazy(() => import("@/pages/tools/PhishingURLDetector"));
const EpochConverter = lazy(() => import("@/pages/tools/EpochConverter"));
const HTTPRequestBuilder = lazy(() => import("@/pages/tools/HTTPRequestBuilder"));
const APKAnalyzer = lazy(() => import("@/pages/tools/APKAnalyzer"));
const WifiHandshakeCracker = lazy(() => import("@/pages/tools/WifiHandshakeCracker"));
const AzureBlobFinder = lazy(() => import("@/pages/tools/AzureBlobFinder"));
const GCPBucketFinder = lazy(() => import("@/pages/tools/GCPBucketFinder"));
const ROPGadgetFinder = lazy(() => import("@/pages/tools/ROPGadgetFinder"));
const BufferOverflowCalc = lazy(() => import("@/pages/tools/BufferOverflowCalc"));
const HomoglyphGenerator = lazy(() => import("@/pages/tools/HomoglyphGenerator"));
const DarkWebChecker = lazy(() => import("@/pages/tools/DarkWebChecker"));
const DiskImageAnalyzer = lazy(() => import("@/pages/tools/DiskImageAnalyzer"));
const ADBGenerator = lazy(() => import("@/pages/tools/ADBGenerator"));
const BluetoothScanner = lazy(() => import("@/pages/tools/BluetoothScanner"));
const CompanyOSINT = lazy(() => import("@/pages/tools/CompanyOSINT"));
const TextDiff = lazy(() => import("@/pages/tools/TextDiff"));
const AWSMetadataTester = lazy(() => import("@/pages/tools/AWSMetadataTester"));
const CloudIAMAuditor = lazy(() => import("@/pages/tools/CloudIAMAuditor"));
const CloudAssetEnumerator = lazy(() => import("@/pages/tools/CloudAssetEnumerator"));
const MobilePermissionAuditor = lazy(() => import("@/pages/tools/MobilePermissionAuditor"));
const EvilTwinDetector = lazy(() => import("@/pages/tools/EvilTwinDetector"));
const SocialMediaOSINT = lazy(() => import("@/pages/tools/SocialMediaOSINT"));
const PastebinMonitor = lazy(() => import("@/pages/tools/PastebinMonitor"));
const CodeObfuscator = lazy(() => import("@/pages/tools/CodeObfuscator"));
const CredentialChecker = lazy(() => import("@/pages/tools/CredentialChecker"));
const PayloadEncoder = lazy(() => import("@/pages/tools/PayloadEncoder"));
const XXESSILibrary = lazy(() => import("@/pages/tools/XXESSILibrary"));

const PageLoader = () => (
  <div className="w-full flex items-center justify-center py-24 text-cyber-cyan/70 text-sm tracking-widest animate-pulse">
    LOADING...
  </div>
);

const AppRouter = () => {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/port-scanner" element={<PortScanner />} />
        <Route path="/tools/os-fingerprint" element={<OSFingerprint />} />
        <Route path="/tools/whois" element={<WHOISLookup />} />
        <Route path="/tools/service-detect" element={<ServiceDetection />} />
        <Route path="/tools/subdomains" element={<SubdomainEnumeration />} />
        <Route path="/tools/dns-recon" element={<DNSRecon />} />
        <Route path="/tools/api-scanner" element={<APIScanner />} />
        <Route path="/tools/hash-cracker" element={<HashCracker />} />
        <Route path="/tools/breach-check" element={<EmailBreachChecker />} />
        <Route path="/tools/dir-fuzzer" element={<DirectoryFuzzer />} />
        <Route path="/tools/broken-auth" element={<BrokenAuthChecker />} />
        <Route path="/tools/container-scan" element={<ContainerScanner />} />
        <Route path="/tools/ciphers" element={<CipherTool />} />
        <Route path="/tools/vuln-fuzzer" element={<VulnerabilityFuzzer />} />
        <Route path="/tools/s3-finder" element={<S3BucketFinder />} />
        <Route path="/tools/k8s-enum" element={<K8sEnumerator />} />
        <Route path="/tools/jwt" element={<JWTDecoder />} />
        <Route path="/tools/ip-geo" element={<IPGeolocation />} />
        <Route path="/tools/reverse-ip" element={<ReverseIPLookup />} />
        <Route path="/tools/rsa-aes" element={<RSAESEncryption />} />
        <Route path="/tools/packet-analyzer" element={<PacketAnalyzer />} />
        <Route path="/tools/image-exif" element={<ImageMetadataExtractor />} />
        <Route path="/tools/stego-image" element={<ImageSteganography />} />
        <Route path="/tools/stego-audio" element={<AudioSteganography />} />
        <Route path="/tools/stego-doc" element={<DocumentSteganography />} />
        <Route path="/tools/stego-video" element={<VideoSteganography />} />
        <Route path="/tools/google-dorks" element={<GoogleDorkGenerator />} />
        <Route path="/tools/packet-capturer" element={<PacketCapturer />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/honeypots" element={<HoneypotMonitor />} />
        <Route path="/rl-arena" element={<RLArena />} />
        <Route path="/rl-training" element={<RLArena />} />
        <Route path="/red-vs-blue" element={<RedVsBlue />} />
        <Route path="/world-map" element={<WorldMap />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/tools/base64-encoder" element={<Base64Encoder />} />
        <Route path="/tools/reverse-shell" element={<ReverseShellGenerator />} />
        <Route path="/tools/ssl-analyzer" element={<SSLAnalyzer />} />
        <Route path="/tools/http-headers" element={<HTTPHeaderAnalyzer />} />
        <Route path="/tools/email-headers" element={<EmailHeaderAnalyzer />} />
        <Route path="/tools/cve-search" element={<CVESearch />} />
        <Route path="/tools/file-hash" element={<FileHashCalculator />} />
        <Route path="/tools/password-gen" element={<PasswordGenerator />} />
        <Route path="/tools/username-enum" element={<UsernameEnumerator />} />
        <Route path="/tools/malware-hash" element={<MalwareHashLookup />} />
        <Route path="/tools/sqli-test" element={<SQLInjectionTester />} />
        <Route path="/tools/xss-test" element={<XSSPayloadGenerator />} />
        <Route path="/tools/tech-fingerprint" element={<WebsiteTechFingerprinter />} />
        <Route path="/tools/cidr-calc" element={<CIDRCalculator />} />
        <Route path="/tools/wordlist-gen" element={<WordlistGenerator />} />
        <Route path="/tools/json-beautifier" element={<JSONBeautifier />} />
        <Route path="/tools/ct-search" element={<CTLogSearch />} />
        <Route path="/tools/email-spoof-check" element={<SpoofedEmailChecker />} />
        <Route path="/tools/ip-reputation" element={<IPReputationChecker />} />
        <Route path="/tools/url-encoder" element={<URLEncoder />} />
        <Route path="/tools/hex-view" element={<HexViewer />} />
        <Route path="/tools/string-extract" element={<StringExtractor />} />
        <Route path="/tools/file-type" element={<FileTypeIdentifier />} />
        <Route path="/tools/default-creds" element={<DefaultCredentialsDB />} />
        <Route path="/tools/exploit-search" element={<ExploitDBSearch />} />
        <Route path="/tools/cookie-analyze" element={<CookieAnalyzer />} />
        <Route path="/tools/ssrf-test" element={<SSRFTester />} />
        <Route path="/tools/csrf-poc" element={<CSRFPoCGenerator />} />
        <Route path="/tools/traceroute" element={<Traceroute />} />
        <Route path="/tools/asn-lookup" element={<BGPASNLookup />} />
        <Route path="/tools/pgp-gen" element={<PGPKeyGenerator />} />
        <Route path="/tools/entropy" element={<EntropyAnalyzer />} />
        <Route path="/tools/phone-lookup" element={<PhoneNumberOSINT />} />
        <Route path="/tools/domain-reputation" element={<DomainReputation />} />
        <Route path="/tools/waf-bypass" element={<WAFBypassGenerator />} />
        <Route path="/tools/robots-analyze" element={<RobotsTxtAnalyzer />} />
        <Route path="/tools/base-converter" element={<NumberBaseConverter />} />
        <Route path="/tools/regex-tester" element={<RegexTester />} />
        <Route path="/tools/snmp-scan" element={<SNMPScanner />} />
        <Route path="/tools/waf-detect" element={<WAFDetector />} />
        <Route path="/tools/host-discovery" element={<ARPHostDiscovery />} />
        <Route path="/tools/password-strength" element={<PasswordStrengthAnalyzer />} />
        <Route path="/tools/hash-generate" element={<BCryptGenerator />} />
        <Route path="/tools/ssl-cert-decode" element={<SSLCertDecoder />} />
        <Route path="/tools/xxe-payloads" element={<XXEPayloadGenerator />} />
        <Route path="/tools/open-redirect" element={<OpenRedirectFinder />} />
        <Route path="/tools/web-crawl" element={<WebCrawler />} />
        <Route path="/tools/banner-grab" element={<BannerGrabber />} />
        <Route path="/tools/log-analyze" element={<LogAnalyzer />} />
        <Route path="/tools/pdf-forensics" element={<PDFForensics />} />
        <Route path="/tools/binary-analyze" element={<BinaryAnalyzer />} />
        <Route path="/tools/hash-identify" element={<HashIdentifier />} />
        <Route path="/tools/mask-builder" element={<MaskAttackBuilder />} />
        <Route path="/tools/phishing-check" element={<PhishingURLDetector />} />
        <Route path="/tools/epoch-converter" element={<EpochConverter />} />
        <Route path="/tools/http-request" element={<HTTPRequestBuilder />} />
        <Route path="/tools/apk-analyze" element={<APKAnalyzer />} />
        <Route path="/tools/wifi-crack" element={<WifiHandshakeCracker />} />
        <Route path="/tools/azure-blob-find" element={<AzureBlobFinder />} />
        <Route path="/tools/gcp-bucket-find" element={<GCPBucketFinder />} />
        <Route path="/tools/rop-gadgets" element={<ROPGadgetFinder />} />
        <Route path="/tools/buffer-overflow" element={<BufferOverflowCalc />} />
        <Route path="/tools/homoglyph-gen" element={<HomoglyphGenerator />} />
        <Route path="/tools/dark-web-check" element={<DarkWebChecker />} />
        <Route path="/tools/disk-analyze" element={<DiskImageAnalyzer />} />
        <Route path="/tools/adb-gen" element={<ADBGenerator />} />
        <Route path="/tools/bt-scan" element={<BluetoothScanner />} />
        <Route path="/tools/company-osint" element={<CompanyOSINT />} />
        <Route path="/tools/text-diff" element={<TextDiff />} />
        <Route path="/tools/aws-metadata" element={<AWSMetadataTester />} />
        <Route path="/tools/iam-audit" element={<CloudIAMAuditor />} />
        <Route path="/tools/cloud-assets" element={<CloudAssetEnumerator />} />
        <Route path="/tools/permission-audit" element={<MobilePermissionAuditor />} />
        <Route path="/tools/evil-twin" element={<EvilTwinDetector />} />
        <Route path="/tools/social-osint" element={<SocialMediaOSINT />} />
        <Route path="/tools/pastebin-search" element={<PastebinMonitor />} />
        <Route path="/tools/code-obfuscator" element={<CodeObfuscator />} />
        <Route path="/tools/credential-check" element={<CredentialChecker />} />
        <Route path="/tools/payload-encoder" element={<PayloadEncoder />} />
        <Route path="/tools/xxe-ssti" element={<XXESSILibrary />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

export default AppRouter;
