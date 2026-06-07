import express from 'express';
import { portScan, parsePorts } from '../scanners/portScanner.js';
import { performOSFingerprint } from '../scanners/osFingerprint.js';
import { performWHOISLookup } from '../scanners/whoisLookup.js';
import { performServiceDetection } from '../scanners/serviceDetection.js';
import { performSubdomainEnumeration } from '../scanners/subdomainEnumeration.js';
import { performDNSRecon } from '../scanners/dnsRecon.js';
import { performAPIScan } from '../scanners/apiScanner.js';
import { performBreachCheck } from '../scanners/breachChecker.js';
import { performHashCracking } from '../scanners/hashCracker.js';
import { performDirectoryFuzzing } from '../scanners/directoryFuzzer.js';
import { performAuthCheck } from '../scanners/authChecker.js';
import { performContainerScan } from '../scanners/containerScanner.js';
import { processCipher, analyzeCipher } from '../scanners/cipherTool.js';
import { performVulnerabilityFuzzing } from '../scanners/vulnerabilityFuzzer.js';
import { performS3BucketFinding } from '../scanners/s3BucketFinder.js';
import { performK8sEnumeration } from '../scanners/k8sEnumerator.js';
import { decodeJWT } from '../scanners/jwtDecoder.js';
import { performIPGeolocation } from '../scanners/ipGeolocation.js';
import { performReverseIPLookup } from '../scanners/reverseIPLookup.js';
import { processCrypto, generateKeys } from '../scanners/rsaesEncryption.js';
import { analyzePackets } from '../scanners/packetAnalyzer.js';
import multer from 'multer';
import { extractImageMetadata } from '../scanners/imageMetaDataExtractor.js';
import { hideDataInImage, extractDataFromImage } from '../scanners/imageSteganography.js';
import { hideDataInAudio, extractDataFromAudio } from '../scanners/audioSteganography.js';
import { hideDataInDocument, extractDataFromDocument } from '../scanners/documentSteganography.js';
import { hideDataInVideo, extractDataFromVideo } from '../scanners/videoSteganography.js';
import { performOSINTSearch } from '../scanners/osintSearch.js';
import {
  getNetworkInterfaces,
  startPacketCapture,
  stopPacketCapture,
  getCapturePackets,
  generatePcapFile,
} from '../scanners/packetCapturer.js';
import { logToolActivity, getRecentToolActivity } from '../utils/activityLogger.js';
import { getSystemResources } from '../scanners/systemResources.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { performSSLAnalysis } from '../scanners/sslAnalyzer.js';
import { analyzeHTTPHeaders } from '../scanners/httpHeaderAnalyzer.js';
import { searchCVE } from '../scanners/cveSearch.js';
import { calculateFileHashes } from '../scanners/fileHashCalculator.js';
import { enumerateUsername } from '../scanners/usernameEnumerator.js';
import { lookupMalwareHash } from '../scanners/malwareHashLookup.js';
import { performSQLiTest } from '../scanners/sqlInjectionTester.js';
import { performXSSTest } from '../scanners/xssPayloadGenerator.js';
import { performTechFingerprint } from '../scanners/websiteTechFingerprinter.js';
import { generateWordlist } from '../scanners/wordlistGenerator.js';
import { searchCTLogs } from '../scanners/ctLogSearch.js';
import { checkEmailSpoofability } from '../scanners/spoofedEmailChecker.js';
import { analyzeRobotsTxt } from '../scanners/robotsTxtAnalyzer.js';
import { performSNMPScan } from '../scanners/snmpScanner.js';
import { detectWAF } from '../scanners/wafDetector.js';
import { discoverHosts } from '../scanners/arpHostDiscovery.js';
import { generateHash } from '../scanners/bcryptGenerator.js';
import { testOpenRedirect } from '../scanners/openRedirectFinder.js';
import { crawlWebsite } from '../scanners/webCrawler.js';
import { grabBanners } from '../scanners/bannerGrabber.js';
import { analyzeLogs } from '../scanners/logAnalyzer.js';
import { analyzePDF } from '../scanners/pdfForensics.js';
import { analyzeBinary } from '../scanners/binaryAnalyzer.js';
import { checkPhishingURL } from '../scanners/phishingURLDetector.js';
import { sendHTTPRequest } from '../scanners/httpRequestBuilder.js';
import { checkIPReputation } from '../scanners/ipReputationChecker.js';
import { hexDump } from '../scanners/hexViewer.js';
import { extractStrings } from '../scanners/stringExtractor.js';
import { identifyFileType } from '../scanners/fileTypeIdentifier.js';
import { searchExploitDB } from '../scanners/exploitDBSearch.js';
import { analyzeCookies } from '../scanners/cookieAnalyzer.js';
import { performSSRFTest } from '../scanners/ssrfTester.js';
import { performTraceroute } from '../scanners/traceroute.js';
import { lookupASN } from '../scanners/bgpASNLookup.js';
import { lookupPhoneNumber } from '../scanners/phoneNumberOSINT.js';
import { checkDomainReputation } from '../scanners/domainReputation.js';
import { generateWordlist as generateWordlistP3 } from '../scanners/wordlistGenerator.js';
import { analyzeAPK } from '../scanners/apkAnalyzer.js';
import { crackWPAHandshake } from '../scanners/wifiHandshakeCracker.js';
import { findAzureBlobs } from '../scanners/azureBlobFinder.js';
import { findGCPBuckets } from '../scanners/gcpBucketFinder.js';
import { findROPGadgets } from '../scanners/ropGadgetFinder.js';
import { checkDarkWebMentions } from '../scanners/darkWebChecker.js';
import { analyzeDiskImage } from '../scanners/diskImageAnalyzer.js';
import { performCompanyOSINT } from '../scanners/companyOSINT.js';
import { testAWSMetadata } from '../scanners/awsMetadataTester.js';
import { auditIAMPolicy } from '../scanners/cloudIAMAuditor.js';
import { enumerateCloudAssets } from '../scanners/cloudAssetEnumerator.js';
import { performSocialOSINT } from '../scanners/socialMediaOSINT.js';
import { searchPastebins } from '../scanners/pastebinMonitor.js';
import { checkCredentials } from '../scanners/credentialChecker.js';


// ---------- Result Type Fixes ----------

interface SinglePortResult {
  port: number;
  protocol: string;
  state: string;
}


interface OSFingerprintResult {
  os: string;
}

interface CrackResult {
  cracked?: string[];
}

interface FuzzerResult {
  found?: string[];
}

interface CipherAnalysisResult {
  likelyCipher?: string;
}

interface VulnFuzzResult {
  vulnerabilityTypes?: string[];
}

const router = express.Router();
// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Validation helper
function isValidTarget(target: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return hostnameRegex.test(target) || ipRegex.test(target);
}

