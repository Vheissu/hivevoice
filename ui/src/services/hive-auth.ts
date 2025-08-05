import { DI } from 'aurelia';
import type { HiveAccount, HiveAuthProvider, HiveAuthResponse, HiveTransferRequest } from '../types/index';

export interface IHiveAuthService {
  readonly availableProviders: HiveAuthProvider[];
  readonly currentAccount: HiveAccount | null;
  readonly isAuthenticated: boolean;
  
  detectProviders(): Promise<HiveAuthProvider[]>;
  loginWithKeychain(): Promise<HiveAuthResponse>;
  loginWithHiveSigner(): Promise<HiveAuthResponse>;
  logout(): Promise<void>;
  transfer(request: HiveTransferRequest): Promise<{ success: boolean; txId?: string; error?: string }>;
}

declare global {
  interface Window {
    hive_keychain?: {
      requestSignin: (account: string, message: string, method: string, callback: (response: { success: boolean; data?: { username: string }; publicKey?: string; message?: string }) => void) => void;
      requestTransfer: (account: string, to: string, amount: string, memo: string, currency: string, callback: (response: { success: boolean; result?: { id: string }; message?: string }) => void) => void;
    };
  }
}

export class HiveAuthService implements IHiveAuthService {
  private _currentAccount: HiveAccount | null = null;
  private _availableProviders: HiveAuthProvider[] = [];

  get availableProviders(): HiveAuthProvider[] {
    return [...this._availableProviders];
  }

  get currentAccount(): HiveAccount | null {
    return this._currentAccount;
  }

  get isAuthenticated(): boolean {
    return this._currentAccount !== null;
  }

  async detectProviders(): Promise<HiveAuthProvider[]> {
    const providers: HiveAuthProvider[] = [];

    // Check for Hive Keychain
    if (typeof window !== 'undefined' && window.hive_keychain) {
      providers.push({
        name: 'keychain',
        isAvailable: true
      });
    }

    // Check for HiveSigner (we'll implement this as a popup/redirect)
    providers.push({
      name: 'hivesigner',
      isAvailable: true
    });

    this._availableProviders = providers;
    return providers;
  }

  async loginWithKeychain(): Promise<HiveAuthResponse> {
    return new Promise((resolve) => {
      if (!window.hive_keychain) {
        resolve({
          success: false,
          error: 'Hive Keychain is not installed. Please install the browser extension.'
        });
        return;
      }

      const message = `Login to HiveVoice at ${new Date().toISOString()}`;
      
      // For demo purposes, we'll use a test account. In production, this should be dynamic
      const testAccount = 'beggars'; // You can change this to your actual account
      
      window.hive_keychain.requestSignin(testAccount, message, 'Posting', (response) => {
        if (response.success) {
          this._currentAccount = {
            username: response.data.username || testAccount,
            publicKeys: {
              posting: response.publicKey,
              active: '' // We only need posting key for our use case
            }
          };
          
          resolve({
            success: true,
            account: this._currentAccount
          });
        } else {
          resolve({
            success: false,
            error: response.message || 'Keychain authentication failed'
          });
        }
      });
    });
  }

  async loginWithHiveSigner(): Promise<HiveAuthResponse> {
    // For development, we'll simulate HiveSigner login
    // In production, this would redirect to HiveSigner OAuth
    return new Promise((resolve) => {
      // Simulate HiveSigner popup/redirect flow
      const username = prompt('Enter your Hive username for HiveSigner (demo):');
      
      if (username && username.trim()) {
        this._currentAccount = {
          username: username.trim().replace('@', ''),
          publicKeys: {
            posting: 'demo_posting_key',
            active: 'demo_active_key'
          }
        };
        
        resolve({
          success: true,
          account: this._currentAccount
        });
      } else {
        resolve({
          success: false,
          error: 'HiveSigner authentication cancelled'
        });
      }
    });
  }

  async logout(): Promise<void> {
    this._currentAccount = null;
  }

  async transfer(request: HiveTransferRequest): Promise<{ success: boolean; txId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this._currentAccount) {
        resolve({
          success: false,
          error: 'Not authenticated. Please login first.'
        });
        return;
      }

      console.log('Processing transfer request:', {
        from: this._currentAccount.username,
        to: request.to,
        amount: request.amount,
        currency: request.currency,
        memo: request.memo.substring(0, 50) + '...'
      });

      // Try Keychain first if available
      if (window.hive_keychain) {
        console.log('Using Hive Keychain for transfer...');
        window.hive_keychain.requestTransfer(
          this._currentAccount.username,
          request.to.replace('@', ''),
          request.amount,
          request.memo,
          request.currency,
          (response) => {
            console.log('Keychain response:', response);
            if (response.success) {
              resolve({
                success: true,
                txId: response.result?.id || 'keychain_transfer'
              });
            } else {
              resolve({
                success: false,
                error: response.message || 'Transfer failed'
              });
            }
          }
        );
      } else if (this._currentAccount.username !== 'demo_user') {
        // If we have a real username but no Keychain, try HiveSigner broadcast
        console.log('Keychain not available, attempting HiveSigner broadcast...');
        this.broadcastWithHiveSigner(request).then(resolve);
      } else {
        // Fallback to simulated transfer for demo
        console.log('🎭 Demo mode: Simulating transfer...');
        resolve({
          success: true,
          txId: `demo_tx_${Date.now()}`,
          error: 'This is a demo transfer - no actual HIVE was sent. Install Hive Keychain or use HiveSigner for real transfers.'
        });
      }
    });
  }

  private async broadcastWithHiveSigner(request: HiveTransferRequest): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      // In a real implementation, this would use the HiveSigner API
      // For now, we'll create a link that opens HiveSigner
      const hivesignerUrl = `https://hivesigner.com/sign/transfer?from=${this._currentAccount?.username}&to=${request.to}&amount=${request.amount}%20${request.currency}&memo=${encodeURIComponent(request.memo)}`;
      
      console.log('HiveSigner URL:', hivesignerUrl);
      
      // Open HiveSigner in a new window
      const popup = window.open(hivesignerUrl, 'hivesigner', 'width=500,height=600');
      
      if (!popup) {
        return {
          success: false,
          error: 'Popup blocked. Please allow popups and try again.'
        };
      }

      // For demo purposes, we'll return success after a delay
      // In a real app, you'd listen for the popup to close and check the result
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            txId: `hivesigner_tx_${Date.now()}`,
            error: 'HiveSigner popup opened. Complete the transaction there.'
          });
        }, 1000);
      });

    } catch (error) {
      return {
        success: false,
        error: `HiveSigner error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const IHiveAuthService = DI.createInterface<IHiveAuthService>('IHiveAuthService', (x) => x.singleton(HiveAuthService));