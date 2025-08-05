import { route, IRouter } from '@aurelia/router';
import { resolve } from 'aurelia';
import { IAuthService } from './services/auth';
import { IHiveAuthService } from './services/hive-auth';

@route({
  routes: [
    { path: '', redirectTo: 'dashboard' },
    { path: '/dashboard', component: import('./pages/dashboard'), title: 'Dashboard' },
    { path: '/invoices', component: import('./pages/invoices'), title: 'Invoices' },
    { path: '/invoices/create', component: import('./pages/invoice-create'), title: 'Create Invoice' },
    { path: '/invoices/:id', component: import('./pages/invoice-detail'), title: 'Invoice Details' },
    { path: '/login', component: import('./pages/login'), title: 'Login' },
    { path: '/hive-login', component: import('./pages/hive-login'), title: 'Hive Login' },
  ]
})
export class MyApp {
  constructor(
    private readonly authService: IAuthService = resolve(IAuthService),
    private readonly hiveAuth: IHiveAuthService = resolve(IHiveAuthService),
    private readonly router: IRouter = resolve(IRouter)
  ) {}

  async attached() {
    // Wait for auth service to finish loading
    if (this.authService.isLoading) {
      // You might want to show a loading spinner here
      return;
    }
    
    // Check if user is not authenticated with either system
    if (!this.authService.isAuthenticated && !this.hiveAuth.isAuthenticated) {
      await this.router.load('/hive-login');
    }
  }

  async logout() {
    await this.authService.logout();
    await this.hiveAuth.logout();
    await this.router.load('/hive-login');
  }

  get currentUser() {
    // Prefer Hive authentication over basic auth
    if (this.hiveAuth.isAuthenticated && this.hiveAuth.currentAccount) {
      return this.hiveAuth.currentAccount.username;
    }
    return this.authService.username;
  }

  get isAuthenticated() {
    return this.authService.isAuthenticated || this.hiveAuth.isAuthenticated;
  }
}
