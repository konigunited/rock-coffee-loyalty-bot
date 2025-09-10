import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from '../services/client.service';
import { PointService } from '../services/point.service';
import { UserService } from '../services/user.service';
import { BotContext } from '../middleware/access.middleware';

// Helper function to extract first name from contact
function getFirstName(contact: TelegramBot.Contact | null, fullName?: string): string {
  if (contact?.first_name) {
    return contact.first_name;
  }
  
  if (fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return parts[1]; // Return first name (Иван from "Иванов Иван")
    }
    return parts[0];
  }
  
  return 'Друг';
}

// Helper function to get last name from contact
function getLastName(contact: TelegramBot.Contact | null): string | null {
  return contact?.last_name || null;
}

export class ClientHandler {
  private bot: TelegramBot;
  private clientService: ClientService;
  private pointService: PointService;
  private userService: UserService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
    this.pointService = new PointService();
    this.userService = new UserService();
  }

  // Start authentication process - now simplified to just contact sharing
  async startAuthentication(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) {
      return;
    }

    try {
      // Check if user is already authenticated
      const existingClient = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (existingClient) {
        await this.showMainMenu(ctx);
        return;
      }

      // Check if user is staff
      const staff = await this.userService.getByTelegramId(ctx.from.id);
      if (staff && ['barista', 'manager', 'admin'].includes(staff.role)) {
        await this.bot.sendMessage(ctx.message.chat.id, 
          '👨‍💼 Вы уже зарегистрированы как сотрудник.\n\nИспользуйте команду /start для доступа к рабочей панели.'
        );
        return;
      }

      // Show contact sharing request
      await this.requestContact(ctx);

    } catch (error) {
      console.error('Start authentication error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Request contact sharing
  private async requestContact(ctx: BotContext): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const welcomeMessage = 
      '🎉 *Добро пожаловать в Rock Coffee!*\n\n' +
      '☕ Присоединяйтесь к программе лояльности и получайте баллы за каждую покупку!\n\n' +
      '🎯 *Преимущества программы:*\n' +
      '• Баллы за покупки\n' +
      '• Скидки и специальные предложения\n' +
      '• Бонусы в день рождения\n' +
      '• Накопление без срока истечения\n\n' +
      '📱 *Для входа поделитесь своим контактом:*';

    const keyboard: TelegramBot.ReplyKeyboardMarkup = {
      keyboard: [
        [{ text: '📱 Поделиться контактом', request_contact: true }]
      ],
      one_time_keyboard: true,
      resize_keyboard: true
    };

    await this.bot.sendMessage(ctx.message.chat.id, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // Set session to wait for contact
    if (!ctx.session) {
      ctx.session = {};
    }
    ctx.session.waitingFor = 'contact_auth';
  }

  // Process contact sharing for authentication
  async processContactAuth(ctx: BotContext, contact: TelegramBot.Contact): Promise<void> {
    if (!ctx.message?.chat?.id || !ctx.from) return;

    try {
      // Normalize phone number
      const normalizedPhone = this.normalizePhone(contact.phone_number);

      if (!this.validatePhone(normalizedPhone)) {
        await this.bot.sendMessage(ctx.message.chat.id,
          '❌ Некорректный номер телефона в контакте.\n\n' +
          'Попробуйте поделиться контактом еще раз или обратитесь к персоналу.',
          { reply_markup: { remove_keyboard: true } }
        );
        return;
      }

      // Extract names from contact
      const firstName = getFirstName(contact);
      const lastName = getLastName(contact);

      // Find or create client using database function
      const result = await this.clientService.findOrCreateByPhone(
        normalizedPhone, 
        ctx.from.id,
        firstName,
        lastName
      );

      if (!result) {
        throw new Error('Failed to authenticate or create client');
      }

      const { client_id, is_new_client, card_number, full_name, balance } = result;

      // Clear contact auth session
      if (ctx.session) {
        delete ctx.session.waitingFor;
      }

      if (is_new_client) {
        // For new clients, ask for name after contact auth
        await this.requestNameInput(ctx, { client_id, card_number, full_name, balance });
      } else {
        // For existing clients, show returning message and main menu
        await this.showReturningClientMessage(ctx, { card_number, full_name, balance });
        setTimeout(async () => {
          await this.showMainMenu(ctx);
        }, 2500);
      }

    } catch (error) {
      console.error('Process contact auth error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, 
        '❌ Произошла ошибка при входе в систему. Попробуйте позже или обратитесь к персоналу.',
        { reply_markup: { remove_keyboard: true } }
      );
    }
  }

  // Show welcome message for new clients
  private async showWelcomeMessage(ctx: BotContext, clientData: any): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const welcomeMessage = 
      '🎉 *Добро пожаловать в Rock Coffee!*\n\n' +
      `👤 ${clientData.full_name}\n` +
      `💳 Ваша карта: \`${clientData.card_number}\`\n` +
      `💰 Приветственный бонус: *${clientData.balance} баллов*\n\n` +
      `☕ *Как пользоваться:*\n` +
      `• Сообщите номер карты бариста\n` +
      `• Получайте баллы за покупки\n` +
      `• Тратьте баллы на скидки\n\n` +
      `🎯 Добро пожаловать в семью Rock Coffee!`;

    await this.bot.sendMessage(ctx.message.chat.id, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
  }

  // Request name input for new clients
  private async requestNameInput(ctx: BotContext, clientData: any): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const nameRequestMessage = 
      '🎉 *Добро пожаловать в Rock Coffee!*\n\n' +
      `💳 Ваша карта: \`${clientData.card_number}\`\n` +
      `💰 Приветственный бонус: *${clientData.balance} баллов*\n\n` +
      '👤 *Как к вам обращаться?*\n' +
      'Введите ваше имя (одно слово):\n\n' +
      '💡 Например: Алексей, Мария, Дмитрий';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '⏭️ Пропустить', callback_data: 'skip_name_input' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id, nameRequestMessage, {
      parse_mode: 'Markdown',
      reply_markup: { 
        inline_keyboard: keyboard,
        remove_keyboard: true 
      }
    });

    // Set session to wait for name
    if (!ctx.session) {
      ctx.session = {};
    }
    ctx.session.waitingFor = 'contact_auth_name';
    ctx.session.clientData = clientData;
  }

  // Process name input after contact auth
  async processContactAuthName(ctx: BotContext, name: string): Promise<void> {
    if (!ctx.message?.chat?.id || !ctx.from) return;

    // Skip if empty
    if (name === 'skip') {
      await this.completeContactAuth(ctx);
      return;
    }

    // Validate single word name
    if (!this.validateSingleWordName(name)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Пожалуйста, введите только одно слово.\n\n' +
        '✅ Правильно: Алексей, Мария, Дмитрий\n' +
        '❌ Неправильно: Алексей Петров, два слова'
      );
      return;
    }

    try {
      // Update client's name
      await this.clientService.updateProfile(ctx.from.id, {
        full_name: name.trim(),
        first_name: name.trim()
      });

      await this.completeContactAuth(ctx, name.trim());

    } catch (error) {
      console.error('Process contact auth name error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при сохранении имени.');
    }
  }

  // Complete contact authentication flow
  private async completeContactAuth(ctx: BotContext, name?: string): Promise<void> {
    if (!ctx.message?.chat?.id || !ctx.session?.clientData) return;

    const clientData = ctx.session.clientData;

    const completionMessage = 
      '✅ *Регистрация завершена!*\n\n' +
      `👤 ${name || 'Друг'}\n` +
      `💳 Карта: \`${clientData.card_number}\`\n` +
      `💰 Баланс: *${clientData.balance} баллов*\n\n` +
      '🎯 *Как пользоваться:*\n' +
      '• Сообщите номер карты бариста\n' +
      '• Получайте баллы за покупки\n' +
      '• Тратьте баллы на скидки\n\n' +
      '☕ Добро пожаловать в семью Rock Coffee!';

    await this.bot.sendMessage(ctx.message.chat.id, completionMessage, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });

    // Clear session
    if (ctx.session) {
      delete ctx.session.waitingFor;
      delete ctx.session.clientData;
    }

    // Show main menu after delay
    setTimeout(async () => {
      await this.showMainMenu(ctx);
    }, 2500);
  }

  // Show returning client message
  private async showReturningClientMessage(ctx: BotContext, clientData: any): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const welcomeMessage = 
      '👋 *С возвращением!*\n\n' +
      `💳 Ваша карта: \`${clientData.card_number}\`\n` +
      `💰 Баланс баллов: *${clientData.balance}*\n\n` +
      `☕ Рады видеть вас снова в Rock Coffee!`;

    await this.bot.sendMessage(ctx.message.chat.id, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
  }

  // Show main client menu
  async showMainMenu(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.startAuthentication(ctx);
        return;
      }

      const firstName = client.first_name || getFirstName(null, client.full_name);
      const lastVisitText = client.last_visit 
        ? new Date(client.last_visit).toLocaleDateString('ru-RU')
        : 'Добро пожаловать впервые!';

      const welcomeText = 
        `☕ *Rock Coffee*\n\n` +
        `👋 Привет, ${firstName}!\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Баллы: *${client.balance}*\n` +
        `📅 ${lastVisitText}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '💳 Моя карта', callback_data: 'my_card' },
          { text: '⚙️ Профиль', callback_data: 'my_profile' }
        ],
        [
          { text: '📍 Наша кофейня', callback_data: 'coffee_shops' },
          { text: '📱 Соц. сети', callback_data: 'social_media' }
        ],
        [
          { text: 'ℹ️ О программе', callback_data: 'about_program' }
        ]
      ];

      // Show profile completion reminder if needed
      if (client.auth_method === 'phone_contact' && !client.profile_completed) {
        keyboard.unshift([
          { text: '📝 Дополнить профиль', callback_data: 'complete_profile' }
        ]);
      }

      await this.bot.sendMessage(ctx.message.chat.id, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Show main menu error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Произошла ошибка при загрузке главного меню.');
    }
  }

  // Show loyalty card
  async showLoyaltyCard(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.startAuthentication(ctx);
        return;
      }

      // Get recent transactions
      const recentTransactions = await this.pointService.getClientTransactions(client.id, 5);
      
      const lastVisitText = client.last_visit
        ? new Date(client.last_visit).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Никогда';

      let cardMessage = 
        `💳 *Карта лояльности*\n\n` +
        `👤 ${client.full_name}\n` +
        `🆔 Номер карты: \`${client.card_number}\`\n` +
        `💰 Баланс: *${client.balance} баллов*\n` +
        `📅 Последний визит: ${lastVisitText}\n` +
        `🔢 Всего визитов: *${client.visit_count}*\n\n`;

      if (recentTransactions.length > 0) {
        cardMessage += `📊 *Последние операции:*\n`;
        recentTransactions.forEach(transaction => {
          const icon = transaction.points > 0 ? '➕' : '➖';
          const date = new Date(transaction.created_at).toLocaleDateString('ru-RU');
          cardMessage += `${icon} ${Math.abs(transaction.points)} баллов (${date})\n`;
        });
      } else {
        cardMessage += `📊 История операций пока пуста\n`;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '🔄 Обновить', callback_data: 'my_card' }],
        [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, cardMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Show loyalty card error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке карты лояльности.');
    }
  }

  // Show client profile
  async showProfile(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.startAuthentication(ctx);
        return;
      }

      const birthDateText = client.birth_date 
        ? new Date(client.birth_date).toLocaleDateString('ru-RU')
        : 'Не указана';

      const authMethodText = {
        'full_registration': 'Полная регистрация',
        'phone_contact': 'По номеру телефона',
        'manual': 'Вручную персоналом'
      }[client.auth_method as string] || 'Неизвестно';

      const profileMessage = 
        `⚙️ *Мой профиль*\n\n` +
        `👤 ФИО: ${client.full_name}\n` +
        `📱 Телефон: ${client.phone || 'Не указан'}\n` +
        `🎂 День рождения: ${birthDateText}\n` +
        `📅 Дата регистрации: ${new Date(client.created_at).toLocaleDateString('ru-RU')}\n` +
        `🔐 Способ входа: ${authMethodText}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '✏️ Изменить имя', callback_data: 'edit_name' },
          { text: '📱 Изменить телефон', callback_data: 'edit_phone' }
        ],
        [
          { text: '🎂 Изменить день рождения', callback_data: 'edit_birthday' }
        ],
        [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, profileMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Show profile error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке профиля.');
    }
  }

  // Start profile completion for phone-only clients
  async startProfileCompletion(ctx: BotContext): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const completionMessage = 
      '📝 *Дополнение профиля*\n\n' +
      'Вы вошли через номер телефона. Хотите дополнить профиль для получения дополнительных бонусов?\n\n' +
      '🎂 Укажите дату рождения для праздничных бонусов!\n\n' +
      '👤 *Введите ваше полное имя:*\n' +
      'Например: Иванов Иван Иванович';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '⏭️ Пропустить', callback_data: 'skip_profile_completion' }],
      [{ text: '❌ Отмена', callback_data: 'client_main_menu' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id, completionMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard, remove_keyboard: true }
    });

    if (!ctx.session) {
      ctx.session = {};
    }
    ctx.session.waitingFor = 'profile_full_name';
  }

  // Process full name for profile completion
  async processProfileFullName(ctx: BotContext, fullName: string): Promise<void> {
    if (!ctx.message?.chat?.id || !ctx.from) return;

    if (!this.validateFullName(fullName)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Пожалуйста, введите полное имя (минимум Фамилия и Имя).\n\n' +
        'Например: Иванов Иван или Иванов Иван Иванович'
      );
      return;
    }

    try {
      // Update client's full name and first name
      await this.clientService.updateProfile(ctx.from.id, {
        full_name: fullName.trim(),
        first_name: getFirstName(null, fullName.trim())
      });

      const birthdayMessage = 
        '🎂 *Дата рождения (необязательно):*\n\n' +
        'Формат: ДД.ММ.ГГГГ\n' +
        'Например: 15.06.1990\n\n' +
        '💡 Нужно для поздравлений и праздничных бонусов!';

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '⏭️ Пропустить', callback_data: 'complete_profile_final' }],
        [{ text: '❌ Отмена', callback_data: 'client_main_menu' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, birthdayMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      if (ctx.session) {
        ctx.session.waitingFor = 'profile_birth_date';
      }

    } catch (error) {
      console.error('Process profile full name error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при обновлении профиля.');
    }
  }

  // Process birth date for profile completion
  async processProfileBirthDate(ctx: BotContext, birthDate: string): Promise<void> {
    if (!birthDate || birthDate === 'skip') {
      await this.completeProfile(ctx);
      return;
    }

    if (!this.validateBirthDate(birthDate)) {
      await this.bot.sendMessage(ctx.message.chat.id!,
        '❌ Некорректная дата рождения.\n\n' +
        'Используйте формат: ДД.ММ.ГГГГ (например: 15.06.1990)'
      );
      return;
    }

    await this.completeProfile(ctx, birthDate);
  }

  // Complete profile setup
  private async completeProfile(ctx: BotContext, birthDate?: string): Promise<void> {
    if (!ctx.from) return;

    try {
      await this.clientService.completeProfile(ctx.from.id, birthDate);

      const successMessage = 
        '✅ *Профиль дополнен!*\n\n' +
        (birthDate ? '🎂 Не забудьте заглянуть к нам в день рождения за бонусом!\n\n' : '') +
        '☕ Спасибо за доверие! Теперь вы получите максимум от программы лояльности.';

      await this.bot.sendMessage(ctx.message.chat.id!, successMessage, {
        parse_mode: 'Markdown'
      });

      // Clear session
      if (ctx.session) {
        delete ctx.session.waitingFor;
      }

      // Show updated main menu
      setTimeout(async () => {
        await this.showMainMenu(ctx);
      }, 2000);

    } catch (error) {
      console.error('Complete profile error:', error);
      await this.bot.sendMessage(ctx.message.chat.id!, '❌ Ошибка при завершении профиля.');
    }
  }

  // Show coffee shop information
  async showCoffeeShops(ctx: BotContext): Promise<void> {
    const shopInfo = 
      `📍 *Rock Coffee*\n\n` +
      `🏪 **Наш адрес:**\n` +
      `ул. Красная, 4\n` +
      `г. Калининград\n\n` +
      `⏰ **Время работы:**\n` +
      `Пн-Вс: 9:00 - 21:00`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '🗺️ Показать на карте', url: 'https://yandex.ru/maps?whatshere%5Bpoint%5D=20.475075692115222%2C54.72108365189035&whatshere%5Bzoom%5D=16.0&ll=20.475075692115215%2C54.721083651502035&z=16.0&si=gdvp5w39jyyx0q54jj7byzrd6r' }],
      [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id!, shopInfo, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Show social media links
  async showSocialMedia(ctx: BotContext): Promise<void> {
    const socialMessage = 
      `📱 *Наши социальные сети*\n\n` +
      `Следите за новостями, акциями и специальными предложениями:`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '💬 Telegram', url: 'https://t.me/rock_coffee_kld' }],
      [{ text: '📱 Другие соц.сети', url: 'https://www.instagram.com/rockcoffee.kld?utm_source=qr&igsh=NzV2Y3Z4cjNiM2ly' }],
      [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id!, socialMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Show program information
  async showAboutProgram(ctx: BotContext): Promise<void> {
    const aboutMessage = 
      `ℹ️ *О программе лояльности*\n\n` +
      `💎 **Как это работает:**\n` +
      `• Поделитесь контактом для входа\n` +
      `• Получайте баллы за покупки\n` +
      `• Обменивайте баллы на напитки\n` +
      `• Накапливайте баллы без срока истечения\n\n` +
      `❓ **Вопросы?**\n` +
      `Обращайтесь к нашим бариста!`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id!, aboutMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Validation methods
  private validateFullName(name: string): boolean {
    if (!name || name.trim().length < 5) return false;
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 && /^[А-Яа-яЁё\s-]+$/.test(name);
  }

  private validatePhone(phone: string): boolean {
    return /^\+7\d{10}$/.test(phone);
  }

  private validateBirthDate(date: string): boolean {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return false;
    
    const [day, month, year] = date.split('.').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    
    return birthDate < today && year > 1900;
  }

  // Validate single word name
  private validateSingleWordName(name: string): boolean {
    if (!name || name.trim().length === 0) return false;
    const trimmed = name.trim();
    
    // Check that it's a single word (no spaces)
    if (trimmed.includes(' ')) return false;
    
    // Check that it contains only letters (Russian or English)
    if (!/^[А-Яа-яЁёA-Za-z]+$/.test(trimmed)) return false;
    
    // Check reasonable length
    if (trimmed.length < 2 || trimmed.length > 20) return false;
    
    return true;
  }

  // Normalize phone number to +7XXXXXXXXXX format
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    
    if (digits.startsWith('8') && digits.length === 11) {
      return '+7' + digits.substring(1);
    } else if (digits.startsWith('7') && digits.length === 11) {
      return '+' + digits;
    } else if (digits.length === 10) {
      return '+7' + digits;
    }
    
    return '+' + digits;
  }

}