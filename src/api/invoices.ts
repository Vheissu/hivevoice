import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Invoice, HiveConversion } from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../database/schema.js'
import { hiveService } from '../services/hive.js'
import { currencyService } from '../services/currency.js'
import { decryptJSON, MemoCryptoError } from '../utils/memo-crypto.js'

const invoices = new Hono()

// Public endpoints (no auth required)
// Endpoint to get supported currencies and current exchange rates
invoices.get('/currencies', async (c) => {
  try {
    const rates = await currencyService.getExchangeRates()
    
    // Transform data to match frontend expectations
    const currencyDetails = [
      { currency: 'USD' as const, symbol: '$', name: 'US Dollar', key: 'usd' as const },
      { currency: 'GBP' as const, symbol: '£', name: 'British Pound', key: 'gbp' as const },
      { currency: 'EUR' as const, symbol: '€', name: 'Euro', key: 'eur' as const },
      { currency: 'AUD' as const, symbol: 'A$', name: 'Australian Dollar', key: 'aud' as const },
      { currency: 'NZD' as const, symbol: 'NZ$', name: 'New Zealand Dollar', key: 'nzd' as const }
    ]
    
    const transformedCurrencies = currencyDetails.map(detail => ({
      currency: detail.currency,
      symbol: detail.symbol,
      name: detail.name,
      hiveRate: rates.hive[detail.key],
      hbdRate: rates.hive_dollar[detail.key],
      lastUpdated: new Date(rates.timestamp).toISOString()
    }))
    
    return c.json({ 
      currencies: transformedCurrencies,
      timestamp: rates.timestamp
    })
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return c.json({ error: 'Failed to fetch currency data' }, 500)
  }
})

// Endpoint to convert an amount from one currency to HIVE/HBD
const convertCurrencySchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.enum(['USD', 'GBP', 'EUR', 'AUD', 'NZD'])
})

invoices.post('/convert', zValidator('json', convertCurrencySchema), async (c) => {
  const data = c.req.valid('json')
  
  try {
    const result = await currencyService.convertCurrency(data.amount, data.fromCurrency)
    return c.json({ conversion: result })
  } catch (error) {
    console.error('Error converting currency:', error)
    return c.json({ error: 'Failed to convert currency' }, 500)
  }
})

/**
 * Helper function to build invoice response with encrypted data handling
 * @param invoiceData - Raw invoice data from database
 * @param items - Invoice items
 * @returns Complete invoice object with decrypted fields if possible
 */
