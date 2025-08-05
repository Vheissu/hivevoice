import { IApiService } from '../services/api';
import { resolve } from 'aurelia';
import { IRouteViewModel } from '@aurelia/router';
import type { Invoice, SupportedCurrency } from '../types/index';

export class InvoiceDetail implements IRouteViewModel {
  public invoice: Invoice | null = null;
  public isLoading = true;
  public error = '';

  constructor(private readonly apiService: IApiService = resolve(IApiService)) {}

  async canLoad(params: { id?: string }): Promise<boolean> {
    if (!params.id) {
      this.error = 'Invalid invoice ID';
      return false;
    }
    return true;
  }

  async loading(params: { id: string }): Promise<void> {
    await this.loadInvoice(params.id);
  }

  private async loadInvoice(id: string) {
    this.isLoading = true;
    this.error = '';
    
    try {
      const response = await this.apiService.getInvoice(id);
      this.invoice = response.invoice;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load invoice';
    }
    
    this.isLoading = false;
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  formatDate(date: Date | string) {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  }

  print() {
    window.print();
  }

  getCurrencySymbol(currency: SupportedCurrency): string {
    const symbols = {
      USD: '$',
      GBP: '£',
      EUR: '€',
      AUD: 'A$',
      NZD: 'NZ$'
    };
    return symbols[currency] || currency;
  }

  formatConversionDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}