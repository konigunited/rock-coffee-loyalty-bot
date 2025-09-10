# Создание копии проекта для новых клиентов

## 1. Клонирование проекта

```bash
# Клонировать проект в новую папку
git clone https://github.com/konigunited/rock-coffee-loyalty-bot.git rock-coffee-bot-NEW
cd rock-coffee-bot-NEW

# Создать новую ветку
git checkout -b new-client-setup
```

## 2. Настройка новой базы данных

Изменить `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database - НОВАЯ БД
  postgres:
    image: postgres:15-alpine
    container_name: rock_coffee_db_new  # ИЗМЕНИТЬ НАЗВАНИЕ
    restart: unless-stopped
    environment:
      POSTGRES_DB: rock_coffee_bot_new  # НОВОЕ НАЗВАНИЕ БД
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: NEW_PASSWORD_HERE  # НОВЫЙ ПАРОЛЬ
      TZ: Europe/Kaliningrad
    volumes:
      - postgres_data_new:/var/lib/postgresql/data  # НОВЫЙ VOLUME
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5433:5432"  # НОВЫЙ ПОРТ (не 5432)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Rock Coffee Loyalty Bot - НОВАЯ КОПИЯ
  bot:
    build: .
    container_name: rock_coffee_bot_new  # ИЗМЕНИТЬ НАЗВАНИЕ
    restart: unless-stopped
    dns:
      - "8.8.8.8"
      - "1.1.1.1"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      BOT_TOKEN: YOUR_NEW_BOT_TOKEN_HERE  # НОВЫЙ ТОКЕН БОТА
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: rock_coffee_bot_new  # НОВОЕ НАЗВАНИЕ БД
      DB_USER: postgres
      DB_PASSWORD: NEW_PASSWORD_HERE  # НОВЫЙ ПАРОЛЬ
      JWT_SECRET: new_jwt_secret_here  # НОВЫЙ SECRET
      PORT: 3001  # НОВЫЙ ПОРТ
      TZ: Europe/Kaliningrad
    ports:
      - "3001:3001"  # НОВЫЙ ПОРТ (не 3000)
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy - ОБНОВИТЬ ПОРТЫ
  nginx:
    image: nginx:alpine
    container_name: rock_coffee_nginx_new
    restart: unless-stopped
    ports:
      - "8080:80"  # НОВЫЙ ПОРТ (не 80)
      - "8443:443"  # НОВЫЙ ПОРТ (не 443) 
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - bot

  # Redis для новой копии
  redis:
    image: redis:7-alpine
    container_name: rock_coffee_redis_new
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data_new:/data
    ports:
      - "6380:6379"  # НОВЫЙ ПОРТ (не 6379)

volumes:
  postgres_data_new:  # НОВЫЙ VOLUME
    driver: local
  redis_data_new:  # НОВЫЙ VOLUME
    driver: local
```

## 3. Создание нового бота в BotFather

1. Открыть Telegram → @BotFather
2. `/newbot`
3. Название: `Rock Coffee New Client Bot`
4. Username: `rock_coffee_new_bot`
5. Получить токен и вставить в `BOT_TOKEN`

## 4. Запуск новой копии

```bash
# Собрать и запустить
docker-compose up -d --build

# Проверить статус
docker-compose ps

# Проверить логи
docker-compose logs -f bot
```

## 5. Настройка администратора

```bash
# Подключиться к новой БД
docker exec rock_coffee_db_new psql -U postgres -d rock_coffee_bot_new

# Добавить администратора
INSERT INTO users (telegram_id, full_name, role, phone, is_active, created_at, updated_at)
VALUES (YOUR_TELEGRAM_ID, 'Admin Name', 'admin', '+7xxxxxxxxxx', true, NOW(), NOW());
```

## 6. Тестирование

1. Найти бота по username `rock_coffee_new_bot`
2. Нажать `/start`
3. Проверить админ панель
4. Протестировать регистрацию нового клиента

## Готово! 

У вас теперь две независимые копии:

- **Старая копия** - с существующими клиентами на порту 3000
- **Новая копия** - с чистой БД на порту 3001