async function buildInvoiceResponse(invoiceData: any, items: any[]): Promise<Invoice> {
  const hiveConversion: HiveConversion | undefined = 
    invoiceData.hive_conversion_data ? JSON.parse(invoiceData.hive_conversion_data) : undefined

  // Base invoice object from stored fields
  let invoice: Invoice = {
    id: invoiceData.id,
    invoiceNumber: invoiceData.invoice_number,
    clientName: invoiceData.client_name,
    clientHiveAddress: invoiceData.client_hive_address,
    subtotal: invoiceData.subtotal,
    tax: invoiceData.tax,
    total: invoiceData.total,
    currency: invoiceData.currency || 'USD',
    hiveConversion,
    status: invoiceData.status,
    createdAt: new Date(invoiceData.created_at),
    updatedAt: new Date(invoiceData.updated_at),
    dueDate: new Date(invoiceData.due_date),
    hiveTransactionId: invoiceData.hive_transaction_id,
    items: items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total
    }))
  }

  // Handle encrypted data if present
  if (invoiceData.encrypted_data && hiveService.instance.hasMemoKey()) {
    try {
      console.log('Attempting to decrypt invoice data:', {
        invoiceId: invoiceData.id,
        hasEncryptedData: !!invoiceData.encrypted_data,
        hasMemoKey: hiveService.instance.hasMemoKey()
      })

      // Get client's public memo key
      const clientPublicMemoKey = await hiveService.instance.getMemoPublicKey(invoiceData.client_hive_address)
      
      if (clientPublicMemoKey && process.env.HIVE_MEMO_KEY) {
        // Decrypt using server private memo key and client public memo key
        const decryptedData = decryptJSON(
          invoiceData.encrypted_data,
          process.env.HIVE_MEMO_KEY, // server private memo key
          clientPublicMemoKey // client public memo key
        ) as Partial<Invoice>

        // Merge decrypted fields with base invoice
        invoice = { ...invoice, ...decryptedData }
        
        console.log('✅ Successfully decrypted invoice data:', {
          invoiceId: invoiceData.id,
          decryptedFields: Object.keys(decryptedData)
        })
      } else {
        console.warn('⚠️ Cannot decrypt - missing client public memo key:', {
          invoiceId: invoiceData.id,
          clientHiveAddress: invoiceData.client_hive_address,
          hasClientMemoKey: !!clientPublicMemoKey,
          hasServerMemoKey: !!process.env.HIVE_MEMO_KEY
        })
        
        // Return original stored fields and encrypted data string for frontend handling
        invoice.encryptedData = invoiceData.encrypted_data
      }
    } catch (decryptError) {
      console.error('❌ Failed to decrypt invoice data:', {
        invoiceId: invoiceData.id,
        error: decryptError instanceof Error ? decryptError.message : String(decryptError)
      })
      
      // On failure, return original stored fields and encrypted data string for frontend handling
      invoice.encryptedData = invoiceData.encrypted_data
    }
  } else if (!invoiceData.encrypted_data && invoiceData.hive_transaction_id) {
    // Lazy-fetch from chain if encrypted_data not present but hive_transaction_id exists
    try {
      console.log('Lazy-fetching encrypted invoice from blockchain:', {
        invoiceId: invoiceData.id,
        hiveTransactionId: invoiceData.hive_transaction_id
      })

      const encryptedPayload = await hiveService.instance.fetchEncryptedInvoice(invoiceData.id)
      
      if (encryptedPayload) {
        console.log('✅ Retrieved encrypted data from blockchain:', {
          invoiceId: invoiceData.id,
          payloadLength: encryptedPayload.length
        })

        // Cache encrypted data in database
        await db.run(`
          UPDATE invoices 
          SET encrypted_data = ?, updated_at = ?
          WHERE id = ?
        `, [encryptedPayload, new Date().toISOString(), invoiceData.id])

        // Now try to decrypt the fetched data
        if (hiveService.instance.hasMemoKey()) {
          try {
            const clientPublicMemoKey = await hiveService.instance.getMemoPublicKey(invoiceData.client_hive_address)
            
            if (clientPublicMemoKey && process.env.HIVE_MEMO_KEY) {
              const decryptedData = decryptJSON(
                encryptedPayload,
                process.env.HIVE_MEMO_KEY,
                clientPublicMemoKey
              ) as Partial<Invoice>

              // Merge decrypted fields
              invoice = { ...invoice, ...decryptedData }
              
              console.log('✅ Successfully decrypted lazy-fetched invoice data:', {
                invoiceId: invoiceData.id,
                decryptedFields: Object.keys(decryptedData)
              })
            } else {
              // Store encrypted data for frontend handling
              invoice.encryptedData = encryptedPayload
            }
          } catch (decryptError) {
            console.error('❌ Failed to decrypt lazy-fetched invoice data:', decryptError)
            invoice.encryptedData = encryptedPayload
          }
        } else {
          // No memo key available, store encrypted data for frontend
          invoice.encryptedData = encryptedPayload
        }
      } else {
        console.warn('⚠️ No encrypted data found on blockchain for invoice:', invoiceData.id)
      }
    } catch (fetchError) {
      console.error('❌ Failed to lazy-fetch encrypted invoice from blockchain:', {
        invoiceId: invoiceData.id,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      })
    }
  }

  return invoice
}

// Apply auth middleware to all remaining routes
invoices.use('*', authMiddleware)

const createInvoiceSchema = z.object({
  clientName: z.string().min(1),
  clientHiveAddress: z.string().min(1),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive()
  })).min(1),
  dueDate: z.string().transform(str => new Date(str)),
  tax: z.number().min(0).default(0),
  currency: z.enum(['USD', 'GBP', 'EUR', 'AUD', 'NZD']).default('USD'),
  notifyClient: z.boolean().optional().default(false)
})

invoices.get('/', async (c) => {
  try {
    // Get all invoices from database
    const invoicesData = await db.all(`
      SELECT 
        id, invoice_number, client_name, client_hive_address, encrypted_data,
        subtotal, tax, total, currency, hive_conversion_data, status, created_at, updated_at, due_date, hive_transaction_id, hive_permlink
      FROM invoices 
      ORDER BY created_at DESC
    `) as any[]

    // Use Promise.all to build all invoice responses concurrently
    const invoices: Invoice[] = await Promise.all(invoicesData.map(async (invoiceData) => {
      const items = await db.all(`
        SELECT id, description, quantity, unit_price, total 
        FROM invoice_items 
        WHERE invoice_id = ?
      `, [invoiceData.id]) as any[]

      return buildInvoiceResponse(invoiceData, items)
    }))

    return c.json({ invoices })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return c.json({ error: 'Failed to fetch invoices' }, 500)
  }
})

