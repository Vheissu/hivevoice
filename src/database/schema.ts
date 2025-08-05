import sqlite3 from 'sqlite3'
import { promisify } from 'util'

export class Database {
  private db: sqlite3.Database
  private run: (sql: string, ...params: unknown[]) => Promise<sqlite3.RunResult>
  private get: (sql: string, ...params: unknown[]) => Promise<unknown>
  private all: (sql: string, ...params: unknown[]) => Promise<unknown[]>

  constructor(dbPath: string = './invoices.db') {
    this.db = new sqlite3.Database(dbPath)
    this.run = promisify(this.db.run.bind(this.db))
    this.get = promisify(this.db.get.bind(this.db))
    this.all = promisify(this.db.all.bind(this.db))
  }

  async initialize(): Promise<void> {
    await this.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_date DATETIME NOT NULL,
        hive_transaction_id TEXT
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
    await this.run(`CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_email)`)
    await this.run(`CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)`)
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