// Test setup file
import { vi } from 'vitest';

// Mock environment variables for tests
vi.stubEnv('HIVE_USERNAME', 'test-user');
vi.stubEnv('HIVE_POSTING_KEY', '5K...');
vi.stubEnv('HIVE_MEMO_KEY', '5K...');
vi.stubEnv('NODE_ENV', 'test');
