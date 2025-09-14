#!/usr/bin/env python3

"""
Telegram Bot для системы лояльности
Основной файл запуска бота

Автор: Claude Code Assistant
Версия: 1.0.0
"""

import logging
import sys
import os
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters
)
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Добавляем путь к модулям
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.config import config, setup_logging
from src.handlers.client_handlers import ClientHandlers, REGISTER_NAME, REGISTER_PHONE, REGISTER_BIRTH_DATE, REGISTER_CONFIRM
from src.handlers.client_handlers import SELF_REGISTER_NAME, SELF_REGISTER_PHONE, SELF_REGISTER_BIRTH_DATE, SELF_REGISTER_CONFIRM
from src.handlers.bonus_handlers import BonusHandlers, ADD_POINTS_CLIENT, ADD_POINTS_AMOUNT, ADD_POINTS_CONFIRM
from src.handlers.bonus_handlers import SPEND_POINTS_CLIENT, SPEND_POINTS_AMOUNT, SPEND_POINTS_CONFIRM
from src.handlers.bonus_handlers import PURCHASE_CLIENT, PURCHASE_AMOUNT, PURCHASE_POINTS, PURCHASE_CONFIRM
from src.handlers.stats_handlers import StatsHandlers
from src.handlers.admin_handlers import AdminHandlers, ADD_STAFF_NAME, ADD_STAFF_PHONE, ADD_STAFF_ROLE, ADD_STAFF_CONFIRM
from src.utils.scheduler import birthday_scheduler, notification_scheduler

# Настройка логирования
logger = setup_logging()

