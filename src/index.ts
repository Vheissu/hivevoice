import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import dotenv from 'dotenv'
import invoices from './api/invoices.js'
import auth from './api/auth.js'
import { db } from './database/schema.js'

dotenv.config()

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

app.get('/', (c) => {
  return c.json({ message: 'Hivevoice API Server' })
})

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.route('/api/auth', auth)
app.route('/api/invoices', invoices)

const port = parseInt(process.env.PORT || '3000')

async function startServer() {
  await db.initialize()
  console.log('✅ Database initialized')

  serve({
    fetch: app.fetch,
    port
  }, (info) => {
    console.log(`🚀 Hivevoice server running on http://localhost:${info.port}`)
  })
}

startServer().catch(console.error)

export default app