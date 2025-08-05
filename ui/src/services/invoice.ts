import { DI, observable, resolve } from "aurelia";
import { IApiService } from "./api";
import type {
  Invoice,
  CreateInvoiceRequest,
  DashboardStats,
} from "../types/index";

export interface IInvoiceService {
  loadInvoices(): Promise<void>;
  getInvoice(id: string): Promise<Invoice | null>;
  createInvoice(data: CreateInvoiceRequest): Promise<Invoice>;
  updateInvoice(
    id: string,
    data: Partial<CreateInvoiceRequest>
  ): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  getDashboardStats(): DashboardStats;
  getInvoicesByStatus(status: string): Invoice[];
  searchInvoices(query: string): Invoice[];
}

export const IInvoiceService = DI.createInterface<IInvoiceService>(
  "IInvoiceService",
  (x) => x.singleton(InvoiceService)
);

export class InvoiceService {
  @observable invoices: Invoice[] = [];
  @observable isLoading = false;
  @observable error: string | null = null;

  constructor(private apiService: IApiService = resolve(IApiService)) {}

  async loadInvoices(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      const response = await this.apiService.getInvoices();
      this.invoices = response.invoices || [];
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Failed to load invoices";
      this.invoices = [];
    } finally {
      this.isLoading = false;
    }
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    try {
      const response = await this.apiService.getInvoice(id);
      return response.invoice;
    } catch (error) {
      console.error("Failed to get invoice:", error);
      return null;
    }
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    try {
      this.isLoading = true;
      this.error = null;
      const response = await this.apiService.createInvoice(data);

      // Add to local collection
      this.invoices.push(response.invoice);

      return response.invoice;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Failed to create invoice";
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async updateInvoice(
    id: string,
    data: Partial<CreateInvoiceRequest>
  ): Promise<Invoice> {
    try {
      this.isLoading = true;
      this.error = null;
      const response = await this.apiService.updateInvoice(id, data);

      // Update local collection
      const index = this.invoices.findIndex((inv) => inv.id === id);
      if (index !== -1) {
        this.invoices[index] = response.invoice;
      }

      return response.invoice;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Failed to update invoice";
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteInvoice(id: string): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      await this.apiService.deleteInvoice(id);

      // Remove from local collection
      this.invoices = this.invoices.filter((inv) => inv.id !== id);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Failed to delete invoice";
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  getDashboardStats(): DashboardStats {
    const totalInvoices = this.invoices.length;
    const totalRevenue = this.invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.total, 0);
    const pendingInvoices = this.invoices.filter(
      (inv) => inv.status === "pending"
    ).length;
    const paidInvoices = this.invoices.filter(
      (inv) => inv.status === "paid"
    ).length;
    const recentInvoices = this.invoices
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    return {
      totalInvoices,
      totalRevenue,
      pendingInvoices,
      paidInvoices,
      recentInvoices,
    };
  }

  getInvoicesByStatus(status: string): Invoice[] {
    return this.invoices.filter((inv) => inv.status === status);
  }

  searchInvoices(query: string): Invoice[] {
    const searchTerm = query.toLowerCase();
    return this.invoices.filter(
      (inv) =>
        inv.clientName.toLowerCase().includes(searchTerm) ||
        inv.clientEmail.toLowerCase().includes(searchTerm) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm)
    );
  }
}