// Port Scanner Route
router.post('/ports', async (req, res) => {
  try {
    const {
      target,
      ports = '1-1000',
      tcp = true,
      udp = false,
      timeoutMs = 3000,
      concurrency = 50,
    } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    if (!isValidTarget(target)) {
      return res.status(400).json({ error: 'Invalid target format' });
    }

    const portList = parsePorts(ports);
    if (portList.length === 0) {
      return res.status(400).json({ error: 'No valid ports specified' });
    }

    if (portList.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 ports per scan' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 500), 10000);
    const safeConcurrency = Math.min(Math.max(concurrency, 1), 100);

    logToolActivity('Port Scanner', `Started scan on ${target}`, 'info');

    const results = await portScan({
      target,
      ports: portList,
      tcp: Boolean(tcp),
      udp: Boolean(udp),
      timeoutMs: safeTimeout,
      concurrency: safeConcurrency,
      retries: 2,
    });
    const openPorts = Array.isArray(results)
      ? (results as SinglePortResult[]).filter(r => r.state === 'open').length
      : 0;
    logToolActivity(
      'Port Scanner',
      `Completed scan on ${target} - Found ${openPorts} open ports`,
      'success'
    );

    res.json({
      target,
      totalPorts: portList.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logToolActivity('Port Scanner', `Scan failed: ${error.message}`, 'warning');
    console.error('Port scan error:', error);
    res.status(500).json({
      error: 'Scan failed',
      message: error.message,
    });
  }
});

// OS Fingerprinting Route
router.post('/os-fingerprint', async (req, res) => {
  try {
    const { target, timeoutMs = 5000 } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    if (!isValidTarget(target)) {
      return res.status(400).json({ error: 'Invalid target format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 15000);
    
    logToolActivity('OS Fingerprint', `Started fingerprinting ${target}`, 'info');

    const result = await performOSFingerprint(target, safeTimeout);
    const osResult = result as unknown as OSFingerprintResult;
    logToolActivity('OS Fingerprint', `Detected ${osResult.os} on ${target}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('OS Fingerprint', `Fingerprint failed: ${error.message}`, 'warning');
    console.error('OS fingerprint error:', error);
    res.status(500).json({
      error: 'Fingerprint failed',
      message: error.message,
    });
  }
});

// WHOIS Lookup Route
router.post('/whois', async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain parameter' });
    }

    const cleanDomain = domain.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    logToolActivity('WHOIS Lookup', `Querying ${cleanDomain}`, 'info');

    const result = await performWHOISLookup(cleanDomain);

    logToolActivity('WHOIS Lookup', `Completed lookup for ${cleanDomain}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('WHOIS Lookup', `Lookup failed: ${error.message}`, 'warning');
    console.error('WHOIS lookup error:', error);
    res.status(500).json({
      error: 'WHOIS lookup failed',
      message: error.message,
    });
  }
});

// Service Detection Route
router.post('/service-detect', async (req, res) => {
  try {
    const { target, ports = '21-25,53,80,110,143,443,445,3306,3389,5432,8080', timeoutMs = 5000 } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    if (!isValidTarget(target)) {
      return res.status(400).json({ error: 'Invalid target format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 15000);

    logToolActivity('Service Detection', `Detecting services on ${target}`, 'info');

    const result = await performServiceDetection(target, ports, safeTimeout);

    logToolActivity('Service Detection', `Detected ${result.services.length} services on ${target}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Service Detection', `Detection failed: ${error.message}`, 'warning');
    console.error('Service detection error:', error);
    res.status(500).json({
      error: 'Service detection failed',
      message: error.message,
    });
  }
});

// Subdomain Enumeration Route
router.post('/subdomains', async (req, res) => {
  try {
    const { domain, timeoutMs = 3000 } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain parameter' });
    }

    const cleanDomain = domain.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 10000);

    logToolActivity('Subdomain Enumeration', `Enumerating subdomains for ${cleanDomain}`, 'info');

    const result = await performSubdomainEnumeration(cleanDomain, safeTimeout);

    logToolActivity('Subdomain Enumeration', `Found ${result.subdomains.length} subdomains for ${cleanDomain}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Subdomain Enumeration', `Enumeration failed: ${error.message}`, 'warning');
    console.error('Subdomain enumeration error:', error);
    res.status(500).json({
      error: 'Subdomain enumeration failed',
      message: error.message,
    });
  }
});

// DNS Reconnaissance Route
router.post('/dns-recon', async (req, res) => {
  try {
    const { domain, timeoutMs = 5000 } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain parameter' });
    }

    const cleanDomain = domain.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 15000);

    logToolActivity('DNS Recon', `Performing DNS reconnaissance on ${cleanDomain}`, 'info');

    const result = await performDNSRecon(cleanDomain, safeTimeout);

    logToolActivity('DNS Recon', `Completed DNS recon for ${cleanDomain}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('DNS Recon', `Recon failed: ${error.message}`, 'warning');
    console.error('DNS recon error:', error);
    res.status(500).json({
      error: 'DNS reconnaissance failed',
      message: error.message,
    });
  }
});

// API Scanner Route
router.post('/api-scanner', async (req, res) => {
  try {
    const { target, apiKey, timeoutMs = 10000 } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    try {
      new URL(target);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 30000);

    logToolActivity('API Scanner', `Scanning API endpoints at ${target}`, 'info');

    const result = await performAPIScan(target, apiKey, safeTimeout);

    logToolActivity('API Scanner', `Found ${result.endpoints?.length || 0} endpoints at ${target}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('API Scanner', `Scan failed: ${error.message}`, 'warning');
    console.error('API scan error:', error);
    res.status(500).json({
      error: 'API scan failed',
      message: error.message,
    });
  }
});

// Breach Check Route
router.post('/breach-check', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Invalid email parameter' });
    }

    logToolActivity('Breach Checker', `Checking breaches for ${email}`, 'info');

    const result = await performBreachCheck(email);

    logToolActivity('Breach Checker', `Found ${result.breaches?.length || 0} breaches for ${email}`, result.breaches?.length ? 'warning' : 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Breach Checker', `Check failed: ${error.message}`, 'warning');
    console.error('Breach check error:', error);
    res.status(500).json({
      error: 'Breach check failed',
      message: error.message,
    });
  }
});

// Hash Cracker Route
router.post('/hash-crack', async (req, res) => {
  try {
    const { hashes, timeoutMs = 30000 } = req.body;

    if (!hashes || !Array.isArray(hashes) || hashes.length === 0) {
      return res.status(400).json({ error: 'Invalid hashes parameter' });
    }

    if (hashes.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 hashes per request' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);

    logToolActivity('Hash Cracker', `Attempting to crack ${hashes.length} hashes`, 'info');

    const result = await performHashCracking(hashes, safeTimeout);
    const crackResult = result as unknown as CrackResult;
    logToolActivity('Hash Cracker', `Cracked ${crackResult.cracked?.length || 0} of ${hashes.length} hashes`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Hash Cracker', `Cracking failed: ${error.message}`, 'warning');
    console.error('Hash crack error:', error);
    res.status(500).json({
      error: 'Hash cracking failed',
      message: error.message,
    });
  }
});

// Directory Fuzzer Route
router.post('/dir-fuzz', async (req, res) => {
  try {
    const { target, timeoutMs = 60000 } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 10000), 120000);

    logToolActivity('Directory Fuzzer', `Fuzzing directories on ${target}`, 'info');

    const result = await performDirectoryFuzzing(target, safeTimeout);
    const fuzzResult = result as unknown as FuzzerResult;
    logToolActivity('Directory Fuzzer', `Found ${fuzzResult.found?.length || 0} directories on ${target}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Directory Fuzzer', `Fuzzing failed: ${error.message}`, 'warning');
    console.error('Directory fuzzing error:', error);
    res.status(500).json({
      error: 'Directory fuzzing failed',
      message: error.message,
    });
  }
});

// Authentication Security Check Route
router.post('/auth-check', async (req, res) => {
  try {
    const { target, username, password, timeoutMs = 15000 } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    try {
      new URL(target);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 30000);

    logToolActivity('Auth Checker', `Checking authentication security for ${target}`, 'info');

    const result = await performAuthCheck(target, username, password, safeTimeout);

    logToolActivity('Auth Checker', `Completed auth check for ${target}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Auth Checker', `Check failed: ${error.message}`, 'warning');
    console.error('Auth check error:', error);
    res.status(500).json({
      error: 'Authentication check failed',
      message: error.message,
    });
  }
});

// Container Scanner Route
router.post('/container-scan', async (req, res) => {
  try {
    const { imageName, timeoutMs = 30000 } = req.body;

    if (!imageName || typeof imageName !== 'string') {
      return res.status(400).json({ error: 'Invalid imageName parameter' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);

    logToolActivity('Container Scanner', `Scanning container image: ${imageName}`, 'info');

    const result = await performContainerScan(imageName, safeTimeout);

    logToolActivity('Container Scanner', `Scan completed for ${imageName}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Container Scanner', `Scan failed: ${error.message}`, 'warning');
    console.error('Container scan error:', error);
    res.status(500).json({
      error: 'Container scan failed',
      message: error.message,
    });
  }
});

// Cipher Process Route
router.post('/cipher-process', async (req, res) => {
  try {
    const { cipherType, operation, input, key } = req.body;

    if (!cipherType || !operation || !input) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logToolActivity('Cipher Tool', `${operation}ing with ${cipherType}`, 'info');

    const result = await processCipher(cipherType, operation, input, key);

    logToolActivity('Cipher Tool', `${operation}ion completed using ${cipherType}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Cipher Tool', `Operation failed: ${error.message}`, 'warning');
    console.error('Cipher process error:', error);
    res.status(500).json({
      error: 'Cipher processing failed',
      message: error.message,
    });
  }
});

// Cipher Analyze Route
router.post('/cipher-analyze', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Missing input parameter' });
    }

    logToolActivity('Cipher Analyzer', `Analyzing cipher text`, 'info');

    const result = await analyzeCipher(input);
    const cipherAnalysis = result as unknown as CipherAnalysisResult;
    logToolActivity('Cipher Analyzer', `Analysis completed - Detected ${cipherAnalysis.likelyCipher}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Cipher Analyzer', `Analysis failed: ${error.message}`, 'warning');
    console.error('Cipher analyze error:', error);
    res.status(500).json({
      error: 'Cipher analysis failed',
      message: error.message,
    });
  }
});

// Vulnerability Fuzzer Route
router.post('/vuln-fuzz', async (req, res) => {
  try {
    const { target, timeoutMs = 60000 } = req.body;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Invalid target parameter' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 10000), 120000);

    logToolActivity('Vulnerability Fuzzer', `Fuzzing vulnerabilities on ${target}`, 'info');
    
    const result = await performVulnerabilityFuzzing(target, safeTimeout);
    const vulnResult = result as unknown as VulnFuzzResult;
    logToolActivity('Vulnerability Fuzzer', `Found ${vulnResult.vulnerabilityTypes?.length || 0} potential vulnerabilities`,vulnResult.vulnerabilityTypes?.length ? 'warning' : 'success');res.json(result);
  } catch (error: any) {
    logToolActivity('Vulnerability Fuzzer', `Fuzzing failed: ${error.message}`, 'warning');
    console.error('Vulnerability fuzzing error:', error);
    res.status(500).json({
      error: 'Vulnerability fuzzing failed',
      message: error.message,
    });
  }
});

// S3 Bucket Finder Route
router.post('/s3-finder', async (req, res) => {
  try {
    const { keyword, timeoutMs = 60000 } = req.body;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ error: 'Invalid keyword parameter' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 10000), 120000);

    logToolActivity('S3 Bucket Finder', `Searching for S3 buckets with keyword: ${keyword}`, 'info');

    const result = await performS3BucketFinding(keyword, safeTimeout);

    logToolActivity('S3 Bucket Finder', `Found ${result.buckets?.length || 0} S3 buckets`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('S3 Bucket Finder', `Search failed: ${error.message}`, 'warning');
    console.error('S3 bucket finding error:', error);
    res.status(500).json({
      error: 'S3 bucket finding failed',
      message: error.message,
    });
  }
});

// K8s Enumerator Route
router.post('/k8s-enum', async (req, res) => {
  try {
    const { apiEndpoint, token, timeoutMs = 30000 } = req.body;

    if (!apiEndpoint || typeof apiEndpoint !== 'string') {
      return res.status(400).json({ error: 'Invalid apiEndpoint parameter' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);

    logToolActivity('K8s Enumerator', `Enumerating Kubernetes cluster at ${apiEndpoint}`, 'info');

    const result = await performK8sEnumeration(apiEndpoint, token, safeTimeout);

    logToolActivity('K8s Enumerator', `Enumeration completed for ${apiEndpoint}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('K8s Enumerator', `Enumeration failed: ${error.message}`, 'warning');
    console.error('K8s enumeration error:', error);
    res.status(500).json({
      error: 'K8s enumeration failed',
      message: error.message,
    });
  }
});

// JWT Decoder Route
router.post('/jwt-decode', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token parameter' });
    }

    logToolActivity('JWT Decoder', `Decoding JWT token`, 'info');

    const result = await decodeJWT(token);

    logToolActivity('JWT Decoder', `JWT decoded successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('JWT Decoder', `Decoding failed: ${error.message}`, 'warning');
    console.error('JWT decode error:', error);
    res.status(500).json({
      error: 'JWT decoding failed',
      message: error.message,
    });
  }
});

// IP Geolocation Route
router.post('/ip-geo', async (req, res) => {
  try {
    const { ip } = req.body;

    const targetIP = ip && ip !== 'auto' ? ip : 'auto';

    logToolActivity('IP Geolocation', `Looking up geolocation for ${targetIP}`, 'info');

    const result = await performIPGeolocation(targetIP);

    logToolActivity('IP Geolocation', `Located ${targetIP} in ${result.city}, ${result.country}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('IP Geolocation', `Lookup failed: ${error.message}`, 'warning');
    console.error('IP geolocation error:', error);
    res.status(500).json({
      error: 'IP geolocation lookup failed',
      message: error.message,
    });
  }
});

// Reverse IP Lookup Route
router.post('/reverse-ip', async (req, res) => {
  try {
    const { ip, timeoutMs = 30000 } = req.body;

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'Invalid IP address parameter' });
    }

    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);

    logToolActivity('Reverse IP Lookup', `Performing reverse lookup for ${ip}`, 'info');

    const result = await performReverseIPLookup(ip, safeTimeout);

    logToolActivity('Reverse IP Lookup', `Found ${result.domains?.length || 0} domains for ${ip}`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Reverse IP Lookup', `Lookup failed: ${error.message}`, 'warning');
    console.error('Reverse IP lookup error:', error);
    res.status(500).json({
      error: 'Reverse IP lookup failed',
      message: error.message,
    });
  }
});

// Crypto Process Route
router.post('/crypto-process', async (req, res) => {
  try {
    logToolActivity('RSA/AES Tool', `${req.body.operation}ing data`, 'info');

    const result = await processCrypto(req.body);

    logToolActivity('RSA/AES Tool', `${req.body.operation}ion completed`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('RSA/AES Tool', `Operation failed: ${error.message}`, 'warning');
    console.error('Crypto process error:', error);
    res.status(500).json({
      error: 'Encryption/Decryption failed',
      message: error.message,
    });
  }
});

// Crypto Generate Keys Route
router.post('/crypto-generate-keys', async (req, res) => {
  try {
    logToolActivity('RSA/AES Tool', `Generating ${req.body.algorithm} keys`, 'info');

    const result = await generateKeys(req.body);

    logToolActivity('RSA/AES Tool', `Keys generated successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('RSA/AES Tool', `Key generation failed: ${error.message}`, 'warning');
    console.error('Key generation error:', error);
    res.status(500).json({
      error: 'Key generation failed',
      message: error.message,
    });
  }
});

// Packet Analyzer Route
router.post('/packet-analyze', async (req, res) => {
  try {
    const { pcapData, timeoutMs = 30000 } = req.body;

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);

    logToolActivity('Packet Analyzer', `Analyzing network packets`, 'info');

    const result = await analyzePackets(pcapData, safeTimeout);

    logToolActivity('Packet Analyzer', `Analyzed ${result.totalPackets} packets`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Packet Analyzer', `Analysis failed: ${error.message}`, 'warning');
    console.error('Packet analysis error:', error);
    res.status(500).json({
      error: 'Packet analysis failed',
      message: error.message,
    });
  }
});

// Image Metadata Extractor Route
router.post('/image-metadata', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    logToolActivity('Image Metadata', `Extracting metadata from ${req.file.originalname}`, 'info');

    const result = await extractImageMetadata(req.file.buffer, req.file.originalname);

    logToolActivity('Image Metadata', `Metadata extracted from ${req.file.originalname}`, result.gps ? 'warning' : 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Image Metadata', `Extraction failed: ${error.message}`, 'warning');
    console.error('Image metadata extraction error:', error);
    res.status(500).json({
      error: 'Metadata extraction failed',
      message: error.message,
    });
  }
});

// Steganography Hide Route
router.post('/stego-hide', upload.single('coverImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No cover image uploaded' });
    }

    const { secretMessage, password } = req.body;

    if (!secretMessage) {
      return res.status(400).json({ error: 'No secret message provided' });
    }

    logToolActivity('Image Steganography', `Hiding message in image`, 'info');

    const result = await hideDataInImage(
      req.file.buffer,
      secretMessage,
      password
    );

    logToolActivity('Image Steganography', `Message hidden successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Image Steganography', `Hide failed: ${error.message}`, 'warning');
    console.error('Steganography hide error:', error);
    res.status(500).json({
      error: 'Failed to hide data',
      message: error.message,
    });
  }
});

// Steganography Extract Route
router.post('/stego-extract', upload.single('stegoImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No stego image uploaded' });
    }

    const { password } = req.body;

    logToolActivity('Image Steganography', `Extracting hidden message from image`, 'info');

    const result = await extractDataFromImage(
      req.file.buffer,
      password
    );

    logToolActivity('Image Steganography', `Message extracted successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Image Steganography', `Extract failed: ${error.message}`, 'warning');
    console.error('Steganography extract error:', error);
    res.status(500).json({
      error: 'Failed to extract data',
      message: error.message,
    });
  }
});

// Audio Steganography Hide Route
router.post('/audio-stego-hide', upload.single('coverAudio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No cover audio uploaded' });
    }

    const { secretMessage, password } = req.body;

    if (!secretMessage) {
      return res.status(400).json({ error: 'No secret message provided' });
    }

    logToolActivity('Audio Steganography', `Hiding message in audio`, 'info');

    const result = await hideDataInAudio(
      req.file.buffer,
      secretMessage,
      password
    );

    logToolActivity('Audio Steganography', `Message hidden successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Audio Steganography', `Hide failed: ${error.message}`, 'warning');
    console.error('Audio steganography hide error:', error);
    res.status(500).json({
      error: 'Failed to hide data',
      message: error.message,
    });
  }
});

// Audio Steganography Extract Route
router.post('/audio-stego-extract', upload.single('stegoAudio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No stego audio uploaded' });
    }

    const { password } = req.body;

    logToolActivity('Audio Steganography', `Extracting hidden message from audio`, 'info');

    const result = await extractDataFromAudio(
      req.file.buffer,
      password
    );

    logToolActivity('Audio Steganography', `Message extracted successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Audio Steganography', `Extract failed: ${error.message}`, 'warning');
    console.error('Audio steganography extract error:', error);
    res.status(500).json({
      error: 'Failed to extract data',
      message: error.message,
    });
  }
});

// Document Steganography Hide Route
router.post('/doc-stego-hide', upload.single('coverDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No cover document uploaded' });
    }

    const { secretMessage, password } = req.body;

    if (!secretMessage) {
      return res.status(400).json({ error: 'No secret message provided' });
    }

    logToolActivity('Document Steganography', `Hiding message in document`, 'info');

    const result = await hideDataInDocument(
      req.file.buffer,
      req.file.originalname,
      secretMessage,
      password
    );

    logToolActivity('Document Steganography', `Message hidden successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Document Steganography', `Hide failed: ${error.message}`, 'warning');
    console.error('Document steganography hide error:', error);
    res.status(500).json({
      error: 'Failed to hide data',
      message: error.message,
    });
  }
});

// Document Steganography Extract Route
router.post('/doc-stego-extract', upload.single('stegoDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No stego document uploaded' });
    }

    const { password } = req.body;

    logToolActivity('Document Steganography', `Extracting hidden message from document`, 'info');

    const result = await extractDataFromDocument(
      req.file.buffer,
      password
    );

    logToolActivity('Document Steganography', `Message extracted successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Document Steganography', `Extract failed: ${error.message}`, 'warning');
    console.error('Document steganography extract error:', error);
    res.status(500).json({
      error: 'Failed to extract data',
      message: error.message,
    });
  }
});

// Video Steganography Hide Route
router.post('/video-stego-hide', upload.single('coverVideo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No cover video uploaded' });
    }

    const { secretMessage, password } = req.body;

    if (!secretMessage) {
      return res.status(400).json({ error: 'No secret message provided' });
    }

    logToolActivity('Video Steganography', `Hiding message in video`, 'info');

    const result = await hideDataInVideo(
      req.file.buffer,
      req.file.originalname,
      secretMessage,
      password
    );

    logToolActivity('Video Steganography', `Message hidden successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Video Steganography', `Hide failed: ${error.message}`, 'warning');
    console.error('Video steganography hide error:', error);
    res.status(500).json({
      error: 'Failed to hide data',
      message: error.message,
    });
  }
});