invoices.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    // Get invoice from database
    const invoiceData = await db.get(`
      SELECT 
        id, invoice_number, client_name, client_hive_address, encrypted_data,
        subtotal, tax, total, currency, hive_conversion_data, status, created_at, updated_at, due_date, hive_transaction_id, hive_permlink
      FROM invoices 
      WHERE id = ?
    `, [id]) as any

    if (!invoiceData) {
      return c.json({ error: 'Invoice not found' }, 404)
    }

    // Get invoice items
    const items = await db.all(`
      SELECT id, description, quantity, unit_price, total 
      FROM invoice_items 
      WHERE invoice_id = ?
    `, [id]) as any[]

    // Build invoice response with encryption handling
    const invoice = await buildInvoiceResponse(invoiceData, items)

    return c.json({ invoice })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return c.json({ error: 'Failed to fetch invoice' }, 500)
  }
})

invoices.post('/', zValidator('json', createInvoiceSchema), async (c) => {
  const data = c.req.valid('json')
  
  try {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const total = subtotal + data.tax
    
    // Get currency conversion
    const conversionResult = await currencyService.convertCurrency(total, data.currency)
    const hiveConversionData: HiveConversion = {
      hiveAmount: conversionResult.hiveAmount,
      hbdAmount: conversionResult.hbdAmount,
      exchangeRate: conversionResult.exchangeRate,
      timestamp: conversionResult.timestamp
    }
    
    const invoiceId = crypto.randomUUID()
    const invoiceNumber = `INV-${Date.now()}`
    const now = new Date().toISOString()
    
    // Insert invoice into database
    await db.run(`
      INSERT INTO invoices (
        id, invoice_number, client_name, client_hive_address,
        subtotal, tax, total, currency, hive_conversion_data, status, created_at, updated_at, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId,
      invoiceNumber,
      data.clientName,
      data.clientHiveAddress,
      subtotal,
      data.tax,
      total,
      data.currency,
      JSON.stringify(hiveConversionData),
      'pending',
      now,
      now,
      data.dueDate.toISOString()
    ])
    
    // Insert invoice items
    for (const item of data.items) {
      const itemId = crypto.randomUUID()
      const itemTotal = item.quantity * item.unitPrice
      
      await db.run(`
        INSERT INTO invoice_items (
          id, invoice_id, description, quantity, unit_price, total
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        itemId,
        invoiceId,
        item.description,
        item.quantity,
        item.unitPrice,
        itemTotal
      ])
    }
    
    // Create the invoice object to return
    const invoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      clientName: data.clientName,
      clientHiveAddress: data.clientHiveAddress,
      items: data.items.map(item => ({
        id: crypto.randomUUID(),
        ...item,
        total: item.quantity * item.unitPrice
      })),
      subtotal,
      tax: data.tax,
      total,
      currency: data.currency,
      hiveConversion: hiveConversionData,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: data.dueDate
    }
    
    // Store encrypted invoice data as post on Hive blockchain (PRIMARY STORAGE)
    try {
      const { txId, encryptedPayload, permlink } = await hiveService.instance.storeEncryptedInvoice(invoice, data.clientHiveAddress)
      
      // Update the database with the transaction ID, permlink, and encrypted data (CACHE)
      await db.run(`
        UPDATE invoices 
        SET hive_transaction_id = ?, hive_permlink = ?, encrypted_data = ?, updated_at = ?
        WHERE id = ?
      `, [txId, permlink, encryptedPayload, new Date().toISOString(), invoiceId])
      
      // Update the invoice object for the response
      invoice.hiveTransactionId = txId
      
      console.log('✅ Invoice encrypted and stored as Hive post (primary):', {
        invoiceId,
        txId,
        permlink,
        clientHiveAddress: data.clientHiveAddress,
        contentSize: encryptedPayload.length
      })
      
    } catch (encryptionError) {
      // For blockchain-first approach, encryption failure should be an error
      console.error('❌ Failed to encrypt/store invoice on Hive blockchain:', encryptionError)
      
      // Clean up the database record since blockchain storage failed
      await db.run(`DELETE FROM invoices WHERE id = ?`, [invoiceId])
      await db.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId])
      
      if (encryptionError instanceof MemoCryptoError) {
        return c.json({ 
          error: 'Failed to encrypt invoice data',
          details: encryptionError.message
        }, 400)
      }
      
      return c.json({ 
        error: 'Failed to store invoice on blockchain',
        details: encryptionError instanceof Error ? encryptionError.message : String(encryptionError)
      }, 500)
    }
    
    return c.json({ invoice }, 201)
  } catch (error) {
    console.error('Error creating invoice:', error)
    return c.json({ error: 'Failed to create invoice' }, 500)
  }
})

