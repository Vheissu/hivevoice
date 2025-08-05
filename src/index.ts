import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables first with explicit path
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import invoices from './api/invoices.js'
import auth from './api/auth.js'
import dashboard from './api/dashboard.js'
import { db } from './database/schema.js'
import { hiveService } from './services/hive.js'
import { paymentMonitor } from './services/payment-monitor.js'

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
app.route('/api/dashboard', dashboard)

const port = parseInt(process.env.PORT || '3000')

async function startServer() {
  await db.initialize()
  console.log('✅ Database initialized')

  // Debug environment variables
  console.log('Environment check:', {
    HIVE_USERNAME: process.env.HIVE_USERNAME || 'NOT_SET',
    HIVE_POSTING_KEY: process.env.HIVE_POSTING_KEY ? '***SET***' : 'NOT_SET',
    HIVE_NODES: process.env.HIVE_NODES || 'NOT_SET'
  })

  // Validate Hive configuration
  if (process.env.HIVE_USERNAME && process.env.HIVE_POSTING_KEY) {
    const isValid = await hiveService.instance.validateConfig()
    if (isValid) {
      console.log('✅ Hive service initialized')
      
      // Initialize and start payment monitoring
      try {
        await paymentMonitor.instance.initialize()
        await paymentMonitor.instance.startMonitoring()
        console.log('✅ Payment monitoring service started')
      } catch (error) {
        console.error('⚠️ Payment monitoring failed to start:', error)
      }
    } else {
      console.log('⚠️ Hive service validation failed - blockchain features may not work')
    }
  } else {
    console.log('⚠️ Hive configuration not found - blockchain features disabled')
  }

  serve({
    fetch: app.fetch,
    port
  }, (info) => {
    console.log(`🚀 Hivevoice server running on http://localhost:${info.port}`)
  })
}

startServer().catch(console.error)

export default app