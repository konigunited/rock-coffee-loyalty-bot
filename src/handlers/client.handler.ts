import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from '../services/client.service';
import { PointService } from '../services/point.service';
import { UserService } from '../services/user.service';
import { BotContext, getCurrentUser } from '../middleware/access.middleware';
import { CreateClientData } from '../types/client.types';

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

  // Start client registration process
  async startRegistration(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) {
      return;
    }

    try {
      // Check if user is already registered
      const existingClient = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (existingClient) {
        await this.showMainMenu(ctx);
        return;
      }

      // Check if user is staff
      const staff = await this.userService.getByTelegramId(ctx.from.id);
      if (staff && ['barista', 'manager', 'admin'].includes(staff.role)) {
        // Staff should not register as clients
        await this.bot.sendMessage(ctx.message.chat.id, 
          '👨‍💼 Вы уже зарегистрированы как сотрудник.\n\nИспользуйте команду /start для доступа к рабочей панели.'
        );
        return;
      }

      const welcomeMessage = 
        '🎉 *Добро пожаловать в Rock Coffee!*\n\n' +
        '☕ Зарегистрируйтесь в программе лояльности и получайте баллы за каждую покупку!\n\n' +
        '🎯 *Преимущества программы:*\n' +
        '• Начисление баллов по усмотрению\n' +
        '• Списание баллов по усмотрению\n' +
        '• Бонусы в день рождения\n' +
        '• Уведомления о специальных предложениях\n\n' +
        '👤 *Введите ваше полное имя:*\n' +
        'Например: Иванов Иван Иванович';

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '❌ Отмена', callback_data: 'cancel_registration' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      // Initialize registration session
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.registration = {};
      ctx.session.waitingFor = 'full_name';

    } catch (error) {
      console.error('Start registration error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  // Process full name input
  async processFullName(ctx: BotContext, fullName: string): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    // Validate full name
    if (!this.validateFullName(fullName)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Пожалуйста, введите полное имя (минимум Фамилия и Имя).\n\n' +
        'Например: Иванов Иван или Иванов Иван Иванович'
      );
      return;
    }

    if (!ctx.session?.registration) {
      await this.startRegistration(ctx);
      return;
    }

    ctx.session.registration.fullName = fullName.trim();

    const phoneMessage = 
      '📱 *Введите ваш номер телефона:*\n\n' +
      'Можете отправить контакт кнопкой ниже или ввести вручную\n' +
      'Например: +7900123456';

    await this.bot.sendMessage(ctx.message.chat.id, phoneMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '📱 Поделиться контактом', request_contact: true }]
        ],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });

    ctx.session.waitingFor = 'phone';
  }

  // Process phone input
  async processPhone(ctx: BotContext, phone: string): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    // Normalize phone number
    const normalizedPhone = this.normalizePhone(phone);

    if (!this.validatePhone(normalizedPhone)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Некорректный номер телефона.\n\n' +
        'Введите номер в формате: +7XXXXXXXXXX или 8XXXXXXXXXX',
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    // Check if phone is already registered
    try {
      const existingClient = await this.clientService.getByPhone(normalizedPhone);
      if (existingClient) {
        await this.bot.sendMessage(ctx.message.chat.id,
          '❌ Этот номер телефона уже зарегистрирован в системе.\n\n' +
          'Если это ваш номер, обратитесь к бариста для восстановления доступа.',
          { reply_markup: { remove_keyboard: true } }
        );
        return;
      }
    } catch (error) {
      console.error('Phone check error:', error);
    }

    if (!ctx.session?.registration) {
      await this.startRegistration(ctx);
      return;
    }

    ctx.session.registration.phone = normalizedPhone;

    const birthdayMessage = 
      '🎂 *Введите дату рождения (необязательно):*\n\n' +
      'Формат: ДД.ММ.ГГГГ\n' +
      'Например: 15.06.1990\n\n' +
      '💡 Нужно для поздравлений и праздничных бонусов!';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '⏭️ Пропустить', callback_data: 'skip_birthday' }],
      [{ text: '❌ Отмена регистрации', callback_data: 'cancel_registration' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id, birthdayMessage, {
      parse_mode: 'Markdown',
      reply_markup: { 
        inline_keyboard: keyboard,
        remove_keyboard: true 
      }
    });

    ctx.session.waitingFor = 'birth_date';
  }

  // Process birth date input
  async processBirthDate(ctx: BotContext, birthDate: string): Promise<void> {
    if (!birthDate || birthDate === 'skip') {
      await this.completeRegistration(ctx);
      return;
    }

    if (!this.validateBirthDate(birthDate)) {
      await this.bot.sendMessage(ctx.message.chat.id!,
        '❌ Некорректная дата рождения.\n\n' +
        'Используйте формат: ДД.ММ.ГГГГ (например: 15.06.1990)'
      );
      return;
    }

    if (!ctx.session?.registration) {
      await this.startRegistration(ctx);
      return;
    }

    ctx.session.registration.birthDate = birthDate;
    await this.completeRegistration(ctx);
  }

  // Complete registration process
  async completeRegistration(ctx: BotContext): Promise<void> {
    if (!ctx.message?.chat?.id || !ctx.session?.registration) {
      await this.startRegistration(ctx);
      return;
    }

    const { fullName, phone, birthDate } = ctx.session.registration;

    if (!fullName || !phone) {
      await this.startRegistration(ctx);
      return;
    }

    try {
      // Create new client
      const clientData: CreateClientData = {
        telegram_id: ctx.from!.id,
        card_number: await this.clientService.generateCardNumber(),
        full_name: fullName,
        phone,
        birth_date: birthDate || null
      };

      const clientId = await this.clientService.create(clientData, 0); // System created
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        throw new Error('Failed to create client');
      }

      const successMessage = 
        '✅ *Регистрация успешно завершена!*\n\n' +
        `👤 ${client.full_name}\n` +
        `💳 Номер карты: \`${client.card_number}\`\n` +
        `💰 Стартовый баланс: *${client.balance} баллов*\n\n` +
        `🎯 *Как это работает:*\n` +
        `• Баллы начисляются баристой/менеджером\n` +
        `• Баллы списываются по вашему желанию\n` +
        `• Получайте бонусы в день рождения\n\n` +
        `☕ Добро пожаловать в Rock Coffee!`;

      await this.bot.sendMessage(ctx.message.chat.id, successMessage, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });

      // Clear registration session
      delete ctx.session.registration;
      delete ctx.session.waitingFor;

      // Show main menu after short delay
      setTimeout(async () => {
        await this.showMainMenu(ctx);
      }, 2000);

    } catch (error) {
      console.error('Complete registration error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, 
        '❌ Произошла ошибка при регистрации. Попробуйте позже или обратитесь к администратору.'
      );
    }
  }

  // Show main client menu
  async showMainMenu(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.startRegistration(ctx);
        return;
      }

      const firstName = client.full_name.split(' ')[0];
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

      const messageOptions: TelegramBot.SendMessageOptions = {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      };

      // Always send new message for stability
      await this.bot.sendMessage(ctx.message.chat.id, welcomeText, messageOptions);

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
        await this.startRegistration(ctx);
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

      await this.editOrSendMessage(ctx, cardMessage, keyboard);

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
        await this.startRegistration(ctx);
        return;
      }

      const birthDateText = client.birth_date 
        ? new Date(client.birth_date).toLocaleDateString('ru-RU')
        : 'Не указана';

      const profileMessage = 
        `⚙️ *Мой профиль*\n\n` +
        `👤 ФИО: ${client.full_name}\n` +
        `📱 Телефон: ${client.phone}\n` +
        `🎂 День рождения: ${birthDateText}\n` +
        `📅 Дата регистрации: ${new Date(client.created_at).toLocaleDateString('ru-RU')}\n` +
        `🏆 Статус: ${this.getClientStatus(client.visit_count || 0)}`;

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

      await this.editOrSendMessage(ctx, profileMessage, keyboard);

    } catch (error) {
      console.error('Show profile error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке профиля.');
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
      `Пн-Вс: 9:00 - 21:00\n\n` +
      `☕ **Что у нас есть:**\n` +
      `• Свежий кофе из лучших зерен\n` +
      `• Свежая выпечка каждый день\n` +
      `• Бесплатный WiFi\n` +
      `• Уютная атмосфера для работы и отдыха`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '🗺️ Показать на карте', url: 'https://yandex.ru/maps?whatshere%5Bpoint%5D=20.475075692115222%2C54.72108365189035&whatshere%5Bzoom%5D=16.0&ll=20.475075692115215%2C54.721083651502035&z=16.0&si=gdvp5w39jyyx0q54jj7byzrd6r' }],
      [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
    ];

    await this.editOrSendMessage(ctx, shopInfo, keyboard);
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

    await this.editOrSendMessage(ctx, socialMessage, keyboard);
  }

  // Show program information
  async showAboutProgram(ctx: BotContext): Promise<void> {
    const aboutMessage = 
      `ℹ️ *О программе лояльности*\n\n` +
      `💎 **Как это работает:**\n` +
      `• Регистрируйтесь бесплатно\n` +
      `• Получайте баллы за покупки\n` +
      `• Обменивайте баллы на напитки\n` +
      `• Накапливайте баллы без срока истечения\n\n` +
      `❓ **Вопросы?**\n` +
      `Обращайтесь к нашим бариста!`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Главная', callback_data: 'client_main_menu' }]
    ];

    await this.editOrSendMessage(ctx, aboutMessage, keyboard);
  }

  // Cancel registration
  async cancelRegistration(ctx: BotContext): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    if (ctx.session) {
      delete ctx.session.registration;
      delete ctx.session.waitingFor;
    }

    const cancelMessage = 
      '❌ Регистрация отменена.\n\n' +
      'Если вы передумаете, всегда можете зарегистрироваться командой /start\n\n' +
      'До встречи в Rock Coffee! ☕';

    await this.bot.sendMessage(ctx.message.chat.id, cancelMessage, {
      reply_markup: { remove_keyboard: true }
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

  // Get client status based on visit count
  private getClientStatus(visitCount: number): string {
    if (visitCount >= 50) return '🥇 VIP клиент';
    if (visitCount >= 11) return '🥈 Друг кофейни';
    return '🥉 Новичок';
  }

  // Helper method to edit or send message
  private async editOrSendMessage(
    ctx: BotContext, 
    text: string, 
    keyboard: TelegramBot.InlineKeyboardButton[][]
  ): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const messageOptions: TelegramBot.SendMessageOptions = {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    };

    // Always send a new message for client interactions to avoid edit conflicts
    await this.bot.sendMessage(ctx.message.chat.id, text, messageOptions);
  }
}