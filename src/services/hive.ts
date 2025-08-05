import { Client, PrivateKey } from '@hiveio/dhive'
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
}

export const hiveService = new HiveService({
  username: process.env.HIVE_USERNAME || '',
  postingKey: process.env.HIVE_POSTING_KEY || '',
  nodes: process.env.HIVE_NODES?.split(',') || ['https://api.hive.blog']
})