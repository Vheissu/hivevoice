import { Client, PrivateKey, Operation } from '@hiveio/dhive'
import type { HiveConfig, Invoice } from '../types/index.js'
import { encryptJSON, MemoCryptoError, InvalidKeyError, MissingKeyError } from '../utils/memo-crypto.js'

/**
 * Custom error types for blockchain operations
 */
export class BlockchainBroadcastError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'BlockchainBroadcastError';
  }
}

export class InsufficientResourcesError extends BlockchainBroadcastError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'InsufficientResourcesError';
  }
}

export class NetworkError extends BlockchainBroadcastError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'NetworkError';
  }
}

export class InvalidTransactionError extends BlockchainBroadcastError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'InvalidTransactionError';
  }
}

export class HiveService {
  private client: Client
  private config: HiveConfig
  private memoPublicKeyCache: Map<string, string> = new Map()

  constructor(config: HiveConfig) {
    this.config = config
    this.client = new Client(config.nodes)
  }

  hasMemoKey(): boolean {
    return !!this.config.memoKey
  }

  validateEncryptionRequirements(encryptionRequested: boolean = false): void {
    if (encryptionRequested && !this.hasMemoKey()) {
      console.error('❌ MEMO KEY REQUIRED: Encryption was requested but HIVE_MEMO_KEY is not configured.')
      console.error('   Please set HIVE_MEMO_KEY in your environment variables to enable encryption features.')
      throw new Error('Memo key is required for encryption operations but is not configured')
    }
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

  async getInvoicePayments(invoiceId: string): Promise<import('../types/index.js').InvoicePayment | null> {
    // Import here to avoid circular dependency
    const { paymentMonitor } = await import('./payment-monitor.js')
    return paymentMonitor.instance.getInvoicePayments(invoiceId)
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

  async getMemoPublicKey(username: string): Promise<string | null> {
    if (this.memoPublicKeyCache.has(username)) {
      return this.memoPublicKeyCache.get(username) || null
    }

    try {
      const accounts = await this.client.database.getAccounts([username])
      if (accounts.length > 0) {
        const memoKey = accounts[0].memo_key
        this.memoPublicKeyCache.set(username, memoKey)
        return memoKey
      }
      return null
    } catch (error) {
      console.error(`Failed to fetch memo key for ${username}:`, error)
      return null
    }
  }

  /**
   * Stores encrypted invoice data as a post on the Hive blockchain
   * @param invoice - The invoice object to encrypt and store
   * @param recipient - The Hive username of the recipient
   * @returns Transaction ID of the broadcast operation and post permlink
   */
async storeEncryptedInvoice(invoice: Invoice, recipient: string): Promise<{ txId: string; encryptedPayload: string; permlink: string }> {
    try {
      // Validate that we have a memo key for encryption
      this.validateEncryptionRequirements(true)
      
      if (!this.config.memoKey) {
        throw new MissingKeyError('Memo key is required for encryption but not configured')
      }

      if (!this.config.postingKey) {
        throw new MissingKeyError('Posting key is required for blockchain operations but not configured')
      }

      if (!recipient || recipient.trim() === '') {
        throw new Error('Recipient username is required')
      }

      console.log('Storing encrypted invoice as post:', {
        invoiceId: invoice.id,
        recipient: recipient.replace('@', ''),
        invoiceNumber: invoice.invoiceNumber
      })

      // 1. Get recipient's memo public key
      const recipientMemoPublicKey = await this.getMemoPublicKey(recipient.replace('@', ''))
      if (!recipientMemoPublicKey) {
        throw new Error(`Could not retrieve memo public key for recipient: ${recipient}. The account may not exist or may not be accessible.`)
      }

      // 2. Encrypt the invoice data using server memo private key → recipient memo public key
      let encryptedPayload: string
      try {
        encryptedPayload = encryptJSON(invoice, this.config.memoKey, recipientMemoPublicKey)
      } catch (error) {
        if (error instanceof MemoCryptoError) {
          throw error // Re-throw crypto errors as-is
        }
        throw new MemoCryptoError(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 3. Generate unique permlink for the invoice post
      const permlink = `hivevoice-${invoice.invoiceNumber.toLowerCase()}-${Date.now()}`
      
      // 4. Create post operation with encrypted content
      const postOp: Operation = [
        'comment',
        {
          parent_author: '',
          parent_permlink: 'hivevoice-invoices', // Category
          author: this.config.username,
          permlink: permlink,
          title: `Invoice ${invoice.invoiceNumber}`, // Privacy-safe title
          body: `#ENCRYPTED_INVOICE\n${encryptedPayload}`,
          json_metadata: JSON.stringify({
            tags: ['hivevoice-invoices', 'business', invoice.status, new Date().getFullYear().toString()],
            app: 'hivevoice/2.0',
            version: '2.0.0',
            invoice: {
              id: invoice.id,
              number: invoice.invoiceNumber,
              status: invoice.status,
              created: invoice.createdAt.toISOString(),
              due: invoice.dueDate.toISOString(),
              encrypted: true,
              recipient: recipient.replace('@', ''),
              currency: invoice.currency,
              total: invoice.total.toString()
            }
          })
        }
      ]

      // 5. Sign and broadcast the transaction
      let privateKey: PrivateKey
      try {
        privateKey = PrivateKey.fromString(this.config.postingKey)
      } catch (error) {
        throw new InvalidKeyError(`Invalid posting key format: ${error instanceof Error ? error.message : String(error)}`)
      }

      let result: any
      try {
        result = await this.client.broadcast.sendOperations([postOp], privateKey)
      } catch (error) {
        // Handle specific blockchain errors
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase()
          
          if (errorMsg.includes('insufficient') || errorMsg.includes('bandwidth') || errorMsg.includes('resource')) {
            throw new InsufficientResourcesError(
              'Insufficient blockchain resources (RC/bandwidth) to broadcast transaction',
              error
            )
          }
          
          if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('timeout')) {
            throw new NetworkError(
              'Network error while broadcasting to blockchain',
              error
            )
          }
          
          if (errorMsg.includes('invalid') || errorMsg.includes('malformed') || errorMsg.includes('signature')) {
            throw new InvalidTransactionError(
              'Invalid transaction or signature error',
              error
            )
          }
        }
        
        throw new BlockchainBroadcastError(
          `Failed to broadcast post to blockchain: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        )
      }

      if (!result || !result.id) {
        throw new BlockchainBroadcastError('Blockchain broadcast succeeded but no transaction ID returned')
      }

      console.log('✅ Encrypted invoice post stored successfully!', {
        txId: result.id,
        invoiceId: invoice.id,
        permlink: permlink,
        blockNum: result.block_num,
        trxNum: result.trx_num,
        contentSize: encryptedPayload.length
      })

      // 6. Return transaction ID, encrypted payload, and permlink
      return { txId: result.id, encryptedPayload, permlink }

    } catch (error) {
      console.error('❌ Failed to store encrypted invoice post:', error)
      
      // Re-throw known error types without wrapping
      if (error instanceof MemoCryptoError || 
          error instanceof BlockchainBroadcastError ||
          error instanceof InvalidKeyError ||
          error instanceof MissingKeyError) {
        throw error
      }
      
      // Check if it's a validation error from validateEncryptionRequirements
      if (error instanceof Error && error.message.includes('Memo key is required for encryption operations')) {
        throw new MissingKeyError(error.message)
      }
      
      // Wrap unknown errors
      throw new BlockchainBroadcastError(
        `Failed to store encrypted invoice post: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Fetches encrypted invoice data from the Hive blockchain (from posts)
   * @param invoiceId - The ID of the invoice to retrieve
   * @returns The encrypted payload string or null if not found
   */
  async fetchEncryptedInvoice(invoiceId: string): Promise<string | null> {
    try {
      console.log('Fetching encrypted invoice post:', { invoiceId })

      // Get posts by the account using Bridge API
      const posts = await this.client.call('bridge', 'get_account_posts', {
        account: this.config.username,
        sort: 'blog',
        limit: 100
      })

      if (!posts || posts.length === 0) {
        console.log('❌ No posts found for account:', this.config.username)
        return null
      }

      // Look for invoice posts
      for (const post of posts) {
        try {
          // Check if this is a hivevoice invoice post
          if (post.category === 'hivevoice-invoices' && post.author === this.config.username) {
            // Parse metadata to check invoice ID
            const metadata = JSON.parse(post.json_metadata || '{}')
            if (metadata.invoice && metadata.invoice.id === invoiceId) {
              // Extract encrypted payload from post body
              const body = post.body || ''
              if (body.startsWith('#ENCRYPTED_INVOICE\n')) {
                const encryptedPayload = body.substring('#ENCRYPTED_INVOICE\n'.length)
                
                console.log('✅ Found encrypted invoice post:', {
                  invoiceId,
                  permlink: post.permlink,
                  author: post.author,
                  created: post.created,
                  contentSize: encryptedPayload.length
                })
                
                return encryptedPayload
              }
            }
          }
        } catch (parseError) {
          // Skip posts with malformed metadata
          console.warn('Skipping post with malformed metadata:', parseError)
          continue
        }
      }

      // If not found in blog posts, try searching by category using Bridge API
      try {
        const categoryPosts = await this.client.call('bridge', 'get_ranked_posts', {
          sort: 'created',
          tag: 'hivevoice-invoices',
          limit: 100
        })

        for (const post of categoryPosts) {
          try {
            if (post.author === this.config.username) {
              const metadata = JSON.parse(post.json_metadata || '{}')
              if (metadata.invoice && metadata.invoice.id === invoiceId) {
                const body = post.body || ''
                if (body.startsWith('#ENCRYPTED_INVOICE\n')) {
                  const encryptedPayload = body.substring('#ENCRYPTED_INVOICE\n'.length)
                  
                  console.log('✅ Found encrypted invoice post in category:', {
                    invoiceId,
                    permlink: post.permlink,
                    author: post.author,
                    created: post.created
                  })
                  
                  return encryptedPayload
                }
              }
            }
          } catch (parseError) {
            console.warn('Skipping post with malformed metadata:', parseError)
            continue
          }
        }
      } catch (categoryError) {
        console.warn('Failed to search category posts:', categoryError)
      }

      console.log('❌ Encrypted invoice post not found:', { invoiceId })
      return null

    } catch (error) {
      console.error('❌ Failed to fetch encrypted invoice post:', error)
      
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message)
      }

      throw new Error(`Failed to fetch encrypted invoice post: ${errorMessage}`)
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
      memoKey: process.env.HIVE_MEMO_KEY ? 'SET' : 'NOT_SET',
      nodes: process.env.HIVE_NODES || 'NOT_SET'
    })
    
    hiveServiceInstance = new HiveService({
      username: process.env.HIVE_USERNAME || '',
      postingKey: process.env.HIVE_POSTING_KEY || '',
      activeKey: process.env.HIVE_ACTIVE_KEY,
      memoKey: process.env.HIVE_MEMO_KEY,
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