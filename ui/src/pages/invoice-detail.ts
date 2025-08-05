import { IApiService } from '../services/api';
import { IPaymentService, PaymentRequest, PaymentResponse } from '../services/payment';
import { resolve } from 'aurelia';
import { IRouteViewModel } from '@aurelia/router';
import type { Invoice, SupportedCurrency, InvoicePayment } from '../types/index';

export class InvoiceDetail implements IRouteViewModel {
  public invoice: Invoice | null = null;
  public invoicePayments: InvoicePayment | null = null;
  public isLoading = true;
  public isLoadingPayments = false;
  public error = '';
  public paymentError = '';
  public paymentSuccess = '';
  public isProcessingPayment = false;
  public showPaymentModal = false;
  private currentInvoiceId = '';

  constructor(
    private readonly apiService: IApiService = resolve(IApiService),
    private readonly paymentService: IPaymentService = resolve(IPaymentService)
  ) {}

  async canLoad(params: { id?: string }): Promise<boolean> {
    if (!params.id) {
      this.error = 'Invalid invoice ID';
      return false;
    }
    return true;
  }

  async loading(params: { id: string }): Promise<void> {
    this.currentInvoiceId = params.id;
    await this.loadInvoice(params.id);
  }

  private async loadInvoice(id: string) {
    this.isLoading = true;
    this.error = '';
    
    try {
      const response = await this.apiService.getInvoice(id);
      this.invoice = response.invoice;
      
      // Load payment information if invoice is loaded successfully
      await this.loadPayments(id);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load invoice';
    }
    
    this.isLoading = false;
  }

  private async loadPayments(id: string) {
    this.isLoadingPayments = true;
    
    try {
      const response = await this.apiService.getInvoicePayments(id);
      this.invoicePayments = response.payments;
    } catch (error) {
      console.error('Failed to load payments:', error);
      // Don't show error for payments as it's not critical
    }
    
    this.isLoadingPayments = false;
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

  openPaymentModal() {
    this.showPaymentModal = true;
    this.paymentError = '';
    this.paymentSuccess = '';
  }

  closePaymentModal() {
    this.showPaymentModal = false;
  }

  get isHiveKeychainAvailable(): boolean {
    return this.paymentService.isHiveKeychainAvailable();
  }

  get canPayInvoice(): boolean {
    return this.invoice?.status === 'pending' || this.invoice?.status === 'partial';
  }

  async payWithHiveKeychain(currency: 'HIVE' | 'HBD') {
    if (!this.invoice || !this.canPayInvoice) {
      this.paymentError = 'Invoice cannot be paid';
      return;
    }

    this.isProcessingPayment = true;
    this.paymentError = '';

    try {
      let amount: string;
      if (currency === 'HIVE' && this.invoice.hiveConversion) {
        amount = this.invoice.hiveConversion.hiveAmount.toFixed(3);
      } else if (currency === 'HBD' && this.invoice.hiveConversion) {
        amount = this.invoice.hiveConversion.hbdAmount.toFixed(3);
      } else {
        this.paymentError = 'Conversion rates not available';
        return;
      }

      const request: PaymentRequest = {
        to: this.invoice.clientHiveAddress,
        amount,
        currency,
        memo: `Payment for Invoice ${this.invoice.invoiceNumber}`
      };

      const response: PaymentResponse = await this.paymentService.payWithHiveKeychain(request);
      
      if (response.success) {
        this.paymentSuccess = response.message;
        this.closePaymentModal();
        // Reload invoice and payments to show updated status
        await this.loadInvoice(this.currentInvoiceId);
      } else {
        this.paymentError = response.message;
      }
    } catch (error) {
      this.paymentError = error instanceof Error ? error.message : 'Payment failed';
    } finally {
      this.isProcessingPayment = false;
    }
  }

  async payWithHiveSigner(currency: 'HIVE' | 'HBD') {
    if (!this.invoice || !this.canPayInvoice) {
      this.paymentError = 'Invoice cannot be paid';
      return;
    }

    try {
      let amount: string;
      if (currency === 'HIVE' && this.invoice.hiveConversion) {
        amount = this.invoice.hiveConversion.hiveAmount.toFixed(3);
      } else if (currency === 'HBD' && this.invoice.hiveConversion) {
        amount = this.invoice.hiveConversion.hbdAmount.toFixed(3);
      } else {
        this.paymentError = 'Conversion rates not available';
        return;
      }

      const request: PaymentRequest = {
        to: this.invoice.clientHiveAddress,
        amount,
        currency,
        memo: `Payment for Invoice ${this.invoice.invoiceNumber}`
      };

      await this.paymentService.payWithHiveSigner(request);
    } catch (error) {
      this.paymentError = error instanceof Error ? error.message : 'Payment failed';
    }
  }
}