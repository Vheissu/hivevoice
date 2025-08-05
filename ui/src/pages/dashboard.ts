import { IApiService } from '../services/api';
import { resolve } from 'aurelia';
import type { DashboardStats } from '../types/index';

export class Dashboard {
  public stats: DashboardStats | null = null;
  public isLoading = true;
  public error = '';

  constructor(private readonly apiService: IApiService = resolve(IApiService)) {}

  async attached() {
    await this.loadStats();
  }

  private async loadStats() {
    this.isLoading = true;
    this.error = '';
    
    try {
      const response = await this.apiService.getDashboardStats();
      
      if (response.data) {
        this.stats = response.data;
      } else {
        throw new Error(response.error || 'Failed to load dashboard stats');
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load dashboard stats';
    }
    
    this.isLoading = false;
  }
}