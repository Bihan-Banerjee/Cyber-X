import { logToolActivity } from '../utils/activityLogger.js';

export interface ROPGadget {
  offset: string;
  instructions: string;
  bytes: string;
  category: string;
}

export interface ROPGadgetResult {
  architecture: string;
  gadgets: ROPGadget[];
  totalGadgets: number;
  categories: Record<string, number>;
  filename: string;
}

type Architecture = 'x86' | 'x64' | 'arm';

// Common x86/x64 register encodings
const X86_REGS: Record<number, string> = {
  0x58: 'eax', 0x59: 'ecx', 0x5A: 'edx', 0x5B: 'ebx',
  0x5C: 'esp', 0x5D: 'ebp', 0x5E: 'esi', 0x5F: 'edi',
};

const X64_REGS: Record<number, string> = {
  ...X86_REGS,
  0x41: 'r8', 0x42: 'r9', 0x43: 'r10', 0x44: 'r11',
  0x45: 'r12', 0x46: 'r13', 0x47: 'r14', 0x48: 'r15',
};

function categorizeGadget(instructions: string): string {
  const lower = instructions.toLowerCase();
  if (lower.includes('pop') && lower.includes('ret')) return 'pop-ret';
  if (lower.includes('mov') && lower.includes('ret')) return 'mov-ret';
  if (lower.includes('xor') && lower.includes('ret')) return 'xor-ret';
  if (lower.includes('add') && lower.includes('ret')) return 'add-ret';
  if (lower.includes('sub') && lower.includes('ret')) return 'sub-ret';
  if (lower.includes('push') && lower.includes('ret')) return 'push-ret';
  if (lower.includes('jmp') || lower.includes('call')) return 'jmp-call';
  if (lower.includes('int 0x80') || lower.includes('syscall') || lower.includes('sysenter')) return 'syscall';
  if (lower.includes('leave') || lower.includes('ret')) return 'epilogue';
  return 'misc';
}

/**
 * Scan a buffer for ROP gadgets by looking backwards from RET instructions
 */
function findROPGadgets(buffer: Buffer, arch: Architecture): ROPGadget[] {
  const gadgets: ROPGadget[] = [];
  const seen = new Set<string>();

  const RET_BYTE = 0xC3;
  const RET_NEAR = 0xC2; // RET with immediate
  const MAX_LOOKBACK = 7; // Look back up to 7 bytes
  const MAX_GADGETS = 500;

  for (let i = 2; i < buffer.length; i++) {
    if (buffer[i] !== RET_BYTE && buffer[i] !== RET_NEAR) continue;

    for (let len = 1; len <= MAX_LOOKBACK && i - len >= 0; len++) {
      const startOffset = i - len;
      const bytesSlice = buffer.slice(startOffset, i + 1);
      const bytesHex = Array.from(bytesSlice).map((b) => b.toString(16).padStart(2, '0')).join(' ');

      // Skip if we've seen this byte sequence
      if (seen.has(bytesHex)) continue;

      // Basic pattern matching for common gadgets
      const instructions = parseGadgetBytes(bytesSlice, arch);
      if (!instructions) continue;

      seen.add(bytesHex);
      const category = categorizeGadget(instructions);

      gadgets.push({
        offset: '0x' + startOffset.toString(16).padStart(8, '0'),
        instructions,
        bytes: bytesHex,
        category,
      });

      if (gadgets.length >= MAX_GADGETS) break;
    }

    if (gadgets.length >= MAX_GADGETS) break;
  }

  return gadgets;
}

/**
 * Attempt to parse bytes as simple x86 instruction sequence ending with RET
 */