// Video Steganography Extract Route
router.post('/video-stego-extract', upload.single('stegoVideo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No stego video uploaded' });
    }

    const { password } = req.body;

    logToolActivity('Video Steganography', `Extracting hidden message from video`, 'info');

    const result = await extractDataFromVideo(
      req.file.buffer,
      password
    );

    logToolActivity('Video Steganography', `Message extracted successfully`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('Video Steganography', `Extract failed: ${error.message}`, 'warning');
    console.error('Video steganography extract error:', error);
    res.status(500).json({
      error: 'Failed to extract data',
      message: error.message,
    });
  }
});

// OSINT Search Route
router.post('/osint-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Invalid search query' });
    }

    logToolActivity('OSINT Search', `Searching: ${query.substring(0, 50)}...`, 'info');

    const result = await performOSINTSearch(query);

    logToolActivity('OSINT Search', `Found ${result.totalResults} results`, 'success');

    res.json(result);
  } catch (error: any) {
    logToolActivity('OSINT Search', `Search failed: ${error.message}`, 'warning');
    console.error('OSINT search error:', error);
    res.status(500).json({
      error: 'OSINT search failed',
      message: error.message,
    });
  }
});

// Get Network Interfaces
router.get('/network-interfaces', async (req, res) => {
  try {
    const result = getNetworkInterfaces();
    res.json(result);
  } catch (error: any) {
    console.error('Network interfaces error:', error);
    res.status(500).json({
      error: 'Failed to get network interfaces',
      message: error.message,
    });
  }
});

