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

export default router;