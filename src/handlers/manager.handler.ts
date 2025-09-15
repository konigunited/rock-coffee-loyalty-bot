import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database';
import { ClientService } from '../services/client.service';
import { PointService } from '../services/point.service';
import { UserService } from '../services/user.service';
import { NotificationService } from '../services/notification.service';
import { StaffService } from '../services/staff.service';
import { BotContext, getCurrentUser, checkManagerAccess, ACCESS_DENIED_MESSAGES } from '../middleware/access.middleware';
import { ManagerClientView, CreateClientData, UpdateClientData } from '../types/client.types';
import { CreateUserData, User } from '../types/user.types';

export class ManagerHandler {
  private bot: TelegramBot;
  private clientService: ClientService;
  private pointService: PointService;
  private userService: UserService;
  private notificationService: NotificationService;
  private staffService: StaffService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.clientService = new ClientService();
    this.pointService = new PointService();
    this.userService = new UserService();
    this.notificationService = new NotificationService(bot);
    this.staffService = new StaffService();
  }

  // Main menu for manager
  async showMainMenu(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      await this.sendMessage(ctx, ACCESS_DENIED_MESSAGES.NOT_MANAGER);
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '👥 Клиенты', callback_data: 'manage_clients' },
        { text: '👨‍💼 Персонал', callback_data: 'manage_staff' }
      ],
      [
        { text: '📊 Статистика', callback_data: 'manager_statistics' },
        { text: '🎉 Акции', callback_data: 'promotions' }
      ],
      [
        { text: '📢 Уведомления', callback_data: 'manager_notifications' },
        { text: '🔍 Поиск клиента', callback_data: 'search_client_full' }
      ]
    ];

    const user = getCurrentUser(ctx);
    const welcomeText = `🏪 Rock Coffee - Панель управляющего\n\nДобро пожаловать, ${user?.full_name}!\n\nВыберите раздел:`;

    await this.editMessage(ctx, welcomeText, keyboard);
  }

  // Client management menu
  async showClientManagement(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      // Get basic client statistics
      const stats = await this.getClientStats();

      const message = 
        `👥 *Управление клиентами*\n\n` +
        `📊 Всего клиентов: *${stats.total}*\n` +
        `🆕 Новых за неделю: *${stats.newThisWeek}*\n` +
        `🎂 Именинников на неделе: *${stats.birthdaysThisWeek}*\n` +
        `💰 Активных с баллами: *${stats.withBalance}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '🔍 Поиск клиента', callback_data: 'search_client_full' }],
        [
          { text: '📋 Все клиенты', callback_data: 'all_clients' },
          { text: '🎂 Именинники', callback_data: 'birthdays' }
        ],
        [
          { text: '🔝 Топ клиенты', callback_data: 'top_clients' },
          { text: '😴 Неактивные', callback_data: 'inactive_clients' }
        ],
        [{ text: '➕ Добавить клиента', callback_data: 'add_client' }],
        [{ text: '◀️ Главная', callback_data: 'manager_menu' }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Client management error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке данных клиентов');
    }
  }

  // Show full client card (manager view with ALL data)
  async showFullClientCard(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const birthdayAlert = client.is_birthday_soon ? '🎂 *Скоро день рождения!*\n\n' : '';
      const phoneText = client.phone ? `📱 Телефон: ${client.phone}` : '📱 Телефон: не указан';
      const birthDateText = client.birth_date 
        ? `🎂 Дата рождения: ${new Date(client.birth_date).toLocaleDateString('ru-RU')}`
        : '🎂 Дата рождения: не указана';
      
      const lastVisitText = client.last_visit
        ? new Date(client.last_visit).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Никогда';

      const message = 
        `${birthdayAlert}` +
        `👤 *${client.full_name}*\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `${phoneText}\n` +
        `${birthDateText}\n` +
        `💰 Баллы: *${client.balance}*\n` +
        `📊 Операций всего: *${client.total_transactions || 0}*\n` +
        `📅 Последний визит: ${lastVisitText}\n` +
        `🔢 Всего визитов: *${client.visit_count}*\n` +
        `📝 Заметки: ${client.notes || 'Нет'}\n\n` +
        `📅 Создан: ${new Date(client.created_at).toLocaleDateString('ru-RU')}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1', callback_data: `manager_quick_add:${clientId}:1` },
          { text: '+5', callback_data: `manager_quick_add:${clientId}:5` },
          { text: '+10', callback_data: `manager_quick_add:${clientId}:10` }
        ],
        [
          { text: '-1', callback_data: `manager_quick_spend:${clientId}:1` },
          { text: '-5', callback_data: `manager_quick_spend:${clientId}:5` },
          { text: '-10', callback_data: `manager_quick_spend:${clientId}:10` }
        ],
        [
          { text: '➕ Начислить', callback_data: `manager_earn:${clientId}` },
          { text: '➖ Списать', callback_data: `manager_spend:${clientId}` }
        ],
        [
          { text: '🎁 Бонус', callback_data: `give_bonus:${clientId}` },
          { text: '⚖️ Коррекция', callback_data: `adjust_points:${clientId}` }
        ],
        [
          { text: '✏️ Редактировать', callback_data: `edit_client:${clientId}` },
          { text: '📝 Заметки', callback_data: `edit_notes:${clientId}` }
        ],
        [
          { text: '📊 История', callback_data: `client_history:${clientId}` },
          { text: '📱 Отправить SMS', callback_data: `send_sms:${clientId}` }
        ],
        [
          { text: '🗑️ Деактивировать', callback_data: `deactivate_client:${clientId}` },
          { text: '◀️ К клиентам', callback_data: 'manage_clients' }
        ]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Full client card error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке данных клиента');
    }
  }

  // Staff management menu
  async showStaffManagement(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const staff = await this.userService.getAllStaff();
      const baristaCount = staff.filter(s => s.role === 'barista').length;
      const managerCount = staff.filter(s => s.role === 'manager').length;

      const message = 
        `👨‍💼 *Управление персоналом*\n\n` +
        `📊 Статистика персонала:\n` +
        `☕ Бариста: *${baristaCount}*\n` +
        `👔 Управляющих: *${managerCount}*\n` +
        `👑 Всего: *${staff.length}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👨‍💼 Все сотрудники', callback_data: 'all_staff' },
          { text: '☕ Только бариста', callback_data: 'baristas_only' }
        ],
        [
          { text: '➕ Добавить бариста', callback_data: 'add_barista' },
          { text: '👔 Добавить управляющего', callback_data: 'add_manager' }
        ],
        [
          { text: '📊 Статистика работы', callback_data: 'staff_statistics' },
          { text: '◀️ Главная', callback_data: 'manager_menu' }
        ]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Staff management error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке данных персонала');
    }
  }

  // Show all staff members
  async showAllStaff(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const staff = await this.userService.getAllStaff();

      if (staff.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению персоналом', callback_data: 'manage_staff' }]
        ];
        await this.editMessage(ctx, '👨‍💼 *Персонал не найден*', keyboard);
        return;
      }

      let message = '👨‍💼 *Все сотрудники:*\n\n';
      
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      
      for (const member of staff.slice(0, 8)) { // Limit to 8 for inline keyboard
        const roleEmoji = member.role === 'admin' ? '👑' : member.role === 'manager' ? '👔' : '☕';
        const statusEmoji = member.is_active ? '✅' : '❌';
        
        message += `${roleEmoji} ${member.full_name} ${statusEmoji}\n`;
        keyboard.push([{
          text: `${roleEmoji} ${member.full_name}`,
          callback_data: `staff_profile:${member.id}`
        }]);
      }

      keyboard.push([{ text: '◀️ К управлению персоналом', callback_data: 'manage_staff' }]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('All staff error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке списка персонала');
    }
  }

  // Manager statistics menu
  async showManagerStatistics(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '📅 За сегодня', callback_data: 'stats_today_manager' },
        { text: '📅 За неделю', callback_data: 'stats_week_manager' }
      ],
      [
        { text: '📅 За месяц', callback_data: 'stats_month_manager' },
        { text: '📈 Общая статистика', callback_data: 'stats_total' }
      ],
      [
        { text: '🔝 Топ клиенты', callback_data: 'top_clients_stats' },
        { text: '📝 Последние операции', callback_data: 'recent_operations_manager' }
      ],
      [
        { text: '👨‍💼 Работа персонала', callback_data: 'staff_performance' },
        { text: '👔 Сегодня персонал', callback_data: 'staff_performance_today' }
      ],
      [{ text: '◀️ Главная', callback_data: 'manager_menu' }]
    ];

    const text = '📊 *Статистика и аналитика*\n\nВыберите период или тип отчета:';
    await this.editMessage(ctx, text, keyboard);
  }

  // Show manager notifications menu
  async showNotificationsMenu(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '📢 Всем клиентам', callback_data: 'broadcast_all' },
        { text: '🎂 Именинникам', callback_data: 'broadcast_birthdays' }
      ],
      [
        { text: '😴 Неактивным', callback_data: 'broadcast_inactive' },
        { text: '🔝 Топ клиентам', callback_data: 'broadcast_top' }
      ],
      [
        { text: '📊 История рассылок', callback_data: 'broadcast_history' },
        { text: '◀️ Главная', callback_data: 'manager_menu' }
      ]
    ];

    const text = 
      '📢 *Уведомления и рассылки*\n\n' +
      'Выберите группу клиентов для отправки сообщения:';

    await this.editMessage(ctx, text, keyboard);
  }

  // Start client search (full access)
  async startFullClientSearch(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Назад', callback_data: 'manager_menu' }]
    ];

    const searchText = 
      '🔍 *Поиск клиента (полный доступ)*\n\n' +
      'Введите для поиска:\n' +
      '• Номер карты (например: 12345)\n' +
      '• ФИО клиента (например: Иванов)\n' +
      '• Номер телефона (например: +79001234567)\n\n' +
      '🎯 *Умный поиск:* для коротких номеров карт (1-3 цифры) ищет точное совпадение\n' +
      '💡 Вам доступны все персональные данные клиентов';

    await this.editMessage(ctx, searchText, keyboard);

    if (ctx.session) {
      ctx.session.waitingFor = 'full_client_search';
    }
  }

  // Handle full client search
  async handleFullClientSearch(ctx: BotContext, query: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    if (query.length < 1) {
      await this.sendMessage(ctx, '⚠️ Введите минимум 1 символ для поиска');
      return;
    }

    try {
      const clients = await this.clientService.searchForManager(query);

      if (clients.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '🔍 Новый поиск', callback_data: 'search_client_full' }],
          [{ text: '◀️ Главное меню', callback_data: 'manager_menu' }]
        ];

        await this.sendMessage(ctx, '❌ Клиенты не найдены', keyboard);
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = clients.map(client => [{
        text: `💳 ${client.card_number} - ${client.full_name} (${client.balance} б.)`,
        callback_data: `manager_client:${client.id}`
      }]);

      keyboard.push([
        { text: '🔍 Новый поиск', callback_data: 'search_client_full' },
        { text: '◀️ Главное меню', callback_data: 'manager_menu' }
      ]);

      const resultText = `👥 *Найденные клиенты* (${clients.length}):\n\nВыберите клиента:`;
      await this.sendMessage(ctx, resultText, keyboard);

    } catch (error) {
      console.error('Full search error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при поиске клиентов');
    }

    if (ctx.session) {
      ctx.session.waitingFor = undefined;
    }
  }

  // Show staff profile
  async showStaffProfile(ctx: BotContext, staffId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const staff = await this.staffService.getStaffDetails(staffId);

      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      const roleEmoji = staff.role === 'admin' ? '👑' : staff.role === 'manager' ? '👔' : '☕';
      const statusEmoji = staff.is_active ? '✅' : '❌';
      
      const lastTransactionText = staff.last_transaction_date
        ? new Date(staff.last_transaction_date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Нет операций';

      const message = 
        `${roleEmoji} *Профиль сотрудника* ${statusEmoji}\n\n` +
        `👤 ФИО: *${staff.full_name}*\n` +
        `🏷️ Роль: ${staff.role}\n` +
        `📱 Telegram: ${staff.username ? `@${staff.username}` : 'не указан'}\n` +
        `📅 Создан: ${new Date(staff.created_at).toLocaleDateString('ru-RU')}\n\n` +
        `📊 *Статистика работы:*\n` +
        `📝 Всего операций: *${staff.total_transactions}*\n` +
        `👥 Обслужил клиентов: *${staff.total_clients_served}*\n` +
        `⭐ Начислил баллов: *${staff.total_points_earned}*\n` +
        `🕐 Последняя операция: ${lastTransactionText}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📊 Подробная статистика', callback_data: `staff_detailed_stats:${staffId}` },
          { text: '📅 Рабочее время', callback_data: `staff_hours:${staffId}` }
        ],
        [
          { text: '✏️ Редактировать', callback_data: `edit_staff:${staffId}` },
          { text: staff.is_active ? '❌ Деактивировать' : '✅ Активировать', callback_data: `toggle_staff:${staffId}` }
        ]
      ];

      // Add role change option only for admins (prevent managers demoting other managers)
      const user = getCurrentUser(ctx);
      if (user && staff.role === 'manager') {
        const currentUser = await this.userService.getById(user.id);
        if (currentUser?.role === 'admin') {
          keyboard.push([
            { text: '☕ Перевести в бариста', callback_data: `change_role:${staffId}:barista` }
          ]);
        }
      }

      // Add delete option depending on permissions
      if (user) {
        const currentUser = await this.userService.getById(user.id);
        if (currentUser?.role === 'admin') {
          // Admins can delete anyone
          keyboard.push([{ text: '🗑️ Удалить сотрудника', callback_data: `delete_staff:${staffId}` }]);
        } else if (currentUser?.role === 'manager' && staff.role === 'barista') {
          // Managers can delete baristas only
          keyboard.push([{ text: '🗑️ Удалить бариста', callback_data: `delete_staff:${staffId}` }]);
        }
      }

      keyboard.push([{ text: '◀️ К персоналу', callback_data: 'all_staff' }]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Staff profile error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке профиля сотрудника');
    }
  }

  // Show edit options for a staff member (allow managers to edit baristas)
  async editStaff(ctx: BotContext, staffId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) return;

    try {
      const staff = await this.staffService.getStaffDetails(staffId);
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 ФИО', callback_data: `edit_staff_field:${staffId}:full_name` },
          { text: '🔗 Username', callback_data: `edit_staff_field:${staffId}:username` }
        ],
        [
          { text: staff.is_active ? '❌ Деактивировать' : '✅ Активировать', callback_data: `toggle_staff:${staffId}` }
        ],
        [{ text: '◀️ К персоналу', callback_data: 'all_staff' }]
      ];

      const message =
        `✏️ *Редактирование сотрудника*\n\n` +
        `👤 ${staff.full_name}\n` +
        `🏷️ Роль: ${staff.role}\n` +
        `🔗 Username: ${staff.username || 'не указан'}`;

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Edit staff error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке редактирования сотрудника');
    }
  }

  // Prompt for editing specific staff field
  async askEditStaffField(ctx: BotContext, staffId: number, field: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) return;

    const prompts: Record<string, string> = {
      full_name: 'Введите новое ФИО сотрудника:',
      username: 'Введите новый Username (без @):'
    };

    const prompt = prompts[field] || 'Введите новое значение:';

    // store session state for processing the next text message
    if (!ctx.session) ctx.session = {};
    ctx.session.waitingFor = `edit_staff_field:${staffId}:${field}`;

    await this.sendMessage(ctx, prompt);
  }

  // Process submitted staff field edit
  async processEditStaffField(ctx: BotContext, staffId: number, field: string, value: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) return;

    const user = getCurrentUser(ctx);
    if (!user) {
      await this.sendMessage(ctx, '❌ Ошибка аутентификации');
      return;
    }

    try {
      const staff = await this.userService.getById(staffId);
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      if (!this.userService.canManageUser(user, staff)) {
        await this.sendMessage(ctx, '❌ Недостаточно прав для редактирования этого сотрудника');
        return;
      }

      const updateData: any = {};
      if (field === 'full_name') updateData.full_name = value.trim();
      else if (field === 'username') updateData.username = value.trim().replace('@', '') || null;
      else {
        await this.sendMessage(ctx, '❌ Неподдерживаемое поле для редактирования');
        return;
      }

      await this.staffService.updateStaffMember(staffId, updateData, user.id);

      // Clear session state
      if (ctx.session) delete ctx.session.waitingFor;

      await this.sendMessage(ctx, '✅ Профиль сотрудника обновлен');
      // Show updated profile
      await this.showStaffProfile(ctx, staffId);

    } catch (error) {
      console.error('Process edit staff field error:', error);
      // Clear session state to prevent user from getting stuck
      if (ctx.session) delete ctx.session.waitingFor;
      await this.sendMessage(ctx, `❌ Ошибка при обновлении сотрудника: ${error}`);
      // Return to staff management menu
      await this.showStaffManagement(ctx);
    }
  }

  // Permanently remove staff from database (hard delete)
  async deleteStaff(ctx: BotContext, staffId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) return;

    const user = getCurrentUser(ctx);
    if (!user) {
      await this.sendMessage(ctx, '❌ Ошибка аутентификации');
      return;
    }

    try {
      const staff = await this.userService.getById(staffId);
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      // Use staff service method for proper permissions and logging
      await this.staffService.deleteStaffMember(staffId, user.id, 'Удалён через интерфейс управляющего');

      await this.sendMessage(ctx, `✅ Сотрудник "${staff.full_name}" полностью удалён из базы данных`);
      await this.showAllStaff(ctx);

    } catch (error) {
      console.error('Delete staff error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при удалении сотрудника: ${error}`);
    }
  }

  // Toggle staff member status
  async toggleStaffStatus(ctx: BotContext, staffId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      await this.sendMessage(ctx, '❌ Ошибка аутентификации');
      return;
    }

    try {
      const staff = await this.staffService.getStaffDetails(staffId);
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      // Check permissions for managing this staff member
      const currentUser = await this.userService.getById(user.id);
      if (!currentUser || !this.userService.canManageUser(currentUser, staff)) {
        await this.sendMessage(ctx, '❌ Недостаточно прав для управления этим сотрудником');
        return;
      }

      if (staff.is_active) {
        // Deactivate staff member
        await this.staffService.deactivateStaffMember(staffId, user.id, 'Деактивирован управляющим');
        await this.sendMessage(ctx, `✅ Сотрудник ${staff.full_name} деактивирован`);
      } else {
        // Reactivate staff member
        await this.userService.activate(staffId);
        await this.userService.logActivity(user.id, 'activate_staff', 'user', staffId, { reason: 'Активирован управляющим' });
        await this.sendMessage(ctx, `✅ Сотрудник ${staff.full_name} активирован`);
      }

      // Refresh staff profile
      await this.showStaffProfile(ctx, staffId);

    } catch (error) {
      console.error('Toggle staff status error:', error);
      if (error instanceof Error) {
        await this.sendMessage(ctx, `❌ ${error.message}`);
      } else {
        await this.sendMessage(ctx, '❌ Ошибка при изменении статуса сотрудника');
      }
    }
  }

  // Change staff member role  
  async changeStaffRole(ctx: BotContext, staffId: number, newRole: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      await this.sendMessage(ctx, '❌ Ошибка аутентификации');
      return;
    }

    try {
      const staff = await this.staffService.getStaffDetails(staffId);
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      // Check permissions
      const currentUser = await this.userService.getById(user.id);
      if (!currentUser || !this.userService.canManageUser(currentUser, staff)) {
        await this.sendMessage(ctx, '❌ Недостаточно прав для изменения роли этого сотрудника');
        return;
      }

      // Additional safety: only admins can change roles. Managers should not be allowed to change another user's role.
      if (currentUser.role !== 'admin') {
        await this.sendMessage(ctx, '❌ Только администратор может изменять роли сотрудников');
        return;
      }

      // Validate new role
      if (!['barista', 'manager'].includes(newRole)) {
        await this.sendMessage(ctx, '❌ Недопустимая роль');
        return;
      }

      // Update role
      await this.staffService.updateStaffMember(staffId, { role: newRole as any }, user.id);

      const roleText = newRole === 'barista' ? 'бариста' : 'управляющий';
      await this.sendMessage(ctx, `✅ Роль сотрудника ${staff.full_name} изменена на "${roleText}"`);

      // Refresh staff profile
      await this.showStaffProfile(ctx, staffId);

    } catch (error) {
      console.error('Change staff role error:', error);
      if (error instanceof Error) {
        await this.sendMessage(ctx, `❌ ${error.message}`);
      } else {
        await this.sendMessage(ctx, '❌ Ошибка при изменении роли сотрудника');
      }
    }
  }

  // Show today's manager statistics  
  async showTodayManagerStats(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const today = new Date();
      const stats = await this.pointService.getTotalStats(today, today);
      const dailyActivity = await this.staffService.getDailyActivity(today);
      
      const activeStaff = dailyActivity.filter(s => parseInt(s.transactions_today) > 0).length;

      const message = 
        `📊 *Статистика за сегодня*\n` +
        `📅 ${today.toLocaleDateString('ru-RU')}\n\n` +
        `👥 Обслужено клиентов: *${stats.unique_clients || 0}*\n` +
        `👨‍💼 Работало сотрудников: *${activeStaff}*\n` +
        `📝 Всего операций: *${stats.total_transactions || 0}*\n` +
        `⭐ Начислено баллов: *${stats.total_points_earned || 0}*\n` +
        `💸 Списано баллов: *${stats.total_points_spent || 0}*\n` +
        `💰 Начислено баллов: *${stats.total_points_earned || 0}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 За неделю', callback_data: 'stats_week_manager' },
          { text: '📅 За месяц', callback_data: 'stats_month_manager' }
        ],
        [
          { text: '👨‍💼 Работа персонала', callback_data: 'staff_performance_today' },
          { text: '◀️ К статистике', callback_data: 'manager_statistics' }
        ]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Today manager stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики');
    }
  }

  // Add new barista
  async startAddBarista(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Отмена', callback_data: 'manage_staff' }]
    ];

    const text = 
      '➕ *Добавление нового бариста*\n\n' +
      'Отправьте данные в следующем формате:\n' +
      '```\n' +
      'ФИО: Иванов Иван Иванович\n' +
      'Telegram ID: 123456789\n' +
      'Username: @ivanov (необязательно)\n' +
      '```\n\n' +
      '💡 Telegram ID можно узнать у @userinfobot';

    await this.editMessage(ctx, text, keyboard);

    if (ctx.session) {
      ctx.session.waitingFor = 'add_barista_data';
    }
  }

  // Process add barista data
  async processAddBaristaData(ctx: BotContext, data: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      // Parse the input data
      const lines = data.split('\n').map(line => line.trim());
      const parsedData: any = {};

      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith('фио:')) {
          parsedData.full_name = line.substring(line.indexOf(':') + 1).trim();
        } else if (lowerLine.startsWith('telegram id:') || lowerLine.startsWith('telegramid:')) {
          parsedData.telegram_id = parseInt(line.substring(line.indexOf(':') + 1).trim());
        } else if (lowerLine.startsWith('username:')) {
          parsedData.username = line.substring(line.indexOf(':') + 1).trim().replace('@', '');
        }
      }

      // Validate required fields
      if (!parsedData.full_name || !parsedData.telegram_id) {
        await this.sendMessage(ctx, '⚠️ Не все обязательные поля заполнены. Проверьте ФИО и Telegram ID.');
        return;
      }

      if (isNaN(parsedData.telegram_id)) {
        await this.sendMessage(ctx, '⚠️ Telegram ID должен быть числом.');
        return;
      }

      // Check if user already exists
      const existingUser = await this.userService.getByTelegramId(parsedData.telegram_id);
      if (existingUser) {
        await this.sendMessage(ctx, '⚠️ Пользователь с таким Telegram ID уже существует.');
        return;
      }

      const currentUser = getCurrentUser(ctx);
      if (!currentUser) {
        return;
      }

      // Create new barista
      const newBaristaId = await this.staffService.createStaffMember({
        telegram_id: parsedData.telegram_id,
        username: parsedData.username,
        full_name: parsedData.full_name,
        role: 'barista'
      }, currentUser.id);

      const successMessage = 
        `✅ *Бариста добавлен успешно!*\n\n` +
        `👤 ФИО: ${parsedData.full_name}\n` +
        `📱 Telegram ID: ${parsedData.telegram_id}\n` +
        `🔗 Username: ${parsedData.username ? '@' + parsedData.username : 'не указан'}\n` +
        `🏷️ Роль: Бариста\n\n` +
        `💡 Новый сотрудник может использовать команду /start для начала работы.`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 К профилю', callback_data: `staff_profile:${newBaristaId}` },
          { text: '➕ Добавить еще', callback_data: 'add_barista' }
        ],
        [{ text: '◀️ К персоналу', callback_data: 'manage_staff' }]
      ];

      await this.editMessage(ctx, successMessage, keyboard);

    } catch (error) {
      console.error('Add barista error:', error);
      await this.sendMessage(ctx, `❌ Ошибка при добавлении бариста: ${error}`);
    }

    if (ctx.session) {
      ctx.session.waitingFor = undefined;
    }
  }

  // Get client statistics
  private async getClientStats(): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
        COUNT(CASE WHEN birth_date IS NOT NULL AND 
          EXTRACT(WEEK FROM birth_date) = EXTRACT(WEEK FROM CURRENT_DATE) THEN 1 END) as birthdays_this_week,
        COUNT(CASE WHEN balance > 0 THEN 1 END) as with_balance
      FROM clients
      WHERE is_active = true
    `;
    
    const result = await Database.queryOne(sql);
    
    return {
      total: parseInt(result.total) || 0,
      newThisWeek: parseInt(result.new_this_week) || 0,
      birthdaysThisWeek: parseInt(result.birthdays_this_week) || 0,
      withBalance: parseInt(result.with_balance) || 0
    };
  }

  // Get all clients (paginated)
  async showAllClients(ctx: BotContext, page: number = 0): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const limit = 8;
      const offset = page * limit;

      const sql = `
        SELECT id, card_number, full_name, balance, last_visit
        FROM manager_client_view
        ORDER BY last_visit DESC NULLS LAST, created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const clients = await Database.query(sql, [limit, offset]);
      const countSql = 'SELECT COUNT(*) as total FROM manager_client_view';
      const totalResult = await Database.queryOne(countSql);
      const totalClients = parseInt(totalResult.total);
      const totalPages = Math.ceil(totalClients / limit);

      if (clients.length === 0 && page === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению клиентами', callback_data: 'manage_clients' }]
        ];
        await this.editMessage(ctx, '👥 *Клиенты не найдены*', keyboard);
        return;
      }

      let message = `👥 *Все клиенты* (стр. ${page + 1} из ${totalPages})\n\n`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      for (const client of clients) {
        const lastVisit = client.last_visit
          ? new Date(client.last_visit).toLocaleDateString('ru-RU')
          : 'Никогда';
        
        message += `💳 #${client.card_number} - ${client.full_name}\n`;
        message += `💰 ${client.balance} б. | 📅 ${lastVisit}\n\n`;
        
        keyboard.push([{
          text: `💳 ${client.card_number} - ${client.full_name}`,
          callback_data: `manager_client:${client.id}`
        }]);
      }

      // Navigation buttons
      const navButtons: TelegramBot.InlineKeyboardButton[] = [];
      if (page > 0) {
        navButtons.push({ text: '◀️ Назад', callback_data: `all_clients:${page - 1}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: 'Вперед ▶️', callback_data: `all_clients:${page + 1}` });
      }

      if (navButtons.length > 0) {
        keyboard.push(navButtons);
      }

      keyboard.push([{ text: '◀️ К управлению клиентами', callback_data: 'manage_clients' }]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('All clients error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке списка клиентов');
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

  // Show birthday clients
  async showBirthdayClients(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const birthdayClients = await this.clientService.getBirthdayClients();

      if (birthdayClients.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению клиентами', callback_data: 'manage_clients' }]
        ];
        await this.editMessage(ctx, '🎂 *Именинников на этой неделе нет*', keyboard);
        return;
      }

      let message = `🎂 *Именинники на этой неделе* (${birthdayClients.length}):\n\n`;
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      for (const client of birthdayClients.slice(0, 8)) {
        const birthDate = new Date(client.birth_date!);
        const today = new Date();
        const daysDiff = Math.ceil((birthDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const dayText = daysDiff === 0 ? 'СЕГОДНЯ' : daysDiff === 1 ? 'ЗАВТРА' : `через ${daysDiff} дн.`;
        
        message += 
          `👤 ${client.full_name}\n` +
          `💳 #${client.card_number} | 💰 ${client.balance} б.\n` +
          `🎂 ${birthDate.getDate()}.${birthDate.getMonth() + 1} (${dayText})\n\n`;
        
        keyboard.push([{
          text: `🎂 ${client.full_name} - ${dayText}`,
          callback_data: `manager_client:${client.id}`
        }]);
      }

      keyboard.push([
        { text: '🎁 Отправить поздравления', callback_data: 'send_birthday_wishes' },
        { text: '◀️ К клиентам', callback_data: 'manage_clients' }
      ]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Birthday clients error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке именинников');
    }
  }

  // Additional methods for missing functionality

  // Show promotions
  async showPromotions(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const message = 
      '🎉 *Акции и специальные предложения*\n\n' +
      'Функция в разработке. Здесь будут отображаться:\n' +
      '• Текущие акции\n' +
      '• Планируемые акции\n' +
      '• История проведенных акций\n' +
      '• Создание новых акций';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Главная', callback_data: 'manager_menu' }]
    ];

    await this.editMessage(ctx, message, keyboard);
  }

  // Show top clients
  async showTopClients(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      // Compute top clients by aggregating point_transactions to avoid stale clients.total_spent
      const sql = `
        SELECT c.id, c.card_number, c.full_name, c.balance, COALESCE(SUM(CASE WHEN pt.operation_type = 'spend' THEN ABS(pt.points) ELSE 0 END), 0) as total_spent, c.visit_count
        FROM clients c
        LEFT JOIN point_transactions pt ON pt.client_id = c.id AND pt.operation_type = 'spend'
        WHERE c.is_active = true
        GROUP BY c.id, c.card_number, c.full_name, c.balance, c.visit_count
        ORDER BY total_spent DESC
        LIMIT 10
      `;

      const topClients = await Database.query(sql);

      if (topClients.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению клиентами', callback_data: 'manage_clients' }]
        ];
        await this.editMessage(ctx, '🔝 *Топ клиенты не найдены*', keyboard);
        return;
      }

      let message = '🔝 *Топ-10 клиентов по тратам:*\n\n';
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      topClients.forEach((client, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${client.full_name}\n`;
        message += `💳 #${client.card_number} | 💰 ${client.balance} б. | 📈 ${client.visit_count || 0} пос.\n\n`;
        
        keyboard.push([{
          text: `${medal} ${client.full_name} (${client.visit_count || 0} пос.)`,
          callback_data: `manager_client:${client.id}`
        }]);
      });

      keyboard.push([{ text: '◀️ К управлению клиентами', callback_data: 'manage_clients' }]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Top clients error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке топ клиентов');
    }
  }

  // Show inactive clients  
  async showInactiveClients(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const sql = `
        SELECT id, card_number, full_name, balance, last_visit
        FROM manager_client_view
        WHERE is_active = true 
          AND (last_visit IS NULL OR last_visit < $1)
        ORDER BY last_visit DESC NULLS LAST
        LIMIT 15
      `;
      
      const inactiveClients = await Database.query(sql, [thirtyDaysAgo]);

      if (inactiveClients.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению клиентами', callback_data: 'manage_clients' }]
        ];
        await this.editMessage(ctx, '😴 *Неактивных клиентов не найдено*\n\nВсе клиенты активны!', keyboard);
        return;
      }

      let message = `😴 *Неактивные клиенты* (${inactiveClients.length})\n`;
      message += 'Не посещали более 30 дней:\n\n';
      
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      inactiveClients.slice(0, 8).forEach(client => {
        const lastVisit = client.last_visit 
          ? new Date(client.last_visit).toLocaleDateString('ru-RU')
          : 'Никогда';
        
        message += `👤 ${client.full_name}\n`;
        message += `💳 #${client.card_number} | 💰 ${client.balance} б.\n`;
        message += `📅 Последний визит: ${lastVisit}\n\n`;
        
        keyboard.push([{
          text: `😴 ${client.full_name} - ${lastVisit}`,
          callback_data: `manager_client:${client.id}`
        }]);
      });

      keyboard.push([
        { text: '📢 Напомнить о себе', callback_data: 'remind_inactive' },
        { text: '◀️ К клиентам', callback_data: 'manage_clients' }
      ]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Inactive clients error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке неактивных клиентов');
    }
  }

  // Start add client
  async startAddClient(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Отмена', callback_data: 'manage_clients' }]
    ];

    const text = 
      '➕ *Добавление нового клиента*\n\n' +
      'Функция в разработке.\n\n' +
      'Для добавления клиента обратитесь к администратору или используйте ' +
      'регистрацию через бота (@rockcoffee_bot).';

    await this.editMessage(ctx, text, keyboard);
  }

  // Show baristas only
  async showBaristasOnly(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const sql = `
        SELECT * FROM users 
        WHERE role = 'barista' AND is_active = true
        ORDER BY full_name
      `;
      
      const baristas = await Database.query(sql);

      if (baristas.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению персоналом', callback_data: 'manage_staff' }]
        ];
        await this.editMessage(ctx, '☕ *Бариста не найдены*', keyboard);
        return;
      }

      let message = `☕ *Все бариста* (${baristas.length}):\n\n`;
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      baristas.slice(0, 8).forEach(barista => {
        message += `☕ ${barista.full_name} ✅\n`;
        message += `📱 ${barista.username ? `@${barista.username}` : 'не указан'}\n\n`;
        
        keyboard.push([{
          text: `☕ ${barista.full_name}`,
          callback_data: `staff_profile:${barista.id}`
        }]);
      });

      keyboard.push([{ text: '◀️ К управлению персоналом', callback_data: 'manage_staff' }]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Baristas only error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке списка бариста');
    }
  }

  // Start add manager
  async startAddManager(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ Отмена', callback_data: 'manage_staff' }]
    ];

    const text = 
      '➕ *Добавление управляющего*\n\n' +
      'Функция доступна только администраторам.\n\n' +
      'Обратитесь к администратору системы для добавления нового управляющего.';

    await this.editMessage(ctx, text, keyboard);
  }

  // Show staff statistics
  async showStaffStatistics(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const performance = await this.staffService.getStaffPerformance(weekAgo, today);
      
      if (performance.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К управлению персоналом', callback_data: 'manage_staff' }]
        ];
        await this.editMessage(ctx, '📊 *Статистика персонала пуста*', keyboard);
        return;
      }

      let message = '📊 *Статистика работы персонала*\nЗа последние 7 дней:\n\n';
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      performance.slice(0, 6).forEach((staff, index) => {
        const roleEmoji = staff.role === 'manager' ? '👔' : '☕';
        message += `${roleEmoji} ${staff.full_name}\n`;
        message += `📝 Операций: ${staff.transactions_count} | 👥 Клиентов: ${staff.clients_served}\n`;
        message += `⭐ Начислил: ${staff.points_earned || 0} б. | 💳 Списал: ${staff.points_spent || 0} б.\n\n`;
        
        keyboard.push([{
          text: `${roleEmoji} ${staff.full_name} (${staff.transactions_count} оп.)`,
          callback_data: `staff_profile:${staff.id}`
        }]);
      });

      keyboard.push([{ text: '◀️ К управлению персоналом', callback_data: 'manage_staff' }]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Staff statistics error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики персонала');
    }
  }

  // Show week manager stats
  async showWeekManagerStats(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const stats = await this.pointService.getTotalStats(weekAgo, today);

      const message = 
        `📊 *Статистика за неделю*\n` +
        `📅 ${weekAgo.toLocaleDateString('ru-RU')} - ${today.toLocaleDateString('ru-RU')}\n\n` +
        `👥 Обслужено клиентов: *${stats.unique_clients || 0}*\n` +
        `📝 Всего операций: *${stats.total_transactions || 0}*\n` +
        `⭐ Начислено баллов: *${stats.total_points_earned || 0}*\n` +
        `💸 Списано баллов: *${stats.total_points_spent || 0}*\n` +
        `💰 Начислено баллов: *${stats.total_points_earned || 0}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 За сегодня', callback_data: 'stats_today_manager' },
          { text: '📅 За месяц', callback_data: 'stats_month_manager' }
        ],
        [{ text: '◀️ К статистике', callback_data: 'manager_statistics' }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Week manager stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики');
    }
  }

  // Show month manager stats
  async showMonthManagerStats(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const today = new Date();
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const stats = await this.pointService.getTotalStats(monthAgo, today);

      const message = 
        `📊 *Статистика за месяц*\n` +
        `📅 ${monthAgo.toLocaleDateString('ru-RU')} - ${today.toLocaleDateString('ru-RU')}\n\n` +
        `👥 Обслужено клиентов: *${stats.unique_clients || 0}*\n` +
        `📝 Всего операций: *${stats.total_transactions || 0}*\n` +
        `⭐ Начислено баллов: *${stats.total_points_earned || 0}*\n` +
        `💸 Списано баллов: *${stats.total_points_spent || 0}*\n` +
        `💰 Начислено баллов: *${stats.total_points_earned || 0}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 За сегодня', callback_data: 'stats_today_manager' },
          { text: '📅 За неделю', callback_data: 'stats_week_manager' }
        ],
        [{ text: '◀️ К статистике', callback_data: 'manager_statistics' }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Month manager stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики');
    }
  }

  // Show total stats
  async showTotalStats(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const stats = await this.pointService.getTotalStats();
      const clientsCount = await Database.queryOne('SELECT COUNT(*) as count FROM clients WHERE is_active = true');
      const staffCount = await Database.queryOne('SELECT COUNT(*) as count FROM users WHERE is_active = true AND role != \'admin\'');

      const message = 
        `📈 *Общая статистика системы*\n\n` +
        `👥 Всего клиентов: *${clientsCount.count}*\n` +
        `👨‍💼 Сотрудников: *${staffCount.count}*\n` +
        `📝 Всего операций: *${stats.total_transactions || 0}*\n` +
        `⭐ Начислено баллов: *${stats.total_points_earned || 0}*\n` +
        `💸 Списано баллов: *${stats.total_points_spent || 0}*\n` +
        `💰 Начислено баллов: *${stats.total_points_earned || 0}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📅 За сегодня', callback_data: 'stats_today_manager' },
          { text: '📅 За неделю', callback_data: 'stats_week_manager' }
        ],
        [{ text: '◀️ К статистике', callback_data: 'manager_statistics' }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Total stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке общей статистики');
    }
  }

  // Show top clients stats
  async showTopClientsStats(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    await this.showTopClients(ctx); // Reuse existing functionality
  }

  // Show staff performance
  async showStaffPerformance(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    await this.showStaffStatistics(ctx); // Reuse existing functionality
  }

  // Broadcast methods (stubs for now)
  async showBroadcastAll(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const message = 
      '📢 *Рассылка всем клиентам*\n\n' +
      'Функция в разработке.\n\n' +
      'Здесь будет возможность отправить сообщение всем активным клиентам системы.';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ К уведомлениям', callback_data: 'manager_notifications' }]
    ];

    await this.editMessage(ctx, message, keyboard);
  }

  async showBroadcastBirthdays(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const message = 
      '🎂 *Рассылка именинникам*\n\n' +
      'Функция в разработке.\n\n' +
      'Здесь будет возможность отправить поздравления клиентам, у которых скоро день рождения.';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ К уведомлениям', callback_data: 'manager_notifications' }]
    ];

    await this.editMessage(ctx, message, keyboard);
  }

  async showBroadcastInactive(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const message = 
      '😴 *Рассылка неактивным клиентам*\n\n' +
      'Функция в разработке.\n\n' +
      'Здесь будет возможность напомнить о себе клиентам, которые давно не посещали кофейню.';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ К уведомлениям', callback_data: 'manager_notifications' }]
    ];

    await this.editMessage(ctx, message, keyboard);
  }

  async showBroadcastTop(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const message = 
      '🔝 *Рассылка топ клиентам*\n\n' +
      'Функция в разработке.\n\n' +
      'Здесь будет возможность отправить специальные предложения VIP клиентам.';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ К уведомлениям', callback_data: 'manager_notifications' }]
    ];

    await this.editMessage(ctx, message, keyboard);
  }

  async showBroadcastHistory(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const message = 
      '📊 *История рассылок*\n\n' +
      'Функция в разработке.\n\n' +
      'Здесь будет отображаться история всех отправленных рассылок с результатами доставки.';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '◀️ К уведомлениям', callback_data: 'manager_notifications' }]
    ];

    await this.editMessage(ctx, message, keyboard);
  }

  // Manager earn points for client
  async startManagerEarn(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const message = 
        `💰 *Начисление баллов*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `⭐ *Выберите количество баллов для начисления:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '5 баллов', callback_data: `confirm_manager_earn:${clientId}:0:5` },
          { text: '10 баллов', callback_data: `confirm_manager_earn:${clientId}:0:10` },
          { text: '25 баллов', callback_data: `confirm_manager_earn:${clientId}:0:25` }
        ],
        [
          { text: '50 баллов', callback_data: `confirm_manager_earn:${clientId}:0:50` },
          { text: '100 баллов', callback_data: `confirm_manager_earn:${clientId}:0:100` },
          { text: '200 баллов', callback_data: `confirm_manager_earn:${clientId}:0:200` }
        ],
        [{ text: '✏️ Ввести вручную', callback_data: `manual_earn:${clientId}` }],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

      // Set session state
      if (!ctx.session) ctx.session = {};
      ctx.session.selectedClientId = clientId;
      ctx.session.operation = 'manager_earn';

    } catch (error) {
      console.error('Start manager earn error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении баллов');
    }
  }

  // Confirm manager earn points
  async confirmManagerEarn(ctx: BotContext, clientId: number, amount: number, points: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const user = getCurrentUser(ctx);
      if (!user) {
        await this.sendMessage(ctx, '❌ Пользователь не найден');
        return;
      }

      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      // Add points
      await this.pointService.earnPoints({
        client_id: clientId,
        operator_id: user.id,
        points: points,
        amount: amount,
        comment: `Начислено ${points} баллов`
      });

      const newBalance = client.balance + points;
      const message = 
        `✅ *Баллы начислены!*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n\n` +
        `➕ Начислено: *+${points} баллов*\n` +
        `💰 Новый баланс: *${newBalance} баллов*\n\n` +
        `👨‍💼 Операция: ${user.full_name}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

      // Clear session
      if (ctx.session) {
        delete ctx.session.selectedClientId;
        delete ctx.session.operation;
      }

    } catch (error) {
      console.error('Confirm manager earn error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении баллов');
    }
  }

  // Manager spend points for client
  async startManagerSpend(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      if (client.balance <= 0) {
        await this.sendMessage(ctx, '❌ У клиента нет баллов для списания');
        return;
      }

      const message = 
        `💸 *Списание баллов*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `💸 *Выберите количество баллов для списания:*`;

      const maxSpend = Math.min(client.balance, 1000); // Max 1000 points at once
      const quickAmounts = [10, 25, 50, 100, 200, 500].filter(x => x <= maxSpend);
      
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      
      // Quick amounts in rows of 3
      for (let i = 0; i < quickAmounts.length; i += 3) {
        const row = quickAmounts.slice(i, i + 3).map(amount => ({
          text: `${amount} баллов`,
          callback_data: `confirm_manager_spend:${clientId}:${amount}`
        }));
        keyboard.push(row);
      }

      keyboard.push([{ text: '✏️ Ввести вручную', callback_data: `manual_spend:${clientId}` }]);
      keyboard.push([{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]);

      await this.editMessage(ctx, message, keyboard);

      // Set session state
      if (!ctx.session) ctx.session = {};
      ctx.session.selectedClientId = clientId;
      ctx.session.operation = 'manager_spend';

    } catch (error) {
      console.error('Start manager spend error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при списании баллов');
    }
  }

  // Confirm manager spend points
  async confirmManagerSpend(ctx: BotContext, clientId: number, points: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const user = getCurrentUser(ctx);
      if (!user) {
        await this.sendMessage(ctx, '❌ Пользователь не найден');
        return;
      }

      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      if (client.balance < points) {
        await this.sendMessage(ctx, '❌ Недостаточно баллов на счету');
        return;
      }

      // Spend points
      await this.pointService.spendPoints({
        client_id: clientId,
        operator_id: user.id,
        points: points,
        comment: `Списание менеджером`
      });

      const newBalance = client.balance - points;
      const message = 
        `✅ *Баллы списаны!*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n\n` +
        `➖ Списано: *-${points} баллов*\n` +
        `💰 Новый баланс: *${newBalance} баллов*\n\n` +
        `👨‍💼 Операция: ${user.full_name}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

      // Clear session
      if (ctx.session) {
        delete ctx.session.selectedClientId;
        delete ctx.session.operation;
      }

    } catch (error) {
      console.error('Confirm manager spend error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при списании баллов');
    }
  }

  // Give bonus points
  async giveBonus(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const message = 
        `🎁 *Начисление бонуса*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `🎁 *Выберите тип бонуса:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '🎂 День рождения (+100)', callback_data: `confirm_bonus:${clientId}:100:birthday` },
          { text: '🎉 Праздничный (+50)', callback_data: `confirm_bonus:${clientId}:50:holiday` }
        ],
        [
          { text: '👥 Привел друга (+25)', callback_data: `confirm_bonus:${clientId}:25:referral` },
          { text: '💝 Подарочный (+30)', callback_data: `confirm_bonus:${clientId}:30:gift` }
        ],
        [
          { text: '🏆 VIP бонус (+200)', callback_data: `confirm_bonus:${clientId}:200:vip` },
          { text: '✏️ Свой размер', callback_data: `custom_bonus:${clientId}` }
        ],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Give bonus error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении бонуса');
    }
  }

  // Confirm bonus
  async confirmBonus(ctx: BotContext, clientId: number, points: number, type: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const user = getCurrentUser(ctx);
      if (!user) {
        await this.sendMessage(ctx, '❌ Пользователь не найден');
        return;
      }

      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const typeNames = {
        birthday: '🎂 День рождения',
        holiday: '🎉 Праздничный',
        referral: '👥 Привел друга',
        gift: '💝 Подарочный',
        vip: '🏆 VIP бонус'
      };

      // Add bonus points
      await this.pointService.adjustPoints(clientId, user.id, points, `Бонус: ${typeNames[type as keyof typeof typeNames] || type}`);

      const newBalance = client.balance + points;
      const message = 
        `✅ *Бонус начислен!*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n\n` +
        `🎁 Бонус: *${typeNames[type as keyof typeof typeNames] || type}*\n` +
        `➕ Начислено: *+${points} баллов*\n` +
        `💰 Новый баланс: *${newBalance} баллов*\n\n` +
        `👨‍💼 Операция: ${user.full_name}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Confirm bonus error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении бонуса');
    }
  }

  // Adjust points (correction)
  async adjustPoints(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const message = 
        `⚖️ *Коррекция баланса*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `⚖️ *Выберите тип коррекции:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '➕ Увеличить (+10)', callback_data: `confirm_adjust:${clientId}:10` },
          { text: '➕ Увеличить (+50)', callback_data: `confirm_adjust:${clientId}:50` }
        ],
        [
          { text: '➖ Уменьшить (-10)', callback_data: `confirm_adjust:${clientId}:-10` },
          { text: '➖ Уменьшить (-50)', callback_data: `confirm_adjust:${clientId}:-50` }
        ],
        [
          { text: '🔄 Сбросить в 0', callback_data: `confirm_adjust:${clientId}:reset` },
          { text: '✏️ Свое значение', callback_data: `custom_adjust:${clientId}` }
        ],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Adjust points error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при коррекции баланса');
    }
  }

  // Confirm adjustment
  async confirmAdjustment(ctx: BotContext, clientId: number, adjustment: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const user = getCurrentUser(ctx);
      if (!user) {
        await this.sendMessage(ctx, '❌ Пользователь не найден');
        return;
      }

      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      let adjustmentValue = 0;
      let description = '';

      if (adjustment === 'reset') {
        adjustmentValue = -client.balance;
        description = 'Сброс баланса в 0';
      } else {
        adjustmentValue = parseInt(adjustment);
        description = adjustmentValue > 0 ? `Коррекция +${adjustmentValue}` : `Коррекция ${adjustmentValue}`;
      }

      if (adjustmentValue !== 0) {
        await this.pointService.adjustPoints(clientId, user.id, adjustmentValue, description);
      }

      const newBalance = client.balance + adjustmentValue;
      const message = 
        `✅ *Баланс скорректирован!*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n\n` +
        `⚖️ Операция: *${description}*\n` +
        `💰 Новый баланс: *${newBalance} баллов*\n\n` +
        `👨‍💼 Выполнил: ${user.full_name}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Confirm adjustment error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при коррекции баланса');
    }
  }

  // Edit client information
  async editClient(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const birthDate = client.birth_date ? new Date(client.birth_date).toLocaleDateString('ru-RU') : 'Не указана';

      const message = 
        `✏️ *Редактирование клиента*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n` +
        `📱 ${client.phone}\n` +
        `🎂 ${birthDate}\n\n` +
        `*Что хотите изменить?*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 ФИО', callback_data: `edit_field:${clientId}:full_name` },
          { text: '📱 Телефон', callback_data: `edit_field:${clientId}:phone` }
        ],
        [
          { text: '🎂 День рождения', callback_data: `edit_field:${clientId}:birth_date` },
          { text: '🔄 Статус', callback_data: `toggle_status:${clientId}` }
        ],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Edit client error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при редактировании клиента');
    }
  }

  // Edit client notes
  async editClientNotes(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const currentNotes = client.notes || 'Заметки отсутствуют';

      const message = 
        `📝 *Редактирование заметок*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n\n` +
        `📝 *Текущие заметки:*\n${currentNotes}\n\n` +
        `✏️ Напишите новые заметки или нажмите "Очистить":`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '🗑️ Очистить заметки', callback_data: `clear_notes:${clientId}` }],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

      // Set session state for text input
      if (!ctx.session) ctx.session = {};
      ctx.session.selectedClientId = clientId;
      ctx.session.waitingFor = 'edit_notes';

    } catch (error) {
      console.error('Edit notes error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при редактировании заметок');
    }
  }

  // Process edit notes input
  async processEditNotes(ctx: BotContext, notes: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      await this.sendMessage(ctx, '❌ Ошибка аутентификации');
      return;
    }

    const clientId = ctx.session?.selectedClientId;
    if (!clientId) {
      await this.sendMessage(ctx, '❌ Ошибка сессии. Начните операцию заново.');
      return;
    }

    try {
      if (notes.length > 500) {
        await this.sendMessage(ctx, '❌ Заметка слишком длинная (максимум 500 символов)');
        return;
      }

      // Update client notes
      await this.clientService.updateNotes(clientId, notes, user.id);

      // Get updated client data
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *Заметки успешно обновлены!*\n\n` +
        `👤 ${client.full_name}\n` +
        `📝 Новые заметки: ${client.notes || 'Нет заметок'}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👤 К клиенту', callback_data: `manager_client:${clientId}` },
          { text: '🔍 Поиск', callback_data: 'search_client_full' }
        ],
        [{ text: '🏠 Главная', callback_data: 'manager_menu' }]
      ];

      // Add quick link to manager's profile and menu
      const profileKeyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1', callback_data: `manager_quick_add:${clientId}:1` },
          { text: '+5', callback_data: `manager_quick_add:${clientId}:5` },
          { text: '+10', callback_data: `manager_quick_add:${clientId}:10` }
        ],
        [
          { text: '-1', callback_data: `manager_quick_spend:${clientId}:1` },
          { text: '-5', callback_data: `manager_quick_spend:${clientId}:5` },
          { text: '-10', callback_data: `manager_quick_spend:${clientId}:10` }
        ],
        [
          { text: '👤 К профилю', callback_data: `staff_profile:${user.id}` },
          { text: '🏠 Главное меню', callback_data: 'manager_menu' }
        ]
      ];

      await this.editMessage(ctx, successText, profileKeyboard);

      // Clear session
      if (ctx.session) {
        delete ctx.session.waitingFor;
        delete ctx.session.selectedClientId;
      }

    } catch (error) {
      console.error('Process edit notes error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при сохранении заметок');
    }
  }

  // Show client history
  async showClientHistory(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      // Get transaction history
      const transactions = await this.pointService.getClientTransactions(clientId, 20);

      let historyText = '';
      if (transactions.length === 0) {
        historyText = 'История операций пуста';
      } else {
        historyText = transactions.map((tx, index) => {
          const icon = tx.points > 0 ? '➕' : '➖';
          const date = new Date(tx.created_at).toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          const operator = tx.operator_name || 'Система';
          return `${icon} ${Math.abs(tx.points)} баллов (${date})\n   ${tx.description || 'Операция'}\n   👨‍💼 ${operator}`;
        }).join('\n\n');
      }

      const message = 
        `📊 *История операций*\n\n` +
        `👤 ${client.full_name}\n` +
        `💳 ${client.card_number}\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `📈 *Последние операции:*\n\n${historyText}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '🔄 Обновить', callback_data: `client_history:${clientId}` }],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Show history error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке истории');
    }
  }

  // Send SMS to client
  async sendSMS(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      if (!client.phone) {
        await this.sendMessage(ctx, '❌ У клиента не указан номер телефона');
        return;
      }

      const message = 
        `📱 *Отправка SMS*\n\n` +
        `👤 ${client.full_name}\n` +
        `📱 ${client.phone}\n\n` +
        `📝 *Выберите шаблон сообщения:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '🎂 Поздравление с ДР', callback_data: `sms_template:${clientId}:birthday` },
          { text: '🎉 Акция', callback_data: `sms_template:${clientId}:promo` }
        ],
        [
          { text: '💰 Баланс баллов', callback_data: `sms_template:${clientId}:balance` },
          { text: '☕ Приглашение', callback_data: `sms_template:${clientId}:invite` }
        ],
        [
          { text: '✏️ Написать свое', callback_data: `custom_sms:${clientId}` },
          { text: '📋 История SMS', callback_data: `sms_history:${clientId}` }
        ],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Send SMS error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при отправке SMS');
    }
  }

  // Send SMS template
  async sendSMSTemplate(ctx: BotContext, clientId: number, template: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const templates = {
        birthday: `🎂 Поздравляем с Днем Рождения, ${client.full_name.split(' ')[1]}! В подарок 100 баллов на карте ${client.card_number}. Rock Coffee ждет вас!`,
        promo: `☕ Только сегодня скидка 20% на все напитки! Ваша карта: ${client.card_number}, баланс: ${client.balance} баллов. Rock Coffee`,
        balance: `💰 ${client.full_name.split(' ')[1]}, на вашей карте ${client.card_number} баланс: ${client.balance} баллов. Ждем вас в Rock Coffee!`,
        invite: `☕ Скучаем по вам в Rock Coffee! Ваша карта ${client.card_number} готова к новым покупкам. Приходите за любимым кофе!`
      };

      const smsText = templates[template as keyof typeof templates];
      
      // Here we would integrate with SMS service
      // For now, just simulate sending
      
      const message = 
        `✅ *SMS отправлено!*\n\n` +
        `👤 ${client.full_name}\n` +
        `📱 ${client.phone}\n\n` +
        `📝 *Текст сообщения:*\n${smsText}\n\n` +
        `⏰ ${new Date().toLocaleString('ru-RU')}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '📱 Отправить еще', callback_data: `send_sms:${clientId}` }],
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Send SMS template error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при отправке SMS');
    }
  }

  // Start manual earn points
  async startManualEarn(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      const message = 
        `✏️ *Ручное начисление баллов*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `⭐ *Введите количество баллов для начисления:*\n` +
        `(например: 75)`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

      // Set session state for text input
      if (!ctx.session) ctx.session = {};
      ctx.session.selectedClientId = clientId;
      ctx.session.waitingFor = 'manual_earn_amount';

    } catch (error) {
      console.error('Start manual earn error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении баллов');
    }
  }

  // Start manual spend points
  async startManualSpend(ctx: BotContext, clientId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const client = await this.clientService.getForManager(clientId);
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      if (client.balance <= 0) {
        await this.sendMessage(ctx, '❌ У клиента нет баллов для списания');
        return;
      }

      const message = 
        `✏️ *Ручное списание баллов*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💳 Карта: \`${client.card_number}\`\n` +
        `💰 Текущий баланс: *${client.balance} баллов*\n\n` +
        `💸 *Введите количество баллов для списания:*\n` +
        `(максимум: ${client.balance} баллов)`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '◀️ К клиенту', callback_data: `manager_client:${clientId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

      // Set session state for text input
      if (!ctx.session) ctx.session = {};
      ctx.session.selectedClientId = clientId;
      ctx.session.waitingFor = 'manual_spend_amount';

    } catch (error) {
      console.error('Start manual spend error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при списании баллов');
    }
  }

  // Process manual earn amount
  async processManualEarnAmount(ctx: BotContext, input: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    if (!ctx.session?.selectedClientId) {
      await this.startFullClientSearch(ctx);
      return;
    }

    try {
      const points = parseInt(input.trim());
      
      if (isNaN(points) || points <= 0) {
        await this.sendMessage(ctx, '❌ Введите корректное положительное число баллов');
        return;
      }

      if (points > 10000) {
        await this.sendMessage(ctx, '❌ Максимальное количество баллов за раз: 10000');
        return;
      }

      const clientId = ctx.session.selectedClientId;
      await this.confirmManagerEarn(ctx, clientId, 0, points);

      // Clear session
      delete ctx.session.waitingFor;
      delete ctx.session.selectedClientId;

    } catch (error) {
      console.error('Process manual earn error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при обработке данных');
    }
  }

  // Process manual spend amount
  async processManualSpendAmount(ctx: BotContext, input: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    if (!ctx.session?.selectedClientId) {
      await this.startFullClientSearch(ctx);
      return;
    }

    try {
      const points = parseInt(input.trim());
      
      if (isNaN(points) || points <= 0) {
        await this.sendMessage(ctx, '❌ Введите корректное положительное число баллов');
        return;
      }

      const clientId = ctx.session.selectedClientId;
      const client = await this.clientService.getForManager(clientId);
      
      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      if (points > client.balance) {
        await this.sendMessage(ctx, `❌ Недостаточно баллов. Доступно: ${client.balance} баллов`);
        return;
      }

      await this.confirmManagerSpend(ctx, clientId, points);

      // Clear session
      delete ctx.session.waitingFor;
      delete ctx.session.selectedClientId;

    } catch (error) {
      console.error('Process manual spend error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при обработке данных');
    }
  }

  // Show recent operations across all staff (manager view)
  async showRecentOperations(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      // Get recent transactions from all staff members (not just current user)
      const recentTransactions = await this.pointService.getAllRecentTransactions(20);

      if (recentTransactions.length === 0) {
        const text = '📝 *Последние операции*\n\n❌ Операции не найдены';
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К статистике', callback_data: 'manager_statistics' }]
        ];
        
        await this.editMessage(ctx, text, keyboard);
        return;
      }

      let operationsText = '📝 *Последние операции персонала*\n\n';
      
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
          `👤 ${transaction.client_name} (💳 #${transaction.card_number})\n` +
          `👨‍💼 Сотрудник: ${transaction.operator_name || 'Система'}\n` +
          `🕐 ${date}\n\n`;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '🔄 Обновить', callback_data: 'recent_operations_manager' },
          { text: '◀️ К статистике', callback_data: 'manager_statistics' }
        ]
      ];

      await this.editMessage(ctx, operationsText, keyboard);

    } catch (error) {
      console.error('Recent operations error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке операций');
    }
  }

  // Show detailed staff statistics
  async showStaffDetailedStats(ctx: BotContext, staffId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const staff = await this.staffService.getStaffDetails(staffId);
      
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      // Get detailed stats for different periods
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const todayStats = await this.pointService.getBaristaStats(staffId, today, today);
      const weekStats = await this.pointService.getBaristaStats(staffId, weekAgo, today);
      const monthStats = await this.pointService.getBaristaStats(staffId, monthAgo, today);

      const roleEmoji = staff.role === 'admin' ? '👑' : staff.role === 'manager' ? '👔' : '☕';
      
      const message = 
        `${roleEmoji} *Детальная статистика*\n\n` +
        `👤 Сотрудник: *${staff.full_name}*\n` +
        `🏷️ Роль: ${staff.role}\n\n` +
        `📊 **За сегодня:**\n` +
        `👥 Клиентов: ${todayStats.clients_served}\n` +
        `📝 Операций: ${todayStats.transactions_count}\n` +
        `⭐ Начислено: ${todayStats.total_earned} б.\n` +
        `💸 Списано: ${todayStats.total_spent} б.\n\n` +
        `📊 **За неделю:**\n` +
        `👥 Клиентов: ${weekStats.clients_served}\n` +
        `📝 Операций: ${weekStats.transactions_count}\n` +
        `⭐ Начислено: ${weekStats.total_earned} б.\n` +
        `💸 Списано: ${weekStats.total_spent} б.\n\n` +
        `📊 **За месяц:**\n` +
        `👥 Клиентов: ${monthStats.clients_served}\n` +
        `📝 Операций: ${monthStats.transactions_count}\n` +
        `⭐ Начислено: ${monthStats.total_earned} б.\n` +
        `💸 Списано: ${monthStats.total_spent} б.`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📝 Операции сотрудника', callback_data: `staff_operations:${staffId}` },
          { text: '🔄 Обновить', callback_data: `staff_detailed_stats:${staffId}` }
        ],
        [{ text: '◀️ К профилю', callback_data: `staff_profile:${staffId}` }]
      ];

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Staff detailed stats error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке детальной статистики');
    }
  }

  // Show staff operations
  async showStaffOperations(ctx: BotContext, staffId: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const staff = await this.staffService.getStaffDetails(staffId);
      
      if (!staff) {
        await this.sendMessage(ctx, '❌ Сотрудник не найден');
        return;
      }

      const recentTransactions = await this.pointService.getRecentTransactions(staffId, 15);

      if (recentTransactions.length === 0) {
        const text = `📝 *Операции сотрудника*\n\n👤 ${staff.full_name}\n\n❌ Операции не найдены`;
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К статистике', callback_data: `staff_detailed_stats:${staffId}` }]
        ];
        
        await this.editMessage(ctx, text, keyboard);
        return;
      }

      let operationsText = `📝 *Операции сотрудника*\n\n👤 ${staff.full_name}\n\n`;
      
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
          `👤 ${transaction.client_name} (💳 #${transaction.card_number})\n` +
          `🕐 ${date}\n\n`;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '🔄 Обновить', callback_data: `staff_operations:${staffId}` },
          { text: '◀️ К статистике', callback_data: `staff_detailed_stats:${staffId}` }
        ]
      ];

      await this.editMessage(ctx, operationsText, keyboard);

    } catch (error) {
      console.error('Staff operations error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке операций сотрудника');
    }
  }

  // Show staff performance today
  async showStaffPerformanceToday(ctx: BotContext): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      const performance = await this.staffService.getStaffPerformance(startOfDay, endOfDay);
      
      if (performance.length === 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '◀️ К статистике', callback_data: 'manager_statistics' }]
        ];
        await this.editMessage(ctx, '👨‍💼 *Работа персонала сегодня*\n\n❌ Активности не найдено', keyboard);
        return;
      }

      let message = `👨‍💼 *Работа персонала сегодня*\n📅 ${today.toLocaleDateString('ru-RU')}\n\n`;
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      performance.slice(0, 8).forEach((staff, index) => {
        const roleEmoji = staff.role === 'manager' ? '👔' : '☕';
        message += `${roleEmoji} ${staff.full_name}\n`;
        message += `📝 Операций: ${staff.transactions_count} | 👥 Клиентов: ${staff.clients_served}\n`;
        message += `⭐ Начислил: ${staff.points_earned || 0} б. | 💳 Списал: ${staff.points_spent || 0} б.\n\n`;
        
        keyboard.push([{
          text: `${roleEmoji} ${staff.full_name} (${staff.transactions_count} оп.)`,
          callback_data: `staff_detailed_stats:${staff.id}`
        }]);
      });

      keyboard.push([
        { text: '📊 За неделю', callback_data: 'staff_performance' },
        { text: '◀️ К статистике', callback_data: 'manager_statistics' }
      ]);

      await this.editMessage(ctx, message, keyboard);

    } catch (error) {
      console.error('Staff performance today error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при загрузке статистики персонала');
    }
  }

  // Quick add points (manager version)
  async managerQuickAddPoints(ctx: BotContext, clientId: number, points: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
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
        amount: 0,
        points: points,
        comment: `Быстрое начисление ${points} балл(ов) управляющим`
      });

      // Get updated client data
      const client = await this.clientService.getForManager(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *+${points} балл(ов) добавлено!*\n\n` +
        `👤 Клиент: ${client.full_name}\n` +
        `💰 Новый баланс: *${client.balance} баллов*\n` +
        `📅 ${new Date().toLocaleDateString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1', callback_data: `manager_quick_add:${clientId}:1` },
          { text: '+5', callback_data: `manager_quick_add:${clientId}:5` },
          { text: '+10', callback_data: `manager_quick_add:${clientId}:10` }
        ],
        [
          { text: '-1', callback_data: `manager_quick_spend:${clientId}:1` },
          { text: '-5', callback_data: `manager_quick_spend:${clientId}:5` },
          { text: '-10', callback_data: `manager_quick_spend:${clientId}:10` }
        ],
        [
          { text: '👤 К клиенту', callback_data: `manager_client:${clientId}` },
          { text: '🔍 Новый поиск', callback_data: 'search_client_full' }
        ],
        [{ text: '🏠 Главное меню', callback_data: 'manager_menu' }]
      ];

      // Add quick link to manager's profile and menu
      const profileKeyboard2: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1', callback_data: `manager_quick_add:${clientId}:1` },
          { text: '+5', callback_data: `manager_quick_add:${clientId}:5` },
          { text: '+10', callback_data: `manager_quick_add:${clientId}:10` }
        ],
        [
          { text: '-1', callback_data: `manager_quick_spend:${clientId}:1` },
          { text: '-5', callback_data: `manager_quick_spend:${clientId}:5` },
          { text: '-10', callback_data: `manager_quick_spend:${clientId}:10` }
        ],
        [
          { text: '👤 К профилю', callback_data: `staff_profile:${user.id}` },
          { text: '🏠 Главное меню', callback_data: 'manager_menu' }
        ]
      ];

      await this.editMessage(ctx, successText, profileKeyboard2);

    } catch (error) {
      console.error('Manager quick add points error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при начислении баллов');
    }
  }

  // Quick spend points (manager version)
  async managerQuickSpendPoints(ctx: BotContext, clientId: number, points: number): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    const user = getCurrentUser(ctx);
    if (!user) {
      return;
    }

    try {
      // Get current client data to check balance
      const client = await this.clientService.getForManager(clientId);

      if (!client) {
        await this.sendMessage(ctx, '❌ Клиент не найден');
        return;
      }

      // Check if client has enough balance
      if (client.balance < points) {
        const errorText = 
          `❌ *Недостаточно баллов для списания!*\n\n` +
          `👤 Клиент: ${client.full_name}\n` +
          `💰 Текущий баланс: *${client.balance} баллов*\n` +
          `🚫 Требуется: *${points} баллов*`;

        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [{ text: '👤 К клиенту', callback_data: `manager_client:${clientId}` }]
        ];

        await this.editMessage(ctx, errorText, keyboard);
        return;
      }

      // Execute points spend transaction
      await this.pointService.spendPoints({
        client_id: clientId,
        operator_id: user.id,
        points: points,
        comment: `Быстрое списание ${points} балл(ов) управляющим`
      });

      // Get updated client data
      const updatedClient = await this.clientService.getForManager(clientId);

      if (!updatedClient) {
        await this.sendMessage(ctx, '❌ Ошибка при обновлении данных клиента');
        return;
      }

      const successText = 
        `✅ *-${points} балл(ов) списано!*\n\n` +
        `👤 Клиент: ${updatedClient.full_name}\n` +
        `💰 Новый баланс: *${updatedClient.balance} баллов*\n` +
        `📅 ${new Date().toLocaleDateString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '+1', callback_data: `manager_quick_add:${clientId}:1` },
          { text: '+5', callback_data: `manager_quick_add:${clientId}:5` },
          { text: '+10', callback_data: `manager_quick_add:${clientId}:10` }
        ],
        [
          { text: '-1', callback_data: `manager_quick_spend:${clientId}:1` },
          { text: '-5', callback_data: `manager_quick_spend:${clientId}:5` },
          { text: '-10', callback_data: `manager_quick_spend:${clientId}:10` }
        ],
        [
          { text: '👤 К клиенту', callback_data: `manager_client:${clientId}` },
          { text: '🔍 Новый поиск', callback_data: 'search_client_full' }
        ],
        [{ text: '🏠 Главное меню', callback_data: 'manager_menu' }]
      ];

      await this.editMessage(ctx, successText, keyboard);

    } catch (error) {
      console.error('Manager quick spend points error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при списании баллов');
    }
  }

  // Quick points input for managers - allow direct message like "23 2" or "23 -4"
  async handleQuickPointsInput(ctx: BotContext, text: string): Promise<void> {
    if (!await checkManagerAccess(ctx)) {
      return;
    }

    // Parse input like "23 2" (add) or "23 -4" (spend) or "+2 23" or "-4 23"
    const patterns = [
      /^(\d+)\s*\+(\d+)$/, // "23 +2" (legacy support)
      /^(\d+)\s+(\d+)$/, // "23 2" (add points)  
      /^(\d+)\s+(-\d+)$/, // "23 -4" (spend points)
      /^\+(\d+)\s+(\d+)$/, // "+2 23" (legacy support)
      /^(-\d+)\s+(\d+)$/, // "-4 23" (spend points)
    ];

    let cardNumber: string | null = null;
    let points: number | null = null;
    let isSpending = false;

    for (const pattern of patterns) {
      const match = text.trim().match(pattern);
      if (match) {
        if (pattern === patterns[3]) { // "+2 23" format
          points = parseInt(match[1]);
          cardNumber = match[2];
        } else if (pattern === patterns[4]) { // "-4 23" format
          points = Math.abs(parseInt(match[1])); // Convert to positive
          cardNumber = match[2];
          isSpending = true;
        } else if (pattern === patterns[2]) { // "23 -4" format
          cardNumber = match[1];
          points = Math.abs(parseInt(match[2])); // Convert to positive
          isSpending = true;
        } else { // "23 +2" or "23 2" format
          cardNumber = match[1];
          points = parseInt(match[2]);
        }
        break;
      }
    }

    if (!cardNumber || !points || points <= 0) {
      await this.sendMessage(ctx, 
        '❌ Неправильный формат. Используйте:\n' +
        '• `23 2` (карта + начислить 2 балла)\n' +
        '• `23 -4` (карта + списать 4 балла)\n' +
        '• `+2 23` или `-4 23` (баллы + карта)'
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
      const client = await this.clientService.getByCardNumber(cardNumber);
      
      if (!client) {
        await this.sendMessage(ctx, `❌ Клиент с картой \`${cardNumber}\` не найден`);
        return;
      }

      if (isSpending) {
        // Check balance for spending
        if (client.balance < points) {
          await this.sendMessage(ctx, 
            `❌ *Недостаточно баллов!*\n\n` +
            `👤 ${client.full_name} (💳 ${cardNumber})\n` +
            `💰 Баланс: ${client.balance} б.\n` +
            `🚫 Требуется: ${points} б.`
          );
          return;
        }

        // Spend points
        await this.pointService.spendPoints({
          client_id: client.id,
          operator_id: user.id,
          points: points,
          comment: `Быстрое списание ${points} балл(ов) управляющим`
        });

        // Get updated balance
        const updatedClient = await this.clientService.getByCardNumber(cardNumber);
        
        const profileKeyboard: TelegramBot.InlineKeyboardButton[][] = [
          [
            { text: '+1', callback_data: `manager_quick_add:${client.id}:1` },
            { text: '+5', callback_data: `manager_quick_add:${client.id}:5` },
            { text: '+10', callback_data: `manager_quick_add:${client.id}:10` }
          ],
          [
            { text: '-1', callback_data: `manager_quick_spend:${client.id}:1` },
            { text: '-5', callback_data: `manager_quick_spend:${client.id}:5` },
            { text: '-10', callback_data: `manager_quick_spend:${client.id}:10` }
          ],
          [
            { text: '👤 К профилю', callback_data: `staff_profile:${user.id}` },
            { text: '🏠 Главное меню', callback_data: 'manager_menu' }
          ]
        ];

        await this.sendMessage(ctx, 
          `✅ *-${points} балл(ов) списано!*\n\n` +
          `👤 ${client.full_name} (💳 ${cardNumber})\n` +
          `💰 Новый баланс: *${updatedClient?.balance || 0} баллов*`,
          profileKeyboard
        );

      } else {
        // Add points
        await this.pointService.earnPoints({
          client_id: client.id,
          operator_id: user.id,
          amount: 0,
          points: points,
          comment: `Быстрое начисление ${points} балл(ов) управляющим`
        });

        // Get updated balance
        const updatedClient = await this.clientService.getByCardNumber(cardNumber);
        
        const profileKeyboard: TelegramBot.InlineKeyboardButton[][] = [
          [
            { text: '+1', callback_data: `manager_quick_add:${client.id}:1` },
            { text: '+5', callback_data: `manager_quick_add:${client.id}:5` },
            { text: '+10', callback_data: `manager_quick_add:${client.id}:10` }
          ],
          [
            { text: '-1', callback_data: `manager_quick_spend:${client.id}:1` },
            { text: '-5', callback_data: `manager_quick_spend:${client.id}:5` },
            { text: '-10', callback_data: `manager_quick_spend:${client.id}:10` }
          ],
          [
            { text: '👤 К профилю', callback_data: `staff_profile:${user.id}` },
            { text: '🏠 Главное меню', callback_data: 'manager_menu' }
          ]
        ];

        await this.sendMessage(ctx, 
          `✅ *+${points} балл(ов) добавлено!*\n\n` +
          `👤 ${client.full_name} (💳 ${cardNumber})\n` +
          `💰 Новый баланс: *${updatedClient?.balance || 0} баллов*`,
          profileKeyboard
        );
      }

    } catch (error) {
      console.error('Manager quick points error:', error);
      await this.sendMessage(ctx, '❌ Ошибка при обработке операции');
    }
  }
}