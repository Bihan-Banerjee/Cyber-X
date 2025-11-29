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

    const results = await portScan({
      target,
      ports: portList,
      tcp: Boolean(tcp),
      udp: Boolean(udp),
      timeoutMs: safeTimeout,
      concurrency: safeConcurrency,
      retries: 2,
    });

    res.json({
      target,
      totalPorts: portList.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
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

    const result = await performOSFingerprint(target, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    // Basic domain validation
    const cleanDomain = domain.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const result = await performWHOISLookup(cleanDomain);

    res.json(result);
  } catch (error: any) {
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

    const result = await performServiceDetection(target, ports, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    // Basic domain validation
    const cleanDomain = domain.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 10000);

    const result = await performSubdomainEnumeration(cleanDomain, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    // Basic domain validation
    const cleanDomain = domain.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 15000);

    const result = await performDNSRecon(cleanDomain, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    // Basic URL validation
    try {
      new URL(target);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 30000);

    const result = await performAPIScan(target, apiKey, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await performBreachCheck(email);

    res.json(result);
  } catch (error: any) {
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

    const result = await performHashCracking(hashes, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await performDirectoryFuzzing(target, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    // Basic URL validation
    try {
      new URL(target);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 30000);

    const result = await performAuthCheck(target, username, password, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await performContainerScan(imageName, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await processCipher(cipherType, operation, input, key);

    res.json(result);
  } catch (error: any) {
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

    const result = await analyzeCipher(input);

    res.json(result);
  } catch (error: any) {
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

    const result = await performVulnerabilityFuzzing(target, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await performS3BucketFinding(keyword, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await performK8sEnumeration(apiEndpoint, token, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await decodeJWT(token);

    res.json(result);
  } catch (error: any) {
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

    const result = await performIPGeolocation(targetIP);

    res.json(result);
  } catch (error: any) {
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

    // Basic IP validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const safeTimeout = Math.min(Math.max(timeoutMs, 5000), 60000);

    const result = await performReverseIPLookup(ip, safeTimeout);

    res.json(result);
  } catch (error: any) {
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
    const result = await processCrypto(req.body);
    res.json(result);
  } catch (error: any) {
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
    const result = await generateKeys(req.body);
    res.json(result);
  } catch (error: any) {
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

    const result = await analyzePackets(pcapData, safeTimeout);

    res.json(result);
  } catch (error: any) {
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

    const result = await extractImageMetadata(req.file.buffer, req.file.originalname);

    res.json(result);
  } catch (error: any) {
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

    const result = await hideDataInImage(
      req.file.buffer,
      secretMessage,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await extractDataFromImage(
      req.file.buffer,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await hideDataInAudio(
      req.file.buffer,
      secretMessage,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await extractDataFromAudio(
      req.file.buffer,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await hideDataInDocument(
      req.file.buffer,
      req.file.originalname,
      secretMessage,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await extractDataFromDocument(
      req.file.buffer,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await hideDataInVideo(
      req.file.buffer,
      req.file.originalname,
      secretMessage,
      password
    );

    res.json(result);
  } catch (error: any) {
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

    const result = await extractDataFromVideo(
      req.file.buffer,
      password
    );

    res.json(result);
  } catch (error: any) {
    console.error('Video steganography extract error:', error);
    res.status(500).json({
      error: 'Failed to extract data',
      message: error.message,
    });
  }
});

export default router;