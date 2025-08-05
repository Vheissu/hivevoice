import { IApiService } from '../services/api';
import { resolve } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IValidationRules } from '@aurelia/validation';
import { IHiveAuthService } from '../services/hive-auth';
import type { CreateInvoiceRequest, CreateInvoiceItem, Invoice, CurrencyRate, ConvertAmountResponse } from '../types/index';

export class InvoiceCreate {
  public invoice: CreateInvoiceRequest = {
    clientName: '',
    clientHiveAddress: '',
    dueDate: '',
    currency: 'USD',
    items: [this.createEmptyItem()],
    tax: 0,
    notifyClient: true
  };

  public isLoading = false;
  public error = '';
  public taxRate = 8; // 8% tax rate
  public subtotal = 0;
  public total = 0;
  public shareableLink = '';
  public isGeneratingLink = false;
  
  // Currency-related properties
  public availableCurrencies: CurrencyRate[] = [];
  public isLoadingCurrencies = false;
  public conversionInfo: ConvertAmountResponse | null = null;
  

  // Expose hiveAuth to template
  get hiveAuth() {
    return this.hiveAuthService;
  }

  constructor(
    private readonly apiService: IApiService = resolve(IApiService),
    private readonly router: IRouter = resolve(IRouter),
    private readonly validationRules: IValidationRules = resolve(IValidationRules),
    private readonly hiveAuthService: IHiveAuthService = resolve(IHiveAuthService)
  ) {
    this.setupValidation();
  }

  async attached() {
    await this.loadCurrencies();
    this.calculateTotals();
  }

  private setupValidation() {
    this.validationRules
      .on(this.invoice)
      .ensure('clientName').required().withMessage('Client name is required')
      .ensure('clientHiveAddress').required().matches(/^@?[a-z][a-z0-9\-.]{2,15}$/i).withMessage('Valid Hive address is required (e.g., @beggars)')
      .ensure('dueDate').required().withMessage('Due date is required')
      .ensure('currency').required().withMessage('Currency is required');
  }

  private async loadCurrencies() {
    this.isLoadingCurrencies = true;
    try {
      const response = await this.apiService.getCurrencies();
      this.availableCurrencies = response.currencies;
    } catch (error) {
      console.error('Failed to load currencies:', error);
    } finally {
      this.isLoadingCurrencies = false;
    }
  }

  private createEmptyItem(): CreateInvoiceItem {
    return {
      description: '',
      quantity: 1,
      unitPrice: 0
    };
  }

  addItem() {
    if (!this.invoice.items) this.invoice.items = [];
    this.invoice.items.push(this.createEmptyItem());
  }

  removeItem(index: number) {
    if (this.invoice.items && this.invoice.items.length > 1) {
      this.invoice.items.splice(index, 1);
      this.calculateTotals();
    }
  }

  onItemChange() {
    // Ensure numeric values for all items
    this.invoice.items.forEach(item => {
      item.quantity = Number(item.quantity) || 1;
      item.unitPrice = Number(item.unitPrice) || 0;
    });
    
    // Calculate total for display purposes
    this.calculateTotals();
  }

  private calculateTotals() {
    if (!this.invoice.items) return;
    
    this.subtotal = this.invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    this.invoice.tax = (this.subtotal * this.taxRate) / 100;
    this.total = this.subtotal + this.invoice.tax;
    
    // Update conversion info when totals change
    this.updateConversion();
  }

  private updateConversion() {
    if (this.total <= 0) {
      this.conversionInfo = null;
      return;
    }

    // Find the selected currency rates
    const selectedCurrency = this.availableCurrencies.find(c => c.currency === this.invoice.currency);
    if (!selectedCurrency) {
      this.conversionInfo = null;
      return;
    }

    // Calculate conversion locally using the rates we already have
    // The rates represent: 1 HIVE = X currency units, so to convert FROM currency TO HIVE, we divide
    this.conversionInfo = {
      originalAmount: this.total,
      originalCurrency: this.invoice.currency,
      hiveAmount: parseFloat((this.total / selectedCurrency.hiveRate).toFixed(3)),
      hbdAmount: parseFloat((this.total / selectedCurrency.hbdRate).toFixed(2)),
      exchangeRate: {
        hive: selectedCurrency.hiveRate,
        hbd: selectedCurrency.hbdRate
      },
      timestamp: Date.now()
    };
  }

  onCurrencyChange() {
    this.updateConversion();
  }

  get selectedCurrency(): CurrencyRate | undefined {
    return this.availableCurrencies.find(c => c.currency === this.invoice.currency);
  }

  onTaxRateChange() {
    this.taxRate = Number(this.taxRate) || 0;
    this.calculateTotals();
  }


  async save() {
    this.isLoading = true;
    this.error = '';

    try {
      const response = await this.apiService.createInvoice(this.invoice);
      
      if (response.invoice) {
        // If notification is enabled, send the server-side transfer
        if (this.invoice.notifyClient) {
          await this.sendHiveNotification(response.invoice);
        }
        
        await this.router.load('/invoices');
      } else {
        this.error = 'Failed to create invoice';
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'An error occurred';
    } finally {
      this.isLoading = false;
    }
  }

  private async sendHiveNotification(invoice: Invoice) {
    console.log('Attempting to send server-side Hive notification...');
    
    try {
      const result = await this.apiService.sendHiveNotification(
        invoice.id,
        this.invoice.clientHiveAddress,
        `Invoice ${invoice.invoiceNumber} - Amount: $${invoice.total.toFixed(2)} - View: ${window.location.origin}/invoices/${invoice.id}`
      );
      
      console.log('Server-side transfer result:', result);
      
      if (result.data?.success) {
        console.log('✅ Server-side Hive transfer successful! TX ID:', result.data.txId);
      } else {
        console.warn('❌ Failed to send Hive notification:', result.error);
        // Don't fail the entire invoice creation if notification fails
      }
    } catch (error) {
      console.warn('Error sending Hive notification:', error);
      // Don't fail the entire invoice creation if notification fails
    }
  }

  cancel() {
    this.router.load('/invoices');
  }

  async generateShareableLink() {
    this.isGeneratingLink = true;
    try {
      // Generate a temporary preview link (in production, this would create a secure token)
      const tempInvoiceData = btoa(JSON.stringify({
        clientName: this.invoice.clientName,
        clientHiveAddress: this.invoice.clientHiveAddress,
        items: this.invoice.items,
        dueDate: this.invoice.dueDate,
        tax: this.invoice.tax,
        timestamp: Date.now()
      }));
      
      this.shareableLink = `${window.location.origin}/invoice/preview?data=${tempInvoiceData}`;
    } catch (error) {
      console.error('Error generating shareable link:', error);
    } finally {
      this.isGeneratingLink = false;
    }
  }

  copyToClipboard() {
    if (this.shareableLink) {
      navigator.clipboard.writeText(this.shareableLink).then(() => {
        // Could show a toast notification here
        console.log('Link copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy link:', err);
      });
    }
  }
}