// Start Packet Capture
router.post('/start-capture', async (req, res) => {
  try {
    const { interfaceName, filter } = req.body;

    if (!interfaceName) {
      return res.status(400).json({ error: 'Interface name is required' });
    }

    logToolActivity('Packet Capturer', `Started capture on ${interfaceName}`, 'info');

    const result = startPacketCapture(interfaceName, filter);

    res.json(result);
  } catch (error: any) {
    logToolActivity('Packet Capturer', `Capture start failed: ${error.message}`, 'warning');
    console.error('Start capture error:', error);
    res.status(500).json({
      error: 'Failed to start capture',
      message: error.message,
    });
  }
});

// Stop Packet Capture
router.post('/stop-capture', async (req, res) => {
  try {
    const result = stopPacketCapture();

    logToolActivity('Packet Capturer', `Stopped packet capture`, 'success');

    res.json(result);
  } catch (error: any) {
    console.error('Stop capture error:', error);
    res.status(500).json({
      error: 'Failed to stop capture',
      message: error.message,
    });
  }
});

// Get Captured Packets
router.get('/capture-packets', async (req, res) => {
  try {
    const result = getCapturePackets();
    res.json(result);
  } catch (error: any) {
    console.error('Get packets error:', error);
    res.status(500).json({
      error: 'Failed to get packets',
      message: error.message,
    });
  }
});

// Download PCAP File
router.get('/download-pcap', async (req, res) => {
  try {
    const pcapBuffer = generatePcapFile();

    res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
    res.setHeader('Content-Disposition', 'attachment; filename="capture.pcap"');
    res.send(pcapBuffer);
  } catch (error: any) {
    console.error('Download PCAP error:', error);
    res.status(500).json({
      error: 'Failed to download PCAP',
      message: error.message,
    });
  }
});

// Get Recent Tool Activity
router.get('/recent-tools', async (req, res) => {
  try {
    const tools = getRecentToolActivity(10);
    res.json({ tools });
  } catch (error: any) {
    console.error('Recent tools error:', error);
    res.status(500).json({
      error: 'Failed to get recent tools',
      message: error.message,
    });
  }
});

// Get System Resources
//router.get('/system-resources', async (req, res) => {
//  try {
//    const result = getSystemResources();
//    res.json(result);
//  } catch (error: any) {
//    console.error('System resources error:', error);
//    res.status(500).json({
//      error: 'Failed to get system resources',
//      message: error.message,
//    });
//  }
//});

// Rate limiter: max 30 requests per minute
const resourceLimiter = createRateLimiter(30, 60000);

// Get System Resources (with rate limiting)
router.get('/system-resources', resourceLimiter, async (req, res) => {
  try {
    const result = getSystemResources();
    res.json(result);
  } catch (error: any) {
    console.error('System resources error:', error);
    res.status(500).json({
      error: 'Failed to get system resources',
      message: error.message,
    });
  }
});

// ─── SSL Analyzer ───────────────────────────────────────────────────────────
router.post('/ssl-analyzer', async (req, res) => {
  try {
    const { domain, timeoutMs = 10000 } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain parameter' });
    }
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('SSL Analyzer', `Analysing TLS for ${cleanDomain}`, 'info');
    const result = await performSSLAnalysis(cleanDomain, safeTimeout);
    logToolActivity('SSL Analyzer', `Completed TLS analysis for ${cleanDomain}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('SSL Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'SSL analysis failed', message: error.message });
  }
});

// ─── HTTP Header Analyzer ────────────────────────────────────────────────────
router.post('/http-headers', async (req, res) => {
  try {
    const { url, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('HTTP Header Analyzer', `Analysing headers for ${url}`, 'info');
    const result = await analyzeHTTPHeaders(url, safeTimeout);
    logToolActivity('HTTP Header Analyzer', `Completed header analysis for ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('HTTP Header Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Header analysis failed', message: error.message });
  }
});

// ─── CVE Search ──────────────────────────────────────────────────────────────
const cveLimiter = createRateLimiter(10, 30000); // 10 req per 30s (NVD rate limit)
router.post('/cve-search', cveLimiter, async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    logToolActivity('CVE Search', `Searching for: ${query}`, 'info');
    const result = await searchCVE(query.trim(), limit);
    logToolActivity('CVE Search', `Found ${result.results.length} CVEs`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('CVE Search', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'CVE search failed', message: error.message });
  }
});

// ─── File Hash Calculator ────────────────────────────────────────────────────
router.post('/file-hash', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    logToolActivity('File Hash Calculator', `Hashing: ${req.file.originalname}`, 'info');
    const result = await calculateFileHashes(req.file.buffer, req.file.originalname);
    logToolActivity('File Hash Calculator', `Hashes calculated for ${req.file.originalname}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('File Hash Calculator', `Hash calculation failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Hash calculation failed', message: error.message });
  }
});

// ─── Username Enumerator ─────────────────────────────────────────────────────
const usernameLimiter = createRateLimiter(10, 60000);
router.post('/username-enum', usernameLimiter, async (req, res) => {
  try {
    const { username, platforms, timeoutMs = 8000 } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 1) {
      return res.status(400).json({ error: 'Invalid username parameter' });
    }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 20000);
    logToolActivity('Username Enumerator', `Checking: ${username}`, 'info');
    const result = await enumerateUsername(username.trim(), platforms, safeTimeout);
    logToolActivity('Username Enumerator', `Found ${username} on ${result.found} platforms`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Username Enumerator', `Enumeration failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Username enumeration failed', message: error.message });
  }
});

// ─── Malware Hash Lookup ─────────────────────────────────────────────────────
router.post('/malware-hash', async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash || typeof hash !== 'string') {
      return res.status(400).json({ error: 'Invalid hash parameter' });
    }
    logToolActivity('Malware Hash Lookup', `Looking up hash`, 'info');
    const result = await lookupMalwareHash(hash.trim());
    logToolActivity('Malware Hash Lookup', `Lookup complete — found: ${result.found}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Malware Hash Lookup', `Lookup failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Hash lookup failed', message: error.message });
  }
});

