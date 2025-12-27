export type UserRole = 'admin' | 'cashier';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  created_at?: string;  // ✅ ADD THIS LINE

}
// src/types/index.ts
export interface Contractor {
  id: number;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit: number;
  total_credits: number;
  status: 'active' | 'inactive';
  created_at: string;
}
export interface Contractor {
  id: number;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  credit_limit: number;
  total_credits: number;
  status: 'active' | 'inactive';
}

export interface CreditTransaction {
  id: number;
  contractor_id: number;
  sale_id?: number;
  transaction_type: 'credit_sale' | 'payment' | 'adjustment';
  amount: number;
  description: string;
  balance_after: number;
  created_at: string;
  created_by: number;
}


export interface Item {
  id: number;
  name_en: string;
  name_ar: string;
  unit: string;
  price_per_unit: number;
  active: boolean;
}

export interface SaleItem {
  id?: number;
  item_id: number;
  item_name_en: string;
  item_name_ar: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export type PaymentMethod = 'knet' | 'cash' | 'cheque' | 'credit';

export interface Sale {
  id: number;
  sale_number: string;
  user_id: number;
  sale_date: string; // ISO string
  total_items_qty: number;
  subtotal: number;
  discount_amount: number;
  discount_percentage: number;
  total_amount: number;
  payment_method: PaymentMethod;
  knet_reference?: string;
  cheque_number?: string;
  status: 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  cancellation_reason?: string;
  items: SaleItem[];
  cashier_name?: string;
}

export interface Refund {
  id: number;
  refund_number: string;
  original_sale_id: number;
  original_sale_number: string;
  amount: number;
  reason: string;
  created_by_user_id: number;
  created_at: string;
  items_summary: string;
}

export interface AuditLog {
  id: number;
  action: string;
  user_name: string;
  details: string;
  timestamp: string;
}

export interface DailyReport {
  date: string;
  total_sales_count: number;
  total_revenue: number;
  sales_by_payment: { name: string; value: number }[];
  top_items: { name: string; value: number }[];
}