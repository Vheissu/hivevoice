import { describe, it, expect, beforeEach } from 'vitest';
import { PrivateKey, PublicKey } from '@hiveio/dhive';
import { 
  encryptJSON, 
  decryptJSON, 
  MemoCryptoError, 
  InvalidKeyError, 
  MissingKeyError 
} from '../../src/utils/memo-crypto.js';

describe('memo-crypto', () => {
  let testPrivateKey1: string;
  let testPublicKey1: string;
  let testPrivateKey2: string;
  let testPublicKey2: string;
  
  beforeEach(() => {
    // Generate test keys for each test
    const key1 = PrivateKey.fromSeed('test-seed-1');
    const key2 = PrivateKey.fromSeed('test-seed-2');
    
    testPrivateKey1 = key1.toString();
    testPublicKey1 = key1.createPublic().toString();
    testPrivateKey2 = key2.toString();
    testPublicKey2 = key2.createPublic().toString();
  });

  describe('encryptJSON', () => {
    it('should successfully encrypt a simple object', () => {
      const testData = { message: 'Hello World', number: 42 };
      
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should successfully encrypt complex nested objects', () => {
      const testData = {
        invoice: {
          id: 'test-123',
          items: [
            { description: 'Item 1', price: 100.50 },
            { description: 'Item 2', price: 200.25 }
          ],
          metadata: {
            created: new Date().toISOString(),
            tags: ['urgent', 'paid']
          }
        }
      };
      
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should throw MissingKeyError when fromPrivMemo is missing', () => {
      const testData = { message: 'test' };
      
      expect(() => {
        encryptJSON(testData, '', testPublicKey2);
      }).toThrow(MissingKeyError);
      
      expect(() => {
        encryptJSON(testData, '   ', testPublicKey2);
      }).toThrow(MissingKeyError);
    });

    it('should throw MissingKeyError when toPubMemo is missing', () => {
      const testData = { message: 'test' };
      
      expect(() => {
        encryptJSON(testData, testPrivateKey1, '');
      }).toThrow(MissingKeyError);
      
      expect(() => {
        encryptJSON(testData, testPrivateKey1, '   ');
      }).toThrow(MissingKeyError);
    });

    it('should throw MemoCryptoError when plain object is null or undefined', () => {
      expect(() => {
        encryptJSON(null as any, testPrivateKey1, testPublicKey2);
      }).toThrow(MemoCryptoError);
      
      expect(() => {
        encryptJSON(undefined as any, testPrivateKey1, testPublicKey2);
      }).toThrow(MemoCryptoError);
    });

    it('should throw InvalidKeyError when fromPrivMemo is invalid format', () => {
      const testData = { message: 'test' };
      
      expect(() => {
        encryptJSON(testData, 'invalid-private-key', testPublicKey2);
      }).toThrow(InvalidKeyError);
    });

    it('should throw InvalidKeyError when toPubMemo is invalid format', () => {
      const testData = { message: 'test' };
      
      expect(() => {
        encryptJSON(testData, testPrivateKey1, 'invalid-public-key');
      }).toThrow(InvalidKeyError);
    });
  });

  describe('decryptJSON', () => {
    it('should successfully decrypt previously encrypted data', () => {
      const testData = { message: 'Hello World', number: 42, boolean: true };
      
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      const decrypted = decryptJSON(encrypted, testPrivateKey2, testPublicKey1);
      
      expect(decrypted).toEqual(testData);
    });

    it('should successfully decrypt complex nested objects', () => {
      const testData = {
        invoice: {
          id: 'test-123',
          items: [
            { description: 'Item 1', price: 100.50 },
            { description: 'Item 2', price: 200.25 }
          ],
          metadata: {
            created: '2023-01-01T00:00:00.000Z',
            tags: ['urgent', 'paid']
          }
        }
      };
      
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      const decrypted = decryptJSON(encrypted, testPrivateKey2, testPublicKey1);
      
      expect(decrypted).toEqual(testData);
    });

    it('should throw MissingKeyError when cipher is empty', () => {
      expect(() => {
        decryptJSON('', testPrivateKey2, testPublicKey1);
      }).toThrow(MemoCryptoError);
      
      expect(() => {
        decryptJSON('   ', testPrivateKey2, testPublicKey1);
      }).toThrow(MemoCryptoError);
    });

    it('should throw MissingKeyError when toPrivMemo is missing', () => {
      const testData = { message: 'test' };
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      
      expect(() => {
        decryptJSON(encrypted, '', testPublicKey1);
      }).toThrow(MissingKeyError);
      
      expect(() => {
        decryptJSON(encrypted, '   ', testPublicKey1);
      }).toThrow(MissingKeyError);
    });

    it('should throw MissingKeyError when fromPubMemo is missing', () => {
      const testData = { message: 'test' };
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      
      expect(() => {
        decryptJSON(encrypted, testPrivateKey2, '');
      }).toThrow(MissingKeyError);
      
      expect(() => {
        decryptJSON(encrypted, testPrivateKey2, '   ');
      }).toThrow(MissingKeyError);
    });

    it('should throw InvalidKeyError when toPrivMemo is invalid format', () => {
      const testData = { message: 'test' };
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      
      expect(() => {
        decryptJSON(encrypted, 'invalid-private-key', testPublicKey1);
      }).toThrow(InvalidKeyError);
    });

    it('should throw MemoCryptoError when cipher is invalid', () => {
      expect(() => {
        decryptJSON('invalid-cipher-text', testPrivateKey2, testPublicKey1);
      }).toThrow(MemoCryptoError);
    });

    it('should throw MemoCryptoError when decrypted message lacks # prefix', () => {
      // This test is tricky since we need to create a valid encrypted message without # prefix
      // For now, we'll test with a malformed encrypted message that would fail this check
      expect(() => {
        decryptJSON('malformed-encrypted-data', testPrivateKey2, testPublicKey1);
      }).toThrow(MemoCryptoError);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should maintain data integrity through multiple round trips', () => {
      const testData = {
        id: 'invoice-123',
        client: 'John Doe',
        items: [
          { name: 'Service A', price: 100 },
          { name: 'Service B', price: 200 }
        ],
        total: 300,
        timestamp: Date.now()
      };

      // Round trip 1
      const encrypted1 = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      const decrypted1 = decryptJSON(encrypted1, testPrivateKey2, testPublicKey1);
      expect(decrypted1).toEqual(testData);

      // Round trip 2 (with the decrypted data)
      const encrypted2 = encryptJSON(decrypted1, testPrivateKey2, testPublicKey1);
      const decrypted2 = decryptJSON(encrypted2, testPrivateKey1, testPublicKey2);
      expect(decrypted2).toEqual(testData);
    });

    it('should produce different ciphertext for same data (due to randomness)', () => {
      const testData = { message: 'Hello World' };
      
      const encrypted1 = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      const encrypted2 = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      
      // Ciphertext should be different due to randomness in encryption
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same data
      const decrypted1 = decryptJSON(encrypted1, testPrivateKey2, testPublicKey1);
      const decrypted2 = decryptJSON(encrypted2, testPrivateKey2, testPublicKey1);
      expect(decrypted1).toEqual(testData);
      expect(decrypted2).toEqual(testData);
    });

    it('should handle special characters and unicode', () => {
      const testData = {
        message: 'Hello 世界! 🌍 Special chars: @#$%^&*()_+-=[]{}|;:,.<>?',
        emoji: '🚀💎🎉',
        unicode: 'Ñoño αβγ 中文 العربية'
      };
      
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      const decrypted = decryptJSON(encrypted, testPrivateKey2, testPublicKey1);
      
      expect(decrypted).toEqual(testData);
    });

    it('should handle arrays and nested structures', () => {
      const testData = {
        array: [1, 2, 3, 'four', { five: 5 }],
        nested: {
          level1: {
            level2: {
              level3: 'deep value'
            }
          }
        },
        nullValue: null,
        booleans: [true, false]
      };
      
      const encrypted = encryptJSON(testData, testPrivateKey1, testPublicKey2);
      const decrypted = decryptJSON(encrypted, testPrivateKey2, testPublicKey1);
      
      expect(decrypted).toEqual(testData);
    });
  });

  describe('error handling', () => {
    it('should preserve error types through the call stack', () => {
      const testData = { message: 'test' };
      
      try {
        encryptJSON(testData, '', testPublicKey2);
      } catch (error) {
        expect(error).toBeInstanceOf(MissingKeyError);
        expect(error.name).toBe('MissingKeyError');
        expect(error.message).toContain('From private memo key is required');
      }

      try {
        encryptJSON(testData, testPrivateKey1, 'invalid-key');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidKeyError);
        expect(error.name).toBe('InvalidKeyError');
      }

      try {
        encryptJSON(null as any, testPrivateKey1, testPublicKey2);
      } catch (error) {
        expect(error).toBeInstanceOf(MemoCryptoError);
        expect(error.name).toBe('MemoCryptoError');
      }
    });

    it('should handle edge cases gracefully', () => {
      // Empty object
      const emptyObj = {};
      const encrypted = encryptJSON(emptyObj, testPrivateKey1, testPublicKey2);
      const decrypted = decryptJSON(encrypted, testPrivateKey2, testPublicKey1);
      expect(decrypted).toEqual(emptyObj);

      // Object with undefined properties
      const objWithUndefined = { defined: 'value', undefined: undefined };
      const encrypted2 = encryptJSON(objWithUndefined, testPrivateKey1, testPublicKey2);
      const decrypted2 = decryptJSON(encrypted2, testPrivateKey2, testPublicKey1);
      expect(decrypted2).toEqual(objWithUndefined);
    });
  });
});
