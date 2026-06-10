import { logToolActivity } from '../utils/activityLogger.js';

export interface APKAnalysisResult {
  filename: string;
  fileSize: number;
  packageName: string;
  version: string;
  permissions: string[];
  activities: string[];
  services: string[];
  receivers: string[];
  hardcodedStrings: HardcodedString[];
  urls: string[];
  dangerousPermissions: string[];
  zipEntries: string[];
  analysisNotes: string[];
}

export interface HardcodedString {
  type: string;
  value: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const DANGEROUS_PERMISSIONS = [
  'READ_SMS',
  'SEND_SMS',
  'RECEIVE_SMS',
  'CAMERA',
  'READ_CONTACTS',
  'WRITE_CONTACTS',
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'RECORD_AUDIO',
  'READ_PHONE_STATE',
  'CALL_PHONE',
  'READ_CALL_LOG',
  'PROCESS_OUTGOING_CALLS',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE',
  'REQUEST_INSTALL_PACKAGES',
  'BIND_DEVICE_ADMIN',
  'SYSTEM_ALERT_WINDOW',
];

/**
 * Parse ZIP central directory from buffer to extract entry names
 * APK files are ZIP archives. We scan for Local File Header signatures.
 */
function extractZipEntries(buffer: Buffer): string[] {
  const entries: string[] = [];
  const PK_LOCAL = 0x04034b50; // Local file header signature

  let offset = 0;
  while (offset < buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === PK_LOCAL) {
      const filenameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const compressedSize = buffer.readUInt32LE(offset + 18);

      if (filenameLen > 0 && filenameLen < 512 && offset + 30 + filenameLen <= buffer.length) {
        const filename = buffer.slice(offset + 30, offset + 30 + filenameLen).toString('utf8');
        entries.push(filename);
      }

      // Advance to next entry
      const advance = 30 + filenameLen + extraLen + compressedSize;
      if (advance <= 0 || advance > buffer.length) break;
      offset += advance;
    } else {
      offset++;
    }
  }

  return entries;
}

/**
 * Naive scan of bytes for interesting strings using regex
 */