class LoyaltyBot:
    """Основной класс бота системы лояльности"""
    
    def __init__(self):
        self.application = None
        self._setup_bot()
    
    def _setup_bot(self):
        """Настройка бота и обработчиков"""
        logger.debug("Starting bot setup...")
        logger.debug(f"Telegram token: {config.telegram_token[:20]}...")
        
        # Создаем приложение
        logger.debug("Creating Telegram application...")
        self.application = Application.builder().token(config.telegram_token).build()
        logger.debug("Telegram application created successfully")
        
        # Добавляем обработчики команд
        logger.debug("Adding command handlers...")
        self._add_command_handlers()
        
        # Добавляем conversation handlers
        logger.debug("Adding conversation handlers...")
        self._add_conversation_handlers()
        
        # Добавляем callback handlers  
        logger.debug("Adding callback handlers...")
        self._add_callback_handlers()
        
        # Добавляем обработчик ошибок
        logger.debug("Adding error handler...")
        self.application.add_error_handler(self._error_handler)
        
        logger.info("Bot setup completed successfully")
        logger.debug(f"Total handlers registered: {len(self.application.handlers)}")
    
    def _add_command_handlers(self):
        """Добавление обработчиков команд"""
        commands = [
            ("start", ClientHandlers.start_command, "Client start command"),
            ("balance", ClientHandlers.balance_command, "Balance check command"),
            ("search", ClientHandlers.search_client_command, "Client search command"),
            ("delete_client", ClientHandlers.delete_client_command, "Delete client command"),
            ("test_db", ClientHandlers.test_db_connection, "Test database connection"),
            ("stats", StatsHandlers.stats_menu, "Statistics menu command"),
            ("admin", AdminHandlers.admin_menu, "Admin panel command"),
            ("export", StatsHandlers.export_data_command, "Data export command"),
            ("staff", AdminHandlers.staff_management_menu, "Staff management command"),
        ]
        
        for command, handler, description in commands:
            logger.debug(f"Registering command handler: /{command} -> {description}")
            self.application.add_handler(CommandHandler(command, handler))
        
        logger.info(f"Command handlers registered: {len(commands)} commands")
        logger.debug("Available commands: " + ", ".join([f"/{cmd}" for cmd, _, _ in commands]))
    
    def _add_conversation_handlers(self):
        """Добавление conversation handlers"""
        
        # Регистрация клиента
        registration_conv = ConversationHandler(
            entry_points=[
                CallbackQueryHandler(
                    lambda u, c: ClientHandlers.start_registration(u, c),
                    pattern="^register_client$"
                )
            ],
            states={
                REGISTER_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, ClientHandlers.register_name)],
                REGISTER_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, ClientHandlers.register_phone)],
                REGISTER_BIRTH_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, ClientHandlers.register_birth_date)],
                REGISTER_CONFIRM: [CallbackQueryHandler(ClientHandlers.confirm_registration)]
            },
            fallbacks=[CommandHandler("cancel", ClientHandlers.cancel_registration)]
        )
        
        # Начисление баллов
        add_points_conv = ConversationHandler(
            entry_points=[
                CommandHandler("add_points", BonusHandlers.start_add_points),
                CallbackQueryHandler(BonusHandlers.callback_handler, pattern="^add_points_")
            ],
            states={
                ADD_POINTS_CLIENT: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.add_points_client)],
                ADD_POINTS_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.add_points_amount)],
                ADD_POINTS_CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.add_points_confirm)]
            },
            fallbacks=[CommandHandler("cancel", BonusHandlers.cancel_operation)]
        )
        
        # Списание баллов
        spend_points_conv = ConversationHandler(
            entry_points=[
                CommandHandler("spend_points", BonusHandlers.start_spend_points),
                CallbackQueryHandler(BonusHandlers.callback_handler, pattern="^spend_points_")
            ],
            states={
                SPEND_POINTS_CLIENT: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.spend_points_client)],
                SPEND_POINTS_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.spend_points_amount)],
                SPEND_POINTS_CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.spend_points_confirm)]
            },
            fallbacks=[CommandHandler("cancel", BonusHandlers.cancel_operation)]
        )
        
        # Оформление покупки
        purchase_conv = ConversationHandler(
            entry_points=[CommandHandler("purchase", BonusHandlers.start_purchase)],
            states={
                PURCHASE_CLIENT: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.purchase_client)],
                PURCHASE_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.purchase_amount)],
                PURCHASE_POINTS: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.purchase_points)],
                PURCHASE_CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, BonusHandlers.purchase_confirm)]
            },
            fallbacks=[CommandHandler("cancel", BonusHandlers.cancel_operation)]
        )
        
        # Добавление сотрудника
        add_staff_conv = ConversationHandler(
            entry_points=[
                CallbackQueryHandler(
                    lambda u, c: AdminHandlers._start_add_staff(u.callback_query, c),
                    pattern="^add_staff$"
                )
            ],
            states={
                ADD_STAFF_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, AdminHandlers.add_staff_name)],
                ADD_STAFF_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, AdminHandlers.add_staff_phone)],
                ADD_STAFF_ROLE: [CallbackQueryHandler(AdminHandlers.add_staff_role, pattern="^role_")],
                ADD_STAFF_CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, AdminHandlers.add_staff_confirm)]
            },
            fallbacks=[CommandHandler("cancel", AdminHandlers.cancel_add_staff)]
        )
        
        # Самостоятельная регистрация клиентов
        self_registration_conv = ConversationHandler(
            entry_points=[
                CallbackQueryHandler(ClientHandlers.start_self_registration, pattern="^register_self$")
            ],
            states={
                SELF_REGISTER_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, ClientHandlers.self_register_name)],
                SELF_REGISTER_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, ClientHandlers.self_register_phone)],
                SELF_REGISTER_BIRTH_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, ClientHandlers.self_register_birth_date)],
                SELF_REGISTER_CONFIRM: [
                    CallbackQueryHandler(ClientHandlers.confirm_self_registration, pattern="^confirm_self_registration$"),
                    CallbackQueryHandler(ClientHandlers.cancel_self_registration, pattern="^cancel_self_registration$")
                ]
            },
            fallbacks=[CommandHandler("cancel", ClientHandlers.cancel_self_registration)]
        )
        
        # Добавляем все conversation handlers
        self.application.add_handler(registration_conv)
        self.application.add_handler(self_registration_conv)
        self.application.add_handler(add_points_conv)
        self.application.add_handler(spend_points_conv)
        self.application.add_handler(purchase_conv)
        self.application.add_handler(add_staff_conv)
        
        
        logger.info("Conversation handlers добавлены")
    
    def _add_callback_handlers(self):
        """Добавление callback handlers"""
        
        # Основные callback handlers
        self.application.add_handler(
            CallbackQueryHandler(StatsHandlers.stats_callback_handler, pattern="^stats_")
        )
        
        self.application.add_handler(
            CallbackQueryHandler(AdminHandlers.admin_callback_handler, pattern="^(staff_management|admin_stats|promotions|system_settings|force_birthday_check|backup_data|list_staff)$")
        )
        
        self.application.add_handler(
            CallbackQueryHandler(StatsHandlers.send_birthday_bonuses, pattern="^send_birthday_bonuses$")
        )
        
        
        # Callback handlers для удаления клиентов
        self.application.add_handler(
            CallbackQueryHandler(ClientHandlers.confirm_delete_client, pattern="^confirm_delete_")
        )
        
        self.application.add_handler(
            CallbackQueryHandler(ClientHandlers.cancel_delete_client, pattern="^cancel_delete$")
        )
        
        
        # Общий callback handler для остальных случаев
        self.application.add_handler(CallbackQueryHandler(self._general_callback_handler))
        
        logger.info("Callback handlers добавлены")
    
    async def _general_callback_handler(self, update, context):
        """Общий обработчик callback запросов"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        
        # Обработка основного меню
        if data == "search_client":
            await query.edit_message_text(
                "🔍 Поиск клиента\n\n"
                "Используйте команду: /search <телефон/ID/имя>"
            )
        elif data == "register_client":
            # Этот случай обрабатывается в conversation handler
            pass
        elif data == "about_loyalty":
            await ClientHandlers.about_loyalty_program(update, context)
        elif data == "back_to_start":
            # Возвращаем пользователя в начальное меню
            await ClientHandlers.start_command(update, context)
        elif data == "manage_clients":
            await ClientHandlers.manage_clients_menu(update, context)
        elif data == "list_all_clients":
            await ClientHandlers.list_all_clients(update, context)
        elif data.startswith("manage_client_"):
            client_id = data.split("_", 2)[-1]
            await ClientHandlers.manage_single_client(update, context, client_id)
        elif data == "bonus_operations":
            keyboard = [
                [InlineKeyboardButton("➕ Начислить баллы", callback_data="start_add_points")],
                [InlineKeyboardButton("➖ Списать баллы", callback_data="start_spend_points")],
                [InlineKeyboardButton("🛍️ Оформить покупку", callback_data="start_purchase")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                "💰 Операции с бонусными баллами\n\n"
                "Выберите тип операции:",
                reply_markup=reply_markup
            )
        elif data == "statistics":
            await query.edit_message_text(
                "📊 Статистика\n\n"
                "Используйте команду: /stats"
            )
        elif data in ["start_add_points", "start_spend_points", "start_purchase"]:
            command_map = {
                "start_add_points": "/add_points",
                "start_spend_points": "/spend_points", 
                "start_purchase": "/purchase"
            }
            await query.edit_message_text(
                f"Используйте команду: {command_map[data]}"
            )
    
    async def _error_handler(self, update, context):
        """Расширенный обработчик ошибок"""
        error_info = {
            'error': str(context.error),
            'error_type': type(context.error).__name__,
            'update_id': update.update_id if update else None,
            'user_id': update.effective_user.id if update and update.effective_user else None,
            'chat_id': update.effective_chat.id if update and update.effective_chat else None,
            'message_text': update.effective_message.text if update and update.effective_message else None
        }
        
        logger.error("=" * 80)
        logger.error("TELEGRAM BOT ERROR OCCURRED")
        logger.error(f"Error type: {error_info['error_type']}")
        logger.error(f"Error message: {error_info['error']}")
        logger.error(f"Update ID: {error_info['update_id']}")
        logger.error(f"User ID: {error_info['user_id']}")
        logger.error(f"Chat ID: {error_info['chat_id']}")
        logger.error(f"Message text: {error_info['message_text']}")
        
        # Логируем трассировку стека
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        logger.error("=" * 80)
        
        # Пытаемся отправить сообщение пользователю
        if update and update.effective_message:
            try:
                logger.debug("Attempting to send error message to user...")
                await update.effective_message.reply_text(
                    "❌ Произошла ошибка. Пожалуйста, попробуйте позже."
                )
                logger.debug("Error message sent to user successfully")
            except Exception as e:
                logger.error(f"Failed to send error message to user: {e}")
    
    def _setup_notification_callback(self):
        """Настройка callback для отправки уведомлений"""
        async def send_notification(message: str):
            """Отправка уведомления администратору"""
            try:
                await self.application.bot.send_message(
                    chat_id=config.admin_id,
                    text=message
                )
            except Exception as e:
                logger.error(f"Ошибка отправки уведомления: {e}")
        
        notification_scheduler.add_notification_callback(send_notification)
    
    async def _initialize_bot(self):
        """Асинхронная инициализация бота"""
        logger.debug("Initializing bot...")
        try:
            await self.application.initialize()
            await self.application.bot.initialize()
            logger.debug("✅ Bot initialized successfully")
            
            # Получаем информацию о боте
            bot_info = await self.application.bot.get_me()
            logger.info(f"🤖 Bot info: @{bot_info.username} ({bot_info.first_name})")
            logger.info(f"   • Bot ID: {bot_info.id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize bot: {e}")
            raise

    def run(self):
        """Запуск бота с детальным логированием"""
        try:
            logger.info("=" * 80)
            logger.info("STARTING TELEGRAM LOYALTY BOT")
            logger.info("=" * 80)
            
            # Проверяем конфигурацию
            logger.debug("Checking bot configuration...")
            
            if not config.telegram_token:
                logger.error("❌ Telegram bot token not found in environment variables")
                logger.error("Please set TELEGRAM_BOT_TOKEN in .env file")
                return
            logger.debug(f"✅ Telegram token found: {config.telegram_token[:20]}...")
            
            if not config.admin_id:
                logger.error("❌ Admin Telegram ID not found in environment variables")
                logger.error("Please set TELEGRAM_ADMIN_ID in .env file")
                return
            logger.debug(f"✅ Admin ID found: {config.admin_id}")
            
            # Инициализируем бота асинхронно
            logger.debug("Initializing bot asynchronously...")
            import asyncio
            asyncio.get_event_loop().run_until_complete(self._initialize_bot())
            
            # Настраиваем уведомления
            logger.debug("Setting up notification callbacks...")
            self._setup_notification_callback()
            logger.debug("✅ Notification callbacks configured")
            
            # Запускаем планировщики
            logger.debug("Starting schedulers...")
            birthday_scheduler.start()
            notification_scheduler.start()
            logger.debug("✅ Schedulers started successfully")
            
            # Выводим конфигурацию
            logger.info("🤖 BOT CONFIGURATION:")
            logger.info(f"   • Timezone: {config.timezone}")
            logger.info(f"   • Birthday bonus: {config.birthday_bonus} points")
            logger.info(f"   • Registration bonus: {config.registration_bonus} points")
            logger.info(f"   • Log level: {config.log_level}")
            logger.info(f"   • Admin ID: {config.admin_id}")
            
            logger.info("🚀 STARTING BOT POLLING...")
            logger.debug("Poll configuration: message and callback_query updates only")
            logger.debug("Drop pending updates: True")
            
            # Запускаем бота
            self.application.run_polling(
                allowed_updates=["message", "callback_query"],
                drop_pending_updates=True
            )
            
        except KeyboardInterrupt:
            logger.info("\n🛑 Keyboard interrupt received - shutting down gracefully...")
        except Exception as e:
            logger.error("💥 CRITICAL ERROR during bot startup:")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error message: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
        finally:
            logger.info("🔄 Starting shutdown procedure...")
            self._shutdown()
    
    def _shutdown(self):
        """Корректное завершение работы бота"""
        logger.info("Останавливаем планировщики...")
        
        try:
            birthday_scheduler.stop()
            notification_scheduler.stop()
        except Exception as e:
            logger.error(f"Ошибка при остановке планировщиков: {e}")
        
        logger.info("Бот остановлен")

def main():
    """Главная функция"""
    print("=" * 60)
    print("          TELEGRAM LOYALTY BOT")
    print("            Sistema loyalnosti")
    print("=" * 60)
    print()
    print("Functions:")
    print("- Client registration and management")
    print("- Bonus points system")
    print("- Role system (barista/admin/manager)")
    print("- Database integration")
    print("- Automatic birthday bonuses")
    print("- Statistics and reports")
    print()
    print("Version: 1.0.0")
    print("=" * 60)
    
    # Проверяем наличие файла конфигурации
    if not os.path.exists('.env'):
        print("ERROR: .env file not found!")
        print("Create .env file based on .env.example")
        print("Configure all necessary parameters")
        return
    
    # Создаем и запускаем бота
    bot = LoyaltyBot()
    bot.run()

if __name__ == "__main__":
    main()