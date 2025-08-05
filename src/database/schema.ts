import sqlite3 from 'sqlite3'
import { promisify } from 'util'

export class Database {
  private db: sqlite3.Database
  public run: (sql: string, ...params: unknown[]) => Promise<sqlite3.RunResult>
  public get: (sql: string, ...params: unknown[]) => Promise<unknown>
  public all: (sql: string, ...params: unknown[]) => Promise<unknown[]>

  constructor(dbPath: string = './invoices.db') {
    this.db = new sqlite3.Database(dbPath)
    this.run = promisify(this.db.run.bind(this.db))
    this.get = promisify(this.db.get.bind(this.db))
    this.all = promisify(this.db.all.bind(this.db))
  }

  async initialize(): Promise<void> {
    // Check if we need to migrate existing schema first
    await this.migrateSchema()

    // Create the table with the correct current schema
    await this.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        client_hive_address TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        hive_conversion_data TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_date DATETIME NOT NULL,
        hive_transaction_id TEXT,
        encrypted_data TEXT,
        shareable_link TEXT
      )
    `)

    await this.run(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
      )
    `)

    await this.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id TEXT NOT NULL,
        from_account TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        transaction_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
      )
    `)

    await this.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    await this.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`)
    await this.run(`CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_hive_address)`)
    await this.run(`CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)`)
  }

  private async migrateSchema(): Promise<void> {
    try {
      // Check if the table exists first
      const tables = await this.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'`) as any[]
      
      if (tables.length === 0) {
        // Table doesn't exist yet, nothing to migrate
        return
      }

      // Check what columns exist
      const tableInfo = await this.all(`PRAGMA table_info(invoices)`) as any[]
      const hasOldEmail = tableInfo.some(column => column.name === 'client_email')
      const hasHiveAddress = tableInfo.some(column => column.name === 'client_hive_address')
      const hasEncryptedData = tableInfo.some(column => column.name === 'encrypted_data')
      const hasShareableLink = tableInfo.some(column => column.name === 'shareable_link')
      const hasCurrency = tableInfo.some(column => column.name === 'currency')
      const hasHiveConversionData = tableInfo.some(column => column.name === 'hive_conversion_data')

      if (hasOldEmail && !hasHiveAddress) {
        console.log('Migrating database: Recreating table with new schema')
        
        // SQLite doesn't support dropping columns, so we need to recreate the table
        await this.run(`CREATE TABLE invoices_new (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          client_name TEXT NOT NULL,
          client_hive_address TEXT NOT NULL,
          subtotal REAL NOT NULL,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          hive_conversion_data TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME NOT NULL,
          hive_transaction_id TEXT,
          encrypted_data TEXT,
          shareable_link TEXT
        )`)
        
        // Copy data from old table, converting email to hive address
        await this.run(`
          INSERT INTO invoices_new (
            id, invoice_number, client_name, client_hive_address,
            subtotal, tax, total, currency, status, created_at, updated_at, due_date, hive_transaction_id
          )
          SELECT 
            id, invoice_number, client_name, 
            CASE 
              WHEN client_email LIKE '%@%' THEN REPLACE(client_email, '@', '')
              ELSE client_email
            END as client_hive_address,
            subtotal, tax, total, 'USD' as currency, status, created_at, updated_at, due_date, hive_transaction_id
          FROM invoices
        `)
        
        // Drop old table and rename new one
        await this.run(`DROP TABLE invoices`)
        await this.run(`ALTER TABLE invoices_new RENAME TO invoices`)
        
        console.log('Database migration completed successfully')
      }

      // After recreating the table, check again for missing columns
      if (hasOldEmail && !hasHiveAddress) {
        // Table was recreated, so encrypted_data and shareable_link should already be there
      } else {
        // Handle cases where table exists but is missing some new columns
        if (!hasEncryptedData) {
          console.log('Migrating database: Adding encrypted_data column')
          await this.run(`ALTER TABLE invoices ADD COLUMN encrypted_data TEXT`)
        }

        if (!hasShareableLink) {
          console.log('Migrating database: Adding shareable_link column')
          await this.run(`ALTER TABLE invoices ADD COLUMN shareable_link TEXT`)
        }

        if (!hasCurrency) {
          console.log('Migrating database: Adding currency column')
          await this.run(`ALTER TABLE invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`)
        }

        if (!hasHiveConversionData) {
          console.log('Migrating database: Adding hive_conversion_data column')
          await this.run(`ALTER TABLE invoices ADD COLUMN hive_conversion_data TEXT`)
        }
      }

    } catch (error) {
      console.error('Error migrating schema:', error)
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    })
  }
}

export const db = new Database()