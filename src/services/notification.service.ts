import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from './client.service';
import { UserService } from './user.service';
import Database from '../config/database';

export class NotificationService {
  private bot: TelegramBot;
  private clientService: ClientService;
  private userService: UserService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
    this.userService = new UserService();
  }

  // Notify client about points earned
  async notifyPointsEarned(clientId: number, points: number, totalBalance: number): Promise<void> {
    try {
      const client = await this.clientService.getForBarista(clientId);
      
      if (!client || !client.telegram_id) {
        return; // Client not registered in Telegram
      }

      const message = 
        `🎉 *Вам начислены баллы!*\n\n` +
        `⭐ Начислено: *${points} баллов*\n` +
        `💰 Ваш баланс: *${totalBalance} баллов*\n\n` +
        `☕ Спасибо за покупку в Rock Coffee!`;

      await this.bot.sendMessage(client.telegram_id, message, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error notifying points earned:', error);
    }
  }

  // Notify client about points spent
  async notifyPointsSpent(clientId: number, points: number, totalBalance: number, discountAmount: number): Promise<void> {
    try {
      const client = await this.clientService.getForBarista(clientId);
      
      if (!client || !client.telegram_id) {
        return; // Client not registered in Telegram
      }

      const message = 
        `💸 *Баллы использованы!*\n\n` +
        `⭐ Списано: *${points} баллов*\n` +
        `💰 Экономия: ${points} баллов\n` +
        `💳 Остаток баллов: *${totalBalance}*\n\n` +
        `☕ До встречи в Rock Coffee!`;

      await this.bot.sendMessage(client.telegram_id, message, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error notifying points spent:', error);
    }
  }

  // Notify client about birthday bonus
  async notifyBirthdayBonus(clientId: number, bonusPoints: number): Promise<void> {
    try {
      const client = await this.clientService.getForBarista(clientId);
      
      if (!client || !client.telegram_id) {
        return; // Client not registered in Telegram
      }

      const message = 
        `🎂 *С днем рождения!*\n\n` +
        `🎁 Поздравляем с днем рождения от команды Rock Coffee!\n\n` +
        `⭐ Подарок: *${bonusPoints} бонусных баллов*\n` +
        `💰 Ваш баланс: *${client.balance + bonusPoints} баллов*\n\n` +
        `☕ Приходите отпраздновать с нашим вкусным кофе!`;

      await this.bot.sendMessage(client.telegram_id, message, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error notifying birthday bonus:', error);
    }
  }

  // Send welcome message to new client
  async welcomeNewClient(clientId: number, cardNumber: string, welcomeBonus: number = 0): Promise<void> {
    try {
      const client = await this.clientService.getForBarista(clientId);
      
      if (!client || !client.telegram_id) {
        return; // Client not registered in Telegram
      }

      let message = 
        `🎉 *Добро пожаловать в Rock Coffee!*\n\n` +
        `👋 Привет, ${client.full_name}!\n\n` +
        `💳 Ваша карта лояльности: \`${cardNumber}\`\n`;

      if (welcomeBonus > 0) {
        message += 
          `🎁 Приветственный бонус: *${welcomeBonus} баллов*\n` +
          `💰 Ваш баланс: *${welcomeBonus} баллов*\n\n`;
      }

      message += 
        `📍 *Как работает программа лояльности:*\n` +
        `• Баллы начисляются за покупки\n` +
        `• Баллы можно потратить на скидки\n` +
        `• Специальные предложения для участников\n` +
        `• Бонусы в день рождения\n\n` +
        `☕ Добро пожаловать в нашу кофейную семью!`;

      await this.bot.sendMessage(client.telegram_id, message, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  // Send promotional message to all clients
  async sendPromotion(title: string, message: string, imageUrl?: string): Promise<number> {
    try {
      // Get all clients with telegram_id
      const sql = `
        SELECT telegram_id, full_name
        FROM clients
        WHERE telegram_id IS NOT NULL AND is_active = true
      `;
      
      const clients = await Database.query(sql);
      let sentCount = 0;

      const promotionMessage = 
        `🎯 *${title}*\n\n` +
        `${message}\n\n` +
        `☕ Rock Coffee`;

      for (const client of clients) {
        try {
          if (imageUrl) {
            await this.bot.sendPhoto(client.telegram_id, imageUrl, {
              caption: promotionMessage,
              parse_mode: 'Markdown'
            });
          } else {
            await this.bot.sendMessage(client.telegram_id, promotionMessage, {
              parse_mode: 'Markdown'
            });
          }
          
          sentCount++;
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error sending promotion to client ${client.telegram_id}:`, error);
        }
      }

      return sentCount;

    } catch (error) {
      console.error('Error sending promotion:', error);
      return 0;
    }
  }

  // Notify managers about low balance clients (who haven't visited recently)
  async notifyLowActivityClients(): Promise<void> {
    try {
      const sql = `
        SELECT id, card_number, full_name, last_visit, balance
        FROM clients
        WHERE is_active = true 
          AND last_visit < NOW() - INTERVAL '30 days'
          AND balance > 0
        ORDER BY last_visit ASC
        LIMIT 10
      `;
      
      const inactiveClients = await Database.query(sql);
      
      if (inactiveClients.length === 0) {
        return;
      }

      // Get managers to notify
      const managers = await this.userService.getByRole('manager');
      
      let notificationMessage = '📊 *Клиенты с низкой активностью*\n\n';
      notificationMessage += 'Клиенты с баллами, которые давно не посещали кофейню:\n\n';
      
      for (const client of inactiveClients) {
        const daysSinceVisit = Math.floor(
          (Date.now() - new Date(client.last_visit).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        notificationMessage += 
          `👤 ${client.full_name}\n` +
          `💳 #${client.card_number}\n` +
          `💰 ${client.balance} баллов\n` +
          `📅 ${daysSinceVisit} дней назад\n\n`;
      }

      notificationMessage += '💡 Рассмотрите возможность отправки персональных предложений.';

      for (const manager of managers) {
        if (manager.telegram_id) {
          await this.bot.sendMessage(manager.telegram_id, notificationMessage, {
            parse_mode: 'Markdown'
          });
        }
      }

    } catch (error) {
      console.error('Error notifying low activity clients:', error);
    }
  }

  // Send birthday reminders to managers
  async sendBirthdayReminders(): Promise<void> {
    try {
      const birthdayClients = await this.clientService.getBirthdayClients();
      
      if (birthdayClients.length === 0) {
        return;
      }

      // Get managers to notify
      const managers = await this.userService.getByRole('manager');
      
      let message = '🎂 *Дни рождения на этой неделе*\n\n';
      
      for (const client of birthdayClients) {
        const birthDate = new Date(client.birth_date!);
        message += 
          `👤 ${client.full_name}\n` +
          `💳 #${client.card_number}\n` +
          `🎂 ${birthDate.getDate()}.${birthDate.getMonth() + 1}\n` +
          `💰 ${client.balance} баллов\n\n`;
      }

      message += '💡 Не забудьте поздравить клиентов и начислить праздничные бонусы!';

      for (const manager of managers) {
        if (manager.telegram_id) {
          await this.bot.sendMessage(manager.telegram_id, message, {
            parse_mode: 'Markdown'
          });
        }
      }

    } catch (error) {
      console.error('Error sending birthday reminders:', error);
    }
  }

  // Send daily statistics to managers
  async sendDailyStats(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const sql = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT client_id) as unique_clients,
          COUNT(DISTINCT operator_id) as active_baristas,
          SUM(CASE WHEN operation_type = 'earn' THEN points ELSE 0 END) as points_earned,
          SUM(CASE WHEN operation_type = 'spend' THEN ABS(points) ELSE 0 END) as points_spent,
          SUM(CASE WHEN operation_type = 'earn' THEN amount ELSE 0 END) as total_revenue
        FROM point_transactions
        WHERE created_at >= $1 AND created_at < $2
          AND operation_type IN ('earn', 'spend')
      `;

      const stats = await Database.queryOne(sql, [today, tomorrow]);
      
      const managers = await this.userService.getByRole('manager');

      const message = 
        `📊 *Дневная статистика*\n` +
        `📅 ${today.toLocaleDateString('ru-RU')}\n\n` +
        `👥 Обслужено клиентов: *${stats.unique_clients || 0}*\n` +
        `👔 Работало бариста: *${stats.active_baristas || 0}*\n` +
        `📝 Всего операций: *${stats.total_transactions || 0}*\n` +
        `⭐ Начислено баллов: *${stats.points_earned || 0}*\n` +
        `💸 Списано баллов: *${stats.points_spent || 0}*\n` +
        `💰 Начислено баллов: *${stats.total_points_earned || 0}*`;

      for (const manager of managers) {
        if (manager.telegram_id) {
          await this.bot.sendMessage(manager.telegram_id, message, {
            parse_mode: 'Markdown'
          });
        }
      }

    } catch (error) {
      console.error('Error sending daily stats:', error);
    }
  }
}