function parseGadgetBytes(bytes: Buffer, arch: Architecture): string | null {
  if (bytes.length === 0) return null;

  const last = bytes[bytes.length - 1];
  if (last !== 0xC3 && last !== 0xC2) return null;

  const regs = arch === 'x64' ? X64_REGS : X86_REGS;
  const instructions: string[] = [];

  let i = 0;
  while (i < bytes.length - 1) {
    const b = bytes[i];

    // POP reg (0x58-0x5F)
    if (b >= 0x58 && b <= 0x5F) {
      const reg = regs[b] || `r${b - 0x58}`;
      instructions.push(`pop ${reg}`);
      i++;
      continue;
    }

    // PUSH reg (0x50-0x57)
    if (b >= 0x50 && b <= 0x57) {
      const reg = regs[b + 8] || `r${b - 0x50}`;
      instructions.push(`push ${reg}`);
      i++;
      continue;
    }

    // NOP (0x90)
    if (b === 0x90) {
      instructions.push('nop');
      i++;
      continue;
    }

    // XOR reg, reg (0x31 /r)
    if (b === 0x31 && i + 1 < bytes.length - 1) {
      const modrm = bytes[i + 1];
      const reg = regs[0x58 + (modrm & 0x07)] || `r${modrm & 0x07}`;
      instructions.push(`xor ${reg}, ${reg}`);
      i += 2;
      continue;
    }

    // MOV reg, imm32 (0xB8-0xBF)
    if (b >= 0xB8 && b <= 0xBF && i + 4 < bytes.length) {
      const reg = regs[b - 0xB8 + 0x58] || `r${b - 0xB8}`;
      const imm = bytes.readUInt32LE(i + 1);
      instructions.push(`mov ${reg}, 0x${imm.toString(16)}`);
      i += 5;
      continue;
    }

    // INC reg (0x40-0x47)
    if (b >= 0x40 && b <= 0x47) {
      const reg = regs[b + 0x18] || `r${b - 0x40}`;
      instructions.push(`inc ${reg}`);
      i++;
      continue;
    }

    // DEC reg (0x48-0x4F)
    if (b >= 0x48 && b <= 0x4F) {
      const reg = regs[b + 0x10] || `r${b - 0x48}`;
      instructions.push(`dec ${reg}`);
      i++;
      continue;
    }

    // INT 0x80 (0xCD 0x80)
    if (b === 0xCD && i + 1 < bytes.length && bytes[i + 1] === 0x80) {
      instructions.push('int 0x80');
      i += 2;
      continue;
    }

    // SYSCALL (0x0F 0x05)
    if (b === 0x0F && i + 1 < bytes.length && bytes[i + 1] === 0x05) {
      instructions.push('syscall');
      i += 2;
      continue;
    }

    // LEAVE (0xC9)
    if (b === 0xC9) {
      instructions.push('leave');
      i++;
      continue;
    }

    // Unknown byte — skip this gadget
    return null;
  }

  if (last === 0xC3) {
    instructions.push('ret');
  } else if (last === 0xC2) {
    instructions.push('ret <imm>');
  }

  if (instructions.length < 2) return null;
  return instructions.join(' ; ');
}

export async function findGadgets(
  buffer: Buffer,
  filename: string,
  arch: string
): Promise<ROPGadgetResult> {
  const architecture = (arch || 'x86').toLowerCase() as Architecture;

  logToolActivity('ROP Gadget Finder', `Scanning ${filename} (${buffer.length} bytes) for ${architecture} gadgets`, 'info');

  try {
    const gadgets = findROPGadgets(buffer, architecture);

    const categories: Record<string, number> = {};
    for (const gadget of gadgets) {
      categories[gadget.category] = (categories[gadget.category] || 0) + 1;
    }

    logToolActivity('ROP Gadget Finder', `Found ${gadgets.length} gadgets in ${filename}`, 'success');

    return {
      architecture,
      gadgets,
      totalGadgets: gadgets.length,
      categories,
      filename,
    };
  } catch (error: any) {
    logToolActivity('ROP Gadget Finder', `Error: ${error.message}`, 'warning');
    throw error;
  }
}
