# 🛡️ Безопасный деплой на сервер (Zero-downtime)

## ⚠️ ВАЖНО: Выполняй команды по порядку!

---

## Шаг 1: Подключение и подготовка

```bash
# Подключиться к серверу
ssh your_user@your_server_ip

# Перейти в папку проекта
cd /path/to/rc_bot

# Проверить что Docker работает
docker-compose ps
```

**Должен быть вывод:**
```
NAME                 STATUS
rock_coffee_bot      Up
rock_coffee_db       Up
```

---

## Шаг 2: Бэкап БД (ОБЯЗАТЕЛЬНО!)

```bash
# Создать бэкап
docker exec rock_coffee_db pg_dump -U postgres rock_coffee_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Проверить что бэкап создался
ls -lh backup_*.sql | tail -1
```

**Должен показать файл > 10KB**

---

## Шаг 3: Скачать обновления

```bash
# Посмотреть текущий коммит (для отката если что)
git log --oneline -1

# Скачать обновления
git pull origin main

# Должно быть:
# - migrations/005_telegram_messages_log.sql
# - migrations/006_sessions_table.sql
# - src/services/session.service.ts
# и другие файлы
```

---

## Шаг 4: Применить миграции БД (БЕЗ остановки бота)

```bash
# Скопировать миграции в контейнер БД
docker cp migrations/005_telegram_messages_log.sql rock_coffee_db:/tmp/
docker cp migrations/006_sessions_table.sql rock_coffee_db:/tmp/

# Применить миграцию 005 (telegram_messages_log)
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/005_telegram_messages_log.sql

# Применить миграцию 006 (sessions)
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/006_sessions_table.sql

# Проверить что таблицы созданы
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('telegram_messages_log', 'sessions') ORDER BY tablename;"
```

**Должен показать:**
```
     tablename
--------------------
 sessions
 telegram_messages_log
(2 rows)
```

✅ **Важно:** Миграции НЕ изменяют существующие данные, только добавляют новые таблицы!

---

## Шаг 5: Пересобрать образ бота (БЕЗ остановки)

```bash
# Пересобрать образ
docker-compose build bot
```

**Ждём 30-60 секунд, бот продолжает работать**

---

## Шаг 6: Быстрый рестарт бота (минимальный даунтайм ~5 сек)

```bash
# Перезапустить только бот (БД остается работать)
docker-compose up -d bot
```

**Бот перезагрузится за 5-10 секунд**

---

## Шаг 7: Проверка что всё работает

```bash
# 1. Посмотреть логи (должны быть без ошибок)
docker-compose logs --tail=30 bot

# 2. Проверить health endpoint
curl http://localhost:3000/health

# Должен вернуть:
# {"status":"ok","timestamp":"2025-..."}

# 3. Проверить что бот запущен
docker-compose ps bot

# Должен быть:
# STATUS: Up

# 4. Проверить сессии в БД
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT COUNT(*) as active_sessions FROM sessions WHERE expires_at > NOW();"

# 5. Проверить новую таблицу сообщений
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT COUNT(*) FROM telegram_messages_log;"
```

---

## Шаг 8: Тестирование в Telegram

1. Открой бота в Telegram
2. Отправь `/start`
3. Попробуй основные функции:
   - ✅ Поиск клиента
   - ✅ Начисление баллов
   - ✅ Отправка сообщения клиенту (вместо SMS)

---

## 🚨 Если что-то пошло не так - ОТКАТ

### Вариант 1: Откатить только код (БД остается новой)

```bash
# 1. Посмотреть предыдущий коммит
git log --oneline -5

# 2. Откатиться на предыдущий коммит
git checkout 082b21c  # Замени на свой hash

# 3. Пересобрать старую версию
docker-compose build bot
docker-compose up -d bot
```

### Вариант 2: Полный откат (с БД)

```bash
# 1. Остановить бот
docker-compose stop bot

# 2. Найти свой бэкап
ls -lh backup_*.sql | tail -1

# 3. Восстановить БД из бэкапа
docker exec -i rock_coffee_db psql -U postgres -d rock_coffee_bot < backup_20250104_123456.sql

# 4. Откатить код
git checkout 082b21c

# 5. Пересобрать
docker-compose build bot
docker-compose up -d bot
```

---

## 📊 Мониторинг после деплоя

### Смотреть логи в реальном времени:

```bash
docker-compose logs -f bot
```

**Нажми Ctrl+C чтобы выйти**

### Проверить ресурсы:

```bash
# CPU и память контейнеров
docker stats --no-stream

# Размер БД
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT pg_size_pretty(pg_database_size('rock_coffee_bot')) as db_size;"

# Активные сессии
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "SELECT COUNT(*) as active FROM sessions WHERE expires_at > NOW();"
```

---

## ✅ Чеклист успешного деплоя

- [ ] Бэкап БД создан
- [ ] Обновления скачаны (`git pull`)
- [ ] Миграция 005 применена
- [ ] Миграция 006 применена
- [ ] Таблицы `sessions` и `telegram_messages_log` существуют
- [ ] Бот пересобран (`docker-compose build`)
- [ ] Бот перезапущен (`docker-compose up -d`)
- [ ] Health endpoint отвечает 200 OK
- [ ] В логах нет ошибок
- [ ] Бот отвечает в Telegram на `/start`
- [ ] Функции работают (поиск, баллы, сообщения)

---

## 🎯 Итоговое время даунтайма: ~5-10 секунд

✅ **Данные клиентов НЕ ЗАТРОНУТЫ:**
- Таблица `clients` - без изменений
- Таблица `users` - без изменений
- Таблица `point_transactions` - без изменений
- Только ДОБАВЛЕНЫ новые таблицы `sessions` и `telegram_messages_log`

---

## 📞 Если нужна помощь

```bash
# Посмотреть все логи
docker-compose logs

# Зайти в контейнер бота
docker exec -it rock_coffee_bot sh

# Зайти в PostgreSQL
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot

# Список всех таблиц
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "\dt"

# Перезапустить всё
docker-compose restart
```

---

**Готово! Деплой завершен безопасно! 🎉**