function scanForHardcodedStrings(buffer: Buffer): HardcodedString[] {
  const results: HardcodedString[] = [];
  const text = buffer.toString('latin1'); // binary-safe ASCII extraction

  const patterns: { regex: RegExp; type: string; severity: HardcodedString['severity'] }[] = [
    {
      regex: /AIza[0-9A-Za-z\-_]{35}/g,
      type: 'Google API Key',
      severity: 'critical',
    },
    {
      regex: /AKIA[0-9A-Z]{16}/g,
      type: 'AWS Access Key ID',
      severity: 'critical',
    },
    {
      regex: /https?:\/\/[a-zA-Z0-9._\-\/]{10,80}/g,
      type: 'URL',
      severity: 'low',
    },
    {
      regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
      type: 'Email Address',
      severity: 'medium',
    },
    {
      regex: /(?:password|passwd|secret|api_?key|token|auth)["\s:=]+[^\s"]{4,}/gi,
      type: 'Potential Credential',
      severity: 'high',
    },
    {
      regex: /-----BEGIN [A-Z ]+ KEY-----/g,
      type: 'Private Key Header',
      severity: 'critical',
    },
    {
      regex: /(?:mysql|postgres|mongodb|redis):\/\/[^\s"]{8,}/gi,
      type: 'Database Connection String',
      severity: 'critical',
    },
  ];

  const seen = new Set<string>();

  for (const { regex, type, severity } of patterns) {
    let match: RegExpExecArray | null;
    let count = 0;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null && count < 20) {
      const val = match[0].slice(0, 120);
      const key = `${type}:${val}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ type, value: val, severity });
        count++;
      }
    }
  }

  return results;
}

/**
 * Extract strings that look like XML/manifest content from buffer
 */
function extractManifestInfo(buffer: Buffer): {
  packageName: string;
  version: string;
  permissions: string[];
  activities: string[];
  services: string[];
  receivers: string[];
} {
  const text = buffer.toString('latin1');

  const packageMatch = text.match(/package[=\s"]+([a-zA-Z][a-zA-Z0-9_.]{2,80})/);
  const versionMatch = text.match(/versionName[=\s"]+([0-9a-zA-Z._\-]{1,20})/);

  // Permissions
  const permRegex = /(?:android\.permission\.|uses-permission[^>]*name[=\s"]+android\.permission\.)([A-Z_]{3,50})/g;
  const permissions = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = permRegex.exec(text)) !== null) {
    permissions.add(m[1]);
  }

  // Activities, services, receivers by class name pattern
  const activityRegex = /activity[^>]*name[=\s"]+\.?([a-zA-Z][a-zA-Z0-9_.]{3,60}Activity)/g;
  const activities: string[] = [];
  while ((m = activityRegex.exec(text)) !== null && activities.length < 20) {
    activities.push(m[1]);
  }

  const serviceRegex = /service[^>]*name[=\s"]+\.?([a-zA-Z][a-zA-Z0-9_.]{3,60}Service)/g;
  const services: string[] = [];
  while ((m = serviceRegex.exec(text)) !== null && services.length < 20) {
    services.push(m[1]);
  }

  const receiverRegex = /receiver[^>]*name[=\s"]+\.?([a-zA-Z][a-zA-Z0-9_.]{3,60}Receiver)/g;
  const receivers: string[] = [];
  while ((m = receiverRegex.exec(text)) !== null && receivers.length < 20) {
    receivers.push(m[1]);
  }

  return {
    packageName: packageMatch?.[1] || 'unknown',
    version: versionMatch?.[1] || 'unknown',
    permissions: Array.from(permissions),
    activities,
    services,
    receivers,
  };
}

/**
 * Main APK analysis function
 */
export async function analyzeAPK(
  buffer: Buffer,
  filename: string
): Promise<APKAnalysisResult> {
  logToolActivity('APK Analyzer', `Starting analysis of ${filename} (${buffer.length} bytes)`, 'info');

  try {
    const zipEntries = extractZipEntries(buffer);
    const analysisNotes: string[] = [];

    if (zipEntries.length === 0) {
      analysisNotes.push('Warning: No ZIP entries found. File may not be a valid APK or may be encrypted.');
    }

    // Try to find and parse AndroidManifest.xml entry
    const manifestEntry = zipEntries.find((e) => e === 'AndroidManifest.xml');
    if (!manifestEntry) {
      analysisNotes.push('AndroidManifest.xml not found in ZIP entries (binary XML may require AXML parser).');
    }

    // Scan full buffer for strings
    const hardcodedStrings = scanForHardcodedStrings(buffer);

    // Extract URL-type hardcoded strings
    const urls = hardcodedStrings
      .filter((s) => s.type === 'URL')
      .map((s) => s.value)
      .slice(0, 30);

    // Extract manifest info from raw buffer (best-effort on binary XML)
    const manifestInfo = extractManifestInfo(buffer);

    const dangerousPermissions = manifestInfo.permissions.filter((p) =>
      DANGEROUS_PERMISSIONS.includes(p)
    );

    if (dangerousPermissions.length > 0) {
      analysisNotes.push(`Found ${dangerousPermissions.length} dangerous permission(s): ${dangerousPermissions.join(', ')}`);
    }

    const result: APKAnalysisResult = {
      filename,
      fileSize: buffer.length,
      packageName: manifestInfo.packageName,
      version: manifestInfo.version,
      permissions: manifestInfo.permissions,
      activities: manifestInfo.activities,
      services: manifestInfo.services,
      receivers: manifestInfo.receivers,
      hardcodedStrings: hardcodedStrings.filter((s) => s.type !== 'URL'),
      urls,
      dangerousPermissions,
      zipEntries: zipEntries.slice(0, 100),
      analysisNotes,
    };

    logToolActivity('APK Analyzer', `Analysis complete: ${dangerousPermissions.length} dangerous perms, ${hardcodedStrings.length} hardcoded strings`, 'success');
    return result;
  } catch (error: any) {
    logToolActivity('APK Analyzer', `Analysis failed: ${error.message}`, 'warning');
    throw error;
  }
}
