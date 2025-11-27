import { Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import Honeypots from "@/pages/Honeypots";
import PortScanner from "@/pages/tools/PortScanner";
import HashTool from "@/pages/tools/HashTool";
import EmailBreach from "@/pages/tools/EmailBreach";
import NotFound from "@/pages/NotFound";
import OSFingerprint from "@/pages/tools/OSFingerprint";
import WHOISLookup from "@/pages/tools/WHOISLookup";

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
        <Route path="/tools/hash-tool" element={<HashTool />} />
        <Route path="/tools/email-breach" element={<EmailBreach />} />
        <Route path="/honeypots" element={<Honeypots />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

export default AppRouter;
