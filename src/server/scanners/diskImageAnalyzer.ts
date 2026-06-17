import { logToolActivity } from '../utils/activityLogger.js';

export interface Partition {
  index: number;
  status: string;
  type: string;
  typeName: string;
  lbaStart: number;
  lbaSize: number;
  sizeBytes: number;
  sizeHuman: string;
  active: boolean;
}

export interface DiskImageResult {
  filename: string;
  size: number;
  mbrValid: boolean;
  mbrSignature: string;
  partitions: Partition[];
  fileSystem?: string;
  volumeLabel?: string;
  anomalies: string[];
}

// Partition type codes
const PARTITION_TYPES: Record<number, string> = {
  0x00: 'Empty',
  0x01: 'FAT12',
  0x04: 'FAT16 (<32M)',
  0x05: 'Extended',
  0x06: 'FAT16',
  0x07: 'NTFS / exFAT / HPFS',
  0x0B: 'FAT32 (CHS)',
  0x0C: 'FAT32 (LBA)',
  0x0E: 'FAT16 (LBA)',
  0x0F: 'Extended (LBA)',
  0x11: 'Hidden FAT12',
  0x14: 'Hidden FAT16 (<32M)',
  0x16: 'Hidden FAT16',
  0x17: 'Hidden NTFS',
  0x1B: 'Hidden FAT32',
  0x1C: 'Hidden FAT32 (LBA)',
  0x1E: 'Hidden FAT16 (LBA)',
  0x27: 'Windows Recovery',
  0x41: 'Linux / PPC PReP',
  0x82: 'Linux Swap',
  0x83: 'Linux native',
  0x84: 'Hibernation',
  0x85: 'Linux Extended',
  0x86: 'NTFS Volume Set',
  0x87: 'NTFS Volume Set',
  0x8E: 'Linux LVM',
  0xA5: 'FreeBSD',
  0xA6: 'OpenBSD',
  0xA8: 'macOS X',
  0xAF: 'macOS X HFS+',
  0xBE: 'Solaris boot',
  0xBF: 'Solaris',
  0xEB: 'BeOS',
  0xEE: 'GPT Protective MBR',
  0xEF: 'EFI System Partition',
  0xFD: 'Linux RAID auto',
  0xFE: 'IBM IML',
  0xFF: 'BBT',
};

function humanSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[Math.min(i, units.length - 1)]}`;
}

function parsePartitionEntry(buffer: Buffer, offset: number, index: number): Partition {
  const status = buffer[offset];
  const type = buffer[offset + 4];
  const lbaStart = buffer.readUInt32LE(offset + 8);
  const lbaSize = buffer.readUInt32LE(offset + 12);
  const sizeBytes = lbaSize * 512;

  return {
    index,
    status: '0x' + status.toString(16).padStart(2, '0'),
    type: '0x' + type.toString(16).padStart(2, '0'),
    typeName: PARTITION_TYPES[type] || `Unknown (0x${type.toString(16)})`,
    lbaStart,
    lbaSize,
    sizeBytes,
    sizeHuman: humanSize(sizeBytes),
    active: status === 0x80,
  };
}

/**
 * Detect filesystem type from VBR magic bytes
 */
function detectFilesystem(buffer: Buffer): string | undefined {
  if (buffer.length < 512) return undefined;

  // FAT magic: "FAT" at offset 54 (FAT12/16) or 82 (FAT32)
  const fat1216 = buffer.slice(54, 57).toString('ascii');
  const fat32 = buffer.slice(82, 87).toString('ascii');
  const ntfsMagic = buffer.slice(3, 11).toString('ascii');
  const ext2Magic = buffer.length >= 1082 ? buffer.readUInt16LE(1080) : 0;

  if (ntfsMagic === 'NTFS    ') return 'NTFS';
  if (fat32.startsWith('FAT32')) return 'FAT32';
  if (fat1216.startsWith('FAT')) return fat1216.trim();
  if (ext2Magic === 0xEF53) return 'ext2/ext3/ext4';

  return undefined;
}

export async function analyzeDiskImage(
  buffer: Buffer,
  filename: string
): Promise<DiskImageResult> {
  logToolActivity('Disk Image Analyzer', `Analyzing ${filename} (${buffer.length} bytes)`, 'info');

  const anomalies: string[] = [];

  // Check if buffer has enough bytes for MBR
  if (buffer.length < 512) {
    logToolActivity('Disk Image Analyzer', 'File too small to be a valid disk image', 'warning');
    return {
      filename,
      size: buffer.length,
      mbrValid: false,
      mbrSignature: 'N/A',
      partitions: [],
      anomalies: ['File is smaller than 512 bytes — cannot be a valid disk image'],
    };
  }

  // Check MBR signature at offset 510-511
  const sig1 = buffer[510];
  const sig2 = buffer[511];
  const mbrValid = sig1 === 0x55 && sig2 === 0xAA;
  const mbrSignature = `0x${sig1.toString(16).padStart(2, '0')}${sig2.toString(16).padStart(2, '0')}`;

  if (!mbrValid) {
    anomalies.push(`Invalid MBR signature: expected 0x55AA, found ${mbrSignature}`);
  }

  // Parse 4 partition table entries at offset 0x1BE
  const PARTITION_TABLE_OFFSET = 0x1BE;
  const partitions: Partition[] = [];

  for (let i = 0; i < 4; i++) {
    const entryOffset = PARTITION_TABLE_OFFSET + i * 16;
    const entry = parsePartitionEntry(buffer, entryOffset, i + 1);

    // Skip empty partitions
    if (entry.lbaStart === 0 && entry.lbaSize === 0) continue;

    partitions.push(entry);

    if (entry.active && entry.index > 1) {
      anomalies.push(`Multiple active/bootable partitions detected (partition ${entry.index})`);
    }
  }

  // Check for GPT
  if (partitions.some((p) => p.type === '0xee')) {
    anomalies.push('GPT protective MBR detected — disk uses GUID Partition Table (GPT), not classic MBR partitions');
  }

  // Try to detect filesystem from first 512 bytes
  const fileSystem = detectFilesystem(buffer);

  if (partitions.length === 0 && mbrValid) {
    anomalies.push('No valid partitions found in partition table');
  }

  logToolActivity('Disk Image Analyzer', `Analysis complete: ${partitions.length} partitions, MBR ${mbrValid ? 'valid' : 'invalid'}`, 'success');

  return {
    filename,
    size: buffer.length,
    mbrValid,
    mbrSignature,
    partitions,
    fileSystem,
    anomalies,
  };
}
