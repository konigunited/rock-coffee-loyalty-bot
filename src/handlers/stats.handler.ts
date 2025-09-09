import TelegramBot from 'node-telegram-bot-api';
import { PointService } from '../services/point.service';
import { BotContext, getCurrentUser, checkBaristaAccess } from '../middleware/access.middleware';

export class StatsHandler {
  private bot: TelegramBot;
  private pointService: PointService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.pointService = new PointService();
  }

  // Show barista statistics menu
  async showStatsMenu(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '📅 За сегодня', callback_data: 'stats_today' },
        { text: '📅 За неделю', callback_data: 'stats_week' }
      ],
      [
        { text: '📅 За месяц', callback_data: 'stats_month' },
        { text: '📝 Последние операции', callback_data: 'recent_operations' }
      ],
      [{ text: '◀️ Главное меню', callback_data: 'barista_menu' }]
    ];

    const text = '📊 *Статистика работы*\n\nВыберите период для просмотра:';
    await this.editMessage(ctx, text, keyboard);
  }

  // Show today's statistics
  async showTodayStats(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const stats = await this.pointService.getBaristaStats(user.id, startOfDay, endOfDay);

      const text = 
        `📊 *Статистика за сегодня*\n\n` +
        `👥 Обслужено клиентов: *${stats.clients_served}*\n` +
        `📝 Всего операций: *${stats.transactions_count}*\n` +
        `⭐ Начислено баллов: *${stats.total_earned}*\n` +
        `💸 Списано баллов: *${stats.total_spent}*\n\n` +
        `🕐 Период: ${startOfDay.toLocaleDateString('ru-RU')}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 За неделю', callback_data: 'stats_week' },
          { text: '📅 За месяц', callback_data: 'stats_month' }
        ],
        [
          { text: '📝 Операции', callback_data: 'recent_operations' },
          { text: '📊 Экспорт', callback_data: 'export_today_stats' }
        ],
        [{ text: '◀️ Назад', callback_data: 'my_stats' }]
      ];

      await this.editMessage(ctx, text, keyboard);

    } catch (error) {
      console.error('Today stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики');
    }
  }

  // Show week statistics
  async showWeekStats(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date();
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      endOfWeek.setHours(23, 59, 59, 999);

      const stats = await this.pointService.getBaristaStats(user.id, startOfWeek, endOfWeek);

      const text = 
        `📊 *Статистика за неделю*\n\n` +
        `👥 Обслужено клиентов: *${stats.clients_served}*\n` +
        `📝 Всего операций: *${stats.transactions_count}*\n` +
        `⭐ Начислено баллов: *${stats.total_earned}*\n` +
        `💸 Списано баллов: *${stats.total_spent}*\n\n` +
        `🗓 Период: ${startOfWeek.toLocaleDateString('ru-RU')} - ${endOfWeek.toLocaleDateString('ru-RU')}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 Сегодня', callback_data: 'stats_today' },
          { text: '📅 За месяц', callback_data: 'stats_month' }
        ],
        [
          { text: '📝 Операции', callback_data: 'recent_operations' },
          { text: '📊 Экспорт', callback_data: 'export_week_stats' }
        ],
        [{ text: '◀️ Назад', callback_data: 'my_stats' }]
      ];

      await this.editMessage(ctx, text, keyboard);

    } catch (error) {
      console.error('Week stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики');
    }
  }

  // Show month statistics
  async showMonthStats(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0); // Last day of current month
      endOfMonth.setHours(23, 59, 59, 999);

      const stats = await this.pointService.getBaristaStats(user.id, startOfMonth, endOfMonth);

      const text = 
        `📊 *Статистика за месяц*\n\n` +
        `👥 Обслужено клиентов: *${stats.clients_served}*\n` +
        `📝 Всего операций: *${stats.transactions_count}*\n` +
        `⭐ Начислено баллов: *${stats.total_earned}*\n` +
        `💸 Списано баллов: *${stats.total_spent}*\n\n` +
        `🗓 Период: ${startOfMonth.toLocaleDateString('ru-RU')} - ${endOfMonth.toLocaleDateString('ru-RU')}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 Сегодня', callback_data: 'stats_today' },
          { text: '📅 За неделю', callback_data: 'stats_week' }
        ],
        [
          { text: '📝 Операции', callback_data: 'recent_operations' },
          { text: '📊 Экспорт', callback_data: 'export_month_stats' }
        ],
        [{ text: '◀️ Назад', callback_data: 'my_stats' }]
      ];

      await this.editMessage(ctx, text, keyboard);

    } catch (error) {
      console.error('Month stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики');
    }
  }

  // Show recent operations
  async showRecentOperations(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const recentTransactions = await this.pointService.getRecentTransactions(user.id, 10);

      if (recentTransactions.length === 0) {
        const text = '📝 *Последние операции*\n\n❌ Операции не найдены';
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К статистике', callback_data: 'my_stats' }]
        ];
        
        await this.editMessage(ctx, text, keyboard);
        return;
      }

      let operationsText = '📝 *Последние операции*\n\n';
      
      for (const transaction of recentTransactions) {
        const date = new Date(transaction.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const operationType = transaction.operation_type === 'earn' ? '➕' : '➖';
        const pointsText = transaction.operation_type === 'earn' ? `+${transaction.points}` : `${transaction.points}`;
        
        operationsText += 
          `${operationType} *${pointsText}* баллов\n` +
          `👤 ${transaction.client_name}\n` +
          `💳 #${transaction.card_number}\n` +
          `🕐 ${date}\n\n`;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К статистике', callback_data: 'my_stats' }]
      ];

      await this.editMessage(ctx, operationsText, keyboard);

    } catch (error) {
      console.error('Recent operations error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке операций');
    }
  }

  // Helper methods
  private async sendMessage(ctx: BotContext, text: string, keyboard?: TelegramBot.InlineKeyboardButton[][]): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    const options: TelegramBot.SendMessageOptions = {
      parse_mode: 'Markdown',
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
    };

    await this.bot.sendMessage(ctx.message.chat.id, text, options);
  }

  private async editMessage(ctx: BotContext, text: string, keyboard?: TelegramBot.InlineKeyboardButton[][]): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    try {
      await this.bot.editMessageText(text, {
        chat_id: ctx.message.chat.id,
        message_id: ctx.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
      });
    } catch (error) {
      await this.sendMessage(ctx, text, keyboard);
    }
  }

  // Export today's statistics to CSV
  async exportTodayStats(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      await this.generateAndSendCSV(ctx, user.id, startOfDay, endOfDay, 'today');
    } catch (error) {
      console.error('Export today stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при экспорте статистики');
    }
  }

  // Export week's statistics to CSV
  async exportWeekStats(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date();
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      await this.generateAndSendCSV(ctx, user.id, startOfWeek, endOfWeek, 'week');
    } catch (error) {
      console.error('Export week stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при экспорте статистики');
    }
  }

  // Export month's statistics to CSV
  async exportMonthStats(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) return;

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      await this.generateAndSendCSV(ctx, user.id, startOfMonth, endOfMonth, 'month');
    } catch (error) {
      console.error('Export month stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при экспорте статистики');
    }
  }

  // Generate and send CSV file
  private async generateAndSendCSV(
    ctx: BotContext, 
    operatorId: number, 
    startDate: Date, 
    endDate: Date, 
    period: string
  ): Promise<void> {
    if (!ctx.message?.chat?.id) return;

    try {
      // Get detailed transactions data
      const transactions = await this.pointService.getRecentTransactions(operatorId, 1000);
      
      // Filter transactions by date range
      const filteredTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.created_at);
        return transactionDate >= startDate && transactionDate <= endDate;
      });

      if (filteredTransactions.length === 0) {
        await this.sendMessage(ctx, '❌ Нет операций за выбранный период для экспорта');
        return;
      }

      // Generate CSV content
      const csvHeader = 'Дата,Время,Клиент,Карта,Операция,Баллы,Сумма,Описание\n';
      let csvContent = csvHeader;

      for (const transaction of filteredTransactions) {
        const date = new Date(transaction.created_at);
        const dateStr = date.toLocaleDateString('ru-RU');
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const operationType = transaction.operation_type === 'earn' ? 'Начисление' : 'Списание';
        const points = transaction.points;
        const amount = transaction.amount || 0;
        const description = transaction.description || '';

        // Escape commas and quotes in CSV data
        const clientName = `"${(transaction.client_name || '').replace(/"/g, '""')}"`;
        const cardNumber = transaction.card_number || '';
        const descriptionEscaped = `"${description.replace(/"/g, '""')}"`;

        csvContent += `${dateStr},${timeStr},${clientName},${cardNumber},${operationType},${points},${amount},${descriptionEscaped}\n`;
      }

      // Create filename
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `статистика_${period}_${dateStr}.csv`;

      // Send CSV as document
      const buffer = Buffer.from('\ufeff' + csvContent, 'utf8'); // Add BOM for Excel compatibility
      
      await this.bot.sendDocument(ctx.message.chat.id, buffer, {
        caption: `📊 Экспорт статистики за ${this.getPeriodName(period)}\n\n📅 Период: ${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}\n📝 Операций: ${filteredTransactions.length}`,
        parse_mode: 'Markdown'
      }, {
        filename: filename,
        contentType: 'text/csv'
      });

      await this.sendMessage(ctx, '✅ Экспорт завершен! CSV файл отправлен.');

    } catch (error) {
      console.error('CSV generation error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при создании CSV файла');
    }
  }

  // Get period name in Russian
  private getPeriodName(period: string): string {
    switch (period) {
      case 'today': return 'сегодня';
      case 'week': return 'неделю';
      case 'month': return 'месяц';
      default: return period;
    }
  }
}