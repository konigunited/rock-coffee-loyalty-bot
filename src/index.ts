import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Database from './config/database';
import { BaristaHandler } from './handlers/barista.handler';
import { ManagerHandler } from './handlers/manager.handler';
import { AdminHandler } from './handlers/admin.handler';
import { BotContext, checkBaristaAccess, checkManagerAccess, checkAdminAccess, getCurrentUser } from './middleware/access.middleware';
import { UserService } from './services/user.service';
import { ensureNotRegistered, handleClientCallbacks } from './middleware/client.middleware';

// Load environment variables
dotenv.config();

console.log('🤖 Starting Rock Coffee Loyalty Bot...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');

// Validate required environment variables
const requiredEnvVars = ['BOT_TOKEN', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize services
console.log('🔗 Initializing Telegram Bot...');
const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
console.log('✅ Telegram Bot initialized');

console.log('🌐 Setting up Express server...');
const app = express();
const port = parseInt(process.env.PORT || '3000');

// Services
const userService = new UserService();
const baristaHandler = new BaristaHandler(bot);
const managerHandler = new ManagerHandler(bot);
const adminHandler = new AdminHandler(bot);

// Session storage (in production, use Redis or database)
const sessions = new Map<number, any>();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to get session
function getSession(userId: number): any {
  if (!sessions.has(userId)) {
    sessions.set(userId, {});
  }
  return sessions.get(userId);
}

// Helper function to create bot context
function createBotContext(msg: TelegramBot.Message): BotContext {
  const session = getSession(msg.from?.id || 0);
  
  return {
    from: msg.from,
    message: msg,
    session,
    bot
  };
}

// Bot error handler
bot.on('polling_error', (error) => {
  console.error('Bot polling error:', error);
});

// Start command
bot.onText(/\/start/, async (msg) => {
  const ctx = createBotContext(msg);
  
  // Check user role and show appropriate menu
  if (msg.from) {
    if (await checkAdminAccess(ctx)) {
      await adminHandler.showMainMenu(ctx);
    } else if (await checkManagerAccess(ctx)) {
      await managerHandler.showMainMenu(ctx);
    } else if (await checkBaristaAccess(ctx)) {
      await baristaHandler.showMainMenu(ctx);
    } else {
      // For regular users (potential clients), use client registration flow
      await ensureNotRegistered(ctx, async () => {
        // Import ClientHandler dynamically to avoid circular dependencies
        const { ClientHandler } = await import('./handlers/client.handler');
        const clientHandler = new ClientHandler(bot);
        await clientHandler.startRegistration(ctx);
      });
      return;
    }
  } else {
    // Welcome message for users without telegram info
    const welcomeText = 
      '👋 Добро пожаловать в Rock Coffee!\n\n' +
      '☕ Это бот системы лояльности нашей кофейни.\n\n' +
      'Команда /start запустит регистрацию в программе лояльности.\n\n' +
      'Если вы сотрудник, обратитесь к администратору для получения доступа к рабочей панели.';
    
    await bot.sendMessage(msg.chat.id, welcomeText);
  }
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const ctx = createBotContext(msg);
  
  if (await checkBaristaAccess(ctx)) {
    const helpText = 
      '📖 *Справка для бариста*\n\n' +
      '*Основные функции:*\n' +
      '🔍 Поиск клиента - поиск по карте или ФИО\n' +
      '➕ Начисление баллов - свободное начисление\n' +
      '➖ Списание баллов - свободное списание\n' +
      '📝 Заметки - добавление комментариев к клиенту\n' +
      '📊 Статистика - ваши операции за день/неделю/месяц\n\n' +
      '*Доступные данные клиента:*\n' +
      '• Номер карты\n' +
      '• ФИО\n' +
      '• Баланс баллов\n' +
      '• Количество визитов\n' +
      '• Заметки\n\n' +
      '*Команды:*\n' +
      '/start - главное меню\n' +
      '/help - эта справка';
    
    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  } else {
    const helpText = 
      '📖 *Справка*\n\n' +
      'Этот бот предназначен для системы лояльности Rock Coffee.\n\n' +
      'Для получения карты лояльности обратитесь к бариста в нашей кофейне.\n\n' +
      'Если вы сотрудник, обратитесь к администратору для получения доступа к системе.';
    
    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  if (!msg || !callbackQuery.from) return;

  // Create context from callback query
  const ctx: BotContext = {
    from: callbackQuery.from,
    message: msg,
    session: getSession(callbackQuery.from.id),
    bot
  };

  const data = callbackQuery.data;
  if (!data) return;

  try {
    // Answer callback query to remove loading state
    await bot.answerCallbackQuery(callbackQuery.id);

    // Route callback data
    if (data === 'barista_menu') {
      await baristaHandler.showMainMenu(ctx);
    } 
    else if (data === 'search_client') {
      await baristaHandler.searchClient(ctx);
    }
    else if (data.startsWith('select_client:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.showClientCard(ctx, clientId);
    }
    else if (data.startsWith('client_card:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.showClientCard(ctx, clientId);
    }
    else if (data.startsWith('earn_points:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.startEarnPoints(ctx, clientId);
    }
    else if (data.startsWith('spend_points:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.startSpendPoints(ctx, clientId);
    }
    else if (data.startsWith('quick_add_one:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.quickAddOne(ctx, clientId);
    }
    else if (data.startsWith('confirm_earn:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const points = parseInt(parts[2]);
      await baristaHandler.confirmEarnPoints(ctx, clientId, points);
    }
    else if (data.startsWith('custom_earn:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.startCustomEarn(ctx, clientId);
    }
    else if (data.startsWith('confirm_spend:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const points = parseInt(parts[2]);
      await baristaHandler.confirmSpendPoints(ctx, clientId, points);
    }
    else if (data.startsWith('add_note:')) {
      const clientId = parseInt(data.split(':')[1]);
      await baristaHandler.startAddNote(ctx, clientId);
    }
    else if (data === 'my_stats') {
      await baristaHandler.showMyStats(ctx);
    }
    else if (data === 'stats_today') {
      await baristaHandler.showTodayStats(ctx);
    }
    else if (data === 'stats_week') {
      await baristaHandler.showWeekStats(ctx);
    }
    else if (data === 'stats_month') {
      await baristaHandler.showMonthStats(ctx);
    }
    else if (data === 'recent_operations') {
      await baristaHandler.showRecentOperations(ctx);
    }
    else if (data === 'help_barista') {
      await baristaHandler.showHelp(ctx);
    }
    // Manager routes
    else if (data === 'manager_menu') {
      await managerHandler.showMainMenu(ctx);
    }
    else if (data === 'manage_clients') {
      await managerHandler.showClientManagement(ctx);
    }
    else if (data === 'manage_staff') {
      await managerHandler.showStaffManagement(ctx);
    }
    else if (data === 'search_client_full') {
      await managerHandler.startFullClientSearch(ctx);
    }
    else if (data.startsWith('manager_client:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.showFullClientCard(ctx, clientId);
    }
    else if (data === 'all_staff') {
      await managerHandler.showAllStaff(ctx);
    }
    else if (data.startsWith('staff_profile:')) {
      const staffId = parseInt(data.split(':')[1]);
      await managerHandler.showStaffProfile(ctx, staffId);
    }
    else if (data === 'manager_statistics') {
      await managerHandler.showManagerStatistics(ctx);
    }
    else if (data === 'stats_today_manager') {
      await managerHandler.showTodayManagerStats(ctx);
    }
    else if (data === 'manager_notifications') {
      await managerHandler.showNotificationsMenu(ctx);
    }
    else if (data === 'add_barista') {
      await managerHandler.startAddBarista(ctx);
    }
    else if (data === 'all_clients') {
      await managerHandler.showAllClients(ctx, 0);
    }
    else if (data.startsWith('all_clients:')) {
      const page = parseInt(data.split(':')[1]);
      await managerHandler.showAllClients(ctx, page);
    }
    else if (data === 'birthdays') {
      await managerHandler.showBirthdayClients(ctx);
    }
    else if (data === 'promotions') {
      await managerHandler.showPromotions(ctx);
    }
    else if (data === 'top_clients') {
      await managerHandler.showTopClients(ctx);
    }
    else if (data === 'inactive_clients') {
      await managerHandler.showInactiveClients(ctx);
    }
    else if (data === 'add_client') {
      await managerHandler.startAddClient(ctx);
    }
    else if (data === 'baristas_only') {
      await managerHandler.showBaristasOnly(ctx);
    }
    else if (data === 'add_manager') {
      await managerHandler.startAddManager(ctx);
    }
    else if (data === 'staff_statistics') {
      await managerHandler.showStaffStatistics(ctx);
    }
    else if (data === 'stats_week_manager') {
      await managerHandler.showWeekManagerStats(ctx);
    }
    else if (data === 'stats_month_manager') {
      await managerHandler.showMonthManagerStats(ctx);
    }
    else if (data === 'stats_total') {
      await managerHandler.showTotalStats(ctx);
    }
    else if (data === 'top_clients_stats') {
      await managerHandler.showTopClientsStats(ctx);
    }
    else if (data === 'staff_performance') {
      await managerHandler.showStaffPerformance(ctx);
    }
    else if (data === 'broadcast_all') {
      await managerHandler.showBroadcastAll(ctx);
    }
    else if (data === 'broadcast_birthdays') {
      await managerHandler.showBroadcastBirthdays(ctx);
    }
    else if (data === 'broadcast_inactive') {
      await managerHandler.showBroadcastInactive(ctx);
    }
    else if (data === 'broadcast_top') {
      await managerHandler.showBroadcastTop(ctx);
    }
    else if (data === 'broadcast_history') {
      await managerHandler.showBroadcastHistory(ctx);
    }
    
    // Admin routes
    else if (data === 'admin_main_menu') {
      await adminHandler.showMainMenu(ctx);
    }
    else if (data === 'admin_manage_managers') {
      await adminHandler.showManagerManagement(ctx);
    }
    else if (data === 'admin_system_settings') {
      await adminHandler.showSystemSettings(ctx);
    }
    else if (data === 'admin_monitoring') {
      await adminHandler.showSystemMonitoring(ctx);
    }
    else if (data === 'admin_backup_restore') {
      await adminHandler.showBackupRestore(ctx);
    }
    else if (data === 'admin_audit_log') {
      await adminHandler.showAuditLog(ctx);
    }
    else if (data === 'admin_broadcast') {
      await adminHandler.showBroadcastSystem(ctx);
    }
    else if (data === 'admin_refresh_stats') {
      await adminHandler.showMainMenu(ctx);
    }
    else if (data === 'admin_add_manager') {
      await adminHandler.startAddManager(ctx);
    }
    else if (data === 'admin_add_barista') {
      await adminHandler.startAddBarista(ctx);
    }
    else if (data === 'admin_list_managers') {
      await adminHandler.showAllManagers(ctx);
    }
    else if (data === 'admin_list_baristas') {
      await adminHandler.showAllBaristas(ctx);
    }
    else if (data === 'admin_remove_staff') {
      await adminHandler.showRemoveStaff(ctx);
    }
    else if (data.startsWith('admin_remove_user:')) {
      const userId = parseInt(data.split(':')[1]);
      await adminHandler.confirmRemoveUser(ctx, userId);
    }

    // MANAGER CLIENT OPERATIONS
    else if (data.startsWith('manager_earn:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.startManagerEarn(ctx, clientId);
    }
    else if (data.startsWith('manager_spend:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.startManagerSpend(ctx, clientId);
    }
    else if (data.startsWith('give_bonus:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.giveBonus(ctx, clientId);
    }
    else if (data.startsWith('adjust_points:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.adjustPoints(ctx, clientId);
    }
    else if (data.startsWith('edit_client:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.editClient(ctx, clientId);
    }
    else if (data.startsWith('edit_notes:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.editClientNotes(ctx, clientId);
    }
    else if (data.startsWith('client_history:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.showClientHistory(ctx, clientId);
    }
    else if (data.startsWith('send_sms:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.sendSMS(ctx, clientId);
    }
    else if (data.startsWith('manual_earn:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.startManualEarn(ctx, clientId);
    }
    else if (data.startsWith('manual_spend:')) {
      const clientId = parseInt(data.split(':')[1]);
      await managerHandler.startManualSpend(ctx, clientId);
    }

    // MANAGER CONFIRMATIONS
    else if (data.startsWith('confirm_manager_earn:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const amount = parseFloat(parts[2]);
      const points = parseInt(parts[3]);
      await managerHandler.confirmManagerEarn(ctx, clientId, amount, points);
    }
    else if (data.startsWith('confirm_manager_spend:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const points = parseInt(parts[2]);
      await managerHandler.confirmManagerSpend(ctx, clientId, points);
    }
    else if (data.startsWith('confirm_bonus:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const points = parseInt(parts[2]);
      const type = parts[3];
      await managerHandler.confirmBonus(ctx, clientId, points, type);
    }
    else if (data.startsWith('confirm_adjust:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const adjustment = parts[2];
      await managerHandler.confirmAdjustment(ctx, clientId, adjustment);
    }
    else if (data.startsWith('sms_template:')) {
      const parts = data.split(':');
      const clientId = parseInt(parts[1]);
      const template = parts[2];
      await managerHandler.sendSMSTemplate(ctx, clientId, template);
    }
    
    // Try to handle client callbacks
    else {
      const handled = await handleClientCallbacks(ctx, data);
      if (!handled) {
        console.log(`Unhandled callback data: ${data}`);
      }
    }
    
  } catch (error) {
    console.error('Callback query error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Произошла ошибка. Попробуйте еще раз.');
  }
});

// Contact handler
bot.on('contact', async (msg) => {
  if (!msg.from || !msg.contact) return;

  const ctx = createBotContext(msg);
  const session = ctx.session;

  if (!session || !session.waitingFor) return;

  try {
    // Handle contact sharing for phone input
    if (session.waitingFor === 'phone') {
      const { ClientHandler } = await import('./handlers/client.handler');
      const clientHandler = new ClientHandler(bot);
      await clientHandler.processPhone(ctx, msg.contact.phone_number);
    }
    else if (session.waitingFor === 'edit_phone') {
      const { ProfileHandler } = await import('./handlers/profile.handler');
      const profileHandler = new ProfileHandler(bot);
      await profileHandler.processPhoneEdit(ctx, msg.contact.phone_number);
    }

  } catch (error) {
    console.error('Contact handler error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при обработке контакта.');
  }
});

// Text message handler
bot.on('message', async (msg) => {
  if (!msg.from || !msg.text || msg.text.startsWith('/')) return;

  const ctx = createBotContext(msg);
  const session = ctx.session;

  // Check for quick points input patterns (e.g., "12345 +15", "12345 15", "+15 12345")
  const quickPointsPatterns = [
    /^\d+\s*\+\d+$/, // "12345 +15"
    /^\d+\s+\d+$/, // "12345 15"  
    /^\+\d+\s+\d+$/, // "+15 12345"
  ];

  const isQuickPointsInput = quickPointsPatterns.some(pattern => pattern.test(msg.text.trim()));
  
  if (isQuickPointsInput) {
    // Handle quick points input for baristas
    if (await checkBaristaAccess(ctx)) {
      await baristaHandler.handleQuickPointsInput(ctx, msg.text);
    }
    return;
  }

  if (!session || !session.waitingFor) return;

  try {
    // Handle different waiting states
    if (session.waitingFor === 'client_search') {
      await baristaHandler.handleSearchQuery(ctx, msg.text);
    }
    else if (session.waitingFor === 'custom_earn_amount') {
      await baristaHandler.processCustomEarnAmount(ctx, msg.text);
    }
    else if (session.waitingFor === 'spend_points') {
      await baristaHandler.processSpendPoints(ctx, msg.text);
    }
    else if (session.waitingFor === 'add_note') {
      await baristaHandler.processAddNote(ctx, msg.text);
    }
    else if (session.waitingFor === 'full_client_search') {
      await managerHandler.handleFullClientSearch(ctx, msg.text);
    }
    else if (session.waitingFor === 'add_barista_data') {
      await managerHandler.processAddBaristaData(ctx, msg.text);
    }
    else if (session.waitingFor === 'manual_earn_amount') {
      await managerHandler.processManualEarnAmount(ctx, msg.text);
    }
    else if (session.waitingFor === 'manual_spend_amount') {
      await managerHandler.processManualSpendAmount(ctx, msg.text);
    }
    else if (session.waitingFor === 'add_manager_data') {
      await adminHandler.processAddManagerData(ctx, msg.text);
    }
    else if (session.waitingFor === 'add_barista_data') {
      await adminHandler.processAddBaristaData(ctx, msg.text);
    }
    // CLIENT REGISTRATION HANDLERS
    else if (session.waitingFor === 'full_name') {
      const { ClientHandler } = await import('./handlers/client.handler');
      const clientHandler = new ClientHandler(bot);
      await clientHandler.processFullName(ctx, msg.text);
    }
    else if (session.waitingFor === 'phone') {
      const { ClientHandler } = await import('./handlers/client.handler');
      const clientHandler = new ClientHandler(bot);
      await clientHandler.processPhone(ctx, msg.text);
    }
    else if (session.waitingFor === 'birth_date') {
      const { ClientHandler } = await import('./handlers/client.handler');
      const clientHandler = new ClientHandler(bot);
      await clientHandler.processBirthDate(ctx, msg.text);
    }
    // PROFILE EDITING HANDLERS
    else if (session.waitingFor === 'edit_name') {
      const { ProfileHandler } = await import('./handlers/profile.handler');
      const profileHandler = new ProfileHandler(bot);
      await profileHandler.processNameEdit(ctx, msg.text);
    }
    else if (session.waitingFor === 'edit_phone') {
      const { ProfileHandler } = await import('./handlers/profile.handler');
      const profileHandler = new ProfileHandler(bot);
      await profileHandler.processPhoneEdit(ctx, msg.text);
    }
    else if (session.waitingFor === 'edit_birthday') {
      const { ProfileHandler } = await import('./handlers/profile.handler');
      const profileHandler = new ProfileHandler(bot);
      await profileHandler.processBirthdayEdit(ctx, msg.text);
    }

  } catch (error) {
    console.error('Message handler error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при обработке сообщения.');
  }
});

// Session cleanup (run every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [userId, session] of sessions.entries()) {
    if (session.lastActivity && session.lastActivity.getTime() < oneHourAgo) {
      sessions.delete(userId);
    }
  }
}, 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await bot.stopPolling();
  await Database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await bot.stopPolling();
  await Database.close();
  process.exit(0);
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Rock Coffee Loyalty Bot started on port ${port}`);
  console.log(`📱 Bot is polling for updates...`);
});

// Start the bot
console.log('🤖 Telegram Bot is starting...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

export default app;