import { MockTelegramBot } from './helpers/database';
import { createMockContext, TEST_USERS } from './fixtures/users';

describe('Basic Functionality Tests', () => {
  let mockBot: MockTelegramBot;

  beforeEach(() => {
    mockBot = new MockTelegramBot();
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('Mock Bot', () => {
    it('should send messages correctly', async () => {
      await mockBot.sendMessage(123, 'Test message');
      
      expect(mockBot.sentMessages).toHaveLength(1);
      expect(mockBot.getLastMessage().text).toBe('Test message');
      expect(mockBot.getLastMessage().chatId).toBe(123);
    });

    it('should edit messages correctly', async () => {
      await mockBot.editMessageText('Edited message', { chat_id: 123, message_id: 456 });
      
      expect(mockBot.editedMessages).toHaveLength(1);
      expect(mockBot.getLastEdit().text).toBe('Edited message');
    });
  });

  describe('Test Fixtures', () => {
    it('should have test users defined', () => {
      expect(TEST_USERS).toBeDefined();
      expect(TEST_USERS.length).toBeGreaterThan(0);
      
      const adminUser = TEST_USERS.find(u => u.role === 'admin');
      const managerUser = TEST_USERS.find(u => u.role === 'manager');
      const baristaUser = TEST_USERS.find(u => u.role === 'barista');
      
      expect(adminUser).toBeDefined();
      expect(managerUser).toBeDefined();
      expect(baristaUser).toBeDefined();
    });

    it('should create mock context correctly', () => {
      const testUser = TEST_USERS[0];
      const ctx = createMockContext(testUser);
      
      expect(ctx.from.id).toBe(testUser.telegram_id);
      expect(ctx.from.username).toBe(testUser.username);
      expect(ctx.message.chat.id).toBe(testUser.telegram_id);
    });
  });

  describe('Message Formatting', () => {
    it('should handle text with markdown', async () => {
      const markdownText = '*Bold text* and _italic text_';
      await mockBot.sendMessage(123, markdownText);
      
      expect(mockBot.getLastMessage().text).toContain('*Bold text*');
      expect(mockBot.getLastMessage().text).toContain('_italic text_');
    });

    it('should handle keyboard options', async () => {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Button 1', callback_data: 'btn1' }],
            [{ text: 'Button 2', callback_data: 'btn2' }]
          ]
        }
      };
      
      await mockBot.sendMessage(123, 'Test with buttons', options);
      
      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.options.reply_markup.inline_keyboard).toHaveLength(2);
    });
  });
});