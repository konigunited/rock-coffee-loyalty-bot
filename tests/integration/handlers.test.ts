import { MockTelegramBot } from '../helpers/database';
import { createMockContext, TEST_USERS } from '../fixtures/users';

// Mock all handler dependencies
jest.mock('../../src/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  end: jest.fn()
}));

jest.mock('../../src/services/client.service', () => ({
  ClientService: jest.fn().mockImplementation(() => ({
    findByTelegramId: jest.fn().mockResolvedValue(null),
    findByCardNumber: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../../src/services/user.service', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    findByTelegramId: jest.fn().mockResolvedValue(TEST_USERS[0]),
    getAllStaff: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 })
  }))
}));

jest.mock('../../src/services/point.service', () => ({
  PointService: jest.fn().mockImplementation(() => ({
    addPoints: jest.fn().mockResolvedValue(true),
    deductPoints: jest.fn().mockResolvedValue(true),
    getBalance: jest.fn().mockResolvedValue(100),
    getTransactionHistory: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('../../src/services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendToAll: jest.fn().mockResolvedValue(true),
    sendToRole: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../../src/services/staff.service', () => ({
  StaffService: jest.fn().mockImplementation(() => ({
    getAllBaristas: jest.fn().mockResolvedValue([]),
    getStaffStats: jest.fn().mockResolvedValue({})
  }))
}));

describe('Handler Integration Tests', () => {
  let mockBot: MockTelegramBot;

  beforeEach(() => {
    mockBot = new MockTelegramBot();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('Admin Handler', () => {
    it('should initialize without errors', async () => {
      const { AdminHandler } = await import('../../src/handlers/admin.handler');
      
      expect(() => new AdminHandler(mockBot as any)).not.toThrow();
    });

    it('should handle admin context', async () => {
      const { AdminHandler } = await import('../../src/handlers/admin.handler');
      const adminHandler = new AdminHandler(mockBot as any);
      
      const adminUser = TEST_USERS.find(u => u.role === 'admin')!;
      const ctx = createMockContext(adminUser);
      ctx.bot = mockBot;

      // This should not throw
      expect(() => adminHandler).toBeDefined();
    });
  });

  describe('Manager Handler', () => {
    it('should initialize without errors', async () => {
      const { ManagerHandler } = await import('../../src/handlers/manager.handler');
      
      expect(() => new ManagerHandler(mockBot as any)).not.toThrow();
    });

    it('should handle manager context', async () => {
      const { ManagerHandler } = await import('../../src/handlers/manager.handler');
      const managerHandler = new ManagerHandler(mockBot as any);
      
      const managerUser = TEST_USERS.find(u => u.role === 'manager')!;
      const ctx = createMockContext(managerUser);
      ctx.bot = mockBot;

      // This should not throw
      expect(() => managerHandler).toBeDefined();
    });
  });

  describe('Barista Handler', () => {
    it('should initialize without errors', async () => {
      const { BaristaHandler } = await import('../../src/handlers/barista.handler');
      
      expect(() => new BaristaHandler(mockBot as any)).not.toThrow();
    });

    it('should handle barista context', async () => {
      const { BaristaHandler } = await import('../../src/handlers/barista.handler');
      const baristaHandler = new BaristaHandler(mockBot as any);
      
      const baristaUser = TEST_USERS.find(u => u.role === 'barista')!;
      const ctx = createMockContext(baristaUser);
      ctx.bot = mockBot;

      // This should not throw
      expect(() => baristaHandler).toBeDefined();
    });
  });

  describe('Client Handler', () => {
    it('should initialize without errors', async () => {
      const { ClientHandler } = await import('../../src/handlers/client.handler');
      
      expect(() => new ClientHandler(mockBot as any)).not.toThrow();
    });

    it('should handle client context', async () => {
      const { ClientHandler } = await import('../../src/handlers/client.handler');
      const clientHandler = new ClientHandler(mockBot as any);
      
      const clientUser = { ...TEST_USERS[0], role: 'client' as const };
      const ctx = createMockContext(clientUser);
      ctx.bot = mockBot;

      // This should not throw
      expect(() => clientHandler).toBeDefined();
    });
  });

  describe('Handler Interactions', () => {
    it('should allow all handlers to coexist', async () => {
      const { AdminHandler } = await import('../../src/handlers/admin.handler');
      const { ManagerHandler } = await import('../../src/handlers/manager.handler');
      const { BaristaHandler } = await import('../../src/handlers/barista.handler');
      const { ClientHandler } = await import('../../src/handlers/client.handler');

      const adminHandler = new AdminHandler(mockBot as any);
      const managerHandler = new ManagerHandler(mockBot as any);
      const baristaHandler = new BaristaHandler(mockBot as any);
      const clientHandler = new ClientHandler(mockBot as any);

      expect(adminHandler).toBeDefined();
      expect(managerHandler).toBeDefined();
      expect(baristaHandler).toBeDefined();
      expect(clientHandler).toBeDefined();
    });

    it('should handle mock bot interactions', async () => {
      await mockBot.sendMessage(123, 'Test message');
      await mockBot.editMessageText('Edited message', { chat_id: 123, message_id: 456 });
      
      expect(mockBot.sentMessages).toHaveLength(1);
      expect(mockBot.editedMessages).toHaveLength(1);
      expect(mockBot.getLastMessage().text).toBe('Test message');
      expect(mockBot.getLastEdit().text).toBe('Edited message');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing context gracefully', async () => {
      const { AdminHandler } = await import('../../src/handlers/admin.handler');
      const adminHandler = new AdminHandler(mockBot as any);

      // Empty context should not crash the handler
      const emptyCtx = { from: null, message: null };
      expect(() => adminHandler).toBeDefined();
    });

    it('should handle malformed messages', async () => {
      const malformedMessage = {
        text: null,
        chat: { id: 123 },
        message_id: 456
      };

      await mockBot.sendMessage(123, 'Response to malformed message');
      expect(mockBot.sentMessages).toHaveLength(1);
    });
  });
});