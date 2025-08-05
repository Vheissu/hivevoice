import { Client, PrivateKey, Operation } from '@hiveio/dhive'
import type { HiveConfig } from '../types/index.js'

export class HiveService {
  private client: Client
  private config: HiveConfig

  constructor(config: HiveConfig) {
    this.config = config
    this.client = new Client(config.nodes)
  }

  async createInvoice(invoiceId: string, amount: number, currency: string): Promise<string> {
    const privateKey = PrivateKey.fromString(this.config.postingKey)
    
    const operation = {
      required_auths: [],
      required_posting_auths: [this.config.username],
      id: 'hivevoice_v1',
      json: JSON.stringify({
        action: 'create_invoice',
        invoice_id: invoiceId,
        to: this.config.username,
        amount: `${amount.toFixed(3)} ${currency}`
      })
    }

    const result = await this.client.broadcast.json(operation, privateKey)
    return result.id
  }

  async getInvoicePayments(_invoiceId: string): Promise<unknown[]> {
    return []
  }

  async getBlockchainHeight(): Promise<number> {
    const props = await this.client.database.getDynamicGlobalProperties()
    return props.head_block_number
  }

  async sendInvoiceNotification(to: string, invoiceData: { invoiceNumber: string; total: number; link: string }): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      console.log('Sending invoice notification via custom JSON:', {
        from: this.config.username,
        to: to.replace('@', ''),
        invoice: invoiceData.invoiceNumber
      })

      // Create the custom JSON operation for invoice notification
      const customJsonOp: Operation = [
        'custom_json',
        {
          required_auths: [],
          required_posting_auths: [this.config.username],
          id: 'hivevoice_invoice_notification',
          json: JSON.stringify({
            action: 'notify_invoice',
            to: to.replace('@', ''),
            invoice_number: invoiceData.invoiceNumber,
            amount: invoiceData.total,
            currency: 'USD',
            link: invoiceData.link,
            timestamp: Date.now()
          })
        }
      ]

      // Sign and broadcast the transaction
      const privateKey = PrivateKey.fromString(this.config.postingKey)
      const result = await this.client.broadcast.sendOperations([customJsonOp], privateKey)

      console.log('✅ Invoice notification sent successfully!', {
        txId: result.id,
        blockNum: result.block_num,
        trxNum: result.trx_num
      })

      return {
        success: true,
        txId: result.id
      }

    } catch (error) {
      console.error('❌ Invoice notification failed:', error)
      
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message)
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async sendTransfer(to: string, amount: string, memo: string, currency: 'HIVE' | 'HBD' = 'HIVE'): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      // Check if we have an active key for transfers
      if (!this.config.activeKey) {
        return {
          success: false,
          error: 'Active key required for transfers. Please set HIVE_ACTIVE_KEY in your environment.'
        }
      }

      console.log('Sending Hive transfer:', {
        from: this.config.username,
        to: to.replace('@', ''),
        amount: `${amount} ${currency}`,
        memo: memo.substring(0, 50) + '...'
      })

      // Create the transfer operation
      const transferOp: Operation = [
        'transfer',
        {
          from: this.config.username,
          to: to.replace('@', ''),
          amount: `${amount} ${currency}`,
          memo: memo
        }
      ]

      // Sign and broadcast the transaction using ACTIVE key
      const privateKey = PrivateKey.fromString(this.config.activeKey)
      const result = await this.client.broadcast.sendOperations([transferOp], privateKey)

      console.log('✅ Hive transfer successful!', {
        txId: result.id,
        result: result
      })

      return {
        success: true,
        txId: result.id
      }

    } catch (error) {
      console.error('❌ Hive transfer failed:', error)
      
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message)
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Check if the configured account exists
      const accounts = await this.client.database.getAccounts([this.config.username])
      const account = accounts[0]
      
      if (!account) {
        console.error('❌ Hive account not found:', this.config.username)
        return false
      }

      console.log('✅ Hive configuration validated for account:', this.config.username)
      return true

    } catch (error) {
      console.error('❌ Error validating Hive configuration:', error)
      return false
    }
  }
}

// Create singleton instance lazily
let hiveServiceInstance: HiveService | null = null

export function getHiveService(): HiveService {
  if (!hiveServiceInstance) {
    console.log('Creating Hive service with config:', {
      username: process.env.HIVE_USERNAME || 'NOT_SET',
      postingKey: process.env.HIVE_POSTING_KEY ? 'SET' : 'NOT_SET',
      activeKey: process.env.HIVE_ACTIVE_KEY ? 'SET' : 'NOT_SET',
      nodes: process.env.HIVE_NODES || 'NOT_SET'
    })
    
    hiveServiceInstance = new HiveService({
      username: process.env.HIVE_USERNAME || '',
      postingKey: process.env.HIVE_POSTING_KEY || '',
      activeKey: process.env.HIVE_ACTIVE_KEY,
      nodes: process.env.HIVE_NODES?.split(',') || ['https://api.hive.blog']
    })
  }
  return hiveServiceInstance
}

// Export as getter property for lazy initialization
export const hiveService = {
  get instance() {
    return getHiveService()
  }
}