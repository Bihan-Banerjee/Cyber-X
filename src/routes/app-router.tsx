import { Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import HoneypotMonitor from "../pages/HoneypotMonitor";
import PortScanner from "@/pages/tools/PortScanner";
import CipherTool from "@/pages/tools/CipherTool";
import NotFound from "@/pages/NotFound";
import OSFingerprint from "@/pages/tools/OSFingerprint";
import WHOISLookup from "@/pages/tools/WHOISLookup";
import ServiceDetection from "@/pages/tools/ServiceDetection";
import SubdomainEnumeration from "@/pages/tools/SubdomainEnumeration";
import DNSRecon from "@/pages/tools/DNSRecon";
import APIScanner from "@/pages/tools/APIScanner";
import EmailBreachChecker from "../pages/tools/EmailBreachChecker";
import HashCracker from "@/pages/tools/HashCracker";
import DirectoryFuzzer from "@/pages/tools/DirectoryFuzzer";
import BrokenAuthChecker from "@/pages/tools/BrokenAuthChecker";
import ContainerScanner from "@/pages/tools/ContainerScanner";
import VulnerabilityFuzzer from "@/pages/tools/VulnerabilityFuzzer";
import S3BucketFinder from "@/pages/tools/S3BucketFinder";
import K8sEnumerator from "@/pages/tools/K8sEnumerator";
import JWTDecoder from "@/pages/tools/JWTDecoder";
import IPGeolocation from "@/pages/tools/IPGeolocation";
import ReverseIPLookup from "@/pages/tools/ReverseIPLookup";
import RSAESEncryption from "@/pages/tools/RSAESEncryption";
import PacketAnalyzer from "@/pages/tools/PacketAnalyzer";
import ImageMetadataExtractor from "@/pages/tools/ImageMetaDataExtractor";
import ImageSteganography from "@/pages/tools/ImageSteganography";
import AudioSteganography from "@/pages/tools/AudioSteganography";
import DocumentSteganography from "@/pages/tools/DocumentSteganography";
import VideoSteganography from "@/pages/tools/VideoSteganography";
import GoogleDorkGenerator from "@/pages/tools/GoogleDorkGenerator";
import PacketCapturer from "@/pages/tools/PacketCapturer";
import RLTraining from "@/pages/RLTraining";
import WorldMap from '@/components/WorldMap';
import Guide from "@/pages/Guide";
import Base64Encoder from "@/pages/tools/Base64Encoder";
import ReverseShellGenerator from "@/pages/tools/ReverseShellGenerator";
import SSLAnalyzer from "@/pages/tools/SSLAnalyzer";
import HTTPHeaderAnalyzer from "@/pages/tools/HTTPHeaderAnalyzer";
import EmailHeaderAnalyzer from "@/pages/tools/EmailHeaderAnalyzer";
import CVESearch from "@/pages/tools/CVESearch";
import FileHashCalculator from "@/pages/tools/FileHashCalculator";
import PasswordGenerator from "@/pages/tools/PasswordGenerator";
import UsernameEnumerator from "@/pages/tools/UsernameEnumerator";
import MalwareHashLookup from "@/pages/tools/MalwareHashLookup";
import SQLInjectionTester from "@/pages/tools/SQLInjectionTester";
import XSSPayloadGenerator from "@/pages/tools/XSSPayloadGenerator";
import WebsiteTechFingerprinter from "@/pages/tools/WebsiteTechFingerprinter";
import CIDRCalculator from "@/pages/tools/CIDRCalculator";
import WordlistGenerator from "@/pages/tools/WordlistGenerator";
import JSONBeautifier from "@/pages/tools/JSONBeautifier";
import CTLogSearch from "@/pages/tools/CTLogSearch";
import SpoofedEmailChecker from "@/pages/tools/SpoofedEmailChecker";
import IPReputationChecker from "@/pages/tools/IPReputationChecker";
import URLEncoder from "@/pages/tools/URLEncoder";
import HexViewer from "@/pages/tools/HexViewer";
import StringExtractor from "@/pages/tools/StringExtractor";
import FileTypeIdentifier from "@/pages/tools/FileTypeIdentifier";
import DefaultCredentialsDB from "@/pages/tools/DefaultCredentialsDB";
import ExploitDBSearch from "@/pages/tools/ExploitDBSearch";
import CookieAnalyzer from "@/pages/tools/CookieAnalyzer";
import SSRFTester from "@/pages/tools/SSRFTester";
import CSRFPoCGenerator from "@/pages/tools/CSRFPoCGenerator";
import Traceroute from "@/pages/tools/Traceroute";
import BGPASNLookup from "@/pages/tools/BGPASNLookup";
import PGPKeyGenerator from "@/pages/tools/PGPKeyGenerator";
import EntropyAnalyzer from "@/pages/tools/EntropyAnalyzer";
import PhoneNumberOSINT from "@/pages/tools/PhoneNumberOSINT";
import DomainReputation from "@/pages/tools/DomainReputation";
import WAFBypassGenerator from "@/pages/tools/WAFBypassGenerator";
import RobotsTxtAnalyzer from "@/pages/tools/RobotsTxtAnalyzer";
import NumberBaseConverter from "@/pages/tools/NumberBaseConverter";
import RegexTester from "@/pages/tools/RegexTester";
import SNMPScanner from "@/pages/tools/SNMPScanner";
import WAFDetector from "@/pages/tools/WAFDetector";
import ARPHostDiscovery from "@/pages/tools/ARPHostDiscovery";
import PasswordStrengthAnalyzer from "@/pages/tools/PasswordStrengthAnalyzer";
import BCryptGenerator from "@/pages/tools/BCryptGenerator";
import SSLCertDecoder from "@/pages/tools/SSLCertDecoder";
import XXEPayloadGenerator from "@/pages/tools/XXEPayloadGenerator";
import OpenRedirectFinder from "@/pages/tools/OpenRedirectFinder";
import WebCrawler from "@/pages/tools/WebCrawler";
import BannerGrabber from "@/pages/tools/BannerGrabber";
import LogAnalyzer from "@/pages/tools/LogAnalyzer";
import PDFForensics from "@/pages/tools/PDFForensics";
import BinaryAnalyzer from "@/pages/tools/BinaryAnalyzer";
import HashIdentifier from "@/pages/tools/HashIdentifier";
import MaskAttackBuilder from "@/pages/tools/MaskAttackBuilder";
import PhishingURLDetector from "@/pages/tools/PhishingURLDetector";
import EpochConverter from "@/pages/tools/EpochConverter";
import HTTPRequestBuilder from "@/pages/tools/HTTPRequestBuilder";
import APKAnalyzer from "@/pages/tools/APKAnalyzer";
import WifiHandshakeCracker from "@/pages/tools/WifiHandshakeCracker";
import AzureBlobFinder from "@/pages/tools/AzureBlobFinder";
import GCPBucketFinder from "@/pages/tools/GCPBucketFinder";
import ROPGadgetFinder from "@/pages/tools/ROPGadgetFinder";
import BufferOverflowCalc from "@/pages/tools/BufferOverflowCalc";
import HomoglyphGenerator from "@/pages/tools/HomoglyphGenerator";
import DarkWebChecker from "@/pages/tools/DarkWebChecker";
import DiskImageAnalyzer from "@/pages/tools/DiskImageAnalyzer";
import ADBGenerator from "@/pages/tools/ADBGenerator";
import BluetoothScanner from "@/pages/tools/BluetoothScanner";
import CompanyOSINT from "@/pages/tools/CompanyOSINT";
import TextDiff from "@/pages/tools/TextDiff";
import AWSMetadataTester from "@/pages/tools/AWSMetadataTester";
import CloudIAMAuditor from "@/pages/tools/CloudIAMAuditor";
import CloudAssetEnumerator from "@/pages/tools/CloudAssetEnumerator";
import MobilePermissionAuditor from "@/pages/tools/MobilePermissionAuditor";
import EvilTwinDetector from "@/pages/tools/EvilTwinDetector";
import SocialMediaOSINT from "@/pages/tools/SocialMediaOSINT";
import PastebinMonitor from "@/pages/tools/PastebinMonitor";
import CodeObfuscator from "@/pages/tools/CodeObfuscator";
import CredentialChecker from "@/pages/tools/CredentialChecker";
import PayloadEncoder from "@/pages/tools/PayloadEncoder";
import XXESSILibrary from "@/pages/tools/XXESSILibrary";

const AppRouter = () => {
  return (
    <Layout>
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
        <Route path="/honeypots" element={<HoneypotMonitor />} />
        <Route path="/rl-training" element={<RLTraining />} />
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
    </Layout>
  );
};

export default AppRouter;
