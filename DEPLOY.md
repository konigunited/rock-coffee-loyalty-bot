# 🚀 Быстрый деплой Rock Coffee Bot

## ⚡ Экспресс-обновление через Git (рекомендуется)

### 1. На сервере получите последние изменения

```bash
cd ~/rc_bot
git pull
```

### 2. Запустите автоматическую настройку

```bash
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh
```

Скрипт автоматически:
- ✅ Создаст `.env.production` (если не существует)
- ✅ Сгенерирует безопасные секреты (JWT_SECRET, SESSION_SECRET)
- ✅ Запросит токен бота и пароль БД
- ✅ Пересоберёт и перезапустит Docker контейнеры
- ✅ Покажет логи запуска

### 3. Готово!

Бот автоматически обновится с новыми настройками безопасности.

---

## 📋 Альтернативные варианты деплоя

### Вариант 1: Быстрое обновление кода (без изменения credentials)

```bash
cd ~/rc_bot
git pull
docker-compose restart bot
```

Используйте, если `.env.production` уже настроен и нужно только обновить код.

### Вариант 2: Полное обновление с пересборкой

```bash
cd ~/rc_bot
git pull
docker-compose down
docker-compose build bot
docker-compose up -d
docker-compose logs --tail 30 bot
```

Используйте при изменении Dockerfile или зависимостей.

### Вариант 3: Ручная настройка credentials (текущие данные)

```bash
cd ~/rc_bot
git pull

# Создайте .env.production с текущими данными
cat > .env.production <<EOF
NODE_ENV=production
BOT_TOKEN=8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs
DB_NAME=rock_coffee_bot
DB_USER=postgres
DB_PASSWORD=7R4P5T4R
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
PORT=3000
TZ=Europe/Kaliningrad
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
EOF

# Перезапустите
docker-compose down
docker-compose build bot
docker-compose up -d
docker-compose logs --tail 30 bot
```

---

## 🗄️ Применение миграций БД

### Если появились новые миграции после git pull:

```bash
# Проверьте новые файлы в migrations/
ls -la migrations/

# Примените новую миграцию (например, 007)
docker exec -i rock_coffee_db psql -U postgres -d rock_coffee_bot < migrations/007_create_broadcasts_tables.sql

# Проверьте таблицы
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "\dt"

# Перезапустите бота
docker-compose restart bot
```

---

## ✅ Проверка после деплоя

```bash
# 1. Статус контейнеров
docker-compose ps

# 2. Логи бота (последние 50 строк)
docker-compose logs --tail 50 bot

# 3. Логи в реальном времени
docker-compose logs -f bot

# 4. Health check
curl http://localhost:3000/health
# Должен вернуть: {"status":"ok","timestamp":"..."}

# 5. Проверьте что .env.production НЕ в git
git status

# 6. Проверьте таблицы в БД
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

### Протестируйте бота:
1. Откройте бота в Telegram
2. Отправьте `/start`
3. Проверьте основные функции

---

## 🚨 Откат изменений (если что-то пошло не так)

```bash
# 1. Остановите контейнеры
docker-compose down

# 2. Найдите предыдущий коммит
git log --oneline -5

# 3. Вернитесь к рабочей версии
git checkout <previous-commit-hash>

# 4. Перезапустите
docker-compose build bot
docker-compose up -d

# 5. Проверьте логи
docker-compose logs --tail 50 bot
```

Если нужно вернуться к последней версии:
```bash
git checkout main
git pull
```

---

## 📝 Полезные команды Docker

```bash
# Посмотреть все контейнеры
docker-compose ps

# Перезапустить все сервисы
docker-compose restart

# Остановить все
docker-compose down

# Запустить все
docker-compose up -d

# Пересобрать образ бота
docker-compose build bot

# Зайти в контейнер бота
docker exec -it rock_coffee_bot sh

# Зайти в PostgreSQL
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot

# Посмотреть логи всех сервисов
docker-compose logs -f

# Посмотреть использование ресурсов
docker stats

# Очистить все и начать заново (ОСТОРОЖНО - удалит данные!)
docker-compose down -v
docker-compose up -d
```

---

## 🔒 Безопасность после деплоя

После деплоя проверьте:

```bash
# 1. .env.production существует и настроен
cat .env.production

# 2. .env.production НЕ в git
git status | grep .env.production
# Не должно показать файл

# 3. Rate limiting работает
curl http://localhost:3000/health
# Должен работать

# 4. Проверьте npm audit
docker exec -it rock_coffee_bot npm audit
```

**НЕ коммитьте** `.env.production` в git!

Полная документация: `SECURITY.md`

---

## 📊 Мониторинг после деплоя

```bash
# CPU и память контейнеров
docker stats

# Размер БД
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT pg_size_pretty(pg_database_size('rock_coffee_bot')) as size;
"

# Количество активных сессий
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT COUNT(*) FROM sessions WHERE expires_at > NOW();
"

# Количество клиентов
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "
SELECT COUNT(*) FROM clients WHERE is_active = true;
"
```

---

## 🎯 Zero-downtime деплой

Для минимального простоя:

```bash
cd ~/rc_bot
git pull

# Применить миграции (пока бот работает)
docker exec -i rock_coffee_db psql -U postgres -d rock_coffee_bot < migrations/007_create_broadcasts_tables.sql

# Быстро пересобрать и перезапустить
docker-compose build bot && docker-compose up -d bot

# Перерыв ~10-30 секунд
```

---

## ✅ Чеклист деплоя

**Перед деплоем:**
- [ ] Код закоммичен в git
- [ ] Миграции протестированы локально

**На сервере:**
- [ ] Подключился к серверу: `ssh user@server`
- [ ] Перешёл в директорию: `cd ~/rc_bot`
- [ ] Скачал обновления: `git pull`
- [ ] Применил миграции (если есть)
- [ ] Запустил setup скрипт или пересобрал: `./scripts/setup-production.sh`

**После деплоя:**
- [ ] Проверил логи: `docker-compose logs -f bot`
- [ ] Проверил health: `curl http://localhost:3000/health`
- [ ] Проверил статус: `docker-compose ps`
- [ ] Протестировал в Telegram
- [ ] `.env.production` не в git: `git status`

---

## 🆘 Частые проблемы

### "Database password must be set in .env.production"

**Решение:**
```bash
./scripts/setup-production.sh
```

### Бот не запускается

**Решение:**
```bash
docker-compose build bot
docker-compose up -d
docker-compose logs --tail 50 bot
```

### Ошибка "broadcasts does not exist"

**Решение:**
```bash
docker exec -i rock_coffee_db psql -U postgres -d rock_coffee_bot < migrations/007_create_broadcasts_tables.sql
docker-compose restart bot
```

### Permissions denied

**Решение:**
```bash
chmod +x scripts/setup-production.sh
```

---

## 📞 Поддержка

Проблемы с деплоем? Проверьте:
1. **Логи бота:** `docker-compose logs bot | tail -100`
2. **Логи БД:** `docker-compose logs postgres | tail -50`
3. **Docker статус:** `docker-compose ps`
4. **Env конфигурация:** `docker-compose config`

Полная документация:
- Безопасность: `SECURITY.md`
- Быстрый старт: `README.md`

---

**🎉 Готово! Бот обновлён и работает!**