// Get payment information for an invoice
invoices.get('/:id/payments', async (c) => {
  const id = c.req.param('id')
  
  try {
    const payments = await hiveService.instance.getInvoicePayments(id)
    
    if (!payments) {
      return c.json({ error: 'Invoice not found' }, 404)
    }
    
    return c.json({ payments })
  } catch (error) {
    console.error('Error fetching invoice payments:', error)
    return c.json({ error: 'Failed to fetch payments' }, 500)
  }
})

invoices.put('/:id', async (c) => {
  const id = c.req.param('id')
  return c.json({ message: `Invoice ${id} updated` })
})

invoices.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    // First check if the invoice exists
    const existingInvoice = await db.get(`
      SELECT id FROM invoices WHERE id = ?
    `, [id])

    if (!existingInvoice) {
      return c.json({ error: 'Invoice not found' }, 404)
    }

    // Delete the invoice (CASCADE will handle related records)
    const result = await db.run(`
      DELETE FROM invoices WHERE id = ?
    `, [id])

    // Check if the deletion was successful
    // Handle the case where result might be undefined or not have changes property
    if (result && typeof result === 'object' && 'changes' in result) {
      if (result.changes === 0) {
        return c.json({ error: 'Failed to delete invoice' }, 500)
      }
    }

    return c.json({ message: `Invoice ${id} deleted successfully` })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return c.json({ error: 'Failed to delete invoice' }, 500)
  }
})

// New endpoint for sending Hive notifications
const hiveTransferSchema = z.object({
  invoiceId: z.string(),
  clientHiveAddress: z.string(),
  message: z.string().optional()
})

invoices.post('/notify/:id', zValidator('json', hiveTransferSchema), async (c) => {
  const invoiceId = c.req.param('id')
  const data = c.req.valid('json')
  
  try {
    // Use the invoiceId from the request body if available, otherwise fall back to URL param
    const actualInvoiceId = data.invoiceId || invoiceId
    
    console.log('Looking for invoice notification:', {
      urlParam: invoiceId,
      bodyParam: data.invoiceId,
      actualInvoiceId,
      clientHiveAddress: data.clientHiveAddress
    })
    
    // Get the invoice to create the notification message
    const invoiceData = await db.get(`
      SELECT invoice_number, client_hive_address, total, currency 
      FROM invoices 
      WHERE id = ?
    `, [actualInvoiceId]) as any

    if (!invoiceData) {
      console.error('Invoice not found in database:', {
        searchedId: actualInvoiceId,
        urlParam: invoiceId,
        bodyParam: data.invoiceId
      })
      return c.json({ error: 'Invoice not found' }, 404)
    }

    // Create the transfer memo
    const shareableLink = `${process.env.FRONTEND_URL || 'http://localhost:9000'}/invoices/${actualInvoiceId}`
    const memo = data.message || `Invoice ${invoiceData.invoice_number} from @${process.env.HIVE_USERNAME} - Amount: ${invoiceData.total} ${invoiceData.currency || 'USD'} - ${shareableLink}`

    // Send the Hive transfer with memo
    const result = await hiveService.instance.sendTransfer(
      data.clientHiveAddress,
      '0.001', // Small transfer amount for notification
      memo,
      'HIVE'
    )

    if (result.success) {
      // Update the invoice with the notification transaction ID
      // Note: We don't override hive_transaction_id as it's used for the invoice storage transaction
      // This is a separate notification transaction
      console.log('✅ Notification sent successfully:', {
        invoiceId: actualInvoiceId,
        notificationTxId: result.txId,
        clientHiveAddress: data.clientHiveAddress
      })

      return c.json({ 
        success: true, 
        txId: result.txId,
        message: 'Hive transfer sent successfully'
      })
    } else {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500)
    }

  } catch (error) {
    console.error('Error sending Hive notification:', error)
    return c.json({ error: 'Failed to send Hive notification' }, 500)
  }
})

export default invoices