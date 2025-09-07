# ☕ Rock Coffee Loyalty Bot

Telegram бот системы лояльности для кофейни Rock Coffee в Калининграде.

## 🚀 Быстрый запуск

### Docker (рекомендуется)
```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd rock-coffee-bot

# 2. Настройте переменные окружения
cp .env.example .env
# Отредактируйте .env - укажите пароль БД

# 3. Запустите все сервисы
docker-compose up -d

# 4. Проверьте статус
docker-compose ps
```

### Ручная установка
```bash
# 1. Установите Node.js 18+ и PostgreSQL
# 2. Создайте базу данных
createdb -U postgres rock_coffee_bot

# 3. Установите зависимости
npm install

# 4. Примените миграции
npm run migrate

# 5. Запустите бота
npm run dev
```

## ⚙️ Настройка

### Переменные окружения (.env):
```env
BOT_TOKEN=your_telegram_bot_token
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rock_coffee_bot
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
PORT=3000
NODE_ENV=production
```

### Создание администратора:
```sql
-- Подключитесь к БД и выполните:
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (YOUR_TELEGRAM_ID, 'username', 'Your Name', 'admin', true);
```

## 🏗️ Архитектура

- **Node.js + TypeScript** - основа приложения
- **PostgreSQL** - база данных с VIEW-based безопасностью
- **Telegram Bot API** - интерфейс пользователя
- **Docker** - контейнеризация для простого деплоя
- **Nginx** - reverse proxy (опционально)

## 👥 Роли пользователей

### 🔹 Клиент
- Регистрация в программе лояльности
- Просмотр баланса баллов и карты
- Редактирование профиля

### ☕ Бариста
- Поиск клиентов (ограниченные данные)
- Начисление/списание баллов
- Добавление заметок о клиентах

### 👔 Менеджер  
- Полный доступ к данным клиентов
- Управление персоналом
- Аналитика и отчеты
- Массовые уведомления

### 👑 Администратор
- Системные настройки
- Мониторинг и логи
- Управление всеми пользователями
- Резервное копирование

## 🔒 Безопасность

- **Ролевая модель доступа** - строгое разделение прав
- **VIEW-based security** - ограничения на уровне БД
- **Аудит операций** - логирование всех действий
- **Защита персональных данных** - бариста не видят телефоны/даты рождения

## 📊 Система лояльности

- Начисление баллов за каждый напиток в чеке
- 10 баллов = 1 бесплатный напиток
- Бонусы в день рождения
- Накопление без срока истечения

## 🗄️ База данных

Основные таблицы:
- `users` - сотрудники (персонал)
- `clients` - клиенты программы лояльности
- `point_transactions` - операции с баллами
- `activity_log` - журнал аудита

## 📱 Команды управления

```bash
# Просмотр логов
docker-compose logs -f bot

# Перезапуск сервисов
docker-compose restart

# Остановка
docker-compose down

# Обновление после изменений
docker-compose down && docker-compose up -d --build
```

## 📍 Кофейня

**Rock Coffee**  
📍 ул. Красная 4, г. Калининград  
🕘 Пн-Вс: 9:00 - 21:00

**Социальные сети:**
- Telegram: https://t.me/rock_coffee_kld  
- Instagram: https://www.instagram.com/rockcoffee.kld

## 🛠️ Разработка

```bash
# Разработка с hot-reload
npm run dev

# Сборка проекта  
npm run build

# Проверка типов
npm run typecheck

# Линтинг
npm run lint
```

## 📞 Поддержка

При возникновении вопросов или проблем:
1. Проверьте логи: `docker-compose logs -f`
2. Убедитесь что все сервисы запущены: `docker-compose ps`
3. Проверьте настройки в `.env` файле

---

**Made with ☕ and ❤️ for Rock Coffee Kaliningrad**