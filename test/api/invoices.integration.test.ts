import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { serve } from '@hono/node-server';
import type { Server } from 'http';
import { PrivateKey } from '@hiveio/dhive';
import app from '../../src/index';
import { hiveService } from '../../src/services/hive';
import { db } from '../../src/database/schema';

describe('Invoice API - Encryption Integration Test', () => {
  let server: Server;
  let port: number;
  const testKeys = {
    serverPrivate: PrivateKey.fromSeed('server-private-seed').toString(),
    serverPublic: PrivateKey.fromSeed('server-private-seed').createPublic().toString(),
    clientPrivate: PrivateKey.fromSeed('client-private-seed').toString(),
    clientPublic: PrivateKey.fromSeed('client-private-seed').createPublic().toString(),
  };

  beforeAll(async () => {
    // Set env vars for encryption and auth
    process.env.HIVE_MEMO_KEY = testKeys.serverPrivate;
    process.env.HIVE_USERNAME = 'test-server-account';
    process.env.HIVE_POSTING_KEY = PrivateKey.fromSeed('test-posting-seed').toString();
    process.env.DB_PATH = ':memory:'; // Use in-memory DB for tests
    process.env.SESSION_SECRET = 'test-session-secret'; // Set session secret for auth

    await db.initialize();

    // Mock hive service external calls
    vi.spyOn(hiveService.instance['client'].broadcast, 'sendOperations').mockResolvedValue({
      id: 'mock-tx-id',
      block_num: 1,
      trx_num: 1,
    } as any);

    vi.spyOn(hiveService.instance, 'getMemoPublicKey').mockImplementation(async (username: string) => {
      if (username === 'test-client-account') {
        return testKeys.clientPublic;
      }
      return null;
    });

    // Start server
    server = serve({
      fetch: app.fetch,
      port: 0, // Let the system choose a free port
    }, (info) => {
      port = info.port;
    });

    await new Promise(resolve => server.on('listening', resolve));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (server) {
      server.close();
    }
  });

  it('should create an invoice with encrypted data, then retrieve and decrypt it', async () => {
    const newInvoice = {
      clientName: 'Test Client',
      clientHiveAddress: 'test-client-account',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      items: [{ description: 'Encrypted Service', quantity: 1, unitPrice: 123.45 }],
      tax: 20,
    };

    // 1. Create the invoice
    const createRes = await fetch(`http://localhost:${port}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session_id=test-session-secret',
      },
      body: JSON.stringify(newInvoice),
    });

    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    const invoiceId = createJson.invoice.id;

    expect(invoiceId).toBeDefined();
    expect(createJson.invoice.hiveTransactionId).toBe('mock-tx-id');

    // 2. Retrieve the invoice
    const getRes = await fetch(`http://localhost:${port}/api/invoices/${invoiceId}`, {
      headers: {
        'Cookie': 'session_id=test-session-secret',
      },
    });

    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();

    // 3. Verify decrypted data
    const retrievedInvoice = getJson.invoice;
    expect(retrievedInvoice.id).toBe(invoiceId);
    expect(retrievedInvoice.clientName).toBe(newInvoice.clientName);
    expect(retrievedInvoice.items[0].description).toBe('Encrypted Service');
    expect(retrievedInvoice.items[0].unitPrice).toBe(123.45);
    expect(retrievedInvoice.encryptedData).toBeUndefined();
  });
});

