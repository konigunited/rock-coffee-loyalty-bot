import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database';
import { ClientService } from './client.service';

// Helper function to extract first name from full name
function getFirstName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return 'друг';
  
  // Split by spaces and return second part (first name) or first part if only one word
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    return parts[1]; // Return first name (Иван from "Иванов Иван Иванович")
  }
  return parts[0]; // Return single word if no spaces
}

export class ClientNotificationService {
  private bot: TelegramBot;
  private clientService: ClientService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
  }

  // Notify client about points earned
  async notifyPointsEarned(clientId: number, points: number, amount: number, newBalance: number): Promise<void> {
    try {
      const client = await this.clientService.getByTelegramId(0); // Will be updated with proper client lookup
      const clientWithTelegram = await this.getClientWithTelegramId(clientId);
      
      if (!clientWithTelegram?.telegram_id) {
        console.log(`No Telegram ID for client ${clientId}, skipping notification`);
        return;
      }

      const message = 
        `✅ *Баллы начислены!*\n\n` +
        `💰 За покупку: *${amount > 0 ? `${amount}₽` : 'начисление'}*\n` +
        `⭐ Начислено: *+${points} баллов*\n` +
        `💎 Ваш баланс: *${newBalance} баллов*\n\n` +
        `Спасибо за покупку в Rock Coffee! ☕\n\n` +
        `💡 Баллы можно потратить на скидки при следующей покупке`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '💳 Моя карта', callback_data: 'my_card' }],
        [{ text: '🏠 Главное меню', callback_data: 'client_main_menu' }]
      ];

      await this.bot.sendMessage(clientWithTelegram.telegram_id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error notifying points earned:', error);
    }
  }

  // Notify client about points spent
  async notifyPointsSpent(clientId: number, points: number, discountAmount: number, newBalance: number): Promise<void> {
    try {
      const clientWithTelegram = await this.getClientWithTelegramId(clientId);
      
      if (!clientWithTelegram?.telegram_id) {
        console.log(`No Telegram ID for client ${clientId}, skipping notification`);
        return;
      }

      const message = 
        `💸 *Баллы потрачены!*\n\n` +
        `⭐ Списано: *${points} баллов*\n` +
        `💎 Остаток баллов: *${newBalance}*\n\n` +
        `Приятного кофепития! ☕\n\n` +
        `📈 Продолжайте копить баллы за новые покупки!`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '💳 Моя карта', callback_data: 'my_card' }],
        [{ text: '🏠 Главное меню', callback_data: 'client_main_menu' }]
      ];

      await this.bot.sendMessage(clientWithTelegram.telegram_id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error notifying points spent:', error);
    }
  }

  // Send birthday wishes and bonus
  async sendBirthdayWish(clientId: number, bonusPoints: number = 10): Promise<void> {
    try {
      const clientWithTelegram = await this.getClientWithTelegramId(clientId);
      
      if (!clientWithTelegram?.telegram_id) {
        console.log(`No Telegram ID for client ${clientId}, skipping birthday notification`);
        return;
      }

      const firstName = getFirstName(clientWithTelegram.full_name);
      
      const message = 
        `🎉 *С днем рождения, ${firstName}!*\n\n` +
        `🎂 Поздравляем вас с днем рождения от всей команды Rock Coffee!\n\n` +
        `🎁 **Ваш праздничный подарок:**\n` +
        `⭐ ${bonusPoints} бонусных баллов уже начислены!\n` +
        `💎 Ваш новый баланс: *${clientWithTelegram.balance + bonusPoints} баллов*\n\n` +
        `🥳 Желаем здоровья, счастья и отличного настроения!\n` +
        `☕ Ждем вас на праздничный кофе с друзьями и близкими!\n\n` +
        `🎈 Пусть каждый день будет таким же особенным, как сегодня!`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '🎂 Спасибо!', callback_data: 'client_main_menu' }],
        [{ text: '💳 Посмотреть карту', callback_data: 'my_card' }]
      ];

      await this.bot.sendMessage(clientWithTelegram.telegram_id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error sending birthday wish:', error);
    }
  }

  // Send welcome message to new client
  async sendWelcomeMessage(clientId: number, cardNumber: string, welcomeBonus: number = 0): Promise<void> {
    try {
      const clientWithTelegram = await this.getClientWithTelegramId(clientId);
      
      if (!clientWithTelegram?.telegram_id) {
        console.log(`No Telegram ID for client ${clientId}, skipping welcome message`);
        return;
      }

      const firstName = getFirstName(clientWithTelegram.full_name);
      
      let message = 
        `🎉 *Добро пожаловать в Rock Coffee, ${firstName}!*\n\n` +
        `👋 Вы успешно зарегистрировались в нашей программе лояльности!\n\n` +
        `💳 **Ваша карта лояльности:**\n` +
        `🆔 Номер: \`${cardNumber}\`\n`;

      if (welcomeBonus > 0) {
        message += 
          `🎁 **Приветственный бонус:** ${welcomeBonus} баллов\n` +
          `💎 Ваш стартовый баланс: *${welcomeBonus} баллов*\n\n`;
      } else {
        message += `💎 Стартовый баланс: *0 баллов*\n\n`;
      }

      message += 
        `📍 **Как работает программа лояльности:**\n` +
        `• 🛒 Совершайте покупки в нашей кофейне\n` +
        `• ⭐ Получайте баллы за покупки\n` +
        `• 💰 Тратьте баллы на скидки\n` +
        `• 🎂 Получайте праздничные бонусы в день рождения\n` +
        `• 🎉 Узнавайте о специальных предложениях первыми\n\n` +
        `☕ **Приходите за вкусным кофе и копите баллы!**\n\n` +
        `❤️ Добро пожаловать в нашу кофейную семью!`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '💳 Моя карта лояльности', callback_data: 'my_card' }],
        [{ text: '📍 Наша кофейня', callback_data: 'coffee_shops' }],
        [{ text: 'ℹ️ О программе лояльности', callback_data: 'about_program' }]
      ];

      await this.bot.sendMessage(clientWithTelegram.telegram_id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  // Send promotional message to client
  async sendPromotionalMessage(clientId: number, title: string, message: string, imageUrl?: string): Promise<void> {
    try {
      const clientWithTelegram = await this.getClientWithTelegramId(clientId);
      
      if (!clientWithTelegram?.telegram_id) {
        console.log(`No Telegram ID for client ${clientId}, skipping promotional message`);
        return;
      }

      const firstName = getFirstName(clientWithTelegram.full_name);
      
      const promotionMessage = 
        `🎯 *${title}*\n\n` +
        `Привет, ${firstName}! 👋\n\n` +
        `${message}\n\n` +
        `☕ *Rock Coffee* - ваша кофейня`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '💳 Моя карта', callback_data: 'my_card' }],
        [{ text: '📍 Как добраться', callback_data: 'coffee_shops' }]
      ];

      if (imageUrl) {
        await this.bot.sendPhoto(clientWithTelegram.telegram_id, imageUrl, {
          caption: promotionMessage,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await this.bot.sendMessage(clientWithTelegram.telegram_id, promotionMessage, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }

    } catch (error) {
      console.error('Error sending promotional message:', error);
    }
  }

  // Send balance reminder to inactive clients
  async sendBalanceReminder(clientId: number): Promise<void> {
    try {
      const clientWithTelegram = await this.getClientWithTelegramId(clientId);
      
      if (!clientWithTelegram?.telegram_id || clientWithTelegram.balance <= 0) {
        return;
      }

      const firstName = getFirstName(clientWithTelegram.full_name);
      const daysSinceLastVisit = clientWithTelegram.last_visit 
        ? Math.floor((Date.now() - new Date(clientWithTelegram.last_visit).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const message = 
        `😊 *Привет, ${firstName}!*\n\n` +
        `☕ Мы скучаем по вам в Rock Coffee!\n\n` +
        `💎 **У вас есть накопленные баллы:**\n` +
        `⭐ Баланс: *${clientWithTelegram.balance} баллов*\n` +
        `💰 Это ${clientWithTelegram.balance} баллов для скидок!\n\n` +
        `${daysSinceLastVisit ? `🗓 Вы не были у нас уже ${daysSinceLastVisit} дней.\n` : ''}` +
        `🎯 **Приходите и используйте свои баллы:**\n` +
        `• Попробуйте наши новинки\n` +
        `• Получите скидку на любимый напиток\n` +
        `• Накопите еще больше баллов\n\n` +
        `❤️ Ждем вас с ароматным кофе и теплой атмосферой!`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '💳 Мой баланс', callback_data: 'my_card' }],
        [{ text: '📍 Как добраться', callback_data: 'coffee_shops' }]
      ];

      await this.bot.sendMessage(clientWithTelegram.telegram_id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error sending balance reminder:', error);
    }
  }

  // Get client with telegram_id (helper method)
  private async getClientWithTelegramId(clientId: number): Promise<any> {
    const sql = `
      SELECT c.*, c.telegram_id
      FROM clients c
      WHERE c.id = $1 AND c.is_active = true AND c.telegram_id IS NOT NULL
    `;
    
    return await Database.queryOne(sql, [clientId]);
  }
}
