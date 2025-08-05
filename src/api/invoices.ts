import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Invoice, SupportedCurrency, HiveConversion } from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../database/schema.js'
import { hiveService } from '../services/hive.js'
import { currencyService } from '../services/currency.js'

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
        id, invoice_number, client_name, client_hive_address,
        subtotal, tax, total, currency, hive_conversion_data, status, created_at, updated_at, due_date, hive_transaction_id
      FROM invoices 
      ORDER BY created_at DESC
    `) as any[]

    // Get items for each invoice and build complete invoice objects
    const invoices: Invoice[] = []
    for (const invoiceData of invoicesData) {
      const items = await db.all(`
        SELECT id, description, quantity, unit_price, total 
        FROM invoice_items 
        WHERE invoice_id = ?
      `, [invoiceData.id]) as any[]

      const hiveConversion: HiveConversion | undefined = 
        invoiceData.hive_conversion_data ? JSON.parse(invoiceData.hive_conversion_data) : undefined

      invoices.push({
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
      })
    }

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
        id, invoice_number, client_name, client_hive_address,
        subtotal, tax, total, currency, hive_conversion_data, status, created_at, updated_at, due_date, hive_transaction_id
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

    const hiveConversion: HiveConversion | undefined = 
      invoiceData.hive_conversion_data ? JSON.parse(invoiceData.hive_conversion_data) : undefined

    const invoice: Invoice = {
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
    
    return c.json({ invoice }, 201)
  } catch (error) {
    console.error('Error creating invoice:', error)
    return c.json({ error: 'Failed to create invoice' }, 500)
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
    // Get the invoice to create the notification message
    const invoiceData = await db.get(`
      SELECT invoice_number, client_hive_address, total
      FROM invoices 
      WHERE id = ?
    `, [invoiceId]) as any

    if (!invoiceData) {
      return c.json({ error: 'Invoice not found' }, 404)
    }

    // Create the transfer memo
    const shareableLink = `${process.env.FRONTEND_URL || 'http://localhost:9000'}/invoices/${invoiceId}`
    const memo = data.message || `Invoice ${invoiceData.invoice_number} from @${process.env.HIVE_USERNAME} - Amount: ${invoiceData.total} - ${shareableLink}`

    // Send the Hive transfer with memo
    const result = await hiveService.instance.sendTransfer(
      data.clientHiveAddress,
      '0.001', // Small transfer amount for notification
      memo,
      'HIVE'
    )

    if (result.success) {
      // Update the invoice with the transaction ID
      await db.run(`
        UPDATE invoices 
        SET hive_transaction_id = ?, updated_at = ?
        WHERE id = ?
      `, [result.txId, new Date().toISOString(), invoiceId])

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