import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface BinarySection {
  name: string;
  virtualAddress: string;
  size: number;
  entropy: number;
  characteristics: string;
}

export interface BinaryResult {
  filename: string;
  format: string;
  architecture: string;
  bitness: number;
  imports: string[];
  exports: string[];
  sections: BinarySection[];
  entropy: number;
  packed: boolean;
  isSigned: boolean;
  anomalies: string[];
}

function shannonEntropy(buf: Buffer): number {
  const freq = new Array(256).fill(0);
  for (let i = 0; i < buf.length; i++) freq[buf[i]]++;
  let entropy = 0;
  for (const f of freq) {
    if (f === 0) continue;
    const p = f / buf.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function extractStrings(buf: Buffer, minLen: number = 4): string[] {
  const strings: string[] = [];
  let current = '';
  for (let i = 0; i < Math.min(buf.length, 1024 * 1024); i++) {
    const b = buf[i];
    if (b >= 0x20 && b < 0x7f) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= minLen) strings.push(current);
      current = '';
    }
  }
  if (current.length >= minLen) strings.push(current);
  return strings;
}

function parsePEArch(buf: Buffer): { arch: string; bitness: number } {
  try {
    // PE offset is at 0x3C
    const peOffset = buf.readUInt32LE(0x3c);
    if (peOffset + 6 > buf.length) return { arch: 'Unknown', bitness: 32 };
    const machine = buf.readUInt16LE(peOffset + 4);
    const archMap: Record<number, [string, number]> = {
      0x014c: ['x86', 32],
      0x8664: ['x86-64', 64],
      0x01c4: ['ARM', 32],
      0xaa64: ['ARM64', 64],
      0x0200: ['IA-64', 64],
      0x01f0: ['PowerPC', 32],
      0x0166: ['MIPS', 32],
    };
    const [arch, bitness] = archMap[machine] ?? ['Unknown', 32];
    return { arch, bitness };
  } catch {
    return { arch: 'Unknown', bitness: 32 };
  }
}

function parsePESections(buf: Buffer): BinarySection[] {
  const sections: BinarySection[] = [];
  try {
    const peOffset = buf.readUInt32LE(0x3c);
    if (peOffset + 24 > buf.length) return sections;
    const numSections = buf.readUInt16LE(peOffset + 6);
    const optHeaderSize = buf.readUInt16LE(peOffset + 20);
    const sectionTableOffset = peOffset + 24 + optHeaderSize;

    for (let i = 0; i < Math.min(numSections, 24); i++) {
      const off = sectionTableOffset + i * 40;
      if (off + 40 > buf.length) break;

      const nameBytes = buf.slice(off, off + 8);
      const name = nameBytes.toString('ascii').replace(/\0/g, '');
      const virtualSize = buf.readUInt32LE(off + 8);
      const virtualAddress = buf.readUInt32LE(off + 12);
      const rawSize = buf.readUInt32LE(off + 16);
      const rawOffset = buf.readUInt32LE(off + 20);
      const characteristics = buf.readUInt32LE(off + 36);

      const sectionBuf = buf.slice(rawOffset, rawOffset + rawSize);
      const sectionEntropy = sectionBuf.length > 0 ? shannonEntropy(sectionBuf) : 0;

      const charFlags: string[] = [];
      if (characteristics & 0x20) charFlags.push('CODE');
      if (characteristics & 0x40) charFlags.push('INIT_DATA');
      if (characteristics & 0x80) charFlags.push('UNINIT_DATA');
      if (characteristics & 0x20000000) charFlags.push('EXEC');
      if (characteristics & 0x40000000) charFlags.push('READ');
      if (characteristics & 0x80000000) charFlags.push('WRITE');

      sections.push({
        name: name || `.sect${i}`,
        virtualAddress: `0x${virtualAddress.toString(16).padStart(8, '0')}`,
        size: virtualSize,
        entropy: parseFloat(sectionEntropy.toFixed(3)),
        characteristics: charFlags.join('|') || 'NONE',
      });
    }
  } catch {}
  return sections;
}

