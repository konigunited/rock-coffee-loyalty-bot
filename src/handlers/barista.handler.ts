import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from '../services/client.service';
import { PointService } from '../services/point.service';
import { UserService } from '../services/user.service';
import { BotContext, getCurrentUser, checkBaristaAccess, ACCESS_DENIED_MESSAGES } from '../middleware/access.middleware';
import { BaristaClientView } from '../types/client.types';
import { StatsHandler } from './stats.handler';

export class BaristaHandler {
  private bot: TelegramBot;
  private clientService: ClientService;
  private pointService: PointService;
  private userService: UserService;
  private statsHandler: StatsHandler;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
    this.pointService = new PointService();
    this.userService = new UserService();
    this.statsHandler = new StatsHandler(bot);
  }

  // Main menu for barista
  async showMainMenu(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      await this.sendMessage(ctx, ACCESS_DENIED_MESSAGES.NOT_BARISTA);
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '🔍 Поиск клиента', callback_data: 'search_client' }],
      [{ text: '📊 Моя статистика', callback_data: 'my_stats' }],
      [{ text: '📝 Последние операции', callback_data: 'recent_operations' }],
      [{ text: 'ℹ️ Справка', callback_data: 'help_barista' }]
    ];

    const user = getCurrentUser(ctx);
    const welcomeText = 
      `🏪 Rock Coffee - Панель бариста\n\n` +
      `Добро пожаловать, ${user?.full_name}!\n\n` +
      `💡 *Быстрое начисление:* отправьте сообщение\n` +
      `\`12345 +15\` для начисления 15 баллов клиенту с картой 12345\n\n` +
      `Выберите действие:`;

    await this.editMessage(ctx, welcomeText, keyboard);
  }

  // Quick points input - allow direct message like "12345 +15" for adding points
  async handleQuickPointsInput(ctx: BotContext, text: string): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    // Parse input like "12345 +15" or "12345 15" or "+15 12345"
    const patterns = [
      /^(\d+)\s*\+(\d+)$/, // "12345 +15"
      /^(\d+)\s+(\d+)$/, // "12345 15"  
      /^\+(\d+)\s+(\d+)$/, // "+15 12345"
    ];

    let cardNumber: string | null = null;
    let points: number | null = null;

    for (const pattern of patterns) {
      const match = text.trim().match(pattern);
      if (match) {
        if (pattern === patterns[2]) { // "+15 12345" format
          points = parseInt(match[1]);
          cardNumber = match[2];
        } else { // "12345 +15" or "12345 15" format
          cardNumber = match[1];
          points = parseInt(match[2]);
        }
        break;
      }
    }

    if (!cardNumber || !points || points <= 0) {
      await this.sendMessage(ctx, 
        '❌ Неправильный формат. Используйте:\n' +
        '• `12345 +15` (карта + баллы)\n' +
        '• `12345 15` (карта баллы)\n' +
        '• `+15 12345` (баллы карта)'
      );
      return;
    }

    if (points > 1000) {
      await this.sendMessage(ctx, '⚠️ Слишком много баллов. Максимум: 1000');
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      return;
    }

    try {
      // Find client by card number
      const clients = await this.clientService.searchForBarista(cardNumber);
      
      if (clients.length === 0) {
        await this.sendMessage(ctx, `❌ Клиент с картой ${cardNumber} не найден`);
        return;
      }
      
      if (clients.length > 1) {
        await this.sendMessage(ctx, `⚠️ Найдено несколько клиентов с картой ${cardNumber}. Используйте поиск.`);
        return;
      }

      const client = clients[0];

      // Execute direct points transaction
      await this.pointService.earnPoints({
        client_id: client.id,
        operator_id: user.id,
        amount: 0,
        points: points,
        comment: `Быстрое начисление ${points} баллов`
      });

      // Get updated client data
      const updatedClient = await this.clientService.getForBarista(client.id);

      if (!updatedClient) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *Баллы начислены!*\n\n` +
        `👤 ${updatedClient.full_name}\n` +
        `💳 Карта: ${updatedClient.card_number}\n` +
        `⭐ Начислено: *+${points} баллов*\n` +
        `💰 Новый баланс: *${updatedClient.balance} баллов*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 К клиенту', callback_data: `client_card:${client.id}` },
          { text: '🔍 Поиск', callback_data: 'search_client' }
        ],
        [{ text: '🏠 Главная', callback_data: 'barista_menu' }]
      ];

      await this.sendMessage(ctx, successText, keyboard);

    } catch (error) {
      console.error('Quick points input error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при начислении баллов: ${error}`);
    }
  }

  // Search client interface
  async searchClient(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      await this.sendMessage(ctx, ACCESS_DENIED_MESSAGES.NOT_BARISTA);
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Назад к меню', callback_data: 'barista_menu' }]
    ];

    const searchText = 
      '🔍 *Поиск клиента*\n\n' +
      'Введите для поиска:\n' +
      '• Номер карты (например: 12345)\n' +
      '• ФИО клиента (например: Иванов)\n\n' +
      '💡 Совет: введите хотя бы 3 символа для поиска';

    await this.editMessage(ctx, searchText, keyboard);

    // Set waiting state
    if (ctx.session) {
      ctx.session.waitingFor = 'client_search';
    }
  }

  // Handle search query
  async handleSearchQuery(ctx: BotContext, query: string): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    if (query.length < 3) {
      await this.sendMessage(ctx, '⚠️ Введите минимум 3 символа для поиска');
      return;
    }

    try {
      const clients = await this.clientService.searchForBarista(query);

      if (clients.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '🔍 Новый поиск', callback_data: 'search_client' }],
          [{ text: '◀️ Главное меню', callback_data: 'barista_menu' }]
        ];

        await this.sendMessage(ctx, '❌ Клиент не найден', keyboard);
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = clients.map(client => [{
        text: `💳 ${client.card_number} - ${client.full_name} (${client.balance} б.)`,
        callback_data: `select_client:${client.id}`
      }]);

      // Add navigation buttons
      keyboard.push([
        { text: '🔍 Новый поиск', callback_data: 'search_client' },
        { text: '◀️ Главное меню', callback_data: 'barista_menu' }
      ]);

      const resultText = `👥 *Найденные клиенты* (${clients.length}):\n\nВыберите клиента для работы:`;

      await this.sendMessage(ctx, resultText, keyboard);

    } catch (error) {
      console.error('Search error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при поиске клиентов. Попробуйте еще раз.');
    }

    // Clear waiting state
    if (ctx.session) {
      ctx.session.waitingFor = undefined;
    }
  }

  // Show client card (limited data for barista)
  async showClientCard(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const lastVisitText = client.last_visit 
        ? new Date(client.last_visit).toLocaleDateString('ru-RU', {
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit'
          })
        : 'Никогда';

      const clientText = 
        `👤 *${client.full_name}*\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Баллы: *${client.balance}*\n` +
        `📅 Последний визит: ${lastVisitText}\n` +
        `🔢 Всего визитов: ${client.visit_count}\n` +
        `📝 Заметки: ${client.notes || 'Нет'}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1 балл', callback_data: `quick_add_one:${clientId}` },
          { text: '➕ Начислить', callback_data: `earn_points:${clientId}` },
          { text: '➖ Списать', callback_data: `spend_points:${clientId}` }
        ],
        [{ text: '📝 Добавить заметку', callback_data: `add_note:${clientId}` }],
        [
          { text: '🔍 Поиск', callback_data: 'search_client' },
          { text: '🏠 Главная', callback_data: 'barista_menu' }
        ]
      ];

      await this.editMessage(ctx, clientText, keyboard);

    } catch (error) {
      console.error('Client card error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке данных клиента');
    }
  }

  // Quick add one point
  async quickAddOne(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      return;
    }

    try {
      // Execute direct points transaction for 1 point
      await this.pointService.earnPoints({
        client_id: clientId,
        operator_id: user.id,
        amount: 0,
        points: 1,
        comment: `Быстрое начисление 1 балла`
      });

      // Get updated client data
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *+1 балл добавлен!*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💰 Новый баланс: *${client.balance} баллов*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1 балл', callback_data: `quick_add_one:${clientId}` },
          { text: '👤 К клиенту', callback_data: `client_card:${clientId}` }
        ],
        [
          { text: '🔍 Новый поиск', callback_data: 'search_client' },
          { text: '🏠 Главное меню', callback_data: 'barista_menu' }
        ]
      ];

      await this.editMessage(ctx, successText, keyboard);

    } catch (error) {
      console.error('Quick add one point error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при начислении балла: ${error}`);
    }
  }

  // Start earning points process
  async startEarnPoints(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForBarista(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const earnText = 
        `➕ *Начисление баллов*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `🎯 *Выберите количество баллов для начисления:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '1', callback_data: `confirm_earn:${clientId}:1` },
          { text: '5', callback_data: `confirm_earn:${clientId}:5` },
          { text: '10', callback_data: `confirm_earn:${clientId}:10` },
          { text: '15', callback_data: `confirm_earn:${clientId}:15` }
        ],
        [
          { text: '20', callback_data: `confirm_earn:${clientId}:20` },
          { text: '25', callback_data: `confirm_earn:${clientId}:25` },
          { text: '50', callback_data: `confirm_earn:${clientId}:50` },
          { text: '100', callback_data: `confirm_earn:${clientId}:100` }
        ],
        [
          { text: '✏️ Ввести количество', callback_data: `custom_earn:${clientId}` },
          { text: '◀️ Отмена', callback_data: `client_card:${clientId}` }
        ]
      ];

      await this.editMessage(ctx, earnText, keyboard);

    } catch (error) {
      console.error('Start earn points error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении баллов');
    }
  }

  // Process custom earn amount input
  async processCustomEarnAmount(ctx: BotContext, pointsStr: string): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const points = parseInt(pointsStr);
    
    if (isNaN(points) || points <= 0) {
      await this.sendMessage(ctx, '⚠️ Введите корректное количество баллов (например: 15)');
      return;
    }

    if (points > 1000) {
      await this.sendMessage(ctx, '⚠️ Слишком много баллов. Максимум: 1000');
      return;
    }

    const { clientId } = ctx.session?.operation || {};

    if (!clientId) {
      await this.sendMessage(ctx, '❌ Ошибка сессии. Начните сначала.');
      return;
    }

    const confirmText = 
      `⭐ *Подтвердите начисление:*\n\n` +
      `⭐ К начислению: *${points} баллов*`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '✅ Подтвердить', callback_data: `confirm_earn:${clientId}:${points}` },
        { text: '❌ Отмена', callback_data: `client_card:${clientId}` }
      ]
    ];

    await this.editMessage(ctx, confirmText, keyboard);

    // Clear waiting state
    if (ctx.session) {
      ctx.session.waitingFor = undefined;
    }
  }

  // Confirm earn points
  async confirmEarnPoints(ctx: BotContext, clientId: number, points: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      return;
    }

    try {
      // Execute direct points transaction
      await this.pointService.earnPoints({
        client_id: clientId,
        operator_id: user.id,
        amount: 0, // No purchase amount, just direct points
        points: points, // Direct points assignment
        comment: `Начислено ${points} баллов`
      });

      // Get updated client data
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *Операция выполнена успешно!*\n\n` +
        `⭐ Начислено: *${points} баллов*\n` +
        `💰 Новый баланс: *${client.balance} баллов*\n` +
        `👤 Клиент: ${client.full_name}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 К клиенту', callback_data: `client_card:${clientId}` },
          { text: '🔍 Новый поиск', callback_data: 'search_client' }
        ],
        [{ text: '🏠 Главное меню', callback_data: 'barista_menu' }]
      ];

      await this.editMessage(ctx, successText, keyboard);

    } catch (error) {
      console.error('Earn points error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при начислении баллов: ${error}`);
    }
  }

  // Start custom earn points process
  async startCustomEarn(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const customText = 
        `✏️ *Свое количество баллов*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: #${client.card_number}\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `📝 Введите количество баллов для начисления:`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '❌ Отмена', callback_data: `client_card:${clientId}` }]
      ];

      await this.editMessage(ctx, customText, keyboard);

      // Set waiting state for custom amount input
      if (!ctx.session) {
        ctx.session = {};
      }
      if (!ctx.session.operation) {
        ctx.session.operation = {};
      }

      ctx.session.waitingFor = 'custom_earn_amount';
      ctx.session.operation.clientId = clientId;

    } catch (error) {
      console.error('Start custom earn error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении баллов');
    }
  }

  // Start spending points process
  async startSpendPoints(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      if (client.balance <= 0) {
        await this.sendMessage(ctx, '⚠️ У клиента недостаточно баллов для списания');
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ Отмена', callback_data: `client_card:${clientId}` }]
      ];

      const spendText = 
        `💸 *Списание баллов*\n\n` +
        `💰 Доступно баллов: *${client.balance}*\n\n` +
        `Введите количество баллов для списания:\n` +
        `(например: 50)\n\n` +
        `💡 Баллы списываются по усмотрению`;

      await this.editMessage(ctx, spendText, keyboard);

      // Set session state
      if (ctx.session) {
        ctx.session.waitingFor = 'spend_points';
        ctx.session.operation = { type: 'spend', clientId, maxPoints: client.balance };
      }

    } catch (error) {
      console.error('Start spend points error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке данных клиента');
    }
  }

  // Process spend points input
  async processSpendPoints(ctx: BotContext, pointsStr: string): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const points = parseInt(pointsStr);
    const { clientId, maxPoints } = ctx.session?.operation || {};

    if (!clientId) {
      await this.sendMessage(ctx, '❌ Ошибка сессии. Начните сначала.');
      return;
    }

    if (isNaN(points) || points <= 0) {
      await this.sendMessage(ctx, '⚠️ Введите корректное количество баллов (например: 50)');
      return;
    }

    if (points > maxPoints) {
      await this.sendMessage(ctx, `⚠️ Недостаточно баллов. Доступно: ${maxPoints}`);
      return;
    }

    const discountAmount = this.pointService.calculateDiscountAmount(points);

    const confirmText = 
      `💸 *Подтвердите списание:*\n\n` +
      `⭐ К списанию: *${points} баллов*\n` +
      `💰 Списано баллов: ${points}`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '✅ Подтвердить', callback_data: `confirm_spend:${clientId}:${points}` },
        { text: '❌ Отмена', callback_data: `client_card:${clientId}` }
      ]
    ];

    await this.editMessage(ctx, confirmText, keyboard);

    // Clear waiting state
    if (ctx.session) {
      ctx.session.waitingFor = undefined;
    }
  }

  // Confirm spend points
  async confirmSpendPoints(ctx: BotContext, clientId: number, points: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      return;
    }

    try {
      // Execute spend points transaction
      await this.pointService.spendPoints({
        client_id: clientId,
        operator_id: user.id,
        points: points,
        comment: `Списание ${points} баллов`
      });

      // Get updated client data
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const discountAmount = this.pointService.calculateDiscountAmount(points);

      const successText = 
        `✅ *Баллы списаны успешно!*\n\n` +
        `⭐ Списано: *${points} баллов*\n` +
        `💳 Остаток баллов: *${client.balance}*\n` +
        `👤 Клиент: ${client.full_name}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 К клиенту', callback_data: `client_card:${clientId}` },
          { text: '🔍 Новый поиск', callback_data: 'search_client' }
        ],
        [{ text: '🏠 Главное меню', callback_data: 'barista_menu' }]
      ];

      await this.editMessage(ctx, successText, keyboard);

    } catch (error) {
      console.error('Spend points error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при списании баллов: ${error}`);
    }
  }

  // Start adding note process
  async startAddNote(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ Отмена', callback_data: `client_card:${clientId}` }]
      ];

      const noteText = 
        `📝 *Добавление заметки*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: ${client.card_number}\n\n` +
        `📝 Текущие заметки:\n${client.notes || 'Нет'}\n\n` +
        `Введите новую заметку:`;

      await this.editMessage(ctx, noteText, keyboard);

      // Set session state
      if (ctx.session) {
        ctx.session.waitingFor = 'add_note';
        ctx.session.operation = { type: 'note', clientId };
      }

    } catch (error) {
      console.error('Start add note error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке данных клиента');
    }
  }

  // Process note input
  async processAddNote(ctx: BotContext, note: string): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const { clientId } = ctx.session?.operation || {};

    if (!clientId) {
      await this.sendMessage(ctx, '❌ Ошибка сессии. Начните сначала.');
      return;
    }

    if (note.length > 500) {
      await this.sendMessage(ctx, '⚠️ Заметка слишком длинная. Максимум 500 символов.');
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      return;
    }

    try {
      // Update client notes
      await this.clientService.updateNotes(clientId, note, user.id);

      // Get updated client data
      const client = await this.clientService.getForBarista(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *Заметка добавлена успешно!*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `📝 Новые заметки: ${client.notes}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 К клиенту', callback_data: `client_card:${clientId}` },
          { text: '🔍 Новый поиск', callback_data: 'search_client' }
        ],
        [{ text: '🏠 Главное меню', callback_data: 'barista_menu' }]
      ];

      await this.editMessage(ctx, successText, keyboard);

    } catch (error) {
      console.error('Add note error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при добавлении заметки: ${error}`);
    }

    // Clear waiting state
    if (ctx.session) {
      ctx.session.waitingFor = undefined;
    }
  }

  // Show statistics menu
  async showMyStats(ctx: BotContext): Promise<void> {
    await this.statsHandler.showStatsMenu(ctx);
  }

  // Show today's stats
  async showTodayStats(ctx: BotContext): Promise<void> {
    await this.statsHandler.showTodayStats(ctx);
  }

  // Show week stats
  async showWeekStats(ctx: BotContext): Promise<void> {
    await this.statsHandler.showWeekStats(ctx);
  }

  // Show month stats
  async showMonthStats(ctx: BotContext): Promise<void> {
    await this.statsHandler.showMonthStats(ctx);
  }

  // Show recent operations
  async showRecentOperations(ctx: BotContext): Promise<void> {
    await this.statsHandler.showRecentOperations(ctx);
  }

  // Show help for barista
  async showHelp(ctx: BotContext): Promise<void> {
    if (!await checkBaristaAccess(ctx)) {
      return;
    }

    const helpText = 
      'ℹ️ *Справка для бариста*\n\n' +
      '*Быстрое начисление баллов:*\n' +
      '⚡ Отправьте сообщение в формате:\n' +
      '   • `12345 +15` - карта + баллы\n' +
      '   • `12345 15` - карта баллы\n' +
      '   • `+15 12345` - баллы карта\n\n' +
      '*Основные функции:*\n' +
      '🔍 **Поиск клиента** - поиск по карте или ФИО\n' +
      '   • Введите минимум 3 символа\n' +
      '   • Поиск по номеру карты или имени\n\n' +
      '+1 **Быстрая кнопка** - добавить 1 балл клиенту\n' +
      '   • В карточке клиента\n' +
      '   • Мгновенное начисление\n\n' +
      '➕ **Начисление баллов** - свободное начисление\n' +
      '   • 1, 5, 10, 15, 20, 25, 50, 100 баллов\n' +
      '   • Или ввести произвольное количество\n\n' +
      '➖ **Списание баллов** - свободное списание\n' +
      '   • Проверяйте доступный баланс\n' +
      '   • Введите количество для списания\n\n' +
      '📝 **Заметки** - комментарии о клиенте\n' +
      '   • Предпочтения в напитках\n' +
      '   • Особые пожелания\n' +
      '   • Максимум 500 символов\n\n' +
      '📊 **Статистика** - ваша работа\n' +
      '   • Операции за день/неделю/месяц\n' +
      '   • Количество обслуженных клиентов\n' +
      '   • Общая сумма транзакций\n\n' +
      '*Доступные данные клиента:*\n' +
      '• Номер карты\n' +
      '• ФИО\n' +
      '• Баланс баллов\n' +
      '• Количество визитов\n' +
      '• Последний визит\n' +
      '• Заметки\n\n' +
      '*Команды:*\n' +
      '/start - главное меню\n' +
      '/help - общая справка';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '🔍 Поиск клиента', callback_data: 'search_client' },
        { text: '📊 Статистика', callback_data: 'my_stats' }
      ],
      [{ text: '◀️ Главное меню', callback_data: 'barista_menu' }]
    ];

    await this.editMessage(ctx, helpText, keyboard);
  }

  // Helper methods for messaging
  private async sendMessage(ctx: BotContext, text: string, keyboard?: TelegramBot.InlineKeyboardButton[][]): Promise<void> {
    if (!ctx.message?.chat?.id) {
      return;
    }

    const options: TelegramBot.SendMessageOptions = {
      parse_mode: 'Markdown',
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
    };

    await this.bot.sendMessage(ctx.message.chat.id, text, options);
  }

  private async editMessage(ctx: BotContext, text: string, keyboard?: TelegramBot.InlineKeyboardButton[][]): Promise<void> {
    if (!ctx.message?.chat?.id) {
      return;
    }

    try {
      await this.bot.editMessageText(text, {
        chat_id: ctx.message.chat.id,
        message_id: ctx.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
      });
    } catch (error) {
      // If edit fails, send new message
      await this.sendMessage(ctx, text, keyboard);
    }
  }
}