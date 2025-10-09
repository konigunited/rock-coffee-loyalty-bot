# Security Policy

## 🔒 Политика безопасности Rock Coffee Bot

### Supported Versions

Поддерживаемые версии проекта с обновлениями безопасности:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## 🚨 Критические проблемы безопасности (ИСПРАВЛЕНЫ)

### ✅ Решённые проблемы

1. **Hardcoded credentials в docker-compose.yml**
   - ❌ ПРОБЛЕМА: Пароли и токены были захардкожены в файле
   - ✅ РЕШЕНИЕ: Использование переменных окружения через .env.production

2. **Hardcoded пароли в тестах**
   - ❌ ПРОБЛЕМА: Пароль БД был захардкожен в tests/helpers/database.ts
   - ✅ РЕШЕНИЕ: Использование переменных окружения TEST_DB_PASSWORD

3. **Отсутствие Rate Limiting**
   - ❌ ПРОБЛЕМА: API не защищен от DDoS и брутфорса
   - ✅ РЕШЕНИЕ: Добавлен express-rate-limit middleware

## 🔐 Настройка безопасности для production

### 1. Создайте `.env.production`

```bash
# Скопируйте пример
cp .env.production.example .env.production

# Сгенерируйте безопасные секреты
openssl rand -base64 32  # для JWT_SECRET
openssl rand -base64 32  # для SESSION_SECRET
```

### 2. Заполните `.env.production`

```env
# Получите токен от @BotFather
BOT_TOKEN=your_real_bot_token_here

# Создайте надёжный пароль для БД
DB_PASSWORD=your_strong_database_password_here

# Сгенерированные секреты
JWT_SECRET=your_generated_jwt_secret_here
SESSION_SECRET=your_generated_session_secret_here
```

### 3. Проверьте `.gitignore`

Убедитесь, что `.env.production` НЕ попадёт в git:

```bash
# .gitignore уже содержит:
.env
.env.production
.env.local
```

### 4. Запустите с безопасными настройками

```bash
docker-compose up -d
```

Docker Compose автоматически подхватит переменные из `.env.production`

## 🛡️ Меры безопасности в проекте

### Реализовано:

✅ **Helmet.js** - Защита HTTP заголовков
✅ **CORS** - Контроль доступа к API
✅ **Rate Limiting** - Защита от DDoS (100 запросов/мин)
✅ **Environment Variables** - Безопасное хранение секретов
✅ **Role-Based Access** - Проверка ролей пользователей
✅ **PostgreSQL Views** - Ограничение данных для баристы
✅ **Логирование** - Audit log всех действий
✅ **Docker** - Изолированное окружение

### Рекомендации для production:

⚠️ **HTTPS** - Настройте SSL сертификаты:
```bash
# Для Let's Encrypt:
sudo certbot --nginx -d yourdomain.com
```

⚠️ **Firewall** - Ограничьте доступ к портам:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp  # PostgreSQL только внутри Docker
sudo ufw enable
```

⚠️ **Backup** - Настройте автоматические бэкапы:
```bash
# Добавьте в cron
0 2 * * * docker exec rock_coffee_db pg_dump -U postgres rock_coffee_bot > backup_$(date +\%Y\%m\%d).sql
```

⚠️ **Monitoring** - Установите мониторинг (опционально):
```bash
docker run -d --name=prometheus prom/prometheus
docker run -d --name=grafana grafana/grafana
```

## 🐛 Известные уязвимости

### NPM Dependencies

**КРИТИЧНО:** Уязвимости в зависимостях `node-telegram-bot-api`:

```
- form-data <2.5.4 (critical)
- tough-cookie <4.1.3 (moderate)
```

**Статус:** Требуется обновление пакетов, но это может внести breaking changes.

**Временное решение:**
1. Бот использует только Telegram API (не подвержен уязвимостям form-data напрямую)
2. Ограничен доступ через Docker network

**Постоянное решение (будущее):**
```bash
# Обновить до совместимой версии при появлении
npm audit fix --force
npm test  # Проверить совместимость
```

## 📧 Reporting a Vulnerability

Если вы обнаружили уязвимость безопасности:

1. **НЕ создавайте публичный Issue**
2. Отправьте описание на: [security@rockcoffee.example.com]
3. Включите:
   - Описание уязвимости
   - Шаги для воспроизведения
   - Потенциальное влияние
   - Предлагаемое решение (если есть)

Мы ответим в течение 48 часов и выпустим патч в течение 7 дней.

## 🔑 Безопасные практики разработки

### При работе с кодом:

1. **Никогда не коммитьте:**
   - `.env` файлы с реальными данными
   - Пароли, токены, API ключи
   - SSL сертификаты

2. **Всегда используйте:**
   - Environment variables для секретов
   - Prepared statements для SQL (уже используется)
   - Input validation (уже реализовано)

3. **Регулярно проверяйте:**
   ```bash
   npm audit
   npm outdated
   ```

4. **Перед деплоем:**
   ```bash
   npm run typecheck
   npm test
   npm audit
   ```

## 📋 Чеклист безопасности перед production

- [ ] .env.production создан и заполнен
- [ ] JWT_SECRET и SESSION_SECRET сгенерированы
- [ ] DB_PASSWORD изменён на надёжный
- [ ] .env.production НЕ в git
- [ ] HTTPS настроен через Nginx
- [ ] Firewall настроен
- [ ] Backup настроен
- [ ] Rate limiting протестирован
- [ ] npm audit проверен
- [ ] Логи проверяются регулярно
- [ ] Access control протестирован

## 🆘 В случае компрометации

1. **Немедленно:**
   - Остановите бот: `docker-compose down`
   - Смените все пароли и токены
   - Проверьте логи на подозрительную активность

2. **Восстановление:**
   - Обновите .env.production с новыми секретами
   - Пересоздайте контейнеры: `docker-compose up -d --force-recreate`
   - Проверьте БД на несанкционированные изменения

3. **Анализ:**
   - Изучите activity_log таблицу
   - Проверьте Docker logs
   - Проинформируйте пользователей при необходимости

---

**Последнее обновление:** 2025-10-09
**Версия политики:** 1.0.0
