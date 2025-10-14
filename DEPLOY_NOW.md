# 🚀 Инструкция по деплою на рабочий сервер (Ubuntu + Docker)

## ⚠️ Важно: проект уже обслуживает клиентов
- Даунтайм при обновлении: ~5–10 секунд
- Бэкап БД обязателен перед началом
- Новая колонка **не меняет** существующие данные клиентов

## ✅ Что входит в обновление
- Автоматические поздравления с днём рождения (10 баллов + сообщение)
- Сервис `BirthdayService`, который стартует и останавливается вместе с ботом
- Миграция `008_add_last_birthday_bonus.sql` с колонкой `last_birthday_bonus_at`

## 🗂 Ключевые файлы
| Файл | Что делает |
| --- | --- |
| `src/services/birthday.service.ts` | Ежедневно в 09:00 (Калининград) проверяет именинников, начисляет бонус и отправляет сообщение |
| `src/index.ts` | Включает запуск и плавную остановку `BirthdayService` |
| `migrations/008_add_last_birthday_bonus.sql` | Добавляет колонку `last_birthday_bonus_at` и индекс |
| `SAFE_DEPLOY_COMMANDS.md` | Расширенная команда за командой инструкция (держи под рукой при деплое) |

---

## 🛡️ Пошаговый деплой без остановки сервиса

### Шаг 0. Перед выездом на сервер
```bash
# Убедись, что локальные изменения уже зафиксированы
git status

# Отправь коммит в origin
git push origin main

# Убедись, что origin/main содержит твой коммит
git log origin/main -1
```
Продолжай только после успешного `git push` и проверки `origin/main`, чтобы на сервере подтянулась актуальная версия бота.

### Шаг 1. Подключись и проверь контейнеры
```bash
ssh your_user@your_server_ip
cd /path/to/rc_bot
docker-compose ps
```
Ожидаем `rock_coffee_bot` и `rock_coffee_db` в статусе `Up`.

### Шаг 2. Сделай бэкап базы
```bash
docker exec rock_coffee_db pg_dump -U postgres rock_coffee_bot > backup_$(date +%Y%m%d_%H%M%S).sql
ls -lh backup_*.sql | tail -1
```
Файл должен быть > 10 KB.

### Шаг 3. Зафиксируй текущий commit на случай отката
```bash
git log --oneline -1
```
Сохрани hash.

### Шаг 4. Забери последние изменения
```bash
git pull origin main
```
Проверь, что обновились файлы:
- `migrations/008_add_last_birthday_bonus.sql`
- `src/services/birthday.service.ts`
- `src/index.ts`
- `SAFE_DEPLOY_COMMANDS.md`

### Шаг 5. Применить новую миграцию (бот продолжает работать)
```bash
docker cp migrations/008_add_last_birthday_bonus.sql rock_coffee_db:/tmp/
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -f /tmp/008_add_last_birthday_bonus.sql
docker exec -it rock_coffee_db psql -U postgres -d rock_coffee_bot -c "\d+ clients" | grep last_birthday_bonus_at
```
Ожидаем строку `last_birthday_bonus_at | timestamp with time zone |`.

### Шаг 6. Пересобери образ бота (без простоя)
```bash
docker-compose build bot
```
Сборка занимает 30–60 секунд, текущая версия бота в это время продолжает работать.

### Шаг 7. Быстрый рестарт бота
```bash
docker-compose up -d bot
```
Даунтайм ~5–10 секунд, база данных не перезапускается.

### Шаг 8. Контроль после обновления
```bash
# Проверяем логи запуска (должно быть без ошибок)
docker-compose logs --tail=40 bot

# Проверяем health endpoint
curl http://localhost:3000/health

# Убедиться, что BirthdayService запустился
docker-compose logs --tail=40 bot | grep BirthdayService || true

# Статус контейнеров
docker-compose ps
```
Health endpoint должен вернуть `{"status":"ok", ...}`.

### Шаг 9. Проверка в Telegram
1. Открой бота и отправь `/start`
2. Проверь ключевые сценарии: поиск клиента, начисление баллов, рассылка сообщения
3. Убедись, что ответное сообщение приходит без задержек

---

## 🚨 Если нужно откатиться

### Вариант 1. Откатить только код (БД остаётся новой)
```bash
git log --oneline -5
git checkout <PREV_HASH>
docker-compose build bot
docker-compose up -d bot
```

### Вариант 2. Полный откат вместе с БД
```bash
docker-compose stop bot
ls -lh backup_*.sql | tail -1
cat backup_YYYYMMDD_HHMMSS.sql | docker exec -i rock_coffee_db psql -U postgres -d rock_coffee_bot
git checkout <PREV_HASH>
docker-compose build bot
docker-compose up -d bot
```

---

## ✅ Чеклист успешного деплоя
- [ ] Сделан бэкап БД и проверен размер
- [ ] Сохранён hash текущего коммита
- [ ] Выполнен `git pull origin main`
- [ ] Миграция 008 применена, колонка видна в `\d+ clients`
- [ ] Образ пересобран: `docker-compose build bot`
- [ ] Бот перезапущен: `docker-compose up -d bot`
- [ ] `curl /health` возвращает `status: ok`
- [ ] В логах нет ошибок, `BirthdayService` стартовал
- [ ] Бот отвечает в Telegram на основные команды

---

## 🎯 Что изменилось после обновления
- Клиенты с днём рождения автоматически получают +10 баллов и сообщение
- Начисления не повторяются чаще одного раза в 10 месяцев (контроль колонкой)
- Баланс и история транзакций обновляются автоматически, ручных действий не требуется

**Готово!** Обновление устанавливается безопасно, сервис продолжает обслуживать клиентов. 🎉