// ─── SQL Injection Tester ────────────────────────────────────────────────────
const sqliLimiter = createRateLimiter(10, 60000);
router.post('/sqli-test', sqliLimiter, async (req, res) => {
  try {
    const { url, parameter, method = 'GET', timeoutMs = 12000 } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }
    if (!parameter || typeof parameter !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter field' });
    }
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeMethod = method === 'POST' ? 'POST' : 'GET';
    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);
    logToolActivity('SQL Injection Tester', `Testing ${url}`, 'info');
    const result = await performSQLiTest(url, parameter, safeMethod, safeTimeout);
    logToolActivity('SQL Injection Tester', `Test complete — vulnerable: ${result.vulnerable}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('SQL Injection Tester', `Test failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'SQLi test failed', message: error.message });
  }
});

// ─── XSS Payload Generator ───────────────────────────────────────────────────
const xssLimiter = createRateLimiter(10, 60000);
router.post('/xss-test', xssLimiter, async (req, res) => {
  try {
    const { url, parameter, context = 'html', timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }
    if (!parameter || typeof parameter !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter field' });
    }
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('XSS Payload Generator', `Testing ${url}`, 'info');
    const result = await performXSSTest(url, parameter, context, safeTimeout);
    logToolActivity('XSS Payload Generator', `Test complete — vulnerable: ${result.vulnerable}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('XSS Payload Generator', `Test failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'XSS test failed', message: error.message });
  }
});

// ─── Website Tech Fingerprinter ──────────────────────────────────────────────
router.post('/tech-fingerprint', async (req, res) => {
  try {
    const { url, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('Tech Fingerprinter', `Fingerprinting ${url}`, 'info');
    const result = await performTechFingerprint(url, safeTimeout);
    logToolActivity('Tech Fingerprinter', `Detected ${result.technologies.length} technologies`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Tech Fingerprinter', `Fingerprinting failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Tech fingerprinting failed', message: error.message });
  }
});

// ─── Wordlist Generator ──────────────────────────────────────────────────────
const wordlistLimiter = createRateLimiter(10, 60000);
router.post('/wordlist-gen', wordlistLimiter, async (req, res) => {
  try {
    const {
      keywords,
      includeLeet = true,
      includeYears = true,
      includeSuffixes = true,
      includeCapitalization = true,
      minLength = 4,
      maxLength = 20,
      download = false,
    } = req.body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'keywords must be a non-empty array' });
    }
    if (keywords.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 keywords' });
    }

    logToolActivity('Wordlist Generator', `Generating for ${keywords.length} keywords`, 'info');
    const result = generateWordlist(keywords, {
      includeLeet,
      includeYears,
      includeSuffixes,
      includeCapitalization,
      minLength: Math.max(1, minLength),
      maxLength: Math.min(128, maxLength),
    });
    logToolActivity('Wordlist Generator', `Generated ${result.count} words`, 'success');

    if (download) {
      res.setHeader('Content-Disposition', 'attachment; filename="wordlist.txt"');
      res.setHeader('Content-Type', 'text/plain');
      res.send(result.words.join('\n'));
    } else {
      res.json(result);
    }
  } catch (error: any) {
    logToolActivity('Wordlist Generator', `Generation failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Wordlist generation failed', message: error.message });
  }
});

// ─── CT Log Search ───────────────────────────────────────────────────────────
router.post('/ct-search', async (req, res) => {
  try {
    const { domain, includeSubdomains = true, limit = 100 } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain parameter' });
    }
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    logToolActivity('CT Log Search', `Searching CT logs for ${cleanDomain}`, 'info');
    const result = await searchCTLogs(cleanDomain, includeSubdomains, safeLimit);
    logToolActivity('CT Log Search', `Found ${result.certificates.length} certificates`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('CT Log Search', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'CT log search failed', message: error.message });
  }
});

// ─── Spoofed Email Checker ───────────────────────────────────────────────────
router.post('/email-spoof-check', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain parameter' });
    }
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }
    logToolActivity('Spoofed Email Checker', `Checking ${cleanDomain}`, 'info');
    const result = await checkEmailSpoofability(cleanDomain);
    logToolActivity('Spoofed Email Checker', `Check complete — spoofable: ${result.spoofable}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Spoofed Email Checker', `Check failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Email spoof check failed', message: error.message });
  }
});

// IP Reputation
router.post('/ip-reputation', async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip || typeof ip !== 'string') return res.status(400).json({ error: 'Invalid IP parameter' });
    const cleanIP = ip.trim();
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIP)) return res.status(400).json({ error: 'Invalid IP format' });
    logToolActivity('IP Reputation Checker', `Checking reputation for ${cleanIP}`, 'info');
    const result = await checkIPReputation(cleanIP);
    logToolActivity('IP Reputation Checker', `Completed reputation check for ${cleanIP}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('IP Reputation Checker', `Check failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Reputation check failed', message: error.message });
  }
});

// Hex Viewer
router.post('/hex-view', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    logToolActivity('Hex Viewer', `Processing file: ${req.file.originalname}`, 'info');
    const result = await hexDump(req.file.buffer, req.file.originalname);
    logToolActivity('Hex Viewer', `Completed hex dump for ${req.file.originalname}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Hex Viewer', `Processing failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Hex dump failed', message: error.message });
  }
});

// String Extractor
router.post('/string-extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const minLength = Math.min(Math.max(parseInt(req.body.minLength) || 4, 1), 20);
    logToolActivity('String Extractor', `Extracting strings from: ${req.file.originalname}`, 'info');
    const result = await extractStrings(req.file.buffer, minLength);
    logToolActivity('String Extractor', `Extracted strings from ${req.file.originalname}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('String Extractor', `Extraction failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'String extraction failed', message: error.message });
  }
});

// File Type Identifier
router.post('/file-type', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    logToolActivity('File Type Identifier', `Identifying: ${req.file.originalname}`, 'info');
    const result = await identifyFileType(req.file.buffer, req.file.originalname);
    logToolActivity('File Type Identifier', `Identified ${req.file.originalname}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('File Type Identifier', `Identification failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'File type identification failed', message: error.message });
  }
});

// Exploit-DB Search
const exploitLimiter = createRateLimiter(5, 60000);
router.post('/exploit-search', exploitLimiter, async (req, res) => {
  try {
    const { query, platform, type, limit = 20 } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Invalid query' });
    const safeLimit = Math.min(Math.max(parseInt(limit), 1), 50);
    logToolActivity('Exploit-DB Search', `Searching for: ${query}`, 'info');
    const result = await searchExploitDB(query.trim(), safeLimit);
    logToolActivity('Exploit-DB Search', `Found results for: ${query}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Exploit-DB Search', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Exploit search failed', message: error.message });
  }
});

// Cookie Analyzer
router.post('/cookie-analyze', async (req, res) => {
  try {
    const { url, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('Cookie Analyzer', `Analyzing cookies for ${url}`, 'info');
    const result = await analyzeCookies(url, safeTimeout);
    logToolActivity('Cookie Analyzer', `Completed cookie analysis for ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Cookie Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Cookie analysis failed', message: error.message });
  }
});

// SSRF Tester
const ssrfLimiter = createRateLimiter(10, 60000);
router.post('/ssrf-test', ssrfLimiter, async (req, res) => {
  try {
    const { url, parameter, timeoutMs = 10000 } = req.body;
    if (!url || !parameter) return res.status(400).json({ error: 'URL and parameter are required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('SSRF Tester', `Testing SSRF on ${url} param: ${parameter}`, 'info');
    const result = await performSSRFTest(url, parameter, safeTimeout);
    logToolActivity('SSRF Tester', `Completed SSRF test on ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('SSRF Tester', `Test failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'SSRF test failed', message: error.message });
  }
});

// Traceroute
router.post('/traceroute', async (req, res) => {
  try {
    const { target, maxHops = 30, timeoutMs = 30000 } = req.body;
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Invalid target' });
    if (!isValidTarget(target)) return res.status(400).json({ error: 'Invalid target format' });
    logToolActivity('Traceroute', `Tracing route to ${target}`, 'info');
    const result = await performTraceroute(target, Math.min(maxHops, 30), Math.min(timeoutMs, 60000));
    logToolActivity('Traceroute', `Completed traceroute to ${target}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Traceroute', `Traceroute failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Traceroute failed', message: error.message });
  }
});

// BGP / ASN Lookup
router.post('/asn-lookup', async (req, res) => {
  try {
    const { target } = req.body;
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Invalid target' });
    logToolActivity('BGP/ASN Lookup', `Looking up: ${target}`, 'info');
    const result = await lookupASN(target.trim());
    logToolActivity('BGP/ASN Lookup', `Completed lookup for: ${target}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('BGP/ASN Lookup', `Lookup failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'ASN lookup failed', message: error.message });
  }
});

// Phone OSINT
router.post('/phone-lookup', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') return res.status(400).json({ error: 'Invalid phone number' });
    logToolActivity('Phone OSINT', `Looking up: ${phoneNumber}`, 'info');
    const result = await lookupPhoneNumber(phoneNumber.trim());
    logToolActivity('Phone OSINT', `Completed lookup for: ${phoneNumber}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Phone OSINT', `Lookup failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Phone lookup failed', message: error.message });
  }
});

// Domain Reputation
router.post('/domain-reputation', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'Invalid domain' });
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) return res.status(400).json({ error: 'Invalid domain format' });
    logToolActivity('Domain Reputation', `Checking reputation for ${cleanDomain}`, 'info');
    const result = await checkDomainReputation(cleanDomain);
    logToolActivity('Domain Reputation', `Completed reputation check for ${cleanDomain}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Domain Reputation', `Check failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Domain reputation check failed', message: error.message });
  }
});

