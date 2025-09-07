// Simple bot starter without TypeScript complexity
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

console.log('🤖 Starting Rock Coffee Bot (Simple Mode)...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');

// Check token
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found in .env file');
  process.exit(1);
}

console.log('🔗 Token found:', process.env.BOT_TOKEN.substring(0, 10) + '...');

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log('✅ Telegram Bot initialized and polling...');

// Simple start command
bot.onText(/\/start/, async (msg) => {
  console.log('📨 Received /start from:', msg.from?.id);
  
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  
  if (userId === 8092298631) {
    // Admin user
    await bot.sendMessage(chatId, 
      '⚡ ROCK COFFEE - ПАНЕЛЬ АДМИНИСТРАТОРА\n\n' +
      '🎉 Добро пожаловать, Администратор!\n\n' +
      '📊 ОБЗОР СИСТЕМЫ:\n' +
      '👥 Всего клиентов: 0\n' +
      '📋 Активных клиентов: 0\n' +
      '👨‍💼 Управляющих: 0\n' +
      '👨‍🍳 Барист: 0\n\n' +
      '✅ Бот работает правильно!\n' +
      '🚀 Система готова к использованию!'
    );
    console.log('✅ Admin panel sent to user:', userId);
  } else {
    await bot.sendMessage(chatId, 
      '👋 Добро пожаловать в Rock Coffee!\n\n' +
      '☕ Это бот системы лояльности нашей кофейни.\n\n' +
      'Ваш ID: ' + userId + '\n\n' +
      'Для получения доступа обратитесь к администратору.'
    );
    console.log('✅ Welcome message sent to user:', userId);
  }
});

// Error handling
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

console.log('🚀 Rock Coffee Bot is running!');
console.log('📱 Waiting for /start commands...');
console.log('👤 Admin ID: 8092298631');