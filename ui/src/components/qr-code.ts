import { customElement, bindable, observable, resolve } from 'aurelia';
import { IQRCodeService } from '../services/qr-code';
import type { QRCodeType, QRCodeResponse } from '../types/index';

export interface QRCodeProps {
  type: QRCodeType;
  invoiceId?: string;
  currency?: 'HIVE' | 'HBD';
  hiveAddress?: string;
  amount?: string;
  memo?: string;
  size?: number;
  showModal?: boolean;
  title?: string;
  subtitle?: string;
}

@customElement('qr-code')
export class QRCode {
  @bindable type: QRCodeType = 'hive-address';
  @bindable invoiceId?: string;
  @bindable currency?: 'HIVE' | 'HBD';
  @bindable hiveAddress?: string;
  @bindable amount?: string;
  @bindable memo?: string;
  @bindable size: number = 300;
  @bindable showModal: boolean = false;
  @bindable title?: string;
  @bindable subtitle?: string;

  @observable qrData: QRCodeResponse | null = null;
  @observable isLoading = false;
  @observable error: string | null = null;
  @observable showQRModal = false;

  constructor(private readonly qrCodeService: IQRCodeService = resolve(IQRCodeService)) {}

  async attached() {
    await this.generateQRCode();
  }

  async typeChanged() {
    await this.generateQRCode();
  }

  async invoiceIdChanged() {
    await this.generateQRCode();
  }

  async currencyChanged() {
    await this.generateQRCode();
  }

  async hiveAddressChanged() {
    await this.generateQRCode();
  }

  async amountChanged() {
    await this.generateQRCode();
  }

  async memoChanged() {
    await this.generateQRCode();
  }

  private async generateQRCode() {
    if (!this.shouldGenerateQR()) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      this.qrData = await this.qrCodeService.generateQRCode({
        type: this.type,
        invoiceId: this.invoiceId,
        currency: this.currency,
        hiveAddress: this.hiveAddress,
        amount: this.amount,
        memo: this.memo,
        size: this.size
      });
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to generate QR code';
      this.qrData = null;
    } finally {
      this.isLoading = false;
    }
  }

  private shouldGenerateQR(): boolean {
    switch (this.type) {
      case 'payment':
        return !!(this.invoiceId && this.currency && this.amount);
      case 'invoice-link':
        return !!this.invoiceId;
      case 'hive-address':
        return !!this.hiveAddress;
      default:
        return false;
    }
  }

  openModal() {
    this.showQRModal = true;
  }

  closeModal() {
    this.showQRModal = false;
  }

  copyToClipboard() {
    if (!this.qrData?.data) return;

    navigator.clipboard.writeText(this.qrData.data).then(() => {
      // You could add a toast notification here
      console.log('Copied to clipboard:', this.qrData!.data);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }

  downloadQR() {
    if (!this.qrData?.qrCode) return;

    const link = document.createElement('a');
    link.download = `qr-code-${this.type}.png`;
    link.href = this.qrData.qrCode;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  get displayTitle(): string {
    if (this.title) return this.title;
    
    switch (this.type) {
      case 'payment':
        return `Pay ${this.amount} ${this.currency}`;
      case 'invoice-link':
        return 'Invoice Link';
      case 'hive-address':
        return 'Hive Address';
      default:
        return 'QR Code';
    }
  }

  get displaySubtitle(): string {
    if (this.subtitle) return this.subtitle;
    
    switch (this.type) {
      case 'payment':
        return 'Scan to pay via HiveSigner';
      case 'invoice-link':
        return 'Share this invoice';
      case 'hive-address':
        return `@${this.hiveAddress}`;
      default:
        return '';
    }
  }
}