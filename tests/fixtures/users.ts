import { getTestDb } from '../helpers/database';

export interface TestUser {
  id?: number;
  telegram_id: number;
  username?: string;
  full_name: string;
  role: 'admin' | 'manager' | 'barista' | 'client';
  is_active?: boolean;
}

export interface TestClient {
  id?: number;
  telegram_id?: number;
  card_number: string;
  full_name: string;
  phone?: string;
  birth_date?: string;
  balance?: number;
  total_spent?: number;
  visit_count?: number;
  notes?: string;
  is_active?: boolean;
}

export const TEST_USERS: TestUser[] = [
  {
    telegram_id: 123456789,
    username: 'admin_test',
    full_name: 'Test Administrator',
    role: 'admin',
    is_active: true
  },
  {
    telegram_id: 987654321,
    username: 'manager_test', 
    full_name: 'Test Manager',
    role: 'manager',
    is_active: true
  },
  {
    telegram_id: 555666777,
    username: 'barista_test',
    full_name: 'Test Barista',
    role: 'barista',
    is_active: true
  }
];

export const TEST_CLIENTS: TestClient[] = [
  {
    telegram_id: 111222333,
    card_number: 'TEST001',
    full_name: 'Иванов Иван Иванович',
    phone: '+79001234567',
    birth_date: '1990-06-15',
    balance: 100,
    total_spent: 1500,
    visit_count: 5,
    notes: 'Любит капучино',
    is_active: true
  },
  {
    telegram_id: 444555666,
    card_number: 'TEST002', 
    full_name: 'Петрова Мария Сергеевна',
    phone: '+79007654321',
    birth_date: '1985-12-25',
    balance: 50,
    total_spent: 800,
    visit_count: 3,
    notes: 'VIP клиент',
    is_active: true
  },
  {
    card_number: 'TEST003',
    full_name: 'Сидоров Петр Алексеевич', 
    phone: '+79009876543',
    balance: 0,
    total_spent: 200,
    visit_count: 1,
    is_active: true
  }
];

export async function createTestUsers(): Promise<TestUser[]> {
  // Skip database operations in mock mode
  console.log(`⚠️ Mock: Created ${TEST_USERS.length} test users`);
  return TEST_USERS;
}

export async function createTestClients(): Promise<TestClient[]> {
  // Skip database operations in mock mode
  console.log(`⚠️ Mock: Created ${TEST_CLIENTS.length} test clients`);
  return TEST_CLIENTS;
}

export function createMockContext(user: TestUser, message?: any): any {
  return {
    from: {
      id: user.telegram_id,
      username: user.username,
      first_name: user.full_name.split(' ')[0],
      last_name: user.full_name.split(' ')[1]
    },
    message: message || {
      chat: { id: user.telegram_id },
      message_id: 123,
      text: '/start'
    },
    session: {},
    bot: null // Will be set by individual tests
  };
}