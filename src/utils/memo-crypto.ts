import { PrivateKey, PublicKey, Memo } from '@hiveio/dhive';

/**
 * Custom error types for memo crypto operations
 */
export class MemoCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoCryptoError';
  }
}

export class InvalidKeyError extends MemoCryptoError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKeyError';
  }
}

export class MissingKeyError extends MemoCryptoError {
  constructor(message: string) {
    super(message);
    this.name = 'MissingKeyError';
  }
}

/**
 * Encrypts a JSON object as a memo string using dhive memo system
 * Both sender and recipient can decrypt using their respective private keys
 * 
 * @param plain - The object to encrypt
 * @param fromPrivMemo - The sender's private memo key (WIF format)
 * @param toPubMemo - The recipient's public memo key
 * @returns Encrypted memo string
 * @throws {MissingKeyError} When keys are missing or empty
 * @throws {InvalidKeyError} When keys are invalid format
 * @throws {MemoCryptoError} When encryption fails
 */
export function encryptJSON(plain: object, fromPrivMemo: string, toPubMemo: string): string {
  // Validate inputs
  if (!plain) {
    throw new MemoCryptoError('Plain object cannot be null or undefined');
  }
  
  if (!fromPrivMemo || fromPrivMemo.trim() === '') {
    throw new MissingKeyError('From private memo key is required');
  }
  
  if (!toPubMemo || toPubMemo.trim() === '') {
    throw new MissingKeyError('To public memo key is required');
  }

  try {
    // 1. Serialize JSON to string
    const jsonString = JSON.stringify(plain);
    
    // 2. Prefix with # per Hive spec
    const messageWithPrefix = '#' + jsonString;
    
    // 3. Create PrivateKey and PublicKey instances
    const privateKey = PrivateKey.fromString(fromPrivMemo);
    const publicKey = PublicKey.fromString(toPubMemo);
    
    // 4. Encrypt using dhive Memo.encode
    const encryptedMemo = Memo.encode(privateKey, publicKey, messageWithPrefix);
    
    return encryptedMemo;
    
  } catch (error) {
    if (error instanceof Error) {
      // Check for key-related errors
      if (error.message.includes('Invalid private key') || 
          error.message.includes('Invalid public key') ||
          error.message.includes('invalid key format') ||
          error.message.includes('Non-base58 character') ||
          error.message.includes('invalid WIF') ||
          error.message.includes('Invalid key')) {
        throw new InvalidKeyError(`Invalid key format: ${error.message}`);
      }
      
      // Check for missing key errors
      if (error.message.includes('key is required') || 
          error.message.includes('missing key')) {
        throw new MissingKeyError(`Missing key: ${error.message}`);
      }
      
      throw new MemoCryptoError(`Encryption failed: ${error.message}`);
    }
    
    throw new MemoCryptoError('Unknown encryption error occurred');
  }
}

/**
 * Decrypts a memo string back to a JSON object using dhive memo system
 * Works for both sender (with sender private key) and recipient (with recipient private key)
 * 
 * @param cipher - The encrypted memo string to decrypt
 * @param toPrivMemo - The decryptor's private memo key (WIF format)
 * @param fromPubMemo - The other party's public memo key (optional, used for validation)
 * @returns Decrypted object
 * @throws {MissingKeyError} When keys are missing or empty
 * @throws {InvalidKeyError} When keys are invalid format
 * @throws {MemoCryptoError} When decryption fails or JSON is invalid
 */
/**
 * Estimates the size of encrypted memo data in bytes
 * Used to validate against Hive's 2048 byte memo limit
 * 
 * @param plain - The object to estimate size for
 * @returns Estimated encrypted size in bytes
 */
export function estimateEncryptedSize(plain: object): number {
  // 1. Serialize JSON to string
  const jsonString = JSON.stringify(plain);
  
  // 2. Add # prefix per Hive spec
  const messageWithPrefix = '#' + jsonString;
  
  // 3. Calculate AES encryption overhead (16 bytes IV + padding)
  const aesOverhead = 32; // Conservative estimate
  
  // 4. Calculate Base64 encoding overhead (33-37% increase)
  const base64Overhead = Math.ceil((messageWithPrefix.length + aesOverhead) * 1.37);
  
  return base64Overhead;
}

/**
 * Validates if the object will fit within Hive's memo size limits when encrypted
 * 
 * @param plain - The object to validate
 * @param maxSizeBytes - Maximum size in bytes (default: 2048 for Hive)
 * @returns Validation result with size info
 */
export function validateMemoSize(plain: object, maxSizeBytes: number = 2048): {
  isValid: boolean;
  estimatedSize: number;
  maxSize: number;
  compressionSuggestions?: string[];
} {
  const estimatedSize = estimateEncryptedSize(plain);
  const isValid = estimatedSize <= maxSizeBytes;
  
  const result = {
    isValid,
    estimatedSize,
    maxSize: maxSizeBytes
  };
  
  if (!isValid) {
    const compressionSuggestions = [
      'Remove optional fields (shareableLink, etc.)',
      'Truncate long descriptions',
      'Use shorter field names',
      'Store only essential data on-chain',
      'Use abbreviations for common values'
    ];
    
    return { ...result, compressionSuggestions };
  }
  
  return result;
}

export function decryptJSON(cipher: string, toPrivMemo: string, fromPubMemo?: string): object {
  // Validate inputs
  if (!cipher || cipher.trim() === '') {
    throw new MemoCryptoError('Cipher text cannot be empty');
  }
  
  if (!toPrivMemo || toPrivMemo.trim() === '') {
    throw new MissingKeyError('To private memo key is required');
  }
  
  // fromPubMemo is optional for dhive decryption - the cipher contains sender info
  // We keep this parameter for backward compatibility but don't require it

  try {
    // 1. Create PrivateKey instance
    const privateKey = PrivateKey.fromString(toPrivMemo);
    
    // 2. Decrypt using dhive Memo.decode (only needs private key and cipher)
    // dhive automatically handles bi-directional decryption - both parties can decrypt
    const decryptedMessage = Memo.decode(privateKey, cipher);
    
    // 3. Remove the # prefix per Hive spec
    if (!decryptedMessage.startsWith('#')) {
      throw new MemoCryptoError('Decrypted message missing required # prefix');
    }
    
    const jsonString = decryptedMessage.substring(1);
    
    // 4. Parse JSON string back to object
    const parsedObject = JSON.parse(jsonString);
    
    return parsedObject;
    
  } catch (error) {
    if (error instanceof Error) {
      // Check for key-related errors
      if (error.message.includes('Invalid private key') || 
          error.message.includes('Invalid public key') ||
          error.message.includes('invalid key format') ||
          error.message.includes('Non-base58 character') ||
          error.message.includes('invalid WIF') ||
          error.message.includes('Invalid key')) {
        throw new InvalidKeyError(`Invalid key format: ${error.message}`);
      }
      
      // Check for missing key errors
      if (error.message.includes('key is required') || 
          error.message.includes('missing key')) {
        throw new MissingKeyError(`Missing key: ${error.message}`);
      }
      
      // Check for JSON parsing errors
      if (error.message.includes('JSON') || 
          error.message.includes('parse') ||
          error.message.includes('Unexpected token')) {
        throw new MemoCryptoError(`Invalid JSON in decrypted message: ${error.message}`);
      }
      
      throw new MemoCryptoError(`Decryption failed: ${error.message}`);
    }
    
    throw new MemoCryptoError('Unknown decryption error occurred');
  }
}
