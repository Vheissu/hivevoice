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

export interface CreateInvoiceRequest {
  clientName: string
  clientHiveAddress: string
  items: CreateInvoiceItem[]
  dueDate: string
  currency: SupportedCurrency
  tax?: number
  notifyClient?: boolean
}

export interface CreateInvoiceItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface InvoiceListResponse {
  invoices: Invoice[]
  total?: number
  page?: number
  limit?: number
}

export interface DashboardStats {
  totalInvoices: number
  totalRevenue: number
  pendingInvoices: number
  paidInvoices: number
  pendingRevenue: number
  recentInvoices: Invoice[]
}

export interface HiveAccount {
  username: string
  publicKeys?: {
    posting: string
    active: string
  }
}

export interface HiveAuthProvider {
  name: 'hivesigner' | 'keychain'
  isAvailable: boolean
}

export interface HiveTransferRequest {
  to: string
  amount: string
  memo: string
  currency: 'HIVE' | 'HBD'
}

export interface HiveAuthResponse {
  success: boolean
  account?: HiveAccount
  error?: string
}

export interface InvoiceShareLink {
  id: string
  token: string
  expiresAt?: Date
}

export interface CurrencyRate {
  currency: SupportedCurrency
  symbol: string
  name: string
  hiveRate: number
  hbdRate: number
  lastUpdated: string
}

export interface CurrenciesResponse {
  currencies: CurrencyRate[]
  timestamp: number
}

export interface ConvertAmountRequest {
  amount: number
  fromCurrency: SupportedCurrency
}

export interface ConvertAmountResponse {
  originalAmount: number
  originalCurrency: SupportedCurrency
  hiveAmount: number
  hbdAmount: number
  exchangeRate: {
    hive: number
    hbd: number
  }
  timestamp: number
}