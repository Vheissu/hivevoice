import { DI } from 'aurelia';
import { KeychainSDK } from 'keychain-sdk';
import * as hivesigner from 'hivesigner';

export interface PaymentRequest {
  to: string;
  amount: string;
  currency: 'HIVE' | 'HBD';
  memo: string;
  from?: string;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  txId?: string;
}

export const IPaymentService = DI.createInterface<IPaymentService>('IPaymentService', x => x.singleton(PaymentService));

export interface IPaymentService {
  isHiveKeychainAvailable(): boolean;
  payWithHiveKeychain(request: PaymentRequest): Promise<PaymentResponse>;
  payWithHiveSigner(request: PaymentRequest): Promise<PaymentResponse>;
  getHiveSignerLoginUrl(redirectUri: string): string;
  handleHiveSignerCallback(accessToken: string, request: PaymentRequest): Promise<PaymentResponse>;
}

interface HiveKeychainResponse {
  success: boolean;
  message?: string;
  result?: {
    id?: string;
  };
}

interface HiveKeychainRequestCallback {
  (response: HiveKeychainResponse): void;
}

interface HiveKeychain {
  requestTransfer(
    from: string | null,
    to: string,
    amount: string,
    memo: string,
    currency: string,
    callback: HiveKeychainRequestCallback,
    enforce: boolean
  ): void;
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychain;
  }
}

export class PaymentService implements IPaymentService {
  private hiveSignerClient: hivesigner.Client;
  private keychainSDK: KeychainSDK | null = null;

  constructor() {
    this.hiveSignerClient = new hivesigner.Client({
      app: 'hivevoice',
      callbackURL: `${window.location.origin}/invoice/payment-callback`,
      scope: ['login', 'offline']
    });

    if (typeof window !== 'undefined') {
      this.keychainSDK = new KeychainSDK(window, {
        rpc: 'https://api.hive.blog'
      });
    }
  }

  isHiveKeychainAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.hive_keychain;
  }

  async payWithHiveKeychain(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isHiveKeychainAvailable()) {
      return {
        success: false,
        message: 'Hive Keychain is not installed. Please install the browser extension.'
      };
    }

    return new Promise((resolve) => {
      window.hive_keychain!.requestTransfer(
        request.from || null,
        request.to,
        request.amount,
        request.memo,
        request.currency,
        (response: HiveKeychainResponse) => {
          if (response.success) {
            resolve({
              success: true,
              message: 'Payment sent successfully via Hive Keychain',
              txId: response.result?.id
            });
          } else {
            resolve({
              success: false,
              message: response.message || 'Payment failed'
            });
          }
        },
        false
      );
    });
  }

  getHiveSignerLoginUrl(redirectUri: string): string {
    const loginUrl = this.hiveSignerClient.getLoginURL();
    return `${loginUrl}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async payWithHiveSigner(request: PaymentRequest): Promise<PaymentResponse> {
    // Store the request for later use after HiveSigner callback
    sessionStorage.setItem('hivevoice_payment_request', JSON.stringify(request));
    
    const currentUrl = window.location.href;
    const loginUrl = this.getHiveSignerLoginUrl(currentUrl);
    
    window.location.href = loginUrl;
    
    return {
      success: false,
      message: 'Redirecting to HiveSigner...'
    };
  }

  async handleHiveSignerCallback(accessToken: string, request: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.hiveSignerClient.setAccessToken(accessToken);
      
      const operation = [
        'transfer',
        {
          from: '__signer',
          to: request.to,
          amount: `${request.amount} ${request.currency}`,
          memo: request.memo
        }
      ];

      const result = await new Promise<{ id?: string }>((resolve, reject) => {
        this.hiveSignerClient.broadcast([operation], (err: Error | null, result: { id?: string }) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      return {
        success: true,
        message: 'Payment sent successfully via HiveSigner',
        txId: result.id
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }
}