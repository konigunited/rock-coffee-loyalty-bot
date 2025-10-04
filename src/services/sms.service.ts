/**
 * Telegram Message Service
 *
 * Отправка персональных уведомлений клиентам через Telegram бота
 * Заменяет SMS рассылки - все сообщения идут через бота
 */

import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database';

export interface MessageTemplate {
  type: 'birthday' | 'promo' | 'balance' | 'invite' | 'custom';
  message: string;
}

export interface MessageLogEntry {
  id?: number;
  client_id: number;
  telegram_id?: number;
  message: string;
  template_type?: string;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  sent_by: number;
  sent_at?: Date;
}

export class TelegramMessageService {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  /**
   * Send Telegram message to client
   */
  async sendMessage(
    clientId: number,
    message: string,
    templateType?: string,
    sentBy: number = 1
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Get client info
      const client = await Database.queryOne(
        'SELECT id, telegram_id, full_name FROM clients WHERE id = $1',
        [clientId]
      );

      if (!client) {
        throw new Error('Client not found');
      }

      if (!client.telegram_id) {
        throw new Error('Client has no Telegram ID - cannot send message');
      }

      // Validate message
      if (!message || message.length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (message.length > 4000) {
        throw new Error('Message too long (max 4000 characters)');
      }

      let status: MessageLogEntry['status'] = 'sent';
      let errorMessage: string | undefined;

      try {
        // Send message via Telegram
        await this.bot.sendMessage(client.telegram_id, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Моя карта', callback_data: 'my_card' }],
              [{ text: '🏠 Главное меню', callback_data: 'client_main_menu' }]
            ]
          }
        });

        console.log(`📱 Telegram message sent to client ${client.full_name} (${client.telegram_id})`);
      } catch (sendError) {
        status = 'failed';
        errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        console.error(`Failed to send Telegram message to ${client.telegram_id}:`, sendError);
      }

      // Log message attempt to database
      await this.logMessage({
        client_id: clientId,
        telegram_id: client.telegram_id,
        message,
        template_type: templateType,
        status,
        error_message: errorMessage,
        sent_by: sentBy
      });

      if (status === 'failed') {
        return {
          success: false,
          error: errorMessage || 'Failed to send message'
        };
      }

      return {
        success: true,
        message: 'Сообщение отправлено через Telegram'
      };

    } catch (error) {
      console.error('Telegram message send error:', error);

      // Log failed attempt
      await this.logMessage({
        client_id: clientId,
        message,
        template_type: templateType,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        sent_by: sentBy
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  /**
   * Get message template
   */
  getMessageTemplate(
    type: MessageTemplate['type'],
    clientName: string,
    cardNumber?: string,
    balance?: number
  ): string {
    const firstName = this.getFirstName(clientName);

    const templates: Record<MessageTemplate['type'], string> = {
      birthday: `🎂 *Поздравляем с Днем Рождения, ${firstName}!*\n\n🎁 В подарок 100 баллов на вашу карту ${cardNumber}\n\n☕ Rock Coffee ждет вас с праздничным кофе!`,
      promo: `☕ *Только сегодня - специальное предложение!*\n\n🎉 Скидка 20% на все напитки!\n\n💳 Ваша карта: \`${cardNumber}\`\n💰 Баланс: *${balance} баллов*\n\nРок Кофе`,
      balance: `💰 *Баланс ваших баллов*\n\n${firstName}, на вашей карте \`${cardNumber}\`\nдоступно: *${balance} баллов*\n\n☕ Ждем вас в Rock Coffee!`,
      invite: `☕ *Скучаем по вам в Rock Coffee!*\n\n${firstName}, ваша карта \`${cardNumber}\` готова к новым покупкам.\n\n🎁 Приходите за любимым кофе - у нас есть для вас сюрпризы!`,
      custom: ''
    };

    return templates[type] || '';
  }

  /**
   * Get first name from full name
   */
  private getFirstName(fullName: string): string {
    if (!fullName || typeof fullName !== 'string') return 'друг';

    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return parts[1]; // Return first name (Иван from "Иванов Иван Иванович")
    }
    return parts[0]; // Return single word if no spaces
  }

  /**
   * Log message to database
   */
  private async logMessage(entry: MessageLogEntry): Promise<void> {
    try {
      const sql = `
        INSERT INTO telegram_messages_log (
          client_id, telegram_id, message, template_type, status, error_message, sent_by, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;

      await Database.query(sql, [
        entry.client_id,
        entry.telegram_id || null,
        entry.message,
        entry.template_type || null,
        entry.status,
        entry.error_message || null,
        entry.sent_by
      ]);

    } catch (error) {
      // Don't throw - just log to console
      // This prevents message logging errors from breaking the main flow
      console.error('Failed to log Telegram message to database:', error);
    }
  }

  /**
   * Get message sending history
   */
  async getMessageHistory(limit: number = 50): Promise<MessageLogEntry[]> {
    try {
      const sql = `
        SELECT
          id, client_id, telegram_id, message, template_type, status,
          error_message, sent_by, sent_at
        FROM telegram_messages_log
        ORDER BY sent_at DESC
        LIMIT $1
      `;

      return await Database.query(sql, [limit]);

    } catch (error) {
      console.error('Error getting message history:', error);
      return [];
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStatistics(): Promise<{
    total: number;
    sent: number;
    failed: number;
    successRate: number;
  }> {
    try {
      const sql = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM telegram_messages_log
      `;

      const stats = await Database.queryOne(sql);

      const total = parseInt(stats.total) || 0;
      const sent = parseInt(stats.sent) || 0;
      const successRate = total > 0 ? (sent / total) * 100 : 0;

      return {
        total,
        sent,
        failed: parseInt(stats.failed) || 0,
        successRate: Math.round(successRate * 100) / 100
      };

    } catch (error) {
      console.error('Error getting message statistics:', error);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        successRate: 0
      };
    }
  }
}
