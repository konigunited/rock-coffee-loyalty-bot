// Client data types with strict access control

// Limited client data for barista role
export interface BaristaClientView {
  id: number;
  card_number: string;
  full_name: string;
  first_name?: string;
  balance: number;
  notes: string | null;
  last_visit: string | null;
  visit_count: number;
  is_active: boolean;
  auth_method?: string;
  profile_completed?: boolean;
  // Extended fields available in some contexts (but still NO direct access to phone/birth_date for baristas)
  total_spent?: number;
  total_transactions?: number;
  created_at?: string;
  phone?: string;
  birth_date?: string;
  telegram_id?: number;
}

// Full client data for manager/admin roles
export interface ManagerClientView extends BaristaClientView {
  telegram_id: number | null;
  phone: string | null;
  birth_date: string | null;
  first_name: string | null;
  total_spent: number;
  total_transactions: number;
  created_at: string;
  updated_at: string;
  is_birthday_soon: boolean;
  auth_method: string;
  profile_completed: boolean;
}

// Client creation/update interfaces
export interface CreateClientData {
  telegram_id?: number;
  card_number: string;
  full_name: string;
  phone?: string;
  birth_date?: string;
  notes?: string;
}

export interface UpdateClientData {
  full_name?: string;
  phone?: string;
  birth_date?: string;
  notes?: string;
}

// Search result interface
export interface ClientSearchResult {
  id: number;
  card_number: string;
  full_name: string;
  balance: number;
}