import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  details: string;
  created_at: string;
  created_by: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  transaction_id: string;
  transaction_type: TransactionType;
  transaction_amount: number;
  transaction_details: string;
  original_created_by: string | null;
  original_created_at: string;
  deleted_by: string | null;
  deleted_at: string;
}
