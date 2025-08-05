import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { PrivateKey } from '@hiveio/dhive';
import { 
  HiveService, 
  BlockchainBroadcastError, 
  InsufficientResourcesError, 
  NetworkError, 
  InvalidTransactionError 
} from '../../src/services/hive.js';
import { 
  MissingKeyError, 
  InvalidKeyError, 
  MemoCryptoError 
} from '../../src/utils/memo-crypto.js';
import type { HiveConfig, Invoice } from '../../src/types/index.js';

// Mock the dhive client
const mockClient = {
  database: {
    getAccounts: vi.fn(),
  },
  broadcast: {
    sendOperations: vi.fn(),
  }
};

// Mock encryptJSON
vi.mock('../../src/utils/memo-crypto.js', async () => {
  const actual = await vi.importActual('../../src/utils/memo-crypto.js');
  return {
    ...actual,
    encryptJSON: vi.fn(),
  };
});

// Mock the @hiveio/dhive Client
vi.mock('@hiveio/dhive', async () => {
  const actual = await vi.importActual('@hiveio/dhive');
  return {
    ...actual,
    Client: vi.fn().mockImplementation(() => mockClient),
  };
});

describe('HiveService', () => {
  let hiveService: HiveService;
  let mockConfig: HiveConfig;
  let testInvoice: Invoice;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create test config
    mockConfig = {
      username: 'test-user',
      postingKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
      activeKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
      memoKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
      nodes: ['https://api.hive.blog']
    };

    // Create test invoice
    testInvoice = {
      id: 'test-invoice-123',
      invoiceNumber: 'INV-001',
      clientName: 'John Doe',
      clientHiveAddress: 'johndoe',
      items: [
        { id: 'item-1', description: 'Service 1', quantity: 1, unitPrice: 100, total: 100 }
      ],
      subtotal: 100,
      tax: 0,
      total: 100,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: new Date()
    };

    // Create HiveService instance with mocked client
    hiveService = new HiveService(mockConfig);
    (hiveService as any).client = mockClient;
  });

  describe('constructor and basic methods', () => {
    it('should initialize with provided config', () => {
      expect(hiveService).toBeDefined();
      expect(hiveService.hasMemoKey()).toBe(true);
    });

    it('should return false for hasMemoKey when memo key is not provided', () => {
      const configWithoutMemo = { ...mockConfig, memoKey: undefined };
      const service = new HiveService(configWithoutMemo);
      expect(service.hasMemoKey()).toBe(false);
    });
  });

  describe('validateEncryptionRequirements', () => {
    it('should not throw when encryption is not requested', () => {
      expect(() => {
        hiveService.validateEncryptionRequirements(false);
      }).not.toThrow();
    });

    it('should not throw when encryption is requested and memo key is available', () => {
      expect(() => {
        hiveService.validateEncryptionRequirements(true);
      }).not.toThrow();
    });

    it('should throw when encryption is requested but memo key is not available', () => {
      const configWithoutMemo = { ...mockConfig, memoKey: undefined };
      const service = new HiveService(configWithoutMemo);
      
      expect(() => {
        service.validateEncryptionRequirements(true);
      }).toThrow('Memo key is required for encryption operations but is not configured');
    });
  });

  describe('getMemoPublicKey', () => {
    it('should fetch and cache memo public key', async () => {
      const mockAccount = { memo_key: 'STM5testmemokey123' };
      mockClient.database.getAccounts.mockResolvedValue([mockAccount]);

      const result = await hiveService.getMemoPublicKey('testuser');
      
      expect(result).toBe('STM5testmemokey123');
      expect(mockClient.database.getAccounts).toHaveBeenCalledWith(['testuser']);
      
      // Second call should use cache
      const result2 = await hiveService.getMemoPublicKey('testuser');
      expect(result2).toBe('STM5testmemokey123');
      expect(mockClient.database.getAccounts).toHaveBeenCalledTimes(1);
    });

    it('should return null when account not found', async () => {
      mockClient.database.getAccounts.mockResolvedValue([]);

      const result = await hiveService.getMemoPublicKey('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockClient.database.getAccounts.mockRejectedValue(new Error('Network error'));

      const result = await hiveService.getMemoPublicKey('testuser');
      
      expect(result).toBeNull();
    });
  });

  describe('storeEncryptedInvoice', () => {
    beforeEach(async () => {
      // Mock successful account lookup
      mockClient.database.getAccounts.mockResolvedValue([
        { memo_key: 'STM5testmemokey123' }
      ]);
      
      // Mock successful encryption
      const { encryptJSON } = await import('../../src/utils/memo-crypto.js');
      (encryptJSON as MockedFunction<any>).mockReturnValue('encrypted-payload-123');
      
      // Mock successful broadcast
      mockClient.broadcast.sendOperations.mockResolvedValue({
        id: 'txid-123',
        block_num: 12345,
        trx_num: 1
      });
    });

    it('should successfully store encrypted invoice', async () => {
      const result = await hiveService.storeEncryptedInvoice(testInvoice, 'johndoe');
      
      expect(result.txId).toBe('txid-123');
      expect(result.encryptedPayload).toBe('encrypted-payload-123');
      expect(mockClient.database.getAccounts).toHaveBeenCalledWith(['johndoe']);
      expect(mockClient.broadcast.sendOperations).toHaveBeenCalled();
    });

    it('should throw MissingKeyError when memo key is not configured', async () => {
      const configWithoutMemo = { ...mockConfig, memoKey: undefined };
      const service = new HiveService(configWithoutMemo);
      (service as any).client = mockClient;

      await expect(
        service.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(MissingKeyError);
    });

    it('should throw MissingKeyError when posting key is not configured', async () => {
      const configWithoutPosting = { ...mockConfig, postingKey: '' };
      const service = new HiveService(configWithoutPosting);
      (service as any).client = mockClient;

      await expect(
        service.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(MissingKeyError);
    });

    it('should throw error when recipient is empty', async () => {
      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, '')
      ).rejects.toThrow('Recipient username is required');
    });

    it('should throw error when recipient memo key not found', async () => {
      mockClient.database.getAccounts.mockResolvedValue([]);

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'nonexistent')
      ).rejects.toThrow('Could not retrieve memo public key for recipient: nonexistent');
    });

    it('should re-throw encryption errors', async () => {
      const { encryptJSON } = await import('../../src/utils/memo-crypto.js');
      (encryptJSON as MockedFunction<any>).mockImplementation(() => {
        throw new InvalidKeyError('Invalid key format');
      });

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(InvalidKeyError);
    });

    it('should wrap unknown encryption errors in MemoCryptoError', async () => {
      const { encryptJSON } = await import('../../src/utils/memo-crypto.js');
      (encryptJSON as MockedFunction<any>).mockImplementation(() => {
        throw new Error('Unknown error');
      });

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(MemoCryptoError);
    });

    it('should throw InvalidKeyError for invalid posting key', async () => {
      const configWithInvalidKey = { ...mockConfig, postingKey: 'invalid-key' };
      const service = new HiveService(configWithInvalidKey);
      (service as any).client = mockClient;

      await expect(
        service.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(InvalidKeyError);
    });

    it('should throw InsufficientResourcesError for resource issues', async () => {
      mockClient.broadcast.sendOperations.mockRejectedValue(
        new Error('Insufficient bandwidth')
      );

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(InsufficientResourcesError);
    });

    it('should throw NetworkError for network issues', async () => {
      mockClient.broadcast.sendOperations.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(NetworkError);
    });

    it('should throw InvalidTransactionError for transaction issues', async () => {
      mockClient.broadcast.sendOperations.mockRejectedValue(
        new Error('Invalid signature')
      );

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(InvalidTransactionError);
    });

    it('should throw BlockchainBroadcastError for general broadcast failures', async () => {
      mockClient.broadcast.sendOperations.mockRejectedValue(
        new Error('General broadcast error')
      );

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(BlockchainBroadcastError);
    });

    it('should throw BlockchainBroadcastError when result has no transaction ID', async () => {
      mockClient.broadcast.sendOperations.mockResolvedValue({}); // No id field

      await expect(
        hiveService.storeEncryptedInvoice(testInvoice, 'johndoe')
      ).rejects.toThrow(BlockchainBroadcastError);
    });
  });

  describe('error handling', () => {
    it('should preserve error hierarchy', () => {
      const missingKeyError = new MissingKeyError('test');
      const invalidKeyError = new InvalidKeyError('test');
      const memoCryptoError = new MemoCryptoError('test');
      const broadcastError = new BlockchainBroadcastError('test');
      const resourceError = new InsufficientResourcesError('test');
      const networkError = new NetworkError('test');
      const transactionError = new InvalidTransactionError('test');

      expect(missingKeyError).toBeInstanceOf(MemoCryptoError);
      expect(invalidKeyError).toBeInstanceOf(MemoCryptoError);
      expect(resourceError).toBeInstanceOf(BlockchainBroadcastError);
      expect(networkError).toBeInstanceOf(BlockchainBroadcastError);
      expect(transactionError).toBeInstanceOf(BlockchainBroadcastError);

      expect(missingKeyError.name).toBe('MissingKeyError');
      expect(invalidKeyError.name).toBe('InvalidKeyError');
      expect(memoCryptoError.name).toBe('MemoCryptoError');
      expect(broadcastError.name).toBe('BlockchainBroadcastError');
      expect(resourceError.name).toBe('InsufficientResourcesError');
      expect(networkError.name).toBe('NetworkError');
      expect(transactionError.name).toBe('InvalidTransactionError');
    });

    it('should preserve original error in blockchain errors', () => {
      const originalError = new Error('Original error');
      const wrappedError = new BlockchainBroadcastError('Wrapped', originalError);

      expect(wrappedError.originalError).toBe(originalError);
      expect(wrappedError.message).toBe('Wrapped');
    });
  });
});
