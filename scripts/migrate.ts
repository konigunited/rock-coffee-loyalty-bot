#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigrations() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rock_coffee_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password_here',
  });

  try {
    console.log('🔗 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration file loaded');

    console.log('🚀 Running database migrations...');
    
    // Execute the entire migration as a single transaction
    try {
      await client.query('BEGIN');
      console.log('   Starting migration transaction...');
      
      await client.query(migrationSQL);
      
      await client.query('COMMIT');
      console.log('   Migration transaction completed successfully');
    } catch (error: any) {
      await client.query('ROLLBACK');
      
      // Check if it's just a "already exists" error
      if (error.code === '42P07' || error.code === '42710' || error.code === '42P06') {
        console.log('   ⚠️  Some objects already exist, continuing...');
      } else {
        throw error;
      }
    }

    console.log('✅ Database migrations completed successfully!');

    // Add default admin user if not exists
    console.log('👤 Setting up default admin user...');
    
    const adminCheckQuery = `
      SELECT id FROM users WHERE role = 'admin' AND telegram_id = 0;
    `;
    
    const existingAdmin = await client.query(adminCheckQuery);
    
    if (existingAdmin.rows.length === 0) {
      const createAdminQuery = `
        INSERT INTO users (telegram_id, username, full_name, role, is_active) 
        VALUES (0, 'system_admin', 'System Administrator', 'admin', true)
        ON CONFLICT (telegram_id) DO NOTHING;
      `;
      await client.query(createAdminQuery);
      console.log('✅ Default admin user created');
    } else {
      console.log('ℹ️  Default admin user already exists');
    }

    // Display connection info
    console.log('\n📊 Database setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    console.log(`📊 Database: ${process.env.DB_NAME || 'rock_coffee_bot'}`);
    console.log(`👤 User: ${process.env.DB_USER || 'postgres'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 You can now start the bot with: npm run dev');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migrations
if (require.main === module) {
  runMigrations().catch(console.error);
}

export default runMigrations;