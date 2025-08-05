import { Hono } from 'hono'
import { db } from '../database/schema.js'
import type { DashboardStats, Invoice, HiveConversion } from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'

const dashboard = new Hono()

dashboard.use('*', authMiddleware)

dashboard.get('/stats', async (c) => {
  try {
    // Get total invoices count
    const totalResult = await db.all('SELECT COUNT(*) as count FROM invoices') as { count: number }[]
    const totalInvoices = totalResult[0]?.count || 0

    // Get total revenue
    const revenueResult = await db.all('SELECT SUM(total) as revenue FROM invoices WHERE status = "paid"') as { revenue: number }[]
    const totalRevenue = revenueResult[0]?.revenue || 0

    // Get pending invoices count and revenue
    const pendingResult = await db.all('SELECT COUNT(*) as count, SUM(total) as revenue FROM invoices WHERE status = "pending"') as { count: number, revenue: number }[]
    const pendingInvoices = pendingResult[0]?.count || 0
    const pendingRevenue = pendingResult[0]?.revenue || 0

    // Get paid invoices count
    const paidResult = await db.all('SELECT COUNT(*) as count FROM invoices WHERE status = "paid"') as { count: number }[]
    const paidInvoices = paidResult[0]?.count || 0

    // Get recent invoices (latest 5)
    const recentInvoicesData = await db.all(`
      SELECT 
        id, invoice_number, client_name, client_hive_address, 
        subtotal, tax, total, currency, hive_conversion_data, status, 
        created_at, updated_at, due_date, hive_transaction_id
      FROM invoices 
      ORDER BY created_at DESC 
      LIMIT 5
    `) as any[]

    // Transform recent invoices to match frontend interface
    const recentInvoices: Invoice[] = []
    for (const invoice of recentInvoicesData) {
      // Get items for this invoice
      const items = await db.all(`
        SELECT id, description, quantity, unit_price, total 
        FROM invoice_items 
        WHERE invoice_id = ?
      `, [invoice.id]) as any[]

      const hiveConversion: HiveConversion | undefined = 
        invoice.hive_conversion_data ? JSON.parse(invoice.hive_conversion_data) : undefined

      recentInvoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client_name,
        clientHiveAddress: invoice.client_hive_address,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        currency: invoice.currency || 'USD',
        hiveConversion,
        status: invoice.status,
        createdAt: new Date(invoice.created_at),
        updatedAt: new Date(invoice.updated_at),
        dueDate: new Date(invoice.due_date),
        hiveTransactionId: invoice.hive_transaction_id,
        items: items.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          total: item.total
        }))
      })
    }

    const stats: DashboardStats = {
      totalInvoices,
      totalRevenue,
      pendingInvoices,
      paidInvoices,
      pendingRevenue,
      recentInvoices
    }

    return c.json(stats)
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500)
  }
})

export default dashboard