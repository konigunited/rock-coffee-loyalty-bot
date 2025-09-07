// Simple JavaScript runner for quick testing
// This bypasses TypeScript compilation for immediate testing

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Rock Coffee Bot - Quick JS Runner');
console.log('=====================================');

try {
  // Try to run with ts-node directly
  console.log('📦 Running with ts-node...');
  
  const command = 'ts-node src/index.ts';
  execSync(command, { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

} catch (error) {
  console.error('❌ Failed to run with ts-node:', error.message);
  console.log('💡 Please try: npm install ts-node');
  console.log('💡 Or run: npm run build && npm start');
  process.exit(1);
}