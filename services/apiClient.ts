import { User, Item, Sale, SaleItem, DailyReport, Refund, AuditLog, PaymentMethod } from '../types';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

  /**
   * Login with username and password
   * Backend returns user object and sets session
   */
  async login(username: string, password: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401) {
        return null; // Invalid credentials
      }

      const data = await handleResponse<{ user: User }>(response);
      return data.user;
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof APIError && err.status === 401) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Logout - clears backend session
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
      // Don't throw - just log it
    }
  }

  // ==================== ITEMS ====================

  /**
   * Get all active items
   */
  async getItems(): Promise<Item[]> {
    const response = await fetch(`${API_BASE}/items`, {
      credentials: 'include',
    });
    return handleResponse<Item[]>(response);
  }

  /**
   * Get single item by ID
   */
  async getItem(itemId: number): Promise<Item> {
    const response = await fetch(`${API_BASE}/items/${itemId}`, {
      credentials: 'include',
    });
    return handleResponse<Item>(response);
  }

  /**
   * Add new item (admin only)
   */
  async addItem(itemData: { name_en: string; name_ar: string; price_per_unit: number }): Promise<Item> {
    const response = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(itemData),
    });
    return handleResponse<Item>(response);
  }

  /**
   * Create item (alias for addItem)
   */
  async createItem(itemData: { name_en: string; name_ar: string; price_per_unit: number }): Promise<Item> {
    return this.addItem(itemData);
  }

  /**
   * Update item price (admin only)
   */
  async updateItemPrice(id: number, newPrice: number): Promise<Item> {
    const response = await fetch(`${API_BASE}/items/${id}/price`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ price_per_unit: newPrice }),
    });
    return handleResponse<Item>(response);
  }

  /**
   * Delete item (admin only)
   */
  async deleteItem(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean }>(response);
  }

  /**
   * Toggle item status (admin only)
   */
  async toggleItemStatus(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/items/${id}/status`, {
      method: 'PATCH',
      credentials: 'include',
    });
    await handleResponse<void>(response);
  }

  // ==================== SALES ====================

  /**
   * Create new sale
   * Validates KNET reference requirement and creates transaction
   */
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
    // Validation: KNET requires reference
    if (saleData.payment_method === 'knet' && !saleData.knet_reference?.trim()) {
      throw new Error('KNET reference is required for KNET payments');
    }

    // Validation: Cheque requires number
    if (saleData.payment_method === 'cheque' && !saleData.cheque_number?.trim()) {
      throw new Error('Cheque number is required for cheque payments');
    }

    const response = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(saleData),
    });

    return handleResponse<Sale>(response);
  }

  /**
   * Get all sales for a date (or all if no date)
   */
  async getSales(date?: string): Promise<Sale[]> {
    const url = new URL(`${API_BASE}/sales`);
    if (date) {
      url.searchParams.append('date', date);
    }

    const response = await fetch(url.toString(), {
      credentials: 'include',
    });

    return handleResponse<Sale[]>(response);
  }

  /**
   * Get daily sales for CSV export
   */
  async getDailySales(date: string): Promise<Sale[]> {
    return this.getSales(date);
  }

  /**
   * Get sale by number (for refunds)
   * Used to look up original sale before processing refund
   */
  async getSaleByNumber(saleNumber: string): Promise<Sale | undefined> {
    try {
      const response = await fetch(
        `${API_BASE}/sales/${encodeURIComponent(saleNumber)}`,
        {
          credentials: 'include',
        }
      );

      if (response.status === 404) {
        return undefined;
      }

      return handleResponse<Sale>(response);
    } catch (err) {
      if (err instanceof APIError && err.status === 404) {
        return undefined;
      }
      throw err;
    }
  }

  /**
   * Get sale by sale number (alias for getSaleByNumber)
   */
  async getSale(saleNumber: string): Promise<Sale | undefined> {
    return this.getSaleByNumber(saleNumber);
  }

  // ==================== REFUNDS ====================

  /**
   * Create refund for a sale
   * Links refund to original sale and marks it as refunded
   */
  async createRefund(
    saleId: number,
    amount: number,
    reason: string
  ): Promise<Refund> {
    // Validation
    if (!reason?.trim()) {
      throw new Error('Refund reason is required');
    }

    if (amount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }

    const response = await fetch(`${API_BASE}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        sale_id: saleId,
        amount,
        reason: reason.trim(),
      }),
    });

    return handleResponse<Refund>(response);
  }

  /**
   * Get all refunds
   */
  async getRefunds(): Promise<Refund[]> {
    const response = await fetch(`${API_BASE}/refunds`, {
      credentials: 'include',
    });

    return handleResponse<Refund[]>(response);
  }

  /**
   * Get single refund by number
   */
  async getRefund(refundNumber: string): Promise<Refund> {
    const response = await fetch(
      `${API_BASE}/refunds/${encodeURIComponent(refundNumber)}`,
      {
        credentials: 'include',
      }
    );

    return handleResponse<Refund>(response);
  }

  // ==================== REPORTS & ANALYTICS ====================

  /**
   * Get daily report for a specific date
   * Includes KPIs: total revenue, sales count, breakdown by payment method, top items
   */
  async getDailyReport(dateStr: string): Promise<DailyReport> {
    const response = await fetch(
      `${API_BASE}/reports/daily?date=${encodeURIComponent(dateStr)}`,
      {
        credentials: 'include',
      }
    );

    return handleResponse<DailyReport>(response);
  }

  /**
   * Export sales data as CSV
   * Downloads file directly
   */
  async exportSalesCSV(dateStr: string): Promise<Blob> {
    const response = await fetch(
      `${API_BASE}/reports/sales-csv?date=${encodeURIComponent(dateStr)}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new APIError(
        response.status,
        'Failed to export sales data'
      );
    }

    return response.blob();
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Get audit logs (admin only)
   * Returns all logged actions with timestamps
   */
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const url = new URL(`${API_BASE}/audit-logs`);
    url.searchParams.append('limit', limit.toString());

    const response = await fetch(url.toString(), {
      credentials: 'include',
    });

    return handleResponse<AuditLog[]>(response);
  }

  /**
   * Get audit logs by action
   */
  async getAuditLogsByAction(action: string): Promise<AuditLog[]> {
    const url = new URL(`${API_BASE}/audit-logs`);
    url.searchParams.append('action', action);

    const response = await fetch(url.toString(), {
      credentials: 'include',
    });

    return handleResponse<AuditLog[]>(response);
  }

  // ==================== UTILITY ====================

  /**
   * Helper to trigger file download from blob
   */
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

  /**
   * Get base API URL (for debugging)
   */
  getBaseURL(): string {
    return API_BASE;
  }

  /**
   * Check if authenticated (checks if we can make requests)
   */
  isAuthenticated(): boolean {
    // With cookie-based sessions, always return true
    // Backend will handle 401 for invalid sessions
    return true;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return { status: 'unhealthy', connected: false };
      }

      const data = await response.json();
      return { status: 'healthy', connected: true, ...data };
    } catch (err) {
      console.error('Health check failed:', err);
      return { status: 'unhealthy', connected: false };
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Also export as 'db' for backward compatibility
export const db = apiClient;