import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database';
import { getKaliningradTime, KALININGRAD_TIMEZONE } from '../utils/timezone';

interface BirthdayClient {
  id: number;
  telegram_id: number | null;
  full_name: string;
  card_number: string;
}

interface BirthdayRunResult {
  checked: number;
  awarded: number;
  skipped: number;
}

/**
 * Handles automatic birthday accruals and greetings.
 */
export class BirthdayService {
  private readonly bot: TelegramBot;
  private readonly bonusPoints = 10;
  private systemOperatorId: number | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  /**
   * Start daily scheduler after performing an immediate check.
   */
  start(): void {
    this.runBirthdayCheck().catch((error) => {
      console.error('BirthdayService immediate run error:', error);
    }).finally(() => {
      this.scheduleNextRun();
    });
  }

  /**
   * Stop scheduled checks (primarily used in shutdown flows).
   */
  stop(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private scheduleNextRun(): void {
    const now = getKaliningradTime();
    const nextRun = new Date(now);
    nextRun.setHours(9, 0, 0, 0); // run daily at 09:00 Kaliningrad time

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();

    this.timeoutHandle = setTimeout(() => {
      this.runBirthdayCheck().catch((error) => {
        console.error('BirthdayService scheduled run error:', error);
      }).finally(() => {
        this.scheduleNextRun();
      });
    }, delay);
  }

  private getCurrentDateString(): string {
    const now = getKaliningradTime();

    const isoDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: KALININGRAD_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    return isoDate;
  }

  private async getSystemOperatorId(): Promise<number | null> {
    if (this.systemOperatorId !== null) {
      return this.systemOperatorId;
    }

    try {
      const result = await Database.queryOne(
        `SELECT id FROM users WHERE role = 'admin' AND is_active = true ORDER BY id ASC LIMIT 1`
      );

      this.systemOperatorId = result?.id ?? null;
      return this.systemOperatorId;
    } catch (error) {
      console.error('BirthdayService operator lookup error:', error);
      return null;
    }
  }

  private async fetchBirthdayClients(currentDate: string): Promise<BirthdayClient[]> {
    const sql = `
      SELECT id, telegram_id, full_name, card_number
      FROM clients
      WHERE is_active = true
        AND birth_date IS NOT NULL
        AND to_char(birth_date, 'MM-DD') = to_char($1::date, 'MM-DD')
        AND (last_birthday_bonus_at IS NULL OR last_birthday_bonus_at <= ($1::date - INTERVAL '10 months'))
    `;

    return await Database.query(sql, [currentDate]);
  }

  private async sendBirthdayMessage(client: BirthdayClient): Promise<void> {
    if (!client.telegram_id) {
      return;
    }

    const message =
      'Хей, Друг! Команда Rock Coffee поздравляет тебя с днем рождения! ' +
      'Мы начислили тебе баллов на твой праздничный напиток, приходи за ним скорее!';

    try {
      await this.bot.sendMessage(client.telegram_id, message);
    } catch (error) {
      console.error(`BirthdayService failed to send message to client ${client.id}:`, error);
    }
  }

  private async awardBonus(client: BirthdayClient, isoDate: string): Promise<boolean> {
    const operatorId = await this.getSystemOperatorId();
    if (!operatorId) {
      console.warn('BirthdayService: no active admin found to attribute birthday bonus operation. Skipping awards.');
      return false;
    }

    return await Database.transaction(async (dbClient) => {
      const eligibility = await dbClient.query(
        `SELECT 1 FROM clients WHERE id = $1
          AND (last_birthday_bonus_at IS NULL OR last_birthday_bonus_at <= ($2::date - INTERVAL '10 months'))
          FOR UPDATE`,
        [client.id, isoDate]
      );

      if (eligibility.rowCount === 0) {
        return false;
      }

      await dbClient.query(
        `INSERT INTO point_transactions (client_id, operator_id, operation_type, points, description)
         VALUES ($1, $2, 'bonus', $3, $4)`,
        [client.id, operatorId, this.bonusPoints, 'Бонус ко дню рождения (авто)']
      );

      await dbClient.query(
        `UPDATE clients
           SET balance = balance + $1,
               last_birthday_bonus_at = $2::date::timestamp,
               updated_at = NOW()
         WHERE id = $3`,
        [this.bonusPoints, isoDate, client.id]
      );

      return true;
    });
  }

  /**
   * Run the birthday check for today and award bonuses where eligible.
   */
  async runBirthdayCheck(): Promise<BirthdayRunResult> {
    const isoDate = this.getCurrentDateString();

    try {
      const clients = await this.fetchBirthdayClients(isoDate);
      if (clients.length === 0) {
        return { checked: 0, awarded: 0, skipped: 0 };
      }

      let awarded = 0;
      let skipped = 0;

      for (const client of clients) {
        try {
          const granted = await this.awardBonus(client, isoDate);
          if (granted) {
            awarded += 1;
            await this.sendBirthdayMessage(client);
          } else {
            skipped += 1;
          }
        } catch (error) {
          skipped += 1;
          console.error(`BirthdayService failed for client ${client.id}:`, error);
        }
      }

      console.log(`BirthdayService: processed ${clients.length} clients, bonuses awarded: ${awarded}, skipped: ${skipped}`);
      return { checked: clients.length, awarded, skipped };
    } catch (error) {
      console.error('BirthdayService run error:', error);
      return { checked: 0, awarded: 0, skipped: 0 };
    }
  }
}
