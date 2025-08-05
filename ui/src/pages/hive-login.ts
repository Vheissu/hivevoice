import { resolve } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IHiveAuthService } from '../services/hive-auth';
import type { HiveAuthProvider } from '../types/index';

export class HiveLogin {
  public availableProviders: HiveAuthProvider[] = [];
  public isLoading = false;
  public error = '';

  constructor(
    private readonly hiveAuth: IHiveAuthService = resolve(IHiveAuthService),
    private readonly router: IRouter = resolve(IRouter)
  ) {}

  async attached() {
    this.isLoading = true;
    try {
      this.availableProviders = await this.hiveAuth.detectProviders();
    } catch {
      this.error = 'Failed to detect Hive authentication providers';
    } finally {
      this.isLoading = false;
    }
  }

  async loginWithKeychain() {
    this.isLoading = true;
    this.error = '';

    try {
      const result = await this.hiveAuth.loginWithKeychain();
      
      if (result.success) {
        await this.router.load('/dashboard');
      } else {
        this.error = result.error || 'Keychain login failed';
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'An error occurred during login';
    } finally {
      this.isLoading = false;
    }
  }

  async loginWithHiveSigner() {
    this.isLoading = true;
    this.error = '';

    try {
      const result = await this.hiveAuth.loginWithHiveSigner();
      
      if (result.success) {
        await this.router.load('/dashboard');
      } else {
        this.error = result.error || 'HiveSigner login failed';
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'An error occurred during login';
    } finally {
      this.isLoading = false;
    }
  }

  getKeychainProvider() {
    return this.availableProviders.find(p => p.name === 'keychain');
  }

  getHiveSignerProvider() {
    return this.availableProviders.find(p => p.name === 'hivesigner');
  }
}