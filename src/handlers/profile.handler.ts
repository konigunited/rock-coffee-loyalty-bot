import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from '../services/client.service';
import { BotContext } from '../middleware/access.middleware';

export class ProfileHandler {
  private bot: TelegramBot;
  private clientService: ClientService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
  }

  // Start editing name
  async editName(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.bot.sendMessage(ctx.message.chat.id, '❌ Клиент не найден.');
        return;
      }

      const editMessage = 
        `✏️ *Редактирование имени*\n\n` +
        `Текущее имя: ${client.full_name}\n\n` +
        `Введите новое полное имя:\n` +
        `Например: Иванов Иван Иванович`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ Отмена', callback_data: 'my_profile' }]
      ];

      await this.editOrSendMessage(ctx, editMessage, keyboard);

      // Set session state
      if (!ctx.session) ctx.session = {};
      ctx.session.editing = { field: 'full_name', clientId: client.id };
      ctx.session.waitingFor = 'edit_name';

    } catch (error) {
      console.error('Edit name error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при редактировании имени.');
    }
  }

  // Start editing phone
  async editPhone(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.bot.sendMessage(ctx.message.chat.id, '❌ Клиент не найден.');
        return;
      }

      const editMessage = 
        `📱 *Редактирование телефона*\n\n` +
        `Текущий номер: ${client.phone}\n\n` +
        `Введите новый номер телефона или поделитесь контактом:`;

      await this.bot.sendMessage(ctx.message.chat.id, editMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Поделиться новым контактом', request_contact: true }],
            [{ text: '❌ Отмена' }]
          ],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });

      // Set session state
      if (!ctx.session) ctx.session = {};
      ctx.session.editing = { field: 'phone', clientId: client.id };
      ctx.session.waitingFor = 'edit_phone';

    } catch (error) {
      console.error('Edit phone error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при редактировании телефона.');
    }
  }

  // Start editing birthday
  async editBirthday(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const client = await this.clientService.getByTelegramId(ctx.from.id);
      
      if (!client) {
        await this.bot.sendMessage(ctx.message.chat.id, '❌ Клиент не найден.');
        return;
      }

      const currentBirthday = client.birth_date 
        ? new Date(client.birth_date).toLocaleDateString('ru-RU')
        : 'не указана';

      const editMessage = 
        `🎂 *Редактирование даты рождения*\n\n` +
        `Текущая дата: ${currentBirthday}\n\n` +
        `Введите новую дату рождения:\n` +
        `Формат: ДД.ММ.ГГГГ (например: 15.06.1990)`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '🗑️ Удалить дату рождения', callback_data: 'remove_birthday' }],
        [{ text: '◀️ Отмена', callback_data: 'my_profile' }]
      ];

      await this.editOrSendMessage(ctx, editMessage, keyboard);

      // Set session state
      if (!ctx.session) ctx.session = {};
      ctx.session.editing = { field: 'birth_date', clientId: client.id };
      ctx.session.waitingFor = 'edit_birthday';

    } catch (error) {
      console.error('Edit birthday error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при редактировании даты рождения.');
    }
  }

  // Process name edit
  async processNameEdit(ctx: BotContext, newName: string): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    if (!this.validateFullName(newName)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Некорректное имя.\n\n' +
        'Введите полное имя (минимум Фамилия и Имя).\n' +
        'Например: Иванов Иван или Иванов Иван Иванович'
      );
      return;
    }

    await this.processEdit(ctx, 'full_name', newName.trim());
  }

  // Process phone edit
  async processPhoneEdit(ctx: BotContext, newPhone: string): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const normalizedPhone = this.normalizePhone(newPhone);

    if (!this.validatePhone(normalizedPhone)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Некорректный номер телефона.\n\n' +
        'Введите номер в формате: +7XXXXXXXXXX или 8XXXXXXXXXX',
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    // Check if phone is already used by another client
    try {
      const existingClient = await this.clientService.getByPhone(normalizedPhone);
      if (existingClient && existingClient.id !== ctx.session?.editing?.clientId) {
        await this.bot.sendMessage(ctx.message.chat.id,
          '❌ Этот номер телефона уже используется другим клиентом.',
          { reply_markup: { remove_keyboard: true } }
        );
        return;
      }
    } catch (error) {
      console.error('Phone check error:', error);
    }

    await this.processEdit(ctx, 'phone', normalizedPhone);
  }

  // Process birthday edit
  async processBirthdayEdit(ctx: BotContext, newBirthday: string): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    if (!this.validateBirthDate(newBirthday)) {
      await this.bot.sendMessage(ctx.message.chat.id,
        '❌ Некорректная дата рождения.\n\n' +
        'Используйте формат: ДД.ММ.ГГГГ (например: 15.06.1990)'
      );
      return;
    }

    await this.processEdit(ctx, 'birth_date', newBirthday);
  }

  // Remove birthday
  async removeBirthday(ctx: BotContext): Promise<void> {
    await this.processEdit(ctx, 'birth_date', null);
  }

  // Process field edit
  private async processEdit(ctx: BotContext, field: string, value: string | null): Promise<void> {
    if (!ctx.message?.chat?.id || !ctx.session?.editing) return;

    const { clientId } = ctx.session.editing;

    try {
      // Update the client field
      await this.clientService.updateClientField(clientId, field, value);

      // Get updated client data
      const updatedClient = await this.clientService.getByTelegramId(ctx.from!.id);
      if (!updatedClient) {
        throw new Error('Failed to get updated client data');
      }

      // Success message based on field
      let successMessage: string;
      switch (field) {
        case 'full_name':
          successMessage = `✅ Имя успешно изменено на: ${value}`;
          break;
        case 'phone':
          successMessage = `✅ Номер телефона успешно изменен на: ${value}`;
          break;
        case 'birth_date':
          if (value === null) {
            successMessage = '✅ Дата рождения успешно удалена';
          } else {
            const formattedDate = new Date(this.parseBirthDate(value!)).toLocaleDateString('ru-RU');
            successMessage = `✅ Дата рождения успешно изменена на: ${formattedDate}`;
          }
          break;
        default:
          successMessage = '✅ Профиль успешно обновлен!';
      }

      await this.bot.sendMessage(ctx.message.chat.id, successMessage, {
        reply_markup: { remove_keyboard: true }
      });

      // Clear editing session
      delete ctx.session.editing;
      delete ctx.session.waitingFor;

      // Show updated profile after short delay
      setTimeout(async () => {
        // Import ClientHandler to show profile
        const { ClientHandler } = await import('./client.handler');
        const clientHandler = new ClientHandler(this.bot);
        await clientHandler.showProfile(ctx);
      }, 1500);

    } catch (error) {
      console.error('Process edit error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, 
        '❌ Ошибка при обновлении профиля. Попробуйте позже.',
        { reply_markup: { remove_keyboard: true } }
      );

      // Clear editing session on error
      if (ctx.session) {
        delete ctx.session.editing;
        delete ctx.session.waitingFor;
      }
    }
  }

  // Cancel editing
  async cancelEdit(ctx: BotContext): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    // Clear editing session
    if (ctx.session) {
      delete ctx.session.editing;
      delete ctx.session.waitingFor;
    }

    await this.bot.sendMessage(ctx.message.chat.id, 
      '❌ Редактирование отменено.',
      { reply_markup: { remove_keyboard: true } }
    );

    // Show profile after short delay
    setTimeout(async () => {
      const { ClientHandler } = await import('./client.handler');
      const clientHandler = new ClientHandler(this.bot);
      await clientHandler.showProfile(ctx);
    }, 1000);
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
    
    return birthDate < today && year > 1900 && birthDate.getFullYear() === year;
  }

  // Normalize phone number
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

  // Parse birth date from DD.MM.YYYY to YYYY-MM-DD
  private parseBirthDate(dateString: string): string {
    const [day, month, year] = dateString.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

    // Always send new message for stability
    await this.bot.sendMessage(ctx.message.chat.id, text, messageOptions);
  }
}