// User and authentication types

export type UserRole = 'admin' | 'manager' | 'barista' | 'client';

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  full_name: string;
  role: UserRole;
  password_hash?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  telegram_id: number;
  username?: string;
  full_name: string;
  role: UserRole;
  password?: string;
}

export interface UpdateUserData {
  username?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface SessionData {
  user: User;
  waitingFor?: string;
  operation?: any;
  lastActivity: Date;
}