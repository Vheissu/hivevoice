import { IApiService } from '../services/api';
import { resolve } from 'aurelia';
import type { Invoice, SupportedCurrency } from '../types/index';

export class Invoices {
  public invoices: Invoice[] = [];
  public isLoading = true;
  public error = '';
  public searchTerm = '';
  public statusFilter = 'all';
  public currencyFilter = 'all';

  constructor(private readonly apiService: IApiService = resolve(IApiService)) {}

  async attached() {
    await this.loadInvoices();
  }

  private async loadInvoices() {
    this.isLoading = true;
    this.error = '';
    
    try {
      const response = await this.apiService.getInvoices();
      this.invoices = response.invoices || [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load invoices';
    }
    
    this.isLoading = false;
  }

  get filteredInvoices() {
    let filtered = this.invoices;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(invoice => 
        invoice.clientName.toLowerCase().includes(term) ||
        invoice.invoiceNumber.toLowerCase().includes(term) ||
        invoice.clientHiveAddress.toLowerCase().includes(term)
      );
    }
    
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === this.statusFilter);
    }

    if (this.currencyFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.currency === this.currencyFilter);
    }
    
    return filtered;
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

  formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
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

  get availableCurrencies(): SupportedCurrency[] {
    const currencies = new Set<SupportedCurrency>();
    this.invoices.forEach(invoice => currencies.add(invoice.currency));
    return Array.from(currencies).sort();
  }

  async deleteInvoice(invoice: Invoice) {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?`)) {
      return;
    }

    try {
      const response = await this.apiService.deleteInvoice(invoice.id);
      if (!response.error) {
        await this.loadInvoices();
      } else {
        alert(response.error);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete invoice');
    }
  }
}