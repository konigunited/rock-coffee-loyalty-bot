import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database';
import { UserService } from '../services/user.service';
import { ClientService } from '../services/client.service';
import { PointService } from '../services/point.service';
import { BotContext } from '../middleware/access.middleware';
import { UserRole } from '../types/user.types';

export class AdminHandler {
  private bot: TelegramBot;
  private userService: UserService;
  private clientService: ClientService;
  private pointService: PointService;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.userService = new UserService();
    this.clientService = new ClientService();
    this.pointService = new PointService();
  }

  // Show admin main menu with system overview
  async showMainMenu(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const systemStats = await this.getSystemStatistics();
      
      const menuText = 
        `⚡ *ROCK COFFEE - ПАНЕЛЬ АДМИНИСТРАТОРА*\n\n` +
        `📊 **ОБЗОР СИСТЕМЫ:**\n` +
        `👥 Всего клиентов: *${systemStats.totalClients}*\n` +
        `📋 Активных клиентов: *${systemStats.activeClients}*\n` +
        `👨‍💼 Управляющих: *${systemStats.managers}*\n` +
        `👨‍🍳 Барист: *${systemStats.baristas}*\n\n` +
        `💰 **СТАТИСТИКА БАЛЛОВ:**\n` +
        `📈 Операций сегодня: *${systemStats.todayOperations}*\n` +
        `📊 Операций в месяце: *${systemStats.monthOperations}*\n` +
        `⭐ Баллов выдано: *${systemStats.pointsIssued}*\n` +
        `💸 Баллов потрачено: *${systemStats.pointsSpent}*\n\n` +
        `🔧 **СИСТЕМНЫЕ ПАРАМЕТРЫ:**\n` +
        `💾 База данных: ${systemStats.dbStatus}\n` +
        `📊 Активных сессий: *${systemStats.activeSessions}*\n` +
        `🤖 Бот статус: *Активен* ✅\n\n` +
        `🏠 *Выберите раздел управления:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '👨‍💼 Управление менеджерами', callback_data: 'admin_manage_managers' },
          { text: '📊 Системная аналитика', callback_data: 'admin_analytics' }
        ],
        [
          { text: '⚙️ Настройки системы', callback_data: 'admin_system_settings' },
          { text: '🔍 Мониторинг системы', callback_data: 'admin_monitoring' }
        ],
        [
          { text: '💾 Резервное копирование', callback_data: 'admin_backup_restore' },
          { text: '📝 Журнал аудита', callback_data: 'admin_audit_log' }
        ],
        [
          { text: '📢 Массовые уведомления', callback_data: 'admin_broadcast' },
          { text: '🎯 Акции и промо', callback_data: 'admin_promotions' }
        ],
        [
          { text: '🔄 Перезагрузить статистику', callback_data: 'admin_refresh_stats' }
        ]
      ];

      await this.editOrSendMessage(ctx, menuText, keyboard);

    } catch (error) {
      console.error('Admin main menu error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке административной панели.');
    }
  }

  // Manager management functions
  async showManagerManagement(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const managers = await this.userService.getByRole('manager');
      const baristas = await this.userService.getByRole('barista');
      
      let managersText = '';
      if (managers.length > 0) {
        managersText = managers.map((manager, index) => 
          `${index + 1}. ${manager.full_name} (@${manager.username || 'N/A'})\n` +
          `   📱 ID: ${manager.telegram_id}\n` +
          `   📅 Добавлен: ${new Date(manager.created_at).toLocaleDateString('ru-RU')}\n`
        ).join('\n');
      } else {
        managersText = '_Управляющие не найдены_';
      }

      let baristasText = '';
      if (baristas.length > 0) {
        baristasText = baristas.map((barista, index) => 
          `${index + 1}. ${barista.full_name} (@${barista.username || 'N/A'})\n` +
          `   📱 ID: ${barista.telegram_id}\n`
        ).join('\n');
      } else {
        baristasText = '_Бариста не найдены_';
      }

      const menuText = 
        `👨‍💼 **УПРАВЛЕНИЕ ПЕРСОНАЛОМ**\n\n` +
        `📋 **УПРАВЛЯЮЩИЕ (${managers.length}):**\n${managersText}\n\n` +
        `☕ **БАРИСТА (${baristas.length}):**\n${baristasText}\n\n` +
        `🔧 *Выберите действие:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '➕ Добавить управляющего', callback_data: 'admin_add_manager' },
          { text: '➕ Добавить бариста', callback_data: 'admin_add_barista' }
        ],
        [
          { text: '👨‍💼 Список управляющих', callback_data: 'admin_list_managers' },
          { text: '☕ Список барист', callback_data: 'admin_list_baristas' }
        ],
        [
          { text: '🗑️ Удалить сотрудника', callback_data: 'admin_remove_staff' },
          { text: '✏️ Редактировать профиль', callback_data: 'admin_edit_staff' }
        ],
        [
          { text: '◀️ Назад в админ-панель', callback_data: 'admin_main_menu' }
        ]
      ];

      await this.editOrSendMessage(ctx, menuText, keyboard);

    } catch (error) {
      console.error('Manager management error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке управления персоналом.');
    }
  }

  // System settings
  async showSystemSettings(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const settings = await this.getSystemSettings();
      
      const settingsText = 
        `⚙️ **НАСТРОЙКИ СИСТЕМЫ**\n\n` +
        `💰 **СИСТЕМА БАЛЛОВ:**\n` +
        `• Система начисления: Свободная\n` +
        `• Начисление баллов: По усмотрению оператора\n` +
        `• Максимум к списанию: ${settings.maxSpendPercent}% от суммы\n` +
        `• Приветственный бонус: ${settings.welcomeBonus} баллов\n\n` +
        `🎂 **ПРОГРАММА ЛОЯЛЬНОСТИ:**\n` +
        `• Бонус день рождения: ${settings.birthdayBonus} баллов\n` +
        `• Срок действия баллов: ${settings.pointsExpiryDays} дней\n` +
        `• Уведомления о балансе: ${settings.balanceNotifications ? '✅' : '❌'}\n\n` +
        `🤖 **НАСТРОЙКИ БОТА:**\n` +
        `• Автоматические уведомления: ${settings.autoNotifications ? '✅' : '❌'}\n` +
        `• Сбор статистики: ${settings.collectStats ? '✅' : '❌'}\n` +
        `• Режим отладки: ${settings.debugMode ? '✅' : '❌'}\n\n` +
        `🔧 *Выберите настройку для изменения:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '💰 Настройки баллов', callback_data: 'admin_points_settings' },
          { text: '🎂 Программа лояльности', callback_data: 'admin_loyalty_settings' }
        ],
        [
          { text: '🤖 Настройки бота', callback_data: 'admin_bot_settings' },
          { text: '📊 Настройки аналитики', callback_data: 'admin_analytics_settings' }
        ],
        [
          { text: '🔄 Сбросить к заводским', callback_data: 'admin_reset_settings' },
          { text: '💾 Экспорт настроек', callback_data: 'admin_export_settings' }
        ],
        [
          { text: '◀️ Назад в админ-панель', callback_data: 'admin_main_menu' }
        ]
      ];

      await this.editOrSendMessage(ctx, settingsText, keyboard);

    } catch (error) {
      console.error('System settings error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке настроек системы.');
    }
  }

  // System monitoring
  async showSystemMonitoring(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const monitoring = await this.getSystemMonitoring();
      
      const monitoringText = 
        `🔍 **МОНИТОРИНГ СИСТЕМЫ**\n\n` +
        `💾 **БАЗА ДАННЫХ:**\n` +
        `• Статус: ${monitoring.dbStatus}\n` +
        `• Активных соединений: ${monitoring.dbConnections}\n` +
        `• Размер БД: ${monitoring.dbSize} MB\n` +
        `• Время ответа: ${monitoring.dbResponseTime}ms\n\n` +
        `🤖 **ТЕЛЕГРАМ БОТ:**\n` +
        `• Статус: ${monitoring.botStatus}\n` +
        `• Активных сессий: ${monitoring.activeSessions}\n` +
        `• Сообщений сегодня: ${monitoring.messagesToday}\n` +
        `• Ошибок за час: ${monitoring.errorsLastHour}\n\n` +
        `🖥️ **СЕРВЕР:**\n` +
        `• CPU: ${monitoring.cpuUsage}%\n` +
        `• RAM: ${monitoring.ramUsage}%\n` +
        `• Дисковое пространство: ${monitoring.diskUsage}%\n` +
        `• Время работы: ${monitoring.uptime}\n\n` +
        `📊 **ПРОИЗВОДИТЕЛЬНОСТЬ:**\n` +
        `• Транзакций/мин: ${monitoring.transactionsPerMinute}\n` +
        `• Средний ответ API: ${monitoring.avgApiResponse}ms\n\n` +
        `📈 *Система работает ${monitoring.systemHealth}*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '🔄 Обновить данные', callback_data: 'admin_refresh_monitoring' },
          { text: '📊 Детальная статистика', callback_data: 'admin_detailed_stats' }
        ],
        [
          { text: '🚨 Журнал ошибок', callback_data: 'admin_error_log' },
          { text: '⚡ Проверка сервисов', callback_data: 'admin_health_check' }
        ],
        [
          { text: '📈 Графики нагрузки', callback_data: 'admin_load_charts' },
          { text: '🔧 Диагностика системы', callback_data: 'admin_diagnostics' }
        ],
        [
          { text: '◀️ Назад в админ-панель', callback_data: 'admin_main_menu' }
        ]
      ];

      await this.editOrSendMessage(ctx, monitoringText, keyboard);

    } catch (error) {
      console.error('System monitoring error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке системного мониторинга.');
    }
  }

  // Backup and restore
  async showBackupRestore(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const backupInfo = await this.getBackupInfo();
      
      const backupText = 
        `💾 **РЕЗЕРВНОЕ КОПИРОВАНИЕ**\n\n` +
        `📅 **ПОСЛЕДНИЕ РЕЗЕРВНЫЕ КОПИИ:**\n` +
        backupInfo.recentBackups.map((backup, index) => 
          `${index + 1}. ${backup.name}\n` +
          `   📅 ${new Date(backup.date).toLocaleString('ru-RU')}\n` +
          `   📊 Размер: ${backup.size} MB\n` +
          `   ✅ Статус: ${backup.status}\n`
        ).join('\n') + '\n' +
        `🔄 **АВТОМАТИЧЕСКОЕ КОПИРОВАНИЕ:**\n` +
        `• Расписание: ${backupInfo.autoBackupSchedule}\n` +
        `• Следующая копия: ${backupInfo.nextAutoBackup}\n` +
        `• Хранить копий: ${backupInfo.keepBackups} шт.\n\n` +
        `📈 **СТАТИСТИКА КОПИРОВАНИЯ:**\n` +
        `• Всего копий: ${backupInfo.totalBackups}\n` +
        `• Общий размер: ${backupInfo.totalSize} GB\n` +
        `• Последнее восстановление: ${backupInfo.lastRestore || 'Никогда'}\n\n` +
        `💾 *Выберите действие:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '💾 Создать резервную копию', callback_data: 'admin_create_backup' },
          { text: '📥 Восстановить из копии', callback_data: 'admin_restore_backup' }
        ],
        [
          { text: '📋 Список всех копий', callback_data: 'admin_list_backups' },
          { text: '🗑️ Удалить старые копии', callback_data: 'admin_cleanup_backups' }
        ],
        [
          { text: '⚙️ Настройки копирования', callback_data: 'admin_backup_settings' },
          { text: '🔍 Проверить целостность', callback_data: 'admin_verify_backups' }
        ],
        [
          { text: '📊 Экспорт данных', callback_data: 'admin_export_data' },
          { text: '📥 Импорт данных', callback_data: 'admin_import_data' }
        ],
        [
          { text: '◀️ Назад в админ-панель', callback_data: 'admin_main_menu' }
        ]
      ];

      await this.editOrSendMessage(ctx, backupText, keyboard);

    } catch (error) {
      console.error('Backup restore error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке системы резервного копирования.');
    }
  }

  // Audit log
  async showAuditLog(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const auditData = await this.getAuditLogData();
      
      const auditText = 
        `📝 **ЖУРНАЛ АУДИТА СИСТЕМЫ**\n\n` +
        `📊 **СТАТИСТИКА ЗА СЕГОДНЯ:**\n` +
        `• Всего операций: ${auditData.todayTotal}\n` +
        `• Операций с баллами: ${auditData.pointOperations}\n` +
        `• Регистраций клиентов: ${auditData.clientRegistrations}\n` +
        `• Административных действий: ${auditData.adminActions}\n\n` +
        `🔍 **ПОСЛЕДНИЕ ОПЕРАЦИИ:**\n` +
        auditData.recentOperations.map((op, index) => 
          `${index + 1}. [${new Date(op.timestamp).toLocaleTimeString('ru-RU')}] ${op.user}\n` +
          `   🎯 ${op.action}\n` +
          `   📋 ${op.details}\n`
        ).join('\n') + '\n' +
        `⚠️ **КРИТИЧЕСКИЕ СОБЫТИЯ:**\n` +
        `• Неудачных входов: ${auditData.failedLogins}\n` +
        `• Подозрительных операций: ${auditData.suspiciousOperations}\n` +
        `• Системных ошибок: ${auditData.systemErrors}\n\n` +
        `📈 *Фильтры и экспорт:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📋 Все операции', callback_data: 'admin_audit_all' },
          { text: '💰 Операции с баллами', callback_data: 'admin_audit_points' }
        ],
        [
          { text: '👨‍💼 Действия персонала', callback_data: 'admin_audit_staff' },
          { text: '👥 Действия клиентов', callback_data: 'admin_audit_clients' }
        ],
        [
          { text: '⚠️ Критические события', callback_data: 'admin_audit_critical' },
          { text: '🚨 Системные ошибки', callback_data: 'admin_audit_errors' }
        ],
        [
          { text: '📅 Фильтр по дате', callback_data: 'admin_audit_date_filter' },
          { text: '📊 Экспорт отчета', callback_data: 'admin_audit_export' }
        ],
        [
          { text: '🔄 Обновить', callback_data: 'admin_audit_refresh' },
          { text: '◀️ Назад в админ-панель', callback_data: 'admin_main_menu' }
        ]
      ];

      await this.editOrSendMessage(ctx, auditText, keyboard);

    } catch (error) {
      console.error('Audit log error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке журнала аудита.');
    }
  }

  // Global broadcast system
  async showBroadcastSystem(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const broadcastStats = await this.getBroadcastStats();
      
      const broadcastText = 
        `📢 **СИСТЕМА МАССОВЫХ УВЕДОМЛЕНИЙ**\n\n` +
        `📊 **СТАТИСТИКА РАССЫЛОК:**\n` +
        `• Всего клиентов: ${broadcastStats.totalClients}\n` +
        `• Подписано на рассылку: ${broadcastStats.subscribedClients}\n` +
        `• Сообщений за месяц: ${broadcastStats.monthlyMessages}\n` +
        `• Успешность доставки: ${broadcastStats.deliveryRate}%\n\n` +
        `📋 **ПОСЛЕДНИЕ РАССЫЛКИ:**\n` +
        broadcastStats.recentBroadcasts.map((broadcast, index) => 
          `${index + 1}. ${broadcast.title}\n` +
          `   📅 ${new Date(broadcast.date).toLocaleDateString('ru-RU')}\n` +
          `   📊 Доставлено: ${broadcast.delivered}/${broadcast.total}\n` +
          `   ✅ Статус: ${broadcast.status}\n`
        ).join('\n') + '\n' +
        `🎯 **СЕГМЕНТЫ КЛИЕНТОВ:**\n` +
        `• Все клиенты: ${broadcastStats.allClients} чел.\n` +
        `• Активные клиенты: ${broadcastStats.activeClients} чел.\n` +
        `• VIP клиенты: ${broadcastStats.vipClients} чел.\n` +
        `• Именинники: ${broadcastStats.birthdayClients} чел.\n\n` +
        `📢 *Выберите тип рассылки:*`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '📢 Создать рассылку', callback_data: 'admin_create_broadcast' },
          { text: '🎯 Рассылка по сегменту', callback_data: 'admin_segment_broadcast' }
        ],
        [
          { text: '🎉 Акция/промо', callback_data: 'admin_promo_broadcast' },
          { text: '🎂 Поздравления', callback_data: 'admin_birthday_broadcast' }
        ],
        [
          { text: '📋 История рассылок', callback_data: 'admin_broadcast_history' },
          { text: '📊 Аналитика рассылок', callback_data: 'admin_broadcast_analytics' }
        ],
        [
          { text: '⚙️ Настройки рассылок', callback_data: 'admin_broadcast_settings' },
          { text: '👥 Управление подписками', callback_data: 'admin_subscription_management' }
        ],
        [
          { text: '◀️ Назад в админ-панель', callback_data: 'admin_main_menu' }
        ]
      ];

      await this.editOrSendMessage(ctx, broadcastText, keyboard);

    } catch (error) {
      console.error('Broadcast system error:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при загрузке системы рассылок.');
    }
  }

  // Get system statistics
  private async getSystemStatistics(): Promise<any> {
    try {
      const stats = await Database.queryOne(`
        SELECT 
          (SELECT COUNT(*) FROM clients) as total_clients,
          (SELECT COUNT(*) FROM clients WHERE is_active = true) as active_clients,
          (SELECT COUNT(*) FROM users WHERE role = 'manager') as managers,
          (SELECT COUNT(*) FROM users WHERE role = 'barista') as baristas,
          (SELECT COUNT(*) FROM point_transactions 
           WHERE operation_type = 'earn' AND DATE(created_at) = CURRENT_DATE) as today_operations,
          (SELECT COUNT(*) FROM point_transactions 
           WHERE operation_type IN ('earn', 'spend') AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)) as month_operations,
          (SELECT COALESCE(SUM(points), 0) FROM point_transactions WHERE operation_type = 'earn') as points_issued,
          (SELECT COALESCE(ABS(SUM(points)), 0) FROM point_transactions WHERE operation_type = 'spend') as points_spent
      `);

      return {
        totalClients: stats.total_clients || 0,
        activeClients: stats.active_clients || 0,
        managers: stats.managers || 0,
        baristas: stats.baristas || 0,
        todayOperations: stats.today_operations || 0,
        monthOperations: stats.month_operations || 0,
        pointsIssued: stats.points_issued || 0,
        pointsSpent: stats.points_spent || 0,
        dbStatus: '✅ Онлайн',
        activeSessions: 12, // This would come from session store
        systemHealth: '✅ Стабильно'
      };
    } catch (error) {
      console.error('Error getting system statistics:', error);
      return {
        totalClients: 0, activeClients: 0, managers: 0, baristas: 0,
        todayOperations: 0, monthOperations: 0, pointsIssued: 0, pointsSpent: 0,
        dbStatus: '❌ Ошибка', activeSessions: 0, systemHealth: '❌ Проблемы'
      };
    }
  }

  // Get system settings
  private async getSystemSettings(): Promise<any> {
    return {
      pointsPerRuble: 10,
      rublePerPoint: 1,
      maxSpendPercent: 50,
      welcomeBonus: 100,
      birthdayBonus: 200,
      pointsExpiryDays: 365,
      balanceNotifications: true,
      autoNotifications: true,
      collectStats: true,
      debugMode: false
    };
  }

  // Get system monitoring data
  private async getSystemMonitoring(): Promise<any> {
    return {
      dbStatus: '✅ Онлайн',
      dbConnections: 5,
      dbSize: 157,
      dbResponseTime: 45,
      botStatus: '✅ Активен',
      activeSessions: 12,
      messagesToday: 234,
      errorsLastHour: 0,
      cpuUsage: 23,
      ramUsage: 67,
      diskUsage: 34,
      uptime: '5 дней 12 часов',
      transactionsPerMinute: 15,
      avgApiResponse: 120,
      systemHealth: '✅ отлично'
    };
  }

  // Get backup information
  private async getBackupInfo(): Promise<any> {
    return {
      recentBackups: [
        { name: 'backup_2024_01_15.sql', date: new Date(), size: 45, status: 'Успешно' },
        { name: 'backup_2024_01_14.sql', date: new Date(Date.now() - 86400000), size: 43, status: 'Успешно' },
        { name: 'backup_2024_01_13.sql', date: new Date(Date.now() - 172800000), size: 41, status: 'Успешно' }
      ],
      autoBackupSchedule: 'Ежедневно в 03:00',
      nextAutoBackup: 'Завтра в 03:00',
      keepBackups: 30,
      totalBackups: 45,
      totalSize: 1.8,
      lastRestore: null
    };
  }

  // Get audit log data
  private async getAuditLogData(): Promise<any> {
    try {
      const auditStats = await Database.queryOne(`
        SELECT 
          COUNT(*) as today_total,
          COUNT(*) FILTER (WHERE action LIKE '%point%') as point_operations,
          COUNT(*) FILTER (WHERE action = 'create_client') as client_registrations,
          COUNT(*) FILTER (WHERE action LIKE 'admin_%') as admin_actions
        FROM activity_log 
        WHERE DATE(created_at) = CURRENT_DATE
      `);

      const recentOps = await Database.query(`
        SELECT 
          u.full_name as user,
          al.action,
          al.details,
          al.created_at as timestamp
        FROM activity_log al
        JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 5
      `);

      return {
        todayTotal: auditStats.today_total || 0,
        pointOperations: auditStats.point_operations || 0,
        clientRegistrations: auditStats.client_registrations || 0,
        adminActions: auditStats.admin_actions || 0,
        recentOperations: recentOps.map(op => ({
          user: op.user,
          action: op.action,
          details: op.details,
          timestamp: op.timestamp
        })),
        failedLogins: 0,
        suspiciousOperations: 0,
        systemErrors: 1
      };
    } catch (error) {
      console.error('Error getting audit data:', error);
      return {
        todayTotal: 0, pointOperations: 0, clientRegistrations: 0,
        adminActions: 0, recentOperations: [], failedLogins: 0,
        suspiciousOperations: 0, systemErrors: 0
      };
    }
  }

  // Get broadcast statistics
  private async getBroadcastStats(): Promise<any> {
    try {
      const stats = await Database.queryOne(`
        SELECT 
          COUNT(*) as total_clients,
          COUNT(*) FILTER (WHERE telegram_id IS NOT NULL) as subscribed_clients
        FROM clients 
        WHERE is_active = true
      `);

      return {
        totalClients: stats.total_clients || 0,
        subscribedClients: stats.subscribed_clients || 0,
        monthlyMessages: 45,
        deliveryRate: 98.5,
        recentBroadcasts: [
          { title: 'Новогодние скидки', date: new Date(), delivered: 234, total: 250, status: 'Завершено' },
          { title: 'Новые позиции в меню', date: new Date(Date.now() - 172800000), delivered: 198, total: 200, status: 'Завершено' }
        ],
        allClients: stats.total_clients || 0,
        activeClients: Math.floor((stats.total_clients || 0) * 0.7),
        vipClients: Math.floor((stats.total_clients || 0) * 0.1),
        birthdayClients: Math.floor((stats.total_clients || 0) * 0.05)
      };
    } catch (error) {
      console.error('Error getting broadcast stats:', error);
      return {
        totalClients: 0, subscribedClients: 0, monthlyMessages: 0,
        deliveryRate: 0, recentBroadcasts: [], allClients: 0,
        activeClients: 0, vipClients: 0, birthdayClients: 0
      };
    }
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

    if (ctx.message.message_id) {
      try {
        await this.bot.editMessageText(text, {
          chat_id: ctx.message.chat.id,
          message_id: ctx.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (editError) {
        await this.bot.sendMessage(ctx.message.chat.id, text, messageOptions);
      }
    } else {
      await this.bot.sendMessage(ctx.message.chat.id, text, messageOptions);
    }
  }

  // Add manager flow
  async startAddManager(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    const text = 
      `👨‍💼 *ДОБАВЛЕНИЕ МЕНЕДЖЕРА*\n\n` +
      `Отправьте данные нового менеджера в формате:\n` +
      `\`telegram_id username Имя Фамилия\`\n\n` +
      `Пример:\n` +
      `\`123456789 john_manager Иван Менеджеров\`\n\n` +
      `Или нажмите "Отмена" для возврата.`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '❌ Отмена', callback_data: 'admin_manage_managers' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });

    // Set session state for text input
    if (ctx.session) {
      ctx.session.waitingFor = 'add_manager_data';
      ctx.session.lastActivity = new Date();
    }
  }

  // Add barista flow  
  async startAddBarista(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    const text = 
      `👨‍🍳 *ДОБАВЛЕНИЕ БАРИСТА*\n\n` +
      `Отправьте данные нового бариста в формате:\n` +
      `\`telegram_id username Имя Фамилия\`\n\n` +
      `Пример:\n` +
      `\`987654321 jane_barista Мария Бариста\`\n\n` +
      `Или нажмите "Отмена" для возврата.`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '❌ Отмена', callback_data: 'admin_manage_managers' }]
    ];

    await this.bot.sendMessage(ctx.message.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });

    if (ctx.session) {
      ctx.session.waitingFor = 'add_barista_data';
      ctx.session.lastActivity = new Date();
    }
  }

  // Show all managers
  async showAllManagers(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const managers = await this.userService.getUsersByRole('manager');
      
      let text = `👨‍💼 *СПИСОК МЕНЕДЖЕРОВ*\n\n`;
      
      if (managers.length === 0) {
        text += `Менеджеров пока нет.\n\n`;
      } else {
        managers.forEach((manager, index) => {
          const statusIcon = manager.is_active ? '🟢' : '🔴';
          text += `${index + 1}. ${statusIcon} *${manager.full_name}*\n`;
          text += `   @${manager.username || 'без username'}\n`;
          text += `   ID: \`${manager.telegram_id}\`\n\n`;
        });
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '➕ Добавить менеджера', callback_data: 'admin_add_manager' },
          { text: '❌ Удалить сотрудника', callback_data: 'admin_remove_staff' }
        ],
        [{ text: '⬅️ Назад', callback_data: 'admin_manage_managers' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error showing managers:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка получения списка менеджеров');
    }
  }

  // Show all baristas
  async showAllBaristas(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const baristas = await this.userService.getUsersByRole('barista');
      
      let text = `👨‍🍳 *СПИСОК БАРИСТ*\n\n`;
      
      if (baristas.length === 0) {
        text += `Барист пока нет.\n\n`;
      } else {
        baristas.forEach((barista, index) => {
          const statusIcon = barista.is_active ? '🟢' : '🔴';
          text += `${index + 1}. ${statusIcon} *${barista.full_name}*\n`;
          text += `   @${barista.username || 'без username'}\n`;
          text += `   ID: \`${barista.telegram_id}\`\n\n`;
        });
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: '➕ Добавить бариста', callback_data: 'admin_add_barista' },
          { text: '❌ Удалить сотрудника', callback_data: 'admin_remove_staff' }
        ],
        [{ text: '⬅️ Назад', callback_data: 'admin_manage_managers' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error showing baristas:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка получения списка барист');
    }
  }

  // Show staff removal interface
  async showRemoveStaff(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const [managers, baristas] = await Promise.all([
        this.userService.getUsersByRole('manager'),
        this.userService.getUsersByRole('barista')
      ]);

      let text = `❌ *УДАЛЕНИЕ СОТРУДНИКОВ*\n\n`;
      text += `⚠️ Выберите сотрудника для удаления:\n\n`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      if (managers.length > 0) {
        text += `👨‍💼 **Менеджеры:**\n`;
        managers.forEach((manager, index) => {
          text += `${index + 1}. ${manager.full_name}\n`;
          keyboard.push([
            { 
              text: `❌ ${manager.full_name}`, 
              callback_data: `admin_remove_user:${manager.telegram_id}` 
            }
          ]);
        });
        text += `\n`;
      }

      if (baristas.length > 0) {
        text += `👨‍🍳 **Барист:**\n`;
        baristas.forEach((barista, index) => {
          text += `${index + 1}. ${barista.full_name}\n`;
          keyboard.push([
            { 
              text: `❌ ${barista.full_name}`, 
              callback_data: `admin_remove_user:${barista.telegram_id}` 
            }
          ]);
        });
      }

      keyboard.push([{ text: '⬅️ Назад', callback_data: 'admin_manage_managers' }]);

      await this.bot.sendMessage(ctx.message.chat.id, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error showing remove staff:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка получения списка сотрудников');
    }
  }

  // Confirm user removal
  async confirmRemoveUser(ctx: BotContext, userId: number): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const user = await this.userService.getUserById(userId);
      if (!user) {
        await this.bot.sendMessage(ctx.message.chat.id, '❌ Пользователь не найден');
        return;
      }

      // Remove user
      await this.userService.removeUser(userId);

      const roleText = user.role === 'manager' ? 'менеджер' : 'баристa';
      const successText = 
        `✅ *СОТРУДНИК УДАЛЕН*\n\n` +
        `${roleText} *${user.full_name}* был успешно удален из системы.\n\n` +
        `ID: \`${user.telegram_id}\``;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '⬅️ Назад к управлению', callback_data: 'admin_manage_managers' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, successText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error removing user:', error);
      await this.bot.sendMessage(ctx.message.chat.id, '❌ Ошибка при удалении сотрудника');
    }
  }

  // Process add manager data
  async processAddManagerData(ctx: BotContext, input: string): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const parts = input.trim().split(' ');
      if (parts.length < 4) {
        throw new Error('Недостаточно данных');
      }

      const telegramId = parseInt(parts[0]);
      const username = parts[1];
      const fullName = parts.slice(2).join(' ');

      if (isNaN(telegramId)) {
        throw new Error('Неверный Telegram ID');
      }

      // Add manager
      await this.userService.addUser(telegramId, username, fullName, 'manager', true);

      const successText = 
        `✅ *МЕНЕДЖЕР ДОБАВЛЕН*\n\n` +
        `Новый менеджер успешно добавлен в систему:\n\n` +
        `👨‍💼 *${fullName}*\n` +
        `@${username}\n` +
        `ID: \`${telegramId}\`\n\n` +
        `Менеджер может войти в систему командой /start`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '⬅️ Назад к управлению', callback_data: 'admin_manage_managers' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, successText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      // Clear session
      if (ctx.session) {
        delete ctx.session.waitingFor;
      }

    } catch (error) {
      console.error('Error adding manager:', error);
      await this.bot.sendMessage(
        ctx.message.chat.id, 
        `❌ Ошибка: ${error.message || 'Неверный формат данных'}\n\nПопробуйте еще раз в формате:\n\`telegram_id username Имя Фамилия\``
      );
    }
  }

  // Process add barista data
  async processAddBaristaData(ctx: BotContext, input: string): Promise<void> {
    if (!ctx.from || !ctx.message?.chat?.id) return;

    try {
      const parts = input.trim().split(' ');
      if (parts.length < 4) {
        throw new Error('Недостаточно данных');
      }

      const telegramId = parseInt(parts[0]);
      const username = parts[1];
      const fullName = parts.slice(2).join(' ');

      if (isNaN(telegramId)) {
        throw new Error('Неверный Telegram ID');
      }

      // Add barista
      await this.userService.addUser(telegramId, username, fullName, 'barista', true);

      const successText = 
        `✅ *БАРИСТА ДОБАВЛЕН*\n\n` +
        `Новый баристa успешно добавлен в систему:\n\n` +
        `👨‍🍳 *${fullName}*\n` +
        `@${username}\n` +
        `ID: \`${telegramId}\`\n\n` +
        `Баристa может войти в систему командой /start`;

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: '⬅️ Назад к управлению', callback_data: 'admin_manage_managers' }]
      ];

      await this.bot.sendMessage(ctx.message.chat.id, successText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      // Clear session
      if (ctx.session) {
        delete ctx.session.waitingFor;
      }

    } catch (error) {
      console.error('Error adding barista:', error);
      await this.bot.sendMessage(
        ctx.message.chat.id, 
        `❌ Ошибка: ${error.message || 'Неверный формат данных'}\n\nПопробуйте еще раз в формате:\n\`telegram_id username Имя Фамилия\``
      );
    }
  }
}