import { User, Item, Sale, SaleItem, DailyReport, Refund, AuditLog, PaymentMethod, Contractor } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ✅ JWT Helper - Get auth headers with token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Error handler utility
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    let errorMessage = `HTTP ${response.status}`;

    if (contentType?.includes('application/json')) {
      try {
        const data = await response.json();
        errorMessage = data.error || data.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
    } else {
      errorMessage = response.statusText || errorMessage;
    }

    throw new APIError(response.status, errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return (await response.text()) as unknown as T;
}

class APIClient {
  // ==================== AUTHENTICATION ====================

  async login(username: string, password: string): Promise<{ user: User; token: string } | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401) return null;

      const data = await handleResponse<{ user: User; token: string }>(response);
      // ✅ Store JWT token
      localStorage.setItem('token', data.token);
      return data;
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof APIError && err.status === 401) return null;
      throw err;
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } finally {
      // ✅ Clear JWT token
      localStorage.removeItem('token');
    }
  }

  async checkSession(): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await handleResponse<{ user: User }>(response);
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  async createUser(username: string, password: string, role: 'admin' | 'cashier'): Promise<User> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, password, role }),
    });
    return handleResponse<User>(response);
  }

// ==================== ITEMS ====================
  async getUsers(): Promise<User[]> {  // ✅ Add proper indentation and context
    const response = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<User[]>(response);
  }

  async getItems(): Promise<Item[]> {
    const response = await fetch(`${API_BASE}/items`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Item[]>(response);
  }

  async getItem(itemId: number): Promise<Item> {
    const response = await fetch(`${API_BASE}/items/${itemId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Item>(response);
  }

  async addItem(itemData: { name_en: string; name_ar: string; price_per_unit: number }): Promise<Item> {
    const response = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(itemData),
    });
    return handleResponse<Item>(response);
  }

  async createItem(itemData: { name_en: string; name_ar: string; price_per_unit: number }): Promise<Item> {
    return this.addItem(itemData);
  }

  async updateItemPrice(id: number, newPrice: number): Promise<Item> {
    const response = await fetch(`${API_BASE}/items/${id}/price`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ price_per_unit: newPrice }),
    });
    return handleResponse<Item>(response);
  }

  async deleteItem(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ success: boolean }>(response);
  }

  async toggleItemStatus(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/items/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    await handleResponse<void>(response);
  }

  // ==================== SALES ====================

  async createSale(saleData: {
    items: SaleItem[];
    subtotal: number;
    discount_amount: number;
    discount_percentage: number;
    total_amount: number;
    payment_method: PaymentMethod;
    knet_reference?: string;
    cheque_number?: string;
    notes: string;
  }): Promise<Sale> {
    if (saleData.payment_method === 'knet' && !saleData.knet_reference?.trim()) {
      throw new Error('KNET reference is required for KNET payments');
    }
    if (saleData.payment_method === 'cheque' && !saleData.cheque_number?.trim()) {
      throw new Error('Cheque number is required for cheque payments');
    }

    const response = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(saleData),
    });
    return handleResponse<Sale>(response);
  }

  async getSales(date?: string): Promise<Sale[]> {
    const url = new URL(`${API_BASE}/sales`);
    if (date) url.searchParams.append('date', date);

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(),
    });
    return handleResponse<Sale[]>(response);
  }

  async getDailySales(date: string): Promise<Sale[]> {
    return this.getSales(date);
  }

  async getSaleByNumber(saleNumber: string): Promise<Sale | undefined> {
    try {
      const response = await fetch(`${API_BASE}/sales/${encodeURIComponent(saleNumber)}`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 404) return undefined;
      return handleResponse<Sale>(response);
    } catch (err) {
      if (err instanceof APIError && err.status === 404) return undefined;
      throw err;
    }
  }

  async getSale(saleNumber: string): Promise<Sale | undefined> {
    return this.getSaleByNumber(saleNumber);
  }

  // ==================== REFUNDS ====================

  async createRefund(saleId: number, amount: number, reason: string): Promise<Refund> {
    if (!reason?.trim()) throw new Error('Refund reason is required');
    if (amount <= 0) throw new Error('Refund amount must be greater than 0');

    const response = await fetch(`${API_BASE}/refunds`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sale_id: saleId, amount, reason: reason.trim() }),
    });
    return handleResponse<Refund>(response);
  }

  async getRefunds(): Promise<Refund[]> {
    const response = await fetch(`${API_BASE}/refunds`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Refund[]>(response);
  }

  async getRefund(refundNumber: string): Promise<Refund> {
    const response = await fetch(`${API_BASE}/refunds/${encodeURIComponent(refundNumber)}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Refund>(response);
  }

  // ==================== REPORTS ====================

  async getDailyReport(dateStr: string): Promise<DailyReport> {
    const response = await fetch(
      `${API_BASE}/reports/daily?date=${encodeURIComponent(dateStr)}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<DailyReport>(response);
  }

  async exportSalesCSV(dateStr: string): Promise<Blob> {
    const response = await fetch(
      `${API_BASE}/reports/sales-csv?date=${encodeURIComponent(dateStr)}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) throw new APIError(response.status, 'Failed to export sales data');
    return response.blob();
  }
  
async getContractors(): Promise<Contractor[]> {
  const response = await fetch(`${API_BASE}/contractors`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Contractor[]>(response);
}

  async getContractor(id: number): Promise<Contractor> {
    const response = await fetch(`${API_BASE}/contractors/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Contractor>(response);
  }

  async createContractor(data: Partial<Contractor>): Promise<Contractor> {
    const response = await fetch(`${API_BASE}/contractors`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Contractor>(response);
  }

async createCreditSale(saleData: {
  contractor_id: number;
  items: SaleItem[];
  subtotal: number;
  discount_amount: number;
  discount_percentage: number;
  total_amount: number;
  notes: string;
}): Promise<Sale> {
  const response = await fetch(`${API_BASE}/credit-sales`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(saleData),
  });
  const result = await handleResponse<any>(response);
  console.log('API Client - createCreditSale result:', result);
  
  // Unwrap the response if it's wrapped in {sale: ..., contractor_balance: ...}
  const sale = result.sale || result;
  console.log('API Client - unwrapped sale:', sale);
  console.log('API Client - sale_number:', sale?.sale_number);
  console.log('API Client - total_amount:', sale?.total_amount);
  
  // If items are missing, add them from the request data
  if (!sale.items || sale.items.length === 0) {
    sale.items = saleData.items;
  }
  
  return sale;
}

async processPayment(contractor_id: number, amount: number, payment_method: string, description: string) {
  const response = await fetch(`${API_BASE}/credit-payments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ contractor_id, amount, payment_method, description }),
  });
  return handleResponse(response);
}

async getCreditReport(contractorId: number) {
  const response = await fetch(`${API_BASE}/credit-report/${contractorId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

  // ==================== AUDIT LOGS ====================

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const url = new URL(`${API_BASE}/audit-logs`);
    url.searchParams.append('limit', limit.toString());
    const response = await fetch(url.toString(), { headers: getAuthHeaders() });
    return handleResponse<AuditLog[]>(response);
  }

  async getAuditLogsByAction(action: string): Promise<AuditLog[]> {
    const url = new URL(`${API_BASE}/audit-logs`);
    url.searchParams.append('action', action);
    const response = await fetch(url.toString(), { headers: getAuthHeaders() });
    return handleResponse<AuditLog[]>(response);
  }

  // ==================== UTILITY ====================

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  getBaseURL(): string {
    return API_BASE;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    try {
      const response = await fetch(`${API_BASE}/health`, { headers: getAuthHeaders() });
      if (!response.ok) return { status: 'unhealthy', connected: false };
      const data = await response.json();
      return { status: 'healthy', connected: true, ...data };
    } catch {
      return { status: 'unhealthy', connected: false };
    }
  }
}

export const apiClient = new APIClient();
export const db = apiClient;