// Robots.txt Analyzer
router.post('/robots-analyze', async (req, res) => {
  try {
    const { domain, timeoutMs = 10000 } = req.body;
    if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'Invalid domain' });
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) return res.status(400).json({ error: 'Invalid domain format' });
    logToolActivity('Robots.txt Analyzer', `Analyzing robots.txt for ${cleanDomain}`, 'info');
    const result = await analyzeRobotsTxt(cleanDomain, Math.min(timeoutMs, 30000));
    logToolActivity('Robots.txt Analyzer', `Completed analysis for ${cleanDomain}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Robots.txt Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Robots.txt analysis failed', message: error.message });
  }
});

// SNMP Scanner
router.post('/snmp-scan', async (req, res) => {
  try {
    const { target, community = 'public', version = '2c', timeoutMs = 10000 } = req.body;
    if (!target || !isValidTarget(target)) return res.status(400).json({ error: 'Invalid target' });
    logToolActivity('SNMP Scanner', `Scanning ${target}`, 'info');
    const result = await performSNMPScan(target, community, version, Math.min(timeoutMs, 30000));
    logToolActivity('SNMP Scanner', `Completed scan of ${target}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('SNMP Scanner', `Scan failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'SNMP scan failed', message: error.message });
  }
});

// WAF Detector
router.post('/waf-detect', async (req, res) => {
  try {
    const { url, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    logToolActivity('WAF Detector', `Detecting WAF for ${url}`, 'info');
    const result = await detectWAF(url, Math.min(timeoutMs, 30000));
    logToolActivity('WAF Detector', `Completed WAF detection for ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('WAF Detector', `Detection failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'WAF detection failed', message: error.message });
  }
});

// Host Discovery
router.post('/host-discovery', async (req, res) => {
  try {
    const { subnet, timeoutMs = 30000 } = req.body;
    if (!subnet || typeof subnet !== 'string') return res.status(400).json({ error: 'Invalid subnet' });
    if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(subnet.trim())) return res.status(400).json({ error: 'Invalid CIDR notation' });
    logToolActivity('Host Discovery', `Scanning subnet ${subnet}`, 'info');
    const result = await discoverHosts(subnet.trim(), Math.min(timeoutMs, 60000));
    logToolActivity('Host Discovery', `Completed scan of ${subnet}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Host Discovery', `Scan failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Host discovery failed', message: error.message });
  }
});

// Hash Generator (bcrypt)
router.post('/hash-generate', async (req, res) => {
  try {
    const { input, algorithm = 'bcrypt', rounds = 10 } = req.body;
    if (!input || typeof input !== 'string') return res.status(400).json({ error: 'Invalid input' });
    if (input.length > 1000) return res.status(400).json({ error: 'Input too long' });
    const safeRounds = Math.min(Math.max(parseInt(rounds), 10), 14);
    logToolActivity('Hash Generator', `Generating ${algorithm} hash`, 'info');
    const result = await generateHash(input, algorithm, safeRounds);
    logToolActivity('Hash Generator', `Generated ${algorithm} hash`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Hash Generator', `Generation failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Hash generation failed', message: error.message });
  }
});

// Open Redirect Finder
router.post('/open-redirect', async (req, res) => {
  try {
    const { url, parameter, timeoutMs = 10000 } = req.body;
    if (!url || !parameter) return res.status(400).json({ error: 'URL and parameter are required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    logToolActivity('Open Redirect Finder', `Testing ${url} param: ${parameter}`, 'info');
    const result = await testOpenRedirect(url, parameter, Math.min(timeoutMs, 30000));
    logToolActivity('Open Redirect Finder', `Completed test on ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Open Redirect Finder', `Test failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Open redirect test failed', message: error.message });
  }
});

// Web Crawler
const crawlLimiter = createRateLimiter(5, 60000);
router.post('/web-crawl', crawlLimiter, async (req, res) => {
  try {
    const { url, maxDepth = 3, maxPages = 50, timeoutMs = 30000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    logToolActivity('Web Crawler', `Crawling ${url}`, 'info');
    const result = await crawlWebsite(url, Math.min(maxDepth, 5), Math.min(maxPages, 100), Math.min(timeoutMs, 60000));
    logToolActivity('Web Crawler', `Completed crawl of ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Web Crawler', `Crawl failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Web crawl failed', message: error.message });
  }
});

// Banner Grabber
router.post('/banner-grab', async (req, res) => {
  try {
    const { target, ports = [21,22,23,25,80,110,143,443,8080], timeoutMs = 10000 } = req.body;
    if (!target || !isValidTarget(target)) return res.status(400).json({ error: 'Invalid target' });
    const safePorts = (Array.isArray(ports) ? ports : String(ports).split(',').map(Number)).filter((p: number) => p > 0 && p <= 65535).slice(0, 20);
    logToolActivity('Banner Grabber', `Grabbing banners from ${target}`, 'info');
    const result = await grabBanners(target, safePorts, Math.min(timeoutMs, 30000));
    logToolActivity('Banner Grabber', `Completed banner grab from ${target}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Banner Grabber', `Grab failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Banner grab failed', message: error.message });
  }
});

// Log Analyzer
router.post('/log-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logType = req.body.logType || 'auto';
    logToolActivity('Log Analyzer', `Analyzing ${logType} log: ${req.file.originalname}`, 'info');
    const result = await analyzeLogs(req.file.buffer, req.file.originalname, logType);
    logToolActivity('Log Analyzer', `Completed log analysis`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Log Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Log analysis failed', message: error.message });
  }
});

// PDF Forensics
router.post('/pdf-forensics', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    logToolActivity('PDF Forensics', `Analyzing: ${req.file.originalname}`, 'info');
    const result = await analyzePDF(req.file.buffer, req.file.originalname);
    logToolActivity('PDF Forensics', `Completed PDF analysis`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('PDF Forensics', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'PDF forensics failed', message: error.message });
  }
});

// Binary Analyzer
router.post('/binary-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    logToolActivity('Binary Analyzer', `Analyzing: ${req.file.originalname}`, 'info');
    const result = await analyzeBinary(req.file.buffer, req.file.originalname);
    logToolActivity('Binary Analyzer', `Completed binary analysis`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Binary Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Binary analysis failed', message: error.message });
  }
});

// Phishing URL Detector
router.post('/phishing-check', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
    logToolActivity('Phishing URL Detector', `Checking: ${url}`, 'info');
    const result = await checkPhishingURL(url.trim());
    logToolActivity('Phishing URL Detector', `Completed check for: ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Phishing URL Detector', `Check failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Phishing check failed', message: error.message });
  }
});

// HTTP Request Builder
router.post('/http-request', async (req, res) => {
  try {
    const { method = 'GET', url, headers = {}, body: reqBody = '', timeoutMs = 15000, followRedirects = true } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    logToolActivity('HTTP Request Builder', `${method} ${url}`, 'info');
    const result = await sendHTTPRequest(method, url, headers, reqBody, Math.min(timeoutMs, 30000), followRedirects);
    logToolActivity('HTTP Request Builder', `Completed ${method} to ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('HTTP Request Builder', `Request failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'HTTP request failed', message: error.message });
  }
});

// APK Analyzer
router.post('/apk-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    logToolActivity('APK Analyzer', `Analyzing: ${req.file.originalname}`, 'info');
    const result = await analyzeAPK(req.file.buffer, req.file.originalname);
    logToolActivity('APK Analyzer', `Completed APK analysis`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('APK Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'APK analysis failed', message: error.message });
  }
});

// WiFi Handshake Cracker
const wifiLimiter = createRateLimiter(3, 60000);
router.post('/wifi-crack', wifiLimiter, upload.single('capFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No capture file uploaded' });
    const wordlist = req.body.wordlist || '';
    logToolActivity('WiFi Cracker', `Cracking handshake from: ${req.file.originalname}`, 'info');
    const result = await crackWPAHandshake(req.file.buffer, wordlist, 30000);
    logToolActivity('WiFi Cracker', `Completed crack attempt`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('WiFi Cracker', `Crack failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'WiFi crack failed', message: error.message });
  }
});

// Azure Blob Finder
router.post('/azure-blob-find', async (req, res) => {
  try {
    const { keyword, timeoutMs = 15000 } = req.body;
    if (!keyword || typeof keyword !== 'string') return res.status(400).json({ error: 'Invalid keyword' });
    logToolActivity('Azure Blob Finder', `Searching for: ${keyword}`, 'info');
    const result = await findAzureBlobs(keyword.trim(), Math.min(timeoutMs, 60000));
    logToolActivity('Azure Blob Finder', `Completed search for: ${keyword}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Azure Blob Finder', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Azure blob search failed', message: error.message });
  }
});

