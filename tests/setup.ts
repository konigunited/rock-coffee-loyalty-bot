import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'rock_coffee_bot_test';

// Extend Jest timeout for database operations
jest.setTimeout(30000);