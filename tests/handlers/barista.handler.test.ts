import { BaristaHandler } from '../../src/handlers/barista.handler';
import { MockTelegramBot, setupTestDatabase, cleanupTestDatabase, clearTestData } from '../helpers/database';
import { createTestUsers, createTestClients, createMockContext, TEST_USERS } from '../fixtures/users';

describe('BaristaHandler', () => {
  let baristaHandler: BaristaHandler;
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
    baristaHandler = new BaristaHandler(mockBot as any);
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('Menu Navigation', () => {
    it('should show main barista menu', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      await baristaHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('☕ Меню бариста');
      expect(lastMessage.options?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('should show help information', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      await baristaHandler.showHelp(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('ℹ️ *Справка для бариста*');
      expect(lastMessage.text).toContain('Основные функции');
    });
  });

  describe('Client Search', () => {
    it('should initiate client search by card', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      await baristaHandler.searchClient(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔍 Поиск клиента');
    });

    it('should search by name', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      await baristaHandler.searchClientByName(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('Введите ФИО клиента');
    });

    it('should find client by card number', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser, { text: 'TEST001' });
      ctx.bot = mockBot;

      await baristaHandler.handleCardSearch(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👤 Клиент найден');
    });

    it('should handle client not found by card', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser, { text: 'INVALID' });
      ctx.bot = mockBot;

      await baristaHandler.handleCardSearch(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Клиент не найден');
    });

    it('should find client by name', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser, { text: 'Иванов' });
      ctx.bot = mockBot;

      await baristaHandler.handleNameSearch(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('Найдены клиенты');
    });
  });

  describe('Point Operations', () => {
    it('should show earn points menu', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.showTransactionOptions(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💰 Начисление баллов');
    });

    it('should show spend points menu', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.showTransactionOptions(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💸 Списание баллов');
    });

    it('should process earning points', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser, { text: '500' });
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.handlePointsTransaction(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💰 Баллы начислены');
    });

    it('should process spending points', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser, { text: '50' });
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.handlePointsTransaction(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💸 Баллы списаны');
    });

    it('should handle insufficient balance for spending', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser, { text: '1000' });
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.handlePointsTransaction(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Недостаточно баллов');
    });
  });

  describe('Client Profile', () => {
    it('should show client profile', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.showClientDetails(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👤 Профиль клиента');
    });

    it('should show client transactions', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;
      ctx.session = { selectedClientId: 1 };

      await baristaHandler.showClientHistory(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📊 История операций');
    });
  });

  describe('Access Control', () => {
    it('should deny access to non-barista users', async () => {
      const clientUser = { ...TEST_USERS[0], role: 'client' as const };
      const ctx = createMockContext(clientUser);
      ctx.bot = mockBot;

      await baristaHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should allow access to manager and admin users', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      await baristaHandler.showMainMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('☕ Меню бариста');
    });
  });
});