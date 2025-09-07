# 🔧 Команды для Rock Coffee Bot

## 📦 Установка и настройка

```bash
# Установка зависимостей
npm install

# Автоматическая настройка (Windows)
scripts\setup.bat

# Автоматическая настройка (Linux/Mac)  
chmod +x scripts/setup.sh
./scripts/setup.sh

# Ручная миграция БД
npm run migrate

# Сборка TypeScript
npm run build
```

## 🚀 Запуск

```bash
# Режим разработки (с автоперезагрузкой)
npm run dev

# Продакшен режим
npm start

# Проверка типов
npm run typecheck
```

## 🐳 Docker

```bash
# Запуск всей системы
docker-compose up -d

# Только база данных
docker-compose up -d postgres

# Просмотр логов
docker-compose logs -f bot

# Остановка
docker-compose down

# Пересборка и запуск
docker-compose up -d --build
```

## 🗄️ Работа с базой данных

```bash
# Подключение к локальной БД
psql -U postgres -d rock_coffee_bot

# Подключение к БД в Docker
docker-compose exec postgres psql -U postgres -d rock_coffee_bot

# Создание базы данных
createdb -U postgres rock_coffee_bot

# Бэкап базы данных
pg_dump -U postgres rock_coffee_bot > backup.sql

# Восстановление из бэкапа
psql -U postgres -d rock_coffee_bot < backup.sql
```

## 👤 Управление пользователями

### Добавить администратора:
```sql
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (YOUR_TELEGRAM_ID, 'username', 'Full Name', 'admin', true);
```

### Добавить менеджера:
```sql  
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (MANAGER_TELEGRAM_ID, 'manager_username', 'Manager Name', 'manager', true);
```

### Добавить бариста:
```sql
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (BARISTA_TELEGRAM_ID, 'barista_username', 'Barista Name', 'barista', true);
```

### Просмотр всех сотрудников:
```sql
SELECT telegram_id, username, full_name, role, is_active, created_at 
FROM users 
WHERE role IN ('admin', 'manager', 'barista')
ORDER BY role, created_at;
```

## 🔍 Диагностика и мониторинг

```bash
# Проверка здоровья системы
curl http://localhost:3000/health

# Просмотр логов (в режиме dev)
npm run dev

# Просмотр логов Docker
docker-compose logs -f bot

# Проверка подключения к БД
psql -U postgres -d rock_coffee_bot -c "SELECT COUNT(*) FROM users;"
```

## 📊 SQL запросы для мониторинга

### Статистика клиентов:
```sql
SELECT 
    COUNT(*) as total_clients,
    COUNT(*) FILTER (WHERE is_active = true) as active_clients,
    SUM(balance) as total_balance,
    AVG(total_spent) as avg_spent
FROM clients;
```

### Статистика транзакций:
```sql
SELECT 
    operation_type,
    COUNT(*) as count,
    SUM(points) as total_points,
    SUM(amount) as total_amount
FROM point_transactions 
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY operation_type;
```

### Активность за последние дни:
```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as transactions,
    SUM(CASE WHEN operation_type = 'earn' THEN amount ELSE 0 END) as revenue
FROM point_transactions 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## 🛠️ Полезные скрипты

### Очистка тестовых данных:
```sql
-- ВНИМАНИЕ: Удаляет все данные!
TRUNCATE TABLE point_transactions, clients, activity_log RESTART IDENTITY CASCADE;
```

### Сброс баланса клиента:
```sql
UPDATE clients SET balance = 0 WHERE id = CLIENT_ID;
```

### Массовое начисление баллов (например, акция):
```sql
UPDATE clients 
SET balance = balance + 100 
WHERE is_active = true AND last_visit >= CURRENT_DATE - INTERVAL '30 days';
```

## 🔒 Безопасность

### Изменение пароля БД:
1. Остановите бота
2. Измените пароль в PostgreSQL
3. Обновите .env файл  
4. Перезапустите бота

### Ротация токена бота:
1. Создайте новый токен через @BotFather
2. Обновите BOT_TOKEN в .env
3. Перезапустите бота

## 🆘 Устранение неполадок

### Бот не отвечает:
```bash
# Проверьте статус процесса
ps aux | grep node

# Проверьте логи
npm run dev

# Перезапустите
pkill -f "node.*index.js"
npm run dev
```

### База данных недоступна:
```bash
# Проверьте статус PostgreSQL
# Windows: services.msc
# Linux: systemctl status postgresql
# Mac: brew services list

# Перезапустите PostgreSQL при необходимости
```

### Переполнение логов:
```bash
# Очистка логов
> logs/app.log
> logs/error.log

# Или в Docker
docker-compose exec bot sh -c "> /app/logs/app.log"
```

---

**💡 Совет:** Сохраните этот файл в закладки для быстрого доступа к командам!