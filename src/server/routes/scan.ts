import express from 'express';
import { portScan, parsePorts } from '../scanners/portScanner.js';
import { performOSFingerprint } from '../scanners/osFingerprint.js';
import { performWHOISLookup } from '../scanners/whoisLookup.js';
import { performServiceDetection } from '../scanners/serviceDetection.js';
import { performSubdomainEnumeration } from '../scanners/subdomainEnumeration.js';
import { performDNSRecon } from '../scanners/dnsRecon.js';
import { performAPIScan } from '../scanners/apiScanner.js';
import { performBreachCheck } from '../scanners/breachChecker.js';

const router = express.Router();

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


export default router;
