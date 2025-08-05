export interface Invoice {
  id: string
  invoiceNumber: string
  clientName: string
  clientEmail: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  createdAt: Date
  updatedAt: Date
  dueDate: Date
  hiveTransactionId?: string
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