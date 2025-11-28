import { Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import Honeypots from "@/pages/Honeypots";
import PortScanner from "@/pages/tools/PortScanner";
import HashTool from "@/pages/tools/HashTool";
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
        <Route path="/honeypots" element={<Honeypots />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

export default AppRouter;
