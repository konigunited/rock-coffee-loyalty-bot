import { ClientHandler } from '../../src/handlers/client.handler';
import { MockTelegramBot, setupTestDatabase, cleanupTestDatabase, clearTestData } from '../helpers/database';
import { createTestUsers, createTestClients, createMockContext, TEST_USERS, TEST_CLIENTS } from '../fixtures/users';

describe('ClientHandler', () => {
  let clientHandler: ClientHandler;
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
    clientHandler = new ClientHandler();
  });

  afterEach(() => {
    mockBot.clearHistory();
  });

  describe('Registration', () => {
    it('should start registration process', async () => {
      const ctx = createMockContext({ telegram_id: 999888777, full_name: 'New User', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.startRegistration(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📝 Регистрация в программе лояльности');
    });

    it('should process name input', async () => {
      const ctx = createMockContext({ telegram_id: 999888777, full_name: 'New User', role: 'client' }, { text: 'Тестов Тест Тестович' });
      ctx.bot = mockBot;
      ctx.session = { registrationStep: 'name' };

      await clientHandler.processNameInput(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📱 Введите ваш номер телефона');
    });

    it('should process phone input', async () => {
      const ctx = createMockContext({ telegram_id: 999888777, full_name: 'New User', role: 'client' }, { text: '+79001234567' });
      ctx.bot = mockBot;
      ctx.session = { 
        registrationStep: 'phone',
        registrationData: { full_name: 'Тестов Тест Тестович' }
      };

      await clientHandler.processPhoneInput(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🎂 Введите дату рождения');
    });

    it('should complete registration', async () => {
      const ctx = createMockContext({ telegram_id: 999888777, full_name: 'New User', role: 'client' }, { text: '1990-01-01' });
      ctx.bot = mockBot;
      ctx.session = { 
        registrationStep: 'birth_date',
        registrationData: { 
          full_name: 'Тестов Тест Тестович',
          phone: '+79001234567'
        }
      };

      await clientHandler.processBirthDateInput(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('✅ Регистрация завершена');
    });
  });

  describe('Profile Management', () => {
    it('should show client profile', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showProfile(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('👤 Ваш профиль');
    });

    it('should show balance', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showBalance(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💰 Ваш баланс');
    });

    it('should show transaction history', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showTransactionHistory(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📊 История операций');
    });
  });

  describe('Profile Editing', () => {
    it('should show edit profile menu', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showEditProfileMenu(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('✏️ Редактирование профиля');
    });

    it('should edit phone number', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.editPhone(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('📱 Введите новый номер телефона');
    });

    it('should edit birth date', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.editBirthDate(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🎂 Введите новую дату рождения');
    });

    it('should process phone update', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' }, { text: '+79009999999' });
      ctx.bot = mockBot;
      ctx.session = { editField: 'phone' };

      await clientHandler.processPhoneUpdate(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('✅ Номер телефона обновлен');
    });

    it('should process birth date update', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' }, { text: '1995-05-15' });
      ctx.bot = mockBot;
      ctx.session = { editField: 'birth_date' };

      await clientHandler.processBirthDateUpdate(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('✅ Дата рождения обновлена');
    });
  });

  describe('Card Management', () => {
    it('should show QR code', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showQRCode(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('🔳 QR-код вашей карты');
    });

    it('should show card info', async () => {
      const clientTelegramId = TEST_CLIENTS[0].telegram_id!;
      const ctx = createMockContext({ telegram_id: clientTelegramId, full_name: 'Test Client', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showCard(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('💳 Ваша карта');
    });
  });

  describe('Error Handling', () => {
    it('should handle client not found', async () => {
      const ctx = createMockContext({ telegram_id: 999999999, full_name: 'Nonexistent User', role: 'client' });
      ctx.bot = mockBot;

      await clientHandler.showProfile(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Клиент не найден');
    });

    it('should handle invalid phone format', async () => {
      const ctx = createMockContext({ telegram_id: 999888777, full_name: 'New User', role: 'client' }, { text: 'invalid phone' });
      ctx.bot = mockBot;
      ctx.session = { 
        registrationStep: 'phone',
        registrationData: { full_name: 'Тестов Тест Тестович' }
      };

      await clientHandler.processPhoneInput(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Неверный формат');
    });

    it('should handle invalid birth date format', async () => {
      const ctx = createMockContext({ telegram_id: 999888777, full_name: 'New User', role: 'client' }, { text: 'invalid date' });
      ctx.bot = mockBot;
      ctx.session = { 
        registrationStep: 'birth_date',
        registrationData: { 
          full_name: 'Тестов Тест Тестович',
          phone: '+79001234567'
        }
      };

      await clientHandler.processBirthDateInput(ctx);

      const lastMessage = mockBot.getLastMessage();
      expect(lastMessage.text).toContain('❌ Неверный формат');
    });
  });
});