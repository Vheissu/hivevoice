import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Invoice } from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'

const invoices = new Hono()

invoices.use('*', authMiddleware)

const createInvoiceSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive()
  })).min(1),
  dueDate: z.string().transform(str => new Date(str)),
  tax: z.number().min(0).default(0)
})

invoices.get('/', async (c) => {
  return c.json({ invoices: [] })
})

invoices.get('/:id', async (c) => {
  const id = c.req.param('id')
  return c.json({ message: `Invoice ${id} not found` }, 404)
})

invoices.post('/', zValidator('json', createInvoiceSchema), async (c) => {
  const data = c.req.valid('json')
  
  const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const total = subtotal + data.tax
  
  const invoice: Partial<Invoice> = {
    id: crypto.randomUUID(),
    invoiceNumber: `INV-${Date.now()}`,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    items: data.items.map(item => ({
      id: crypto.randomUUID(),
      ...item,
      total: item.quantity * item.unitPrice
    })),
    subtotal,
    tax: data.tax,
    total,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: data.dueDate
  }
  
  return c.json({ invoice }, 201)
})

invoices.put('/:id', async (c) => {
  const id = c.req.param('id')
  return c.json({ message: `Invoice ${id} updated` })
})

invoices.delete('/:id', async (c) => {
  const id = c.req.param('id')
  return c.json({ message: `Invoice ${id} deleted` })
})

export default invoices