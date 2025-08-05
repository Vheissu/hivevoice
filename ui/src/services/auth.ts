import { DI, observable, resolve } from 'aurelia';
import { IApiService } from './api';
import type { AuthUser, LoginRequest } from '../types/index';

export interface IAuthService {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(credentials: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  username: string | null;
}

export const IAuthService = DI.createInterface<IAuthService>('IAuthService', (x) => x.singleton(AuthService));

export class AuthService implements IAuthService {
  @observable currentUser: AuthUser | null = null;
  @observable isAuthenticated = false;
  @observable isLoading = true;

  constructor(private apiService: IApiService = resolve(IApiService)) {
    this.checkAuthStatus();
  }

  async login(credentials: LoginRequest): Promise<void> {
    try {
      const response = await this.apiService.login(credentials);
      if (response.user) {
        this.currentUser = response.user;
        this.isAuthenticated = true;
        localStorage.setItem('auth-user', JSON.stringify(response.user));
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      this.currentUser = null;
      this.isAuthenticated = false;
      localStorage.removeItem('auth-user');
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.currentUser = null;
      this.isAuthenticated = false;
      localStorage.removeItem('auth-user');
    }
  }

  private async checkAuthStatus(): Promise<void> {
    try {
      this.isLoading = true;
      
      // For development, check localStorage for stored auth state
      const storedUser = localStorage.getItem('auth-user');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        this.isAuthenticated = true;
      } else {
        // Try to check with backend (will fail gracefully if backend is not ready)
        try {
          const response = await this.apiService.getAuthStatus();
          if (response.authenticated && response.user) {
            this.currentUser = response.user;
            this.isAuthenticated = true;
            localStorage.setItem('auth-user', JSON.stringify(response.user));
          } else {
            this.currentUser = null;
            this.isAuthenticated = false;
          }
        } catch {
          // Backend not available, default to unauthenticated
          this.currentUser = null;
          this.isAuthenticated = false;
        }
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      this.currentUser = null;
      this.isAuthenticated = false;
    } finally {
      this.isLoading = false;
    }
  }

  get username(): string | null {
    return this.currentUser?.username || null;
  }
}