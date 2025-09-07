import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

let testDb: Pool;

export async function setupTestDatabase(): Promise<void> {
  // Skip database setup in tests for now
  console.log('⚠️ Skipping database setup (mock mode)');
  return;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.end();
    console.log('✅ Test database disconnected');
  }
}

export async function clearTestData(): Promise<void> {
  if (!testDb) return;

  try {
    // Clear all tables in reverse dependency order
    await testDb.query('TRUNCATE TABLE broadcast_recipients, activity_log, point_transactions, broadcasts, clients, users RESTART IDENTITY CASCADE');
    console.log('✅ Test data cleared');
  } catch (error) {
    console.error('❌ Failed to clear test data:', error);
  }
}

export function getTestDb(): any {
  // Return mock database for testing
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn()
  };
}

async function createTestDatabase(): Promise<void> {
  // Connect to postgres database to create test database
  const adminDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '7R4P5T4R',
    database: 'postgres'
  });

  try {
    await adminDb.query(`CREATE DATABASE ${process.env.DB_NAME || 'rock_coffee_bot_test'}`);
    console.log('✅ Test database created');
  } catch (error: any) {
    if (error.code !== '42P04') { // Database already exists
      throw error;
    }
  } finally {
    await adminDb.end();
  }

  // Reconnect to the new test database
  testDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '7R4P5T4R',
    database: process.env.DB_NAME || 'rock_coffee_bot_test'
  });
}

async function runMigrations(): Promise<void> {
  const migrationPath = path.join(__dirname, '../../migrations/001_basic_schema.sql');
  
  if (fs.existsSync(migrationPath)) {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await testDb.query(migrationSQL);
  }
}

// Mock bot for testing
export class MockTelegramBot {
  public sentMessages: Array<{
    chatId: number;
    text: string;
    options?: any;
  }> = [];

  public editedMessages: Array<{
    text: string;
    options: any;
  }> = [];

  async sendMessage(chatId: number, text: string, options?: any): Promise<any> {
    this.sentMessages.push({ chatId, text, options });
    return {
      message_id: Math.floor(Math.random() * 1000),
      chat: { id: chatId },
      text
    };
  }

  async editMessageText(text: string, options: any): Promise<any> {
    this.editedMessages.push({ text, options });
    return true;
  }

  async answerCallbackQuery(callbackQueryId: string): Promise<boolean> {
    return true;
  }

  clearHistory(): void {
    this.sentMessages = [];
    this.editedMessages = [];
  }

  getLastMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getLastEdit(): any {
    return this.editedMessages[this.editedMessages.length - 1];
  }
}