import Database from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔄 Starting migration to phone-based authentication...');

async function runMigration() {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '002_phone_based_auth.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📂 Migration file loaded');

    // Execute migration
    console.log('⚡ Executing database migration...');
    await Database.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('🎯 Changes made:');
    console.log('   • Added phone-based authentication support');
    console.log('   • Added auth_method and profile_completed columns');
    console.log('   • Added first_name column for personalization');
    console.log('   • Created functions for phone-based client creation');
    console.log('   • Converted all card numbers to sequential format (1, 2, 3...)');
    console.log('   • Added unique indexes for phone lookups');
    console.log('');
    console.log('🚀 System is now ready for contact-based authentication!');
    console.log('');
    console.log('📋 What happens now:');
    console.log('   • Existing clients keep their telegram_id and can still login');
    console.log('   • New clients can login by sharing their phone contact');
    console.log('   • Card numbers are now simple: 1, 2, 3, 4, 5...');
    console.log('   • All client data is preserved and compatible');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await Database.close();
  }
}

// Check if we're running directly (not imported)
if (require.main === module) {
  runMigration();
}

export { runMigration };