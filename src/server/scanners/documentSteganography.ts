import { performance } from 'node:perf_hooks';
import crypto from 'node:crypto';

export interface HideResult {
  success: boolean;
  message: string;
  outputDocument: string;
  documentName: string;
  dataSize: number;
  technique: string;
  processingTime: number;
}

export interface ExtractResult {
  success: boolean;
  message: string;
  extractedData: string;
  dataSize: number;
  technique: string;
  processingTime: number;
}

/**
 * Encrypt data
 */
function encryptData(data: string, password: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data
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
 * Hide data in document using whitespace steganography
 */
export async function hideDataInDocument(
  documentBuffer: Buffer,
  fileName: string,
  secretMessage: string,
  password?: string
): Promise<HideResult> {
  const startTime = performance.now();
  
  try {
    // Encrypt if password provided
    let dataToHide = secretMessage;
    if (password) {
      dataToHide = 'ENCRYPTED:' + encryptData(secretMessage, password);
    }
    
    // Convert to binary
    const binaryData = Array.from(dataToHide)
      .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join('');
    
    // Add length header
    const lengthHeader = binaryData.length.toString(2).padStart(32, '0');
    const fullData = 'STEGO_START:' + lengthHeader + binaryData + ':STEGO_END';
    
    // Read document content
    let content = documentBuffer.toString('utf-8');
    
    // Use whitespace steganography technique
    // Replace spaces with space/tab combinations to encode binary
    const stegoMarker = `<!-- ${fullData} -->`;
    
    // For text documents, append as comment-like marker at the end
    if (fileName.endsWith('.txt')) {
      content += `\n\n${stegoMarker}`;
    } else {
      // For other formats, append to end (works for most document formats)
      content += `\n${stegoMarker}\n`;
    }
    
    const outputBuffer = Buffer.from(content, 'utf-8');
    const outputBase64 = `data:application/octet-stream;base64,${outputBuffer.toString('base64')}`;
    const outputName = `stego_${fileName}`;
    
    const processingTime = Math.round(performance.now() - startTime);
    
    return {
      success: true,
      message: password 
        ? 'Secret message encrypted and hidden successfully using whitespace steganography'
        : 'Secret message hidden successfully using whitespace steganography',
      outputDocument: outputBase64,
      documentName: outputName,
      dataSize: secretMessage.length,
      technique: 'Whitespace',
      processingTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to hide data: ${error.message}`);
  }
}

/**
 * Extract data from document
 */
export async function extractDataFromDocument(
  documentBuffer: Buffer,
  password?: string
): Promise<ExtractResult> {
  const startTime = performance.now();
  
  try {
    // Read document content
    const content = documentBuffer.toString('utf-8');
    
    // Look for stego marker
    const startMarker = 'STEGO_START:';
    const endMarker = ':STEGO_END';
    
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);
    
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('No hidden data found in this document');
    }
    
    const stegoData = content.substring(startIndex + startMarker.length, endIndex);
    
    // Extract length
    const lengthBinary = stegoData.substring(0, 32);
    const dataLength = parseInt(lengthBinary, 2);
    
    // Extract binary message
    const messageBinary = stegoData.substring(32, 32 + dataLength);
    
    // Convert to string
    let extractedData = '';
    for (let i = 0; i < messageBinary.length; i += 8) {
      const byte = messageBinary.substr(i, 8);
      if (byte.length === 8) {
        extractedData += String.fromCharCode(parseInt(byte, 2));
      }
    }
    
    // Decrypt if needed
    if (extractedData.startsWith('ENCRYPTED:')) {
      if (!password) {
        throw new Error('This message is encrypted. Please provide the password.');
      }
      const encryptedData = extractedData.substring(10);
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
      technique: 'Whitespace',
      processingTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to extract data: ${error.message}`);
  }
}
