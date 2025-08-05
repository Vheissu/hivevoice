export interface Invoice {
  id: string
  invoiceNumber: string
  clientName: string
  clientHiveAddress: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  currency: SupportedCurrency
  hiveConversion?: HiveConversion
  status: InvoiceStatus
  createdAt: Date
  updatedAt: Date
  dueDate: Date
  hiveTransactionId?: string
  encryptedData?: string
  shareableLink?: string
}

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export type InvoiceStatus = 'pending' | 'partial' | 'paid'

export interface HiveConfig {
  username: string
  postingKey: string
  activeKey?: string
  memoKey?: string
  nodes: string[]
}

export interface DatabaseConfig {
  path: string
}

export interface AppConfig {
  port: number
  frontendUrl: string
  hive: HiveConfig
  database: DatabaseConfig
}

export interface AuthUser {
  username: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  message: string
  user?: AuthUser
}

export interface AuthStatusResponse {
  authenticated: boolean
  user?: AuthUser
}

export interface DashboardStats {
  totalInvoices: number
  totalRevenue: number
  pendingInvoices: number
  paidInvoices: number
  pendingRevenue: number
  recentInvoices: Invoice[]
}

export type SupportedCurrency = 'USD' | 'GBP' | 'EUR' | 'AUD' | 'NZD'

export interface HiveConversion {
  hiveAmount: number
  hbdAmount: number
  exchangeRate: {
    hive: number
    hbd: number
  }
  timestamp: number
}

export interface Payment {
  id: number
  invoiceId: string
  fromAccount: string
  amount: number
  currency: 'HIVE' | 'HBD'
  blockNumber: number
  transactionId: string
  createdAt: Date
}

export interface InvoicePayment {
  invoiceId: string
  payments: Payment[]
  totalPaid: {
    hive: number
    hbd: number
  }
  amountDue: {
    hive: number
    hbd: number
  }
}