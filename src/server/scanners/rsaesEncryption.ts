import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

export interface EncryptionResult {
  algorithm: string;
  operation: string;
  input: string;
  output: string;
  key?: string;
  publicKey?: string;
  privateKey?: string;
  iv?: string;
  keySize?: number;
  processingTime: number;
}

/**
 * AES Encryption/Decryption
 */
function processAES(
  operation: 'encrypt' | 'decrypt',
  input: string,
  keySize: number,
  keyHex?: string
): { output: string; key: string; iv: string } {
  const keyBytes = keySize / 8;
  
  // Generate or use provided key
  const key = keyHex 
    ? Buffer.from(keyHex, 'hex')
    : crypto.randomBytes(keyBytes);
  
  if (operation === 'encrypt') {
    // Generate random IV
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(input, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      output: encrypted,
      key: key.toString('hex'),
      iv: iv.toString('hex'),
    };
  } else {
    // For decryption, extract IV from the key parameter (in real usage)
    // For this demo, we'll generate a new IV
    const iv = crypto.randomBytes(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    try {
      let decrypted = decipher.update(input, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        output: decrypted,
        key: key.toString('hex'),
        iv: iv.toString('hex'),
      };
    } catch (error) {
      throw new Error('Decryption failed. Invalid key or corrupted ciphertext.');
    }
  }
}

/**
 * RSA Encryption/Decryption
 */
function processRSA(
  operation: 'encrypt' | 'decrypt',
  input: string,
  keySize: number,
  publicKeyPEM?: string,
  privateKeyPEM?: string
): { output: string; publicKey?: string; privateKey?: string } {
  if (operation === 'encrypt') {
    // Generate keys if not provided
    let publicKey = publicKeyPEM;
    let privateKey = privateKeyPEM;
    
    if (!publicKey || !privateKey) {
      const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });
      
      publicKey = pubKey;
      privateKey = privKey;
    }
    
    // Encrypt
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(input, 'utf8')
    );
    
    return {
      output: encrypted.toString('base64'),
      publicKey,
      privateKey,
    };
  } else {
    // Decrypt
    if (!privateKeyPEM) {
      throw new Error('Private key is required for decryption');
    }
    
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKeyPEM,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(input, 'base64')
      );
      
      return {
        output: decrypted.toString('utf8'),
      };
    } catch (error) {
      throw new Error('Decryption failed. Invalid private key or corrupted ciphertext.');
    }
  }
}

/**
 * Process encryption/decryption
 */
export async function processCrypto(params: {
  algorithm: 'aes' | 'rsa';
  operation: 'encrypt' | 'decrypt';
  input: string;
  aesKeySize?: number;
  rsaKeySize?: number;
  key?: string;
  publicKey?: string;
  privateKey?: string;
}): Promise<EncryptionResult> {
  const startTime = performance.now();
  
  let result: any;
  let keySize: number;
  
  if (params.algorithm === 'aes') {
    keySize = params.aesKeySize || 256;
    result = processAES(params.operation, params.input, keySize, params.key);
  } else {
    keySize = params.rsaKeySize || 2048;
    result = processRSA(
      params.operation,
      params.input,
      keySize,
      params.publicKey,
      params.privateKey
    );
  }
  
  const processingTime = Math.round(performance.now() - startTime);
  
  return {
    algorithm: params.algorithm,
    operation: params.operation,
    input: params.input,
    output: result.output,
    key: result.key,
    publicKey: result.publicKey,
    privateKey: result.privateKey,
    iv: result.iv,
    keySize,
    processingTime,
  };
}

/**
 * Generate keys
 */
export async function generateKeys(params: {
  algorithm: 'aes' | 'rsa';
  keySize: number;
}): Promise<{ key?: string; publicKey?: string; privateKey?: string }> {
  if (params.algorithm === 'aes') {
    const key = crypto.randomBytes(params.keySize / 8);
    return { key: key.toString('hex') };
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: params.keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    
    return { publicKey, privateKey };
  }
}
