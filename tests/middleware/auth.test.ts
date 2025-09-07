import { checkAdminAccess, checkManagerAccess, checkBaristaAccess } from '../../src/middleware/access.middleware';
import { MockTelegramBot, setupTestDatabase, cleanupTestDatabase, clearTestData } from '../helpers/database';
import { createTestUsers, createMockContext, TEST_USERS } from '../fixtures/users';

describe('Auth Middleware', () => {
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
    
    mockBot = new MockTelegramBot();
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('checkAdminAccess', () => {
    it('should grant access to admin users', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      const hasAccess = await checkAdminAccess(ctx);

      expect(hasAccess).toBe(true);
      expect(mockBot.sentMessages).toHaveLength(0);
    });

    it('should deny access to non-admin users', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      const hasAccess = await checkAdminAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should deny access to barista users', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      const hasAccess = await checkAdminAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should deny access to unregistered users', async () => {
      const unregisteredUser = { telegram_id: 999999999, full_name: 'Unknown User', role: 'client' as const };
      const ctx = createMockContext(unregisteredUser);
      ctx.bot = mockBot;

      const hasAccess = await checkAdminAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });
  });

  describe('checkManagerAccess', () => {
    it('should grant access to admin users', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      const hasAccess = await checkManagerAccess(ctx);

      expect(hasAccess).toBe(true);
      expect(mockBot.sentMessages).toHaveLength(0);
    });

    it('should grant access to manager users', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      const hasAccess = await checkManagerAccess(ctx);

      expect(hasAccess).toBe(true);
      expect(mockBot.sentMessages).toHaveLength(0);
    });

    it('should deny access to barista users', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      const hasAccess = await checkManagerAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should deny access to unregistered users', async () => {
      const unregisteredUser = { telegram_id: 999999999, full_name: 'Unknown User', role: 'client' as const };
      const ctx = createMockContext(unregisteredUser);
      ctx.bot = mockBot;

      const hasAccess = await checkManagerAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });
  });

  describe('checkBaristaAccess', () => {
    it('should grant access to admin users', async () => {
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      const hasAccess = await checkBaristaAccess(ctx);

      expect(hasAccess).toBe(true);
      expect(mockBot.sentMessages).toHaveLength(0);
    });

    it('should grant access to manager users', async () => {
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      const hasAccess = await checkBaristaAccess(ctx);

      expect(hasAccess).toBe(true);
      expect(mockBot.sentMessages).toHaveLength(0);
    });

    it('should grant access to barista users', async () => {
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      const hasAccess = await checkBaristaAccess(ctx);

      expect(hasAccess).toBe(true);
      expect(mockBot.sentMessages).toHaveLength(0);
    });

    it('should deny access to client users', async () => {
      const clientUser = { ...TEST_USERS[0], role: 'client' as const };
      const ctx = createMockContext(clientUser);
      ctx.bot = mockBot;

      const hasAccess = await checkBaristaAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });

    it('should deny access to unregistered users', async () => {
      const unregisteredUser = { telegram_id: 999999999, full_name: 'Unknown User', role: 'client' as const };
      const ctx = createMockContext(unregisteredUser);
      ctx.bot = mockBot;

      const hasAccess = await checkBaristaAccess(ctx);

      expect(hasAccess).toBe(false);
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Нет доступа');
    });
  });
});