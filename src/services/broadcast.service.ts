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

export interface BroadcastMessage {
  id?: number;
  title: string;
  message: string;
  image_url?: string;
  segment: 'all' | 'active' | 'vip' | 'birthday' | 'custom';
  scheduled_at?: Date;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  total_recipients?: number;
  sent_count?: number;
  delivered_count?: number;
  failed_count?: number;
  created_by: number;
  created_at?: Date;
}

export interface BroadcastRecipient {
  client_id: number;
  telegram_id: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  error_message?: string;
  sent_at?: Date;
}

export class BroadcastService {
  private bot: TelegramBot;
  private clientService: ClientService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
  }

  // Create broadcast message
  async createBroadcast(broadcastData: Omit<BroadcastMessage, 'id' | 'created_at'>): Promise<number> {
    try {
      const sql = `
        INSERT INTO broadcasts (
          title, message, image_url, segment, scheduled_at, status,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;
      
      const result = await Database.queryOne(sql, [
        broadcastData.title,
        broadcastData.message,
        broadcastData.image_url || null,
        broadcastData.segment,
        broadcastData.scheduled_at || null,
        broadcastData.status,
        broadcastData.created_by
      ]);

      return result.id;

    } catch (error) {
      console.error('Error creating broadcast:', error);
      throw error;
    }
  }

  // Get broadcast recipients based on segment
  async getBroadcastRecipients(segment: string, customFilters?: any): Promise<Array<{ client_id: number; telegram_id: number; full_name: string }>> {
    try {
      let sql = `
        SELECT id as client_id, telegram_id, full_name
        FROM clients 
        WHERE is_active = true AND telegram_id IS NOT NULL
      `;
      const params: any[] = [];

      switch (segment) {
        case 'active':
          sql += ` AND last_visit >= CURRENT_DATE - INTERVAL '30 days'`;
          break;

        case 'vip':
          sql += ` AND total_spent >= 10000`; // VIP clients with 10k+ spent
          break;

        case 'birthday':
          sql += ` AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)`;
          break;

        case 'custom':
          if (customFilters) {
            if (customFilters.minSpent) {
              sql += ` AND total_spent >= $${params.length + 1}`;
              params.push(customFilters.minSpent);
            }
            if (customFilters.minBalance) {
              sql += ` AND balance >= $${params.length + 1}`;
              params.push(customFilters.minBalance);
            }
            if (customFilters.lastVisitDays) {
              sql += ` AND last_visit >= CURRENT_DATE - INTERVAL '${customFilters.lastVisitDays} days'`;
            }
          }
          break;

        case 'all':
        default:
          // No additional filters for 'all'
          break;
      }

      sql += ` ORDER BY full_name`;

      return await Database.query(sql, params);

    } catch (error) {
      console.error('Error getting broadcast recipients:', error);
      throw error;
    }
  }

  // Send broadcast message
  async sendBroadcast(broadcastId: number): Promise<{
    success: boolean;
    totalSent: number;
    totalFailed: number;
    errors: string[];
  }> {
    try {
      // Get broadcast details
      const broadcast = await this.getBroadcastById(broadcastId);
      if (!broadcast) {
        throw new Error('Broadcast not found');
      }

      // Update status to sending
      await this.updateBroadcastStatus(broadcastId, 'sending');

      // Get recipients
      const recipients = await this.getBroadcastRecipients(broadcast.segment);
      
      // Update total recipients count
      await Database.query(
        'UPDATE broadcasts SET total_recipients = $1 WHERE id = $2',
        [recipients.length, broadcastId]
      );

      let totalSent = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      // Send messages in batches to avoid rate limiting
      const batchSize = 30; // Telegram rate limit consideration
      const batches = this.chunkArray(recipients, batchSize);

      for (const batch of batches) {
        const batchPromises = batch.map(async (recipient) => {
          try {
            await this.sendMessageToRecipient(broadcast, recipient);
            await this.logBroadcastRecipient(broadcastId, recipient, 'sent');
            totalSent++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            await this.logBroadcastRecipient(broadcastId, recipient, 'failed', errorMsg);
            errors.push(`${recipient.full_name}: ${errorMsg}`);
            totalFailed++;
          }
        });

        await Promise.allSettled(batchPromises);
        
        // Rate limiting: wait between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      // Update broadcast completion
      await Database.query(`
        UPDATE broadcasts 
        SET status = $1, sent_count = $2, delivered_count = $3, failed_count = $4, completed_at = NOW()
        WHERE id = $5
      `, ['completed', totalSent, totalSent, totalFailed, broadcastId]);

      return {
        success: true,
        totalSent,
        totalFailed,
        errors: errors.slice(0, 10) // Limit error messages
      };

    } catch (error) {
      console.error('Error sending broadcast:', error);
      
      // Update broadcast status to failed
      await this.updateBroadcastStatus(broadcastId, 'failed');
      
      throw error;
    }
  }

  // Send message to individual recipient
  private async sendMessageToRecipient(
    broadcast: BroadcastMessage,
    recipient: { client_id: number; telegram_id: number; full_name: string }
  ): Promise<void> {
    try {
      const firstName = getFirstName(recipient.full_name);
      let personalizedMessage = broadcast.message.replace('{name}', firstName);
      
      if (broadcast.image_url) {
        await this.bot.sendPhoto(recipient.telegram_id, broadcast.image_url, {
          caption: personalizedMessage,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Моя карта', callback_data: 'my_card' }],
              [{ text: '🏠 Главное меню', callback_data: 'client_main_menu' }]
            ]
          }
        });
      } else {
        await this.bot.sendMessage(recipient.telegram_id, personalizedMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Моя карта', callback_data: 'my_card' }],
              [{ text: '🏠 Главное меню', callback_data: 'client_main_menu' }]
            ]
          }
        });
      }

    } catch (error) {
      console.error(`Error sending message to ${recipient.telegram_id}:`, error);
      throw error;
    }
  }

  // Log broadcast recipient status
  private async logBroadcastRecipient(
    broadcastId: number,
    recipient: { client_id: number; telegram_id: number },
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const sql = `
        INSERT INTO broadcast_recipients (
          broadcast_id, client_id, telegram_id, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (broadcast_id, client_id) 
        DO UPDATE SET status = $4, error_message = $5, sent_at = NOW()
      `;
      
      await Database.query(sql, [
        broadcastId,
        recipient.client_id,
        recipient.telegram_id,
        status,
        errorMessage || null
      ]);

    } catch (error) {
      console.error('Error logging broadcast recipient:', error);
    }
  }

  // Get broadcast by ID
  async getBroadcastById(id: number): Promise<BroadcastMessage | null> {
    try {
      const sql = `
        SELECT *
        FROM broadcasts 
        WHERE id = $1
      `;
      
      return await Database.queryOne(sql, [id]);

    } catch (error) {
      console.error('Error getting broadcast by ID:', error);
      return null;
    }
  }

  // Update broadcast status
  async updateBroadcastStatus(id: number, status: BroadcastMessage['status']): Promise<void> {
    try {
      const sql = `
        UPDATE broadcasts 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      await Database.query(sql, [status, id]);

    } catch (error) {
      console.error('Error updating broadcast status:', error);
      throw error;
    }
  }

  // Get broadcast history
  async getBroadcastHistory(limit: number = 50): Promise<BroadcastMessage[]> {
    try {
      const sql = `
        SELECT b.*, u.full_name as created_by_name
        FROM broadcasts b
        LEFT JOIN users u ON u.id = b.created_by
        ORDER BY b.created_at DESC
        LIMIT $1
      `;
      
      return await Database.query(sql, [limit]);

    } catch (error) {
      console.error('Error getting broadcast history:', error);
      return [];
    }
  }

  // Get broadcast statistics
  async getBroadcastStatistics(broadcastId?: number): Promise<{
    totalBroadcasts: number;
    totalRecipients: number;
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    averageDeliveryRate: number;
  }> {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_broadcasts,
          COALESCE(SUM(total_recipients), 0) as total_recipients,
          COALESCE(SUM(sent_count), 0) as total_sent,
          COALESCE(SUM(delivered_count), 0) as total_delivered,
          COALESCE(SUM(failed_count), 0) as total_failed
        FROM broadcasts
      `;
      const params: any[] = [];

      if (broadcastId) {
        sql += ' WHERE id = $1';
        params.push(broadcastId);
      } else {
        sql += ' WHERE status = \'completed\'';
      }

      const stats = await Database.queryOne(sql, params);
      
      const averageDeliveryRate = stats.total_recipients > 0 
        ? (stats.total_delivered / stats.total_recipients) * 100 
        : 0;

      return {
        totalBroadcasts: parseInt(stats.total_broadcasts) || 0,
        totalRecipients: parseInt(stats.total_recipients) || 0,
        totalSent: parseInt(stats.total_sent) || 0,
        totalDelivered: parseInt(stats.total_delivered) || 0,
        totalFailed: parseInt(stats.total_failed) || 0,
        averageDeliveryRate: Math.round(averageDeliveryRate * 100) / 100
      };

    } catch (error) {
      console.error('Error getting broadcast statistics:', error);
      return {
        totalBroadcasts: 0, totalRecipients: 0, totalSent: 0,
        totalDelivered: 0, totalFailed: 0, averageDeliveryRate: 0
      };
    }
  }

  // Send birthday wishes to clients - DISABLED
  async sendBirthdayWishes(
    autoBonusEnabled: boolean = false,
    bonusAmount: number = 200
  ): Promise<{
    success: boolean;
    sentCount: number;
    errors: string[];
  }> {
    // Birthday auto-accrual is disabled
    console.log('Birthday wishes function is disabled');
    return { success: true, sentCount: 0, errors: [] };

    /* DISABLED BIRTHDAY AUTO-ACCRUAL
    try {
      // Get clients with birthdays today
      const birthdayClients = await Database.query(`
        SELECT id, telegram_id, full_name, balance
        FROM clients 
        WHERE is_active = true 
          AND telegram_id IS NOT NULL
          AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
      `);

      if (birthdayClients.length === 0) {
        return { success: true, sentCount: 0, errors: [] };
      }

      let sentCount = 0;
      const errors: string[] = [];

      for (const client of birthdayClients) {
        try {
          let newBalance = client.balance;

          // Award birthday bonus only if enabled
          if (autoBonusEnabled && bonusAmount > 0) {
            await Database.query(`
              UPDATE clients
              SET balance = balance + $1
              WHERE id = $2
            `, [bonusAmount, client.id]);

            // Log the bonus transaction
            await Database.query(`
              INSERT INTO point_transactions (client_id, operation_type, points, amount, description, operator_id)
              VALUES ($1, 'earn', $2, 0, 'Birthday bonus (auto)', 1)
            `, [client.id, bonusAmount]);

            newBalance = client.balance + bonusAmount;
          }

          // Send birthday message
          const firstName = getFirstName(client.full_name);

          let message: string;
          if (autoBonusEnabled && bonusAmount > 0) {
            message =
              `🎉 *С днем рождения, ${firstName}!*\n\n` +
              `🎂 Поздравляем вас с днем рождения от всей команды Rock Coffee!\n\n` +
              `🎁 *Ваш праздничный подарок:*\n` +
              `⭐ ${bonusAmount} бонусных баллов уже начислены!\n` +
              `💎 Ваш новый баланс: *${newBalance} баллов*\n\n` +
              `🥳 Желаем здоровья, счастья и отличного настроения!\n` +
              `☕ Ждем вас на праздничный кофе с друзьями и близкими!`;
          } else {
            message =
              `🎉 *С днем рождения, ${firstName}!*\n\n` +
              `🎂 Поздравляем вас с днем рождения от всей команды Rock Coffee!\n\n` +
              `🥳 Желаем здоровья, счастья и отличного настроения!\n` +
              `☕ Ждем вас сегодня - у нас для вас есть сюрприз!`;
          }

          await this.bot.sendMessage(client.telegram_id, message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎂 Спасибо!', callback_data: 'client_main_menu' }],
                [{ text: '💳 Посмотреть карту', callback_data: 'my_card' }]
              ]
            }
          });

          sentCount++;

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${client.full_name}: ${errorMsg}`);
        }
      }

      return { success: true, sentCount, errors };

    } catch (error) {
      console.error('Error sending birthday wishes:', error);
      return { success: false, sentCount: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
    */
  }

  // Utility function to chunk array
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Delete old broadcasts
  async cleanupOldBroadcasts(keepDays: number = 90): Promise<number> {
    try {
      const sql = `
        DELETE FROM broadcasts 
        WHERE created_at < NOW() - INTERVAL '${keepDays} days'
          AND status IN ('completed', 'failed')
      `;
      
      const result = await Database.query(sql);
      return result.length || 0;

    } catch (error) {
      console.error('Error cleaning up old broadcasts:', error);
      return 0;
    }
  }
}