import { performance } from 'node:perf_hooks';
import sharp from 'sharp';
import crypto from 'node:crypto';

export interface HideResult {
  success: boolean;
  message: string;
  outputImage: string;
  dataSize: number;
  capacity: number;
  processingTime: number;
}

export interface ExtractResult {
  success: boolean;
  message: string;
  extractedData: string;
  dataSize: number;
  processingTime: number;
}

/**
 * Encrypt data using AES
 */
function encryptData(data: string, password: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data using AES
 */
function decryptData(encryptedData: string, password: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed. Wrong password or corrupted data.');
  }
}

/**
 * Hide data in image using LSB steganography
 */
export async function hideDataInImage(
  coverImageBuffer: Buffer,
  secretMessage: string,
  password?: string
): Promise<HideResult> {
  const startTime = performance.now();
  
  try {
    // Encrypt message if password provided
    let dataToHide = secretMessage;
    if (password) {
      dataToHide = 'ENCRYPTED:' + encryptData(secretMessage, password);
    }
    
    // Convert message to binary
    const messageBinary = Array.from(dataToHide)
      .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join('');
    
    // Add delimiter and length header
    const dataLength = messageBinary.length;
    const lengthBinary = dataLength.toString(2).padStart(32, '0');
    const fullData = lengthBinary + messageBinary + '11111111'.repeat(8); // End marker
    
    // Get image data
    const { data, info } = await sharp(coverImageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = new Uint8Array(data);
    const capacity = Math.floor(pixels.length / 8) * 8; // Bits available
    
    if (fullData.length > capacity) {
      throw new Error(`Message too large. Max ${Math.floor(capacity / 8)} bytes, got ${Math.ceil(fullData.length / 8)} bytes`);
    }
    
    // Embed data using LSB
    for (let i = 0; i < fullData.length; i++) {
      const bit = parseInt(fullData[i]);
      pixels[i] = (pixels[i] & 0xFE) | bit; // Clear LSB and set new bit
    }
    
    // Create output image
    const outputBuffer = await sharp(Buffer.from(pixels), {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels as 3 | 4,
      },
    })
      .png()
      .toBuffer();
    
    const outputBase64 = `data:image/png;base64,${outputBuffer.toString('base64')}`;
    const processingTime = Math.round(performance.now() - startTime);
    
    return {
      success: true,
      message: password 
        ? 'Secret message encrypted and hidden successfully'
        : 'Secret message hidden successfully',
      outputImage: outputBase64,
      dataSize: secretMessage.length,
      capacity: Math.floor(capacity / 8),
      processingTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to hide data: ${error.message}`);
  }
}

/**
 * Extract data from image using LSB steganography
 */
export async function extractDataFromImage(
  stegoImageBuffer: Buffer,
  password?: string
): Promise<ExtractResult> {
  const startTime = performance.now();
  
  try {
    // Get image data
    const { data } = await sharp(stegoImageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = new Uint8Array(data);
    
    // Extract length header (first 32 bits)
    let lengthBinary = '';
    for (let i = 0; i < 32; i++) {
      lengthBinary += (pixels[i] & 1).toString();
    }
    const dataLength = parseInt(lengthBinary, 2);
    
    if (dataLength <= 0 || dataLength > pixels.length * 8) {
      throw new Error('No valid hidden data found in this image');
    }
    
    // Extract message bits
    let messageBinary = '';
    for (let i = 32; i < 32 + dataLength && i < pixels.length; i++) {
      messageBinary += (pixels[i] & 1).toString();
    }
    
    // Convert binary to string
    let extractedData = '';
    for (let i = 0; i < messageBinary.length; i += 8) {
      const byte = messageBinary.substr(i, 8);
      if (byte.length === 8) {
        extractedData += String.fromCharCode(parseInt(byte, 2));
      }
    }
    
    // Check if encrypted
    if (extractedData.startsWith('ENCRYPTED:')) {
      if (!password) {
        throw new Error('This message is encrypted. Please provide the password.');
      }
      const encryptedData = extractedData.substring(10); // Remove 'ENCRYPTED:' prefix
      extractedData = decryptData(encryptedData, password);
    }
    
    const processingTime = Math.round(performance.now() - startTime);
    
    return {
      success: true,
      message: password 
        ? 'Hidden message decrypted and extracted successfully'
        : 'Hidden message extracted successfully',
      extractedData,
      dataSize: extractedData.length,
      processingTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to extract data: ${error.message}`);
  }
}
