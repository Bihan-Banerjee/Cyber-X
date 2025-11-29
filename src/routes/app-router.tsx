import { Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import Honeypots from "@/pages/Honeypots";
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
        <Route path="/honeypots" element={<Honeypots />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

export default AppRouter;
