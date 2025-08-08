import { DI, resolve } from 'aurelia';
import { IApiService } from './api';
import type { QRCodeRequest, QRCodeResponse } from '../types/index';

export interface IQRCodeService {
  generateQRCode(request: QRCodeRequest): Promise<QRCodeResponse>;
  generatePaymentQR(invoiceId: string, currency: 'HIVE' | 'HBD', amount?: string, memo?: string): Promise<QRCodeResponse>;
  generateInvoiceLinkQR(invoiceId: string): Promise<QRCodeResponse>;
  generateHiveAddressQR(hiveAddress: string): Promise<QRCodeResponse>;
}

export const IQRCodeService = DI.createInterface<IQRCodeService>('IQRCodeService', (x) => x.singleton(QRCodeService));

export class QRCodeService implements IQRCodeService {
  constructor(private readonly apiService: IApiService = resolve(IApiService)) {}

  async generateQRCode(request: QRCodeRequest): Promise<QRCodeResponse> {
    try {
      return await this.apiService.generateQRCode(request);
    } catch (error) {
      // For development, return a mock QR code response
      console.warn('QR Code service not available, using mock data:', error);
      
      let data: string;
      let type: string;
      
      switch (request.type) {
        case 'payment':
          data = `hive://transfer?to=${request.hiveAddress}&amount=${request.amount}&currency=${request.currency}&memo=${encodeURIComponent(request.memo || '')}`;
          type = 'Payment Link';
          break;
        case 'invoice-link':
          data = `${window.location.origin}/invoice/${request.invoiceId}`;
          type = 'Invoice Link';
          break;
        case 'hive-address':
          data = request.hiveAddress || '';
          type = 'Hive Address';
          break;
        default:
          data = 'Mock QR Data';
          type = 'Mock QR';
      }

      return {
        qrCode: `data:image/svg+xml;base64,${btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
            <rect width="300" height="300" fill="#f9fafb" stroke="#e5e7eb" stroke-width="2"/>
            <text x="150" y="140" text-anchor="middle" font-family="Arial" font-size="12" fill="#374151">
              QR Code Preview
            </text>
            <text x="150" y="160" text-anchor="middle" font-family="Arial" font-size="10" fill="#6b7280">
              ${type}
            </text>
            <text x="150" y="180" text-anchor="middle" font-family="Arial" font-size="8" fill="#9ca3af">
              Backend service required
            </text>
          </svg>
        `)}`,
        data,
        type
      };
    }
  }

  async generatePaymentQR(invoiceId: string, currency: 'HIVE' | 'HBD', amount?: string, memo?: string): Promise<QRCodeResponse> {
    return this.generateQRCode({
      type: 'payment',
      invoiceId,
      currency,
      amount,
      memo,
      size: 300
    });
  }

  async generateInvoiceLinkQR(invoiceId: string): Promise<QRCodeResponse> {
    return this.generateQRCode({
      type: 'invoice-link',
      invoiceId,
      size: 300
    });
  }

  async generateHiveAddressQR(hiveAddress: string): Promise<QRCodeResponse> {
    return this.generateQRCode({
      type: 'hive-address',
      hiveAddress,
      size: 300
    });
  }
}