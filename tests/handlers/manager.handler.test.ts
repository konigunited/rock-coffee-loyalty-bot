import { ManagerHandler } from '../../src/handlers/manager.handler';
import { MockTelegramBot, setupTestDatabase, cleanupTestDatabase, clearTestData } from '../helpers/database';
import { createTestUsers, createTestClients, createMockContext, TEST_USERS } from '../fixtures/users';

describe('ManagerHandler', () => {
  let managerHandler: ManagerHandler;
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
    managerHandler = new ManagerHandler(mockBot as any);
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('Menu Navigation', () => {
    it('should show main manager menu', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🏢 Меню управляющего');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should show staff menu', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showStaffManagement(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👥 Управление персоналом');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should show client analysis menu', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showClientAnalysis(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📊 Анализ клиентов');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should show statistics menu', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showStatistics(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📈 Статистика');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });
  });

  describe('Client Analysis', () => {
    it('should show top clients', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showTopClients(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🏆 ТОП-10 клиентов');
    });

    it('should show inactive clients', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showInactiveClients(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('😴 Неактивные клиенты');
    });

    it('should show baristas only', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showBaristasOnly(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('☕ Список бариста');
    });
  });

  describe('Statistics', () => {
    it('should show staff statistics', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showStaffStatistics(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👥 Статистика персонала');
    });

    it('should show week manager stats', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showWeekManagerStats(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📅 Недельная статистика');
    });

    it('should show month manager stats', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showMonthManagerStats(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📆 Месячная статистика');
    });

    it('should show total stats', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showTotalStats(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📊 Общая статистика');
    });
  });

  describe('Promotions and Broadcasting', () => {
    it('should show promotions', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showPromotions(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🎯 Акции и промо');
    });

    it('should show broadcast menu', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showNotificationCenter(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📢 Рассылка');
    });

    it('should show broadcast client types', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await managerHandler.showNotificationCenter(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📋 Выберите тип клиентов');
    });
  });

  describe('Access Control', () => {
    it('should deny access to non-manager users', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      await managerHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should allow access to admin users', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      await managerHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🏢 Меню управляющего');
    });
  });
});