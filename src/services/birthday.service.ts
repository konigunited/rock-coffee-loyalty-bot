import TelegramBot from 'node-telegram-bot-api';
import { PoolClient } from 'pg';
import Database from '../config/database';

const BIRTHDAY_BONUS_POINTS = 10;
const BONUS_DESCRIPTION = 'Birthday bonus (auto)';

type BirthdayClient = {
  id: number;
  telegram_id: number | null;
  full_name: string;
};

export class BirthdayService {
  private bot: TelegramBot;
  private systemOperatorId: number | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  startDailySchedule(hour: number = 9, minute: number = 0): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
    }

    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delay = next.getTime() - now.getTime();
      this.scheduledTimeout = setTimeout(async () => {
        try {
          await this.processTodayBirthdays();
        } catch (error) {
          console.error('BirthdayService: failed to process birthdays:', error);
        } finally {
          scheduleNext();
        }
      }, delay);
    };

    void this.processTodayBirthdays();
    scheduleNext();
  }

  async processTodayBirthdays(): Promise<{
    processed: number;
    awarded: number;
    skipped: number;
    errors: number;
  }> {
    const clients: BirthdayClient[] = await Database.query(
      `
        SELECT id, telegram_id, full_name
        FROM clients
        WHERE is_active = true
          AND birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
      `
    );

    const stats = {
      processed: clients.length,
      awarded: 0,
      skipped: 0,
      errors: 0,
    };

    for (const client of clients) {
      try {
        const eligible = await this.isEligibleForBonus(client.id);
        if (!eligible) {
          stats.skipped += 1;
          continue;
        }

        await this.awardBonus(client.id);
        stats.awarded += 1;

        if (client.telegram_id) {
          await this.sendBirthdayMessage(client.telegram_id);
        } else {
          console.log(
            `BirthdayService: client ${client.id} (${client.full_name}) has no Telegram ID, skipping notification`
          );
        }
      } catch (error) {
        stats.errors += 1;
        console.error(`BirthdayService: error processing client ${client.id}:`, error);
      }
    }

    if (stats.processed > 0) {
      console.log(
        `BirthdayService: processed ${stats.processed} birthdays, awarded ${stats.awarded}, skipped ${stats.skipped}, errors ${stats.errors}`
      );
    }

    return stats;
  }

  private async isEligibleForBonus(clientId: number): Promise<boolean> {
    const recentBonus = await Database.queryOne(
      `
        SELECT 1
        FROM point_transactions
        WHERE client_id = $1
          AND operation_type = 'bonus'
          AND description = $2
          AND created_at >= NOW() - INTERVAL '10 months'
        LIMIT 1
      `,
      [clientId, BONUS_DESCRIPTION]
    );

    return !recentBonus;
  }

  private async awardBonus(clientId: number): Promise<void> {
    await Database.transaction(async (dbClient) => {
      const operatorId = await this.resolveSystemOperatorId(dbClient);

      await dbClient.query(
        `
          UPDATE clients
          SET balance = balance + $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [BIRTHDAY_BONUS_POINTS, clientId]
      );

      await dbClient.query(
        `
          INSERT INTO point_transactions (client_id, operator_id, operation_type, points, amount, description)
          VALUES ($1, $2, 'bonus', $3, 0, $4)
        `,
        [clientId, operatorId, BIRTHDAY_BONUS_POINTS, BONUS_DESCRIPTION]
      );
    });
  }

  private async resolveSystemOperatorId(dbClient: PoolClient): Promise<number> {
    if (this.systemOperatorId) {
      return this.systemOperatorId;
    }

    const result = await dbClient.query(
      `
        SELECT id
        FROM users
        WHERE role IN ('admin', 'manager')
        ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id
        LIMIT 1
      `
    );

    if (result.rows.length === 0) {
      throw new Error('No staff user available to log birthday bonus transactions');
    }

    this.systemOperatorId = result.rows[0].id;
    return this.systemOperatorId;
  }

  private async sendBirthdayMessage(telegramId: number): Promise<void> {
    const message =
      '🎉 *Хей, Друг!* Команда Rock Coffee поздравляет тебя с днём рождения!\n\n' +
      `🎁 Мы начислили тебе *${BIRTHDAY_BONUS_POINTS} баллов* на твой праздничный напиток, приходи за ним скорее!`;

    await this.bot.sendMessage(telegramId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Спасибо!', callback_data: 'client_main_menu' }],
          [{ text: '🍰 Меню программы', callback_data: 'about_program' }],
        ],
      },
    });
  }
}