// GCP Bucket Finder
router.post('/gcp-bucket-find', async (req, res) => {
  try {
    const { keyword, timeoutMs = 15000 } = req.body;
    if (!keyword || typeof keyword !== 'string') return res.status(400).json({ error: 'Invalid keyword' });
    logToolActivity('GCP Bucket Finder', `Searching for: ${keyword}`, 'info');
    const result = await findGCPBuckets(keyword.trim(), Math.min(timeoutMs, 60000));
    logToolActivity('GCP Bucket Finder', `Completed search for: ${keyword}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('GCP Bucket Finder', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'GCP bucket search failed', message: error.message });
  }
});

// ROP Gadget Finder
router.post('/rop-gadgets', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const arch = req.body.arch || 'x64';
    logToolActivity('ROP Gadget Finder', `Finding gadgets in: ${req.file.originalname}`, 'info');
    const result = await findROPGadgets(req.file.buffer, arch);
    logToolActivity('ROP Gadget Finder', `Completed gadget search`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('ROP Gadget Finder', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'ROP gadget search failed', message: error.message });
  }
});

// Dark Web Checker
router.post('/dark-web-check', async (req, res) => {
  try {
    const { query, type = 'keyword' } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Invalid query' });
    logToolActivity('Dark Web Checker', `Searching for: ${query}`, 'info');
    const result = await checkDarkWebMentions(query.trim(), type);
    logToolActivity('Dark Web Checker', `Completed dark web search`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Dark Web Checker', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Dark web check failed', message: error.message });
  }
});

// Disk Image Analyzer
router.post('/disk-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    logToolActivity('Disk Image Analyzer', `Analyzing: ${req.file.originalname}`, 'info');
    const result = await analyzeDiskImage(req.file.buffer, req.file.originalname);
    logToolActivity('Disk Image Analyzer', `Completed disk analysis`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Disk Image Analyzer', `Analysis failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Disk analysis failed', message: error.message });
  }
});

// Company OSINT
router.post('/company-osint', async (req, res) => {
  try {
    const { company, domain } = req.body;
    if (!company || typeof company !== 'string') return res.status(400).json({ error: 'Invalid company name' });
    logToolActivity('Company OSINT', `Running OSINT for: ${company}`, 'info');
    const result = await performCompanyOSINT(company.trim(), domain?.trim());
    logToolActivity('Company OSINT', `Completed OSINT for: ${company}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Company OSINT', `OSINT failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Company OSINT failed', message: error.message });
  }
});

// AWS Metadata Tester
router.post('/aws-metadata', async (req, res) => {
  try {
    const { url, parameter, timeoutMs = 10000 } = req.body;
    if (!url || !parameter) return res.status(400).json({ error: 'URL and parameter required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    logToolActivity('AWS Metadata Tester', `Testing ${url}`, 'info');
    const result = await testAWSMetadata(url, parameter, Math.min(timeoutMs, 30000));
    logToolActivity('AWS Metadata Tester', `Completed test on ${url}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('AWS Metadata Tester', `Test failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'AWS metadata test failed', message: error.message });
  }
});

// Cloud IAM Auditor
router.post('/iam-audit', async (req, res) => {
  try {
    const { policy } = req.body;
    if (!policy || typeof policy !== 'string') return res.status(400).json({ error: 'Invalid policy' });
    try { JSON.parse(policy); } catch { return res.status(400).json({ error: 'Invalid JSON policy' }); }
    logToolActivity('Cloud IAM Auditor', `Auditing IAM policy`, 'info');
    const result = await auditIAMPolicy(policy);
    logToolActivity('Cloud IAM Auditor', `Completed IAM audit`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Cloud IAM Auditor', `Audit failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'IAM audit failed', message: error.message });
  }
});

// Cloud Asset Enumerator
router.post('/cloud-assets', async (req, res) => {
  try {
    const { domain, organization } = req.body;
    if (!domain && !organization) return res.status(400).json({ error: 'Domain or organization required' });
    logToolActivity('Cloud Asset Enumerator', `Enumerating assets for: ${domain || organization}`, 'info');
    const result = await enumerateCloudAssets(domain || '', organization || domain || '');
    logToolActivity('Cloud Asset Enumerator', `Completed enumeration`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Cloud Asset Enumerator', `Enumeration failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Cloud asset enumeration failed', message: error.message });
  }
});

// Social Media OSINT
router.post('/social-osint', async (req, res) => {
  try {
    const { handle, platforms } = req.body;
    if (!handle || typeof handle !== 'string') return res.status(400).json({ error: 'Invalid handle' });
    logToolActivity('Social Media OSINT', `Searching for: ${handle}`, 'info');
    const result = await performSocialOSINT(handle.trim(), platforms || []);
    logToolActivity('Social Media OSINT', `Completed OSINT for: ${handle}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Social Media OSINT', `OSINT failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Social OSINT failed', message: error.message });
  }
});

// Pastebin Monitor
router.post('/pastebin-search', async (req, res) => {
  try {
    const { query, type = 'keyword' } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Invalid query' });
    logToolActivity('Pastebin Monitor', `Searching for: ${query}`, 'info');
    const result = await searchPastebins(query.trim(), type);
    logToolActivity('Pastebin Monitor', `Completed search`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Pastebin Monitor', `Search failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Pastebin search failed', message: error.message });
  }
});

// Credential Checker — HEAVILY rate-limited
const credLimiter = createRateLimiter(5, 60000);
router.post('/credential-check', credLimiter, async (req, res) => {
  try {
    const { credentials, target, loginPath = '/login' } = req.body;
    if (!credentials || !Array.isArray(credentials) || credentials.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Invalid target' });
    try { new URL(target); } catch { return res.status(400).json({ error: 'Invalid target URL' }); }
    if (credentials.length > 50) return res.status(400).json({ error: 'Maximum 50 credential pairs' });
    logToolActivity('Credential Checker', `Testing ${credentials.length} credentials against ${target}`, 'warning');
    const result = await checkCredentials(credentials, target, loginPath, 10000);
    logToolActivity('Credential Checker', `Completed credential check against ${target}`, 'success');
    res.json(result);
  } catch (error: any) {
    logToolActivity('Credential Checker', `Check failed: ${error.message}`, 'warning');
    res.status(500).json({ error: 'Credential check failed', message: error.message });
  }
});

export default router;

/* ─── REMOVED DUPLICATE ROUTES (commented out) ──────────────────────────────
router.post('/robots-analyze', async (req, res) => {
  try {
    const { domain, timeoutMs = 10000 } = req.body;
    if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'Invalid domain parameter' });
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) return res.status(400).json({ error: 'Invalid domain format' });
    logToolActivity('Robots.txt Analyzer', `Analyzing ${cleanDomain}`, 'info');
    const result = await analyzeRobotsTxt(cleanDomain, timeoutMs);
    logToolActivity('Robots.txt Analyzer', `Done — ${result.interestingPaths.length} interesting paths`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Robots.txt analysis failed', message: error.message });
  }
});

// ─── SNMP Scanner ────────────────────────────────────────────────────────────
router.post('/snmp-scan', async (req, res) => {
  try {
    const { target, community = 'public', version = '2c', timeoutMs = 10000 } = req.body;
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Invalid target parameter' });
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('SNMP Scanner', `Scanning ${target}`, 'info');
    const result = await performSNMPScan(target, community, version, safeTimeout);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'SNMP scan failed', message: error.message });
  }
});

// ─── WAF Detector ────────────────────────────────────────────────────────────
router.post('/waf-detect', async (req, res) => {
  try {
    const { url, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid url parameter' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('WAF Detector', `Detecting WAF for ${url}`, 'info');
    const result = await detectWAF(url, safeTimeout);
    logToolActivity('WAF Detector', `Done — WAF detected: ${result.wafDetected}`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'WAF detection failed', message: error.message });
  }
});

// ─── ARP Host Discovery ──────────────────────────────────────────────────────
router.post('/host-discovery', async (req, res) => {
  try {
    const { subnet, timeoutMs = 15000 } = req.body;
    if (!subnet || typeof subnet !== 'string') return res.status(400).json({ error: 'Invalid subnet parameter' });
    if (!/^[\d./]+$/.test(subnet)) return res.status(400).json({ error: 'Invalid subnet format' });
    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);
    logToolActivity('Host Discovery', `Scanning ${subnet}`, 'info');
    const result = await discoverHosts(subnet, safeTimeout);
    logToolActivity('Host Discovery', `Found ${result.hostsUp} hosts`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Host discovery failed', message: error.message });
  }
});

// ─── Hash Generator / Verifier ───────────────────────────────────────────────
router.post('/hash-generate', async (req, res) => {
  try {
    const { input, algorithm, rounds, verify } = req.body;
    if (!input || typeof input !== 'string') return res.status(400).json({ error: 'Invalid input parameter' });
    if (!algorithm || typeof algorithm !== 'string') return res.status(400).json({ error: 'Invalid algorithm parameter' });
    logToolActivity('Hash Generator', `Generating ${algorithm} hash`, 'info');
    const result = await generateHash(input, algorithm, rounds, verify);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Hash generation failed', message: error.message });
  }
});

// ─── Open Redirect Finder ────────────────────────────────────────────────────
const openRedirectLimiter = createRateLimiter(10, 60000);
router.post('/open-redirect', openRedirectLimiter, async (req, res) => {
  try {
    const { url, parameter, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid url parameter' });
    if (!parameter || typeof parameter !== 'string') return res.status(400).json({ error: 'Invalid parameter field' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('Open Redirect Finder', `Testing ${url}`, 'info');
    const result = await testOpenRedirect(url, parameter, safeTimeout);
    logToolActivity('Open Redirect Finder', `Done — vulnerable: ${result.vulnerable}`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Open redirect test failed', message: error.message });
  }
});

// ─── Web Crawler ─────────────────────────────────────────────────────────────
router.post('/web-crawl', async (req, res) => {
  try {
    const { url, maxDepth = 3, maxPages = 50, timeoutMs = 60000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid url parameter' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 10000), 120000);
    const safeDepth = Math.min(Math.max(maxDepth, 1), 10);
    const safePages = Math.min(Math.max(maxPages, 5), 200);
    logToolActivity('Web Crawler', `Crawling ${url}`, 'info');
    const result = await crawlWebsite(url, safeDepth, safePages, safeTimeout);
    logToolActivity('Web Crawler', `Crawled ${result.totalPages} pages`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Web crawl failed', message: error.message });
  }
});

// ─── Banner Grabber ──────────────────────────────────────────────────────────
router.post('/banner-grab', async (req, res) => {
  try {
    const { target, ports = [21, 22, 23, 25, 80, 110, 143, 443, 8080], timeoutMs = 10000 } = req.body;
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Invalid target parameter' });
    if (!Array.isArray(ports) || ports.length > 50) return res.status(400).json({ error: 'Ports must be an array of max 50 ports' });
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('Banner Grabber', `Grabbing banners from ${target}`, 'info');
    const result = await grabBanners(target, ports, safeTimeout);
    logToolActivity('Banner Grabber', `Done — ${result.results.filter((r: any) => r.open).length} open ports`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Banner grab failed', message: error.message });
  }
});

// ─── Log Analyzer ────────────────────────────────────────────────────────────
router.post('/log-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No log file uploaded' });
    const logType = req.body.logType || 'auto';
    logToolActivity('Log Analyzer', `Analyzing ${req.file.originalname}`, 'info');
    const result = analyzeLogs(req.file.buffer, req.file.originalname, logType);
    logToolActivity('Log Analyzer', `Analysis complete — ${result.anomalies.length} anomalies`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Log analysis failed', message: error.message });
  }
});

// ─── PDF Forensics ───────────────────────────────────────────────────────────
router.post('/pdf-forensics', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
    logToolActivity('PDF Forensics', `Analyzing ${req.file.originalname}`, 'info');
    const result = analyzePDF(req.file.buffer, req.file.originalname);
    logToolActivity('PDF Forensics', `Analysis complete — ${result.suspiciousFeatures.length} suspicious features`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'PDF forensics failed', message: error.message });
  }
});

// ─── Binary Analyzer ────────────────────────────────────────────────────────
router.post('/binary-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No binary file uploaded' });
    logToolActivity('Binary Analyzer', `Analyzing ${req.file.originalname}`, 'info');
    const result = analyzeBinary(req.file.buffer, req.file.originalname);
    logToolActivity('Binary Analyzer', `Analysis complete — format: ${result.format}`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Binary analysis failed', message: error.message });
  }
});

// ─── Phishing URL Detector ───────────────────────────────────────────────────
router.post('/phishing-check', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid url parameter' });
    logToolActivity('Phishing Detector', `Checking ${url}`, 'info');
    const result = checkPhishingURL(url);
    logToolActivity('Phishing Detector', `Verdict: ${result.verdict} (score ${result.score})`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Phishing check failed', message: error.message });
  }
});

// ─── HTTP Request Builder ────────────────────────────────────────────────────
const httpRequestLimiter = createRateLimiter(30, 60000);
router.post('/http-request', httpRequestLimiter, async (req, res) => {
  try {
    const { method = 'GET', url, headers = {}, body = '', timeoutMs = 15000, followRedirects = true } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid url parameter' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 30000);
    logToolActivity('HTTP Request Builder', `${method} ${url}`, 'info');
    const result = await sendHTTPRequest(method, url, headers, body, safeTimeout, followRedirects);
    logToolActivity('HTTP Request Builder', `Response: ${result.statusCode} in ${result.responseTime}ms`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'HTTP request failed', message: error.message });
  }
});

// ─── Company OSINT ───────────────────────────────────────────────────────────
const osintLimiter = createRateLimiter(5, 60000);
router.post('/company-osint', osintLimiter, async (req, res) => {
  try {
    const { company, domain } = req.body;
    if (!company || typeof company !== 'string') return res.status(400).json({ error: 'Invalid company parameter' });
    logToolActivity('Company OSINT', `Gathering intel on "${company}"`, 'info');
    const result = await performCompanyOSINT(company, domain);
    logToolActivity('Company OSINT', `Intel gathered`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Company OSINT failed', message: error.message });
  }
});

// ─── AWS Metadata Tester ─────────────────────────────────────────────────────
const awsMetaLimiter = createRateLimiter(5, 60000);
router.post('/aws-metadata', awsMetaLimiter, async (req, res) => {
  try {
    const { url, parameter, timeoutMs = 10000 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Invalid url parameter' });
    if (!parameter || typeof parameter !== 'string') return res.status(400).json({ error: 'Invalid parameter field' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    const safeTimeout = Math.min(Math.max(timeoutMs, 3000), 30000);
    logToolActivity('AWS Metadata Tester', `Testing ${url}`, 'info');
    const result = await testAWSMetadata(url, parameter, safeTimeout);
    logToolActivity('AWS Metadata Tester', `Done — vulnerable: ${result.vulnerable}`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'AWS metadata test failed', message: error.message });
  }
});

// ─── Cloud IAM Auditor ───────────────────────────────────────────────────────
router.post('/iam-audit', async (req, res) => {
  try {
    const { policy } = req.body;
    if (!policy || typeof policy !== 'string') return res.status(400).json({ error: 'Invalid policy parameter' });
    logToolActivity('IAM Auditor', `Auditing policy`, 'info');
    const result = auditIAMPolicy(policy);
    logToolActivity('IAM Auditor', `Audit complete — ${result.issues.length} issues, score: ${result.score}`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'IAM audit failed', message: error.message });
  }
});

// ─── Cloud Asset Enumerator ──────────────────────────────────────────────────
const cloudAssetLimiter = createRateLimiter(5, 60000);
router.post('/cloud-assets', cloudAssetLimiter, async (req, res) => {
  try {
    const { domain, organization } = req.body;
    if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'Invalid domain parameter' });
    logToolActivity('Cloud Asset Enumerator', `Enumerating assets for ${domain}`, 'info');
    const result = await enumerateCloudAssets(domain, organization);
    logToolActivity('Cloud Asset Enumerator', `Found ${result.assets.filter((a: any) => a.status === 'public').length} public assets`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Cloud asset enumeration failed', message: error.message });
  }
});

// ─── Social Media OSINT ──────────────────────────────────────────────────────
const socialLimiter = createRateLimiter(10, 60000);
router.post('/social-osint', socialLimiter, async (req, res) => {
  try {
    const { handle, platforms } = req.body;
    if (!handle || typeof handle !== 'string') return res.status(400).json({ error: 'Invalid handle parameter' });
    logToolActivity('Social Media OSINT', `Searching for "${handle}"`, 'info');
    const result = await performSocialOSINT(handle, platforms);
    logToolActivity('Social Media OSINT', `Found ${result.profiles.filter((p: any) => p.found).length} profiles`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Social media OSINT failed', message: error.message });
  }
});

// ─── Pastebin Monitor ────────────────────────────────────────────────────────
const pastebinLimiter = createRateLimiter(10, 60000);
router.post('/pastebin-search', pastebinLimiter, async (req, res) => {
  try {
    const { query, type = 'keyword' } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });
    logToolActivity('Pastebin Monitor', `Searching for "${query}"`, 'info');
    const result = await searchPastebins(query.trim(), type);
    logToolActivity('Pastebin Monitor', `Found ${result.total} results`, 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Pastebin search failed', message: error.message });
  }
});

// ─── Credential Checker ──────────────────────────────────────────────────────
const credLimiter = createRateLimiter(5, 60000);
router.post('/credential-check', credLimiter, async (req, res) => {
  try {
    const { credentials, target, loginPath = '/login', timeoutMs = 5000 } = req.body;
    if (!credentials || !Array.isArray(credentials) || credentials.length === 0) return res.status(400).json({ error: 'Invalid credentials parameter' });
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Invalid target parameter' });
    try { new URL(target); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    if (credentials.length > 20) return res.status(400).json({ error: 'Maximum 20 credentials per request' });
    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 15000);
    logToolActivity('Credential Checker', `Testing ${credentials.length} credentials`, 'warning');
    const result = await checkCredentials(credentials, target, loginPath, safeTimeout);
    logToolActivity('Credential Checker', `Done — ${result.found} valid credentials`, result.found > 0 ? 'warning' : 'success');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Credential check failed', message: error.message });
  }
});
*/