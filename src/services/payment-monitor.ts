import { Client } from '@hiveio/dhive'
import type { HiveConfig, Payment, InvoicePayment } from '../types/index.js'
import { db } from '../database/schema.js'

interface HiveTransfer {
  from: string
  to: string
  amount: string
  memo: string
}


export class PaymentMonitorService {
  private client: Client
  private config: HiveConfig
  private isMonitoring = false
  private lastProcessedBlock = 0
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor(config: HiveConfig) {
    this.config = config
    this.client = new Client(config.nodes)
  }

  async initialize(): Promise<void> {
    // Get the last processed block from database or start from current block
    const lastBlock = await this.getLastProcessedBlock()
    if (lastBlock > 0) {
      this.lastProcessedBlock = lastBlock
    } else {
      // Start from current block if no previous state
      const props = await this.client.database.getDynamicGlobalProperties()
      this.lastProcessedBlock = props.head_block_number
      await this.saveLastProcessedBlock(this.lastProcessedBlock)
    }
    
    console.log(`Payment monitor initialized. Starting from block ${this.lastProcessedBlock}`)
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Payment monitoring is already running')
      return
    }

    this.isMonitoring = true
    console.log('🔍 Starting payment monitoring service...')

    // Monitor every 10 seconds (Hive has 3-second block times)
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.processNewBlocks()
      } catch (error) {
        console.error('Error in payment monitoring:', error)
      }
    }, 10000)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    console.log('Payment monitoring stopped')
  }

  private async processNewBlocks(): Promise<void> {
    try {
      const props = await this.client.database.getDynamicGlobalProperties()
      const currentBlock = props.head_block_number

      if (currentBlock <= this.lastProcessedBlock) {
        return // No new blocks to process
      }

      // Process blocks in batches to avoid overwhelming the API
      const maxBlocksPerBatch = 20
      const endBlock = Math.min(this.lastProcessedBlock + maxBlocksPerBatch, currentBlock)

      for (let blockNum = this.lastProcessedBlock + 1; blockNum <= endBlock; blockNum++) {
        await this.processBlock(blockNum)
      }

      this.lastProcessedBlock = endBlock
      await this.saveLastProcessedBlock(this.lastProcessedBlock)

      if (endBlock < currentBlock) {
        console.log(`Processed blocks ${this.lastProcessedBlock - (endBlock - this.lastProcessedBlock)} to ${endBlock}. ${currentBlock - endBlock} blocks remaining.`)
      }
    } catch (error) {
      console.error('Error processing blocks:', error)
    }
  }

  private async processBlock(blockNum: number): Promise<void> {
    try {
      const block = await this.client.database.getBlock(blockNum)
      if (!block?.transactions) {
        return
      }

      for (let i = 0; i < block.transactions.length; i++) {
        const transaction = block.transactions[i]
        const txId = block.transaction_ids?.[i] || `${blockNum}-${i}`
        
        for (const operation of transaction.operations) {
          if (operation[0] === 'transfer') {
            const transfer = operation[1] as HiveTransfer
            
            // Only process transfers TO our account
            if (transfer.to === this.config.username) {
              await this.processTransfer(transfer, txId, blockNum)
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing block ${blockNum}:`, error)
    }
  }

  private async processTransfer(transfer: HiveTransfer, txId: string, blockNum: number): Promise<void> {
    try {
      // Parse amount and currency
      const [amountStr, currency] = transfer.amount.split(' ')
      const amount = parseFloat(amountStr)

      if (!['HIVE', 'HBD'].includes(currency)) {
        return // Only process HIVE and HBD transfers
      }

      // Extract invoice number from memo
      const invoiceNumber = this.extractInvoiceNumber(transfer.memo)
      if (!invoiceNumber) {
        console.log(`Transfer from ${transfer.from} with no invoice reference: ${transfer.memo}`)
        return
      }

      // Find the invoice in database
      const invoice = await db.get(`
        SELECT id, invoice_number, status, total, currency as invoice_currency, hive_conversion_data
        FROM invoices 
        WHERE invoice_number = ?
      `, [invoiceNumber]) as any

      if (!invoice) {
        console.log(`Invoice ${invoiceNumber} not found for transfer from ${transfer.from}`)
        return
      }

      // Check if payment already recorded
      const existingPayment = await db.get(`
        SELECT id FROM payments 
        WHERE transaction_id = ? AND invoice_id = ?
      `, [txId, invoice.id]) as any

      if (existingPayment) {
        console.log(`Payment already recorded: ${txId}`)
        return
      }

      // Record the payment
      await db.run(`
        INSERT INTO payments (
          invoice_id, from_account, amount, currency, block_number, transaction_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.id,
        transfer.from,
        amount,
        currency,
        blockNum,
        txId,
        new Date().toISOString()
      ])

      console.log(`💰 Payment recorded: ${amount} ${currency} from ${transfer.from} for invoice ${invoiceNumber}`)

      // Update invoice status
      await this.updateInvoiceStatus(invoice)
      
    } catch (error) {
      console.error('Error processing transfer:', error)
    }
  }

  private extractInvoiceNumber(memo: string): string | null {
    // Look for patterns like "Payment for Invoice INV-123456" or "INV-123456"
    const patterns = [
      /Invoice\s+([A-Z]+-\d+)/i,
      /([A-Z]+-\d+)/,
      /invoice:\s*([A-Z]+-\d+)/i
    ]

    for (const pattern of patterns) {
      const match = memo.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  private async updateInvoiceStatus(invoice: any): Promise<void> {
    try {
      // Get all payments for this invoice
      const payments = await db.all(`
        SELECT amount, currency FROM payments 
        WHERE invoice_id = ?
      `, [invoice.id]) as any[]

      // Calculate total paid in HIVE and HBD
      let totalPaidHive = 0
      let totalPaidHbd = 0

      for (const payment of payments) {
        if (payment.currency === 'HIVE') {
          totalPaidHive += payment.amount
        } else if (payment.currency === 'HBD') {
          totalPaidHbd += payment.amount
        }
      }

      // Get expected amounts from invoice
      const hiveConversion = invoice.hive_conversion_data ? 
        JSON.parse(invoice.hive_conversion_data) : null

      if (!hiveConversion) {
        console.log(`No HIVE conversion data for invoice ${invoice.invoice_number}`)
        return
      }

      const expectedHive = hiveConversion.hiveAmount
      const expectedHbd = hiveConversion.hbdAmount

      // Determine new status
      let newStatus = 'pending'
      
      // Check if fully paid (allow small tolerance for rounding)
      const tolerance = 0.001
      const hiveFullyPaid = totalPaidHive >= (expectedHive - tolerance)
      const hbdFullyPaid = totalPaidHbd >= (expectedHbd - tolerance)
      const anyPaymentMade = totalPaidHive > 0 || totalPaidHbd > 0

      if (hiveFullyPaid || hbdFullyPaid) {
        newStatus = 'paid'
      } else if (anyPaymentMade) {
        newStatus = 'partial'
      }

      // Update invoice status if changed
      if (newStatus !== invoice.status) {
        await db.run(`
          UPDATE invoices 
          SET status = ?, updated_at = ?
          WHERE id = ?
        `, [newStatus, new Date().toISOString(), invoice.id])

        console.log(`📄 Invoice ${invoice.invoice_number} status updated to: ${newStatus}`)
        console.log(`   Paid: ${totalPaidHive.toFixed(3)} HIVE, ${totalPaidHbd.toFixed(3)} HBD`)
        console.log(`   Expected: ${expectedHive.toFixed(3)} HIVE or ${expectedHbd.toFixed(3)} HBD`)
      }

    } catch (error) {
      console.error('Error updating invoice status:', error)
    }
  }

  async getInvoicePayments(invoiceId: string): Promise<InvoicePayment | null> {
    try {
      // Get invoice details
      const invoice = await db.get(`
        SELECT id, hive_conversion_data 
        FROM invoices 
        WHERE id = ?
      `, [invoiceId]) as any

      if (!invoice) {
        return null
      }

      // Get all payments for this invoice
      const paymentsData = await db.all(`
        SELECT id, invoice_id, from_account, amount, currency, block_number, transaction_id, created_at
        FROM payments 
        WHERE invoice_id = ?
        ORDER BY created_at DESC
      `, [invoiceId]) as any[]

      const payments: Payment[] = paymentsData.map(p => ({
        id: p.id,
        invoiceId: p.invoice_id,
        fromAccount: p.from_account,
        amount: p.amount,
        currency: p.currency,
        blockNumber: p.block_number,
        transactionId: p.transaction_id,
        createdAt: new Date(p.created_at)
      }))

      // Calculate totals
      let totalPaidHive = 0
      let totalPaidHbd = 0

      for (const payment of payments) {
        if (payment.currency === 'HIVE') {
          totalPaidHive += payment.amount
        } else if (payment.currency === 'HBD') {
          totalPaidHbd += payment.amount
        }
      }

      // Get expected amounts
      const hiveConversion = invoice.hive_conversion_data ? 
        JSON.parse(invoice.hive_conversion_data) : null

      const expectedHive = hiveConversion?.hiveAmount || 0
      const expectedHbd = hiveConversion?.hbdAmount || 0

      return {
        invoiceId,
        payments,
        totalPaid: {
          hive: totalPaidHive,
          hbd: totalPaidHbd
        },
        amountDue: {
          hive: Math.max(0, expectedHive - totalPaidHive),
          hbd: Math.max(0, expectedHbd - totalPaidHbd)
        }
      }

    } catch (error) {
      console.error('Error getting invoice payments:', error)
      return null
    }
  }

  private async getLastProcessedBlock(): Promise<number> {
    try {
      const result = await db.get(`
        SELECT value FROM config WHERE key = 'last_processed_block'
      `) as any
      
      return result ? parseInt(result.value) : 0
    } catch (error) {
      console.error('Error getting last processed block:', error)
      return 0
    }
  }

  private async saveLastProcessedBlock(blockNum: number): Promise<void> {
    try {
      await db.run(`
        INSERT OR REPLACE INTO config (key, value) 
        VALUES ('last_processed_block', ?)
      `, [blockNum.toString()])
    } catch (error) {
      console.error('Error saving last processed block:', error)
    }
  }
}

// Create singleton instance
let paymentMonitorInstance: PaymentMonitorService | null = null

export function getPaymentMonitor(): PaymentMonitorService {
  if (!paymentMonitorInstance) {
    paymentMonitorInstance = new PaymentMonitorService({
      username: process.env.HIVE_USERNAME || '',
      postingKey: process.env.HIVE_POSTING_KEY || '',
      activeKey: process.env.HIVE_ACTIVE_KEY,
      nodes: process.env.HIVE_NODES?.split(',') || ['https://api.hive.blog']
    })
  }
  return paymentMonitorInstance
}

export const paymentMonitor = {
  get instance() {
    return getPaymentMonitor()
  }
}