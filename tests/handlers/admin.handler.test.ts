import { AdminHandler } from '../../src/handlers/admin.handler';
import { MockTelegramBot, setupTestDatabase, cleanupTestDatabase, clearTestData } from '../helpers/database';
import { createTestUsers, createTestClients, createMockContext, TEST_USERS } from '../fixtures/users';

describe('AdminHandler', () => {
  let adminHandler: AdminHandler;
  let mockBot: MockTelegramBot;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    await createTestUsers();
    await createTestClients();
    
    mockBot = new MockTelegramBot();
    adminHandler = new AdminHandler(mockBot as any);
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('Menu Navigation', () => {
    it('should show main admin menu', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('⚙️ Панель администратора');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should show system menu', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemSettings(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔧 Системные настройки');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should show logs menu', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemLogs(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📋 Логи системы');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });
  });

  describe('User Management', () => {
    it('should show all users', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showAllStaff(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👥 Все пользователи');
    });

    it('should show user management menu', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showManagerManagement(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👤 Управление пользователями');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should add user prompt', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.addManager(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('➕ Добавление пользователя');
    });

    it('should search user prompt', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.searchManager(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔍 Поиск пользователя');
    });
  });

  describe('Database Management', () => {
    it('should show database status', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemStatistics(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🗃️ Состояние базы данных');
    });

    it('should backup database', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemSettings(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💾 Резервное копирование');
    });

    it('should run database cleanup', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemSettings(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🧹 Очистка базы данных');
    });
  });

  describe('Statistics and Analytics', () => {
    it('should show system statistics', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemStatistics(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📊 Системная статистика');
    });

    it('should show activity logs', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemLogs(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📈 Логи активности');
    });

    it('should show error logs', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemLogs(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Логи ошибок');
    });
  });

  describe('System Configuration', () => {
    it('should show bot settings', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemSettings(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🤖 Настройки бота');
    });

    it('should restart bot', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemSettings(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔄 Перезапуск бота');
    });

    it('should show maintenance mode toggle', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showSystemSettings(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔧 Режим обслуживания');
    });
  });

  describe('Client Management', () => {
    it('should show all clients', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showAllStaff(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👥 Все клиенты');
    });

    it('should search client', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.searchManager(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔍 Поиск клиента');
    });

    it('should show client details', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await adminHandler.showManagerDetails(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👤 Детали клиента');
    });
  });

  describe('Access Control', () => {
    it('should deny access to non-admin users', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      await adminHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should allow access only to admin users', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await adminHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('⚙️ Панель администратора');
    });
  });
});