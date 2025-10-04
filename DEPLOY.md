# 🚀 Деплой обновлений на сервер (Docker)

## 📦 Что обновили

1. ✅ SMS → Telegram уведомления (без SMS провайдера)
2. ✅ Sessions → PostgreSQL (вместо памяти)
3. ✅ Новые миграции: `005_telegram_messages_log.sql`, `006_sessions_table.sql`

---

## 🔧 Шаг 1: Подготовка на локальной машине

### 1.1 Сохранить изменения в Git

```bash
# Проверить что изменилось
git status

# Добавить все изменения
git add .

# Закоммитить
git commit -m "feat: replace SMS with Telegram messages, migrate sessions to PostgreSQL"

# Запушить на сервер (если используешь Git)
git push origin main
```

---

## 🖥️ Шаг 2: Обновление на сервере

### 2.1 Подключиться к серверу

```bash
ssh your_user@your_server_ip
cd /path/to/rc_bot  # Путь к проекту на сервере
```

### 2.2 Скачать обновления

```bash
# Если используешь Git
git pull origin main

# Или скопировать файлы вручную через scp:
# На локальной машине:
scp -r src migrations package.json your_user@server:/path/to/rc_bot/
```

---

## 🗄️ Шаг 3: Применить миграции БД

### Вариант А: Через Docker Exec (рекомендуется)

```bash
# 1. Скопировать миграции в контейнер БД
docker cp migrations/005_telegram_messages_log.sql rock_coffee_db:/tmp/
docker cp migrations/006_sessions_table.sql rock_coffee_db:/tmp/

# 2. Применить миграции
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/005_telegram_messages_log.sql
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/006_sessions_table.sql

# 3. Проверить что таблицы созданы
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "\dt"
```

### Вариант Б: Через pgAdmin/psql извне

```bash
# Если БД доступна снаружи на порту 5432
psql -h localhost -U postgres -d rock_coffee_bot -f migrations/005_telegram_messages_log.sql
psql -h localhost -U postgres -d rock_coffee_bot -f migrations/006_sessions_table.sql
```

---

## 🔄 Шаг 4: Пересобрать и перезапустить бот

### 4.1 Остановить текущий бот

```bash
docker-compose stop bot
```

### 4.2 Пересобрать образ с новым кодом

```bash
docker-compose build bot
```

### 4.3 Запустить обновленный бот

```bash
docker-compose up -d bot
```

### 4.4 Проверить логи

```bash
# Смотреть логи в реальном времени
docker-compose logs -f bot

# Проверить что нет ошибок
docker-compose logs bot | grep -i error
```

---

## ✅ Шаг 5: Проверка работоспособности

### 5.1 Проверить health endpoint

```bash
curl http://localhost:3000/health
# Должен вернуть: {"status":"ok","timestamp":"..."}
```

### 5.2 Проверить таблицы в БД

```bash
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

Должны быть таблицы:
- ✅ `telegram_messages_log` (новая)
- ✅ `sessions` (новая)
- ✅ `clients`
- ✅ `users`
- ... остальные

### 5.3 Тестировать в боте

1. Открыть бота в Telegram
2. Отправить `/start`
3. Попробовать функции:
   - ✅ Поиск клиента
   - ✅ Начисление баллов
   - ✅ Отправка сообщения клиенту (вместо SMS)

---

## 🚨 Откат в случае проблем

### Если что-то пошло не так:

```bash
# 1. Остановить бот
docker-compose stop bot

# 2. Откатить Git на предыдущий коммит
git log --oneline  # Найти предыдущий коммит
git checkout <commit_hash>

# 3. Пересобрать старую версию
docker-compose build bot
docker-compose up -d bot

# 4. Удалить новые таблицы (опционально)
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
DROP TABLE IF EXISTS telegram_messages_log;
DROP TABLE IF EXISTS sessions;
"
```

---

## 📝 Полезные команды Docker

```bash
# Смотреть все контейнеры
docker-compose ps

# Перезапустить все сервисы
docker-compose restart

# Остановить все
docker-compose down

# Запустить все
docker-compose up -d

# Зайти в контейнер бота
docker exec -it rock_coffee_bot sh

# Зайти в PostgreSQL
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot

# Посмотреть логи всех сервисов
docker-compose logs -f

# Очистить все и начать заново (ОСТОРОЖНО - удалит данные!)
docker-compose down -v
docker-compose up -d
```

---

## 🎯 Zero-downtime деплой (опционально)

Если нужен деплой без остановки бота:

```bash
# 1. Применить миграции (пока бот работает)
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/005_telegram_messages_log.sql
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/006_sessions_table.sql

# 2. Быстро пересобрать и перезапустить
docker-compose build bot && docker-compose up -d bot

# Перерыв будет ~10-30 секунд
```

---

## 📊 Мониторинг после деплоя

### Проверить использование ресурсов:

```bash
# CPU, память контейнеров
docker stats

# Размер БД
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT pg_size_pretty(pg_database_size('rock_coffee_bot')) as size;
"

# Количество активных сессий
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT COUNT(*) FROM sessions WHERE expires_at > NOW();
"
```

---

## ✅ Чеклист деплоя

- [ ] Закоммитить изменения в Git
- [ ] Подключиться к серверу
- [ ] Скачать обновления (`git pull`)
- [ ] Применить миграцию 005 (telegram_messages_log)
- [ ] Применить миграцию 006 (sessions)
- [ ] Проверить таблицы в БД
- [ ] Остановить бот (`docker-compose stop bot`)
- [ ] Пересобрать (`docker-compose build bot`)
- [ ] Запустить (`docker-compose up -d bot`)
- [ ] Проверить логи (`docker-compose logs -f bot`)
- [ ] Проверить health endpoint
- [ ] Протестировать в Telegram

---

**Готово!** 🎉 Бот работает с новыми фичами!
