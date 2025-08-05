import fetch from 'node-fetch'

export type SupportedCurrency = 'USD' | 'GBP' | 'EUR' | 'AUD' | 'NZD'

export interface ExchangeRates {
  hive: { [key in Lowercase<SupportedCurrency>]: number }
  hive_dollar: { [key in Lowercase<SupportedCurrency>]: number }
  timestamp: number
}

export interface ConversionResult {
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

class CurrencyService {
  private static instance: CurrencyService
  private rates: ExchangeRates | null = null
  private lastFetchTime = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price'

  static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService()
    }
    return CurrencyService.instance
  }

  async getExchangeRates(): Promise<ExchangeRates> {
    const now = Date.now()
    
    if (!this.rates || (now - this.lastFetchTime) > this.CACHE_DURATION) {
      await this.fetchRates()
    }
    
    if (!this.rates) {
      throw new Error('Unable to fetch exchange rates')
    }
    
    return this.rates
  }

  private async fetchRates(): Promise<void> {
    try {
      const currencies = 'usd,gbp,eur,aud,nzd'
      const url = `${this.COINGECKO_API}?ids=hive,hive_dollar&vs_currencies=${currencies}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }
      
      const data = await response.json() as any
      
      if (!data['hive'] || !data['hive_dollar']) {
        throw new Error('Invalid response from CoinGecko API')
      }
      
      this.rates = {
        hive: data['hive'],
        hive_dollar: data['hive_dollar'],
        timestamp: Date.now()
      }
      
      this.lastFetchTime = Date.now()
      console.log('Exchange rates updated:', this.rates)
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      throw error
    }
  }

  async convertCurrency(amount: number, fromCurrency: SupportedCurrency): Promise<ConversionResult> {
    const rates = await this.getExchangeRates()
    const currencyKey = fromCurrency.toLowerCase() as Lowercase<SupportedCurrency>
    
    const hiveRate = rates.hive[currencyKey]
    const hbdRate = rates.hive_dollar[currencyKey]
    
    if (!hiveRate || !hbdRate) {
      throw new Error(`Exchange rate not available for ${fromCurrency}`)
    }
    
    const hiveAmount = amount / hiveRate
    const hbdAmount = amount / hbdRate
    
    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      hiveAmount,
      hbdAmount,
      exchangeRate: {
        hive: hiveRate,
        hbd: hbdRate
      },
      timestamp: rates.timestamp
    }
  }

  getSupportedCurrencies(): SupportedCurrency[] {
    return ['USD', 'GBP', 'EUR', 'AUD', 'NZD']
  }

  formatCurrency(amount: number, currency: SupportedCurrency): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return formatter.format(amount)
  }

  formatHive(amount: number, token: 'HIVE' | 'HBD'): string {
    return `${amount.toFixed(3)} ${token}`
  }
}

export const currencyService = CurrencyService.getInstance()