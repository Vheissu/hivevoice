import { resolve } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IValidationRules } from '@aurelia/validation';
import { IAuthService } from '../services/auth';
import type { LoginRequest } from '../types/index';

export class Login {
  public credentials: LoginRequest = {
    username: '',
    password: ''
  };
  
  public isLoading = false;
  public error = '';

  constructor(
    private readonly authService: IAuthService = resolve(IAuthService),
    private readonly router: IRouter = resolve(IRouter),
    private readonly validationRules: IValidationRules = resolve(IValidationRules)
  ) {
    this.setupValidation();
  }

  private setupValidation() {
    this.validationRules
      .on(this.credentials)
      .ensure('username').required().withMessage('Username is required')
      .ensure('password').required().withMessage('Password is required');
  }

  async login() {
    this.isLoading = true;
    this.error = '';

    try {
      await this.authService.login(this.credentials);
      // If we get here, login was successful
      await this.router.load('/dashboard');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Login failed';
    } finally {
      this.isLoading = false;
    }
  }
}