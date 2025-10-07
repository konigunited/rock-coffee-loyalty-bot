# 🚀 Инструкция по деплою на сервер (Ubuntu + Docker)

## ⚠️ ВАЖНО: Данные клиентов НЕ будут затронуты!

Этот деплой включает:
- ✅ Отключение автопоздравлений с ДР
- ✅ Исправление дневной статистики
- ✅ Реальные метрики системы (CPU, диск, БД)
- ✅ Добавление старых миграций (уже должны быть применены)

---

## 📋 Что будет изменено на сервере:

### Изменения в коде:
1. `broadcast.service.ts` - отключена функция `sendBirthdayWishes()`
2. `notification.service.ts` - убрана ошибка в дневной статистике
3. `system.service.ts` - реальные метрики вместо моков

### ⚠️ Миграции БД (проверьте что УЖЕ применены):
- `003_timezone_setup.sql` - настройка таймзоны
- `004_fix_total_spent.sql` - исправление total_spent

**ВАЖНО:** Таблицы `clients`, `users`, `point_transactions` НЕ изменяются!

---

## 🛡️ Безопасный деплой (даунтайм ~5-10 секунд)

### Шаг 1: Подключение к серверу

```bash
ssh your_user@your_server_ip
cd /path/to/rc_bot
```

---

### Шаг 2: Бэкап БД (ОБЯЗАТЕЛЬНО!)

```bash
# Создать бэкап базы данных
docker exec rock_coffee_db pg_dump -U postgres rock_coffee_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Проверить что бэкап создался (должен быть > 10KB)
ls -lh backup_*.sql | tail -1
```

✅ **Ожидаемый результат:** Файл `backup_20251007_*.sql` размером > 10KB

---

### Шаг 3: Посмотреть текущий коммит (для отката)

```bash
# Запомните этот hash на случай отката
git log --oneline -1
```

---

### Шаг 4: Скачать обновления

```bash
# Скачать изменения с GitHub
git pull origin main
```

✅ **Ожидаемый результат:**
```
Updating 000979f..275309f
 8 files changed, 703 insertions(+), 50 deletions(-)
```

---

### Шаг 5: Проверить применены ли миграции (ВАЖНО!)

```bash
# Проверить существуют ли таблицы из миграций
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "\dt"
```

**Вы должны увидеть:**
- ✅ `activity_log`
- ✅ `broadcasts`
- ✅ `clients`
- ✅ `point_transactions`
- ✅ `sessions`
- ✅ `telegram_messages_log`
- ✅ `users`

**Проверить таймзону:**
```bash
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SHOW timezone;"
```

✅ **Должно быть:** `Europe/Kaliningrad`

**Если таймзона НЕ Kaliningrad, применить миграцию 003:**
```bash
docker cp migrations/003_timezone_setup.sql rock_coffee_db:/tmp/
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/003_timezone_setup.sql
```

**Проверить total_spent работает:**
```bash
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT id, full_name, total_spent FROM clients LIMIT 3;"
```

✅ **Должно вернуть:** Клиенты с корректными значениями `total_spent`

---

### Шаг 6: Пересобрать образ бота (бот продолжает работать)

```bash
# Пересобрать Docker образ с новым кодом
docker-compose build bot
```

⏱️ **Время:** 30-60 секунд
✅ **Статус:** Бот продолжает работать на старой версии

---

### Шаг 7: Быстрый рестарт бота (даунтайм ~5-10 сек)

```bash
# Перезапустить только бот (БД остается работать)
docker-compose up -d bot
```

⏱️ **Даунтайм:** 5-10 секунд
✅ **БД:** Продолжает работать без перезапуска

---

### Шаг 8: Проверка что всё работает

```bash
# 1. Посмотреть логи (должны быть без ошибок)
docker-compose logs --tail=30 bot

# 2. Проверить health endpoint
curl http://localhost:3000/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"2025-..."}

# 3. Проверить статус контейнеров
docker-compose ps

# Ожидаемый результат:
# rock_coffee_bot   Up
# rock_coffee_db    Up

# 4. Проверить что нет ошибок при запуске
docker-compose logs bot | grep -i error | tail -10
```

---

### Шаг 9: Тестирование в Telegram

1. Откройте бота в Telegram
2. Отправьте `/start`
3. Попробуйте основные функции:
   - ✅ Поиск клиента
   - ✅ Начисление/списание баллов
   - ✅ Отправка сообщения клиенту
   - ✅ Просмотр статистики

---

## 🚨 Если что-то пошло не так - ОТКАТ

### Вариант 1: Откатить только код (БД остается)

```bash
# 1. Посмотреть предыдущий коммит
git log --online -5

# 2. Откатиться на предыдущий коммит (000979f)
git checkout 000979f

# 3. Пересобрать старую версию
docker-compose build bot
docker-compose up -d bot

# 4. Проверить логи
docker-compose logs --tail=20 bot
```

### Вариант 2: Полный откат с восстановлением БД

```bash
# 1. Остановить бот
docker-compose stop bot

# 2. Найти свой бэкап
ls -lh backup_*.sql | tail -1

# 3. Восстановить БД из бэкапа
cat backup_20251007_HHMMSS.sql | docker exec -i rock_coffee_db psql -U postgres -d rock_coffee_bot

# 4. Откатить код
git checkout 000979f

# 5. Пересобрать и запустить
docker-compose build bot
docker-compose up -d bot
```

---

## ✅ Чеклист успешного деплоя

- [ ] Подключился к серверу Ubuntu
- [ ] Создан бэкап БД (файл > 10KB)
- [ ] Запомнил текущий hash коммита
- [ ] Выполнен `git pull origin main`
- [ ] Проверено что все таблицы существуют
- [ ] Проверена таймзона `Europe/Kaliningrad`
- [ ] Пересобран образ `docker-compose build bot`
- [ ] Перезапущен бот `docker-compose up -d bot`
- [ ] Health endpoint возвращает `{"status":"ok"}`
- [ ] В логах нет ошибок
- [ ] Бот отвечает в Telegram на `/start`
- [ ] Основные функции работают (поиск, баллы, сообщения)

---

## 📊 Итоговое время даунтайма: ~5-10 секунд

## 🛡️ Гарантии безопасности данных:

✅ **Данные клиентов НЕ ЗАТРОНУТЫ:**
- Таблица `clients` - без изменений
- Таблица `users` - без изменений
- Таблица `point_transactions` - без изменений
- Таблица `sessions` - без изменений
- Таблица `telegram_messages_log` - без изменений

✅ **Docker volume `postgres_data`:**
- Данные хранятся на диске сервера
- Не удаляются при перезапуске контейнеров
- Сохраняются между сессиями

✅ **Бэкап БД создан** перед любыми изменениями

---

## 📞 Мониторинг после деплоя

### Смотреть логи в реальном времени:
```bash
docker-compose logs -f bot
```
*Нажмите Ctrl+C для выхода*

### Проверить ресурсы:
```bash
# CPU и память
docker stats --no-stream

# Размер БД
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT pg_size_pretty(pg_database_size('rock_coffee_bot'));"

# Активные сессии
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT COUNT(*) FROM sessions WHERE expires_at > NOW();"

# Количество клиентов
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT COUNT(*) as total_clients FROM clients WHERE is_active = true;"
```

---

## 🎯 Изменения в этом деплое:

### 1. broadcast.service.ts
- Отключена функция автопоздравлений `sendBirthdayWishes()`
- Функция теперь возвращает `{success: true, sentCount: 0, errors: []}`

### 2. notification.service.ts
- Исправлена ошибка в дневной статистике
- Удалена несуществующая переменная `total_points_earned`

### 3. system.service.ts
- Uptime: реальные данные из `process.uptime()` вместо команды Linux
- DB connections: реальные данные из `pg_stat_activity`
- CPU: реальные данные из `process.cpuUsage()`
- Disk: реальные данные через WMIC (Windows) / df (Linux)
- Error logs: читает из таблицы `activity_log`
- Добавлен метод `logError()` для записи ошибок в БД

### 4. Миграции (проверить что применены):
- `003_timezone_setup.sql` - таймзона Europe/Kaliningrad
- `004_fix_total_spent.sql` - триггеры для автообновления total_spent

---

**Готово! Деплой безопасен и не затронет данные клиентов! 🎉**