function extractImportsFromStrings(strings: string[]): string[] {
  const importPatterns = [
    /\.(dll|exe|so|dylib)$/i,
    /^(CreateProcess|VirtualAlloc|WriteProcessMemory|LoadLibrary|GetProcAddress|RegOpenKey|HttpSendRequest|InternetConnect|socket|connect|send|recv|WinExec|ShellExecute)/,
  ];
  return strings.filter((s) => importPatterns.some((p) => p.test(s))).slice(0, 50);
}

export function analyzeBinary(buffer: Buffer, filename: string): BinaryResult {
  const start = performance.now();
  logToolActivity('Binary Analyzer', `Analyzing ${filename} (${buffer.length} bytes)`, 'info');

  const magic = buffer.slice(0, 4);
  const anomalies: string[] = [];

  let format = 'Unknown';
  let arch = 'Unknown';
  let bitness = 32;
  let sections: BinarySection[] = [];

  // Detect format
  if (magic[0] === 0x4d && magic[1] === 0x5a) {
    format = 'PE (Windows Executable)';
    const peInfo = parsePEArch(buffer);
    arch = peInfo.arch;
    bitness = peInfo.bitness;
    sections = parsePESections(buffer);
  } else if (magic[0] === 0x7f && magic[1] === 0x45 && magic[2] === 0x4c && magic[3] === 0x46) {
    format = 'ELF (Linux Executable)';
    const elfClass = buffer[4];
    bitness = elfClass === 2 ? 64 : 32;
    const elfMachine = buffer.length > 18 ? buffer.readUInt16LE(18) : 0;
    const elfArchMap: Record<number, string> = {
      0x03: 'x86',
      0x3e: 'x86-64',
      0x28: 'ARM',
      0xb7: 'AArch64',
      0x02: 'SPARC',
      0x08: 'MIPS',
    };
    arch = elfArchMap[elfMachine] ?? 'Unknown';
  } else if (
    (magic[0] === 0xce || magic[0] === 0xcf) &&
    magic[1] === 0xfa && magic[2] === 0xed && magic[3] === 0xfe
  ) {
    format = 'Mach-O (macOS Executable)';
    bitness = magic[0] === 0xcf ? 64 : 32;
    arch = 'x86';
  } else if (magic[0] === 0xca && magic[1] === 0xfe && magic[2] === 0xba && magic[3] === 0xbe) {
    format = 'Mach-O Universal Binary';
    bitness = 64;
    arch = 'Universal (Multi-arch)';
  }

  // Compute entropy
  const entropy = parseFloat(shannonEntropy(buffer).toFixed(3));
  const packed = entropy > 7.2;

  if (packed) {
    anomalies.push(`High entropy (${entropy}) — binary is likely packed or encrypted`);
  }

  // Check for digital signature (PE)
  const isSigned = format.startsWith('PE') && buffer.includes(Buffer.from('PKCS7'));

  if (format === 'Unknown') {
    anomalies.push('Unknown binary format — may be obfuscated or corrupted');
  }

  // Extract strings
  const strings = extractStrings(buffer);
  const imports = extractImportsFromStrings(strings);

  // Look for suspicious patterns
  const suspiciousPatterns = [
    { pattern: 'http://', label: 'Hardcoded HTTP URL' },
    { pattern: 'https://', label: 'Hardcoded HTTPS URL' },
    { pattern: 'cmd.exe', label: 'Command shell reference' },
    { pattern: 'powershell', label: 'PowerShell reference' },
    { pattern: '/bin/sh', label: 'Unix shell reference' },
  ];

  for (const { pattern, label } of suspiciousPatterns) {
    const count = strings.filter((s) => s.toLowerCase().includes(pattern.toLowerCase())).length;
    if (count > 0) anomalies.push(`${label} found (${count} occurrence${count > 1 ? 's' : ''})`);
  }

  logToolActivity('Binary Analyzer', `Analysis complete — format: ${format}, entropy: ${entropy}`, 'success');

  return {
    filename,
    format,
    architecture: arch,
    bitness,
    imports,
    exports: [],
    sections,
    entropy,
    packed,
    isSigned,
    anomalies,
  };
}
