# 🚀 Руководство по деплою Rock Coffee Loyalty Bot

## Предварительные требования

### Создание Telegram бота:
1. Найдите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Укажите название: `Rock Coffee Loyalty Bot`
4. Укажите username: `rock_coffee_loyalty_bot` (должен быть уникальным)
5. Получите BOT_TOKEN и сохраните его

### Подготовка сервера:
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 🔧 Конфигурация

### 1. Клонирование проекта:
```bash
cd /opt
sudo git clone <repository-url> rock-coffee-bot
sudo chown -R $USER:$USER rock-coffee-bot
cd rock-coffee-bot
```

### 2. Настройка переменных окружения:
```bash
cp .env.example .env
nano .env
```

Заполните `.env`:
```env
# ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz  # Токен от @BotFather
DB_PASSWORD=secure_db_password_here             # Надежный пароль для БД
JWT_SECRET=very_long_random_secret_key_here     # Минимум 32 символа

# ОПЦИОНАЛЬНЫЕ ПАРАМЕТРЫ
DB_HOST=postgres                                # Имя контейнера БД
DB_PORT=5432                                   # Порт PostgreSQL
DB_NAME=rock_coffee                            # Название базы данных
DB_USER=postgres                               # Пользователь БД
PORT=3000                                      # Порт приложения
NODE_ENV=production                            # Режим работы
```

### 3. Генерация SSL сертификатов (опционально):
```bash
# Создание директории для SSL
mkdir -p ssl

# Самоподписанный сертификат для тестирования
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=RockCoffee/CN=yourdomain.com"

# ИЛИ использовать Let's Encrypt для продакшена:
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
```

## 🚢 Деплой

### Запуск всех сервисов:
```bash
# Сборка и запуск в фоновом режиме
docker-compose up -d --build

# Проверка статуса контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs -f
```

### Ожидаемый вывод:
```
    Name                   Command               State           Ports
--------------------------------------------------------------------------------
rock_coffee_bot     npm start                    Up      0.0.0.0:3000->3000/tcp
rock_coffee_db      docker-entrypoint.s ...      Up      0.0.0.0:5432->5432/tcp
rock_coffee_nginx   /docker-entrypoint.sh ...    Up      0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
rock_coffee_redis   docker-entrypoint.s ...      Up      0.0.0.0:6379->6379/tcp
```

## 👑 Настройка первого администратора

### 1. Подключение к базе данных:
```bash
docker-compose exec postgres psql -U postgres -d rock_coffee
```

### 2. Добавление администратора:
```sql
-- Замените 123456789 на свой Telegram ID
-- Узнать ID можно у @userinfobot
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (123456789, 'admin', 'Администратор системы', 'admin', true);
```

### 3. Проверка:
```sql
SELECT * FROM users WHERE role = 'admin';
\q
```

## 🔍 Проверка работоспособности

### Health Check:
```bash
# Проверка API
curl http://localhost:3000/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"2024-01-20T10:30:00.000Z"}
```

### Проверка Telegram бота:
1. Найдите вашего бота в Telegram по username
2. Отправьте команду `/start`
3. Если вы администратор - должно появиться меню управляющего
4. Если не добавлены в систему - увидите приветственное сообщение

## 🛠️ Управление сервисом

### Основные команды:
```bash
# Перезапуск всех сервисов
docker-compose restart

# Перезапуск только бота
docker-compose restart bot

# Остановка всех сервисов
docker-compose down

# Полная очистка (ОСТОРОЖНО: удалит все данные!)
docker-compose down -v

# Обновление кода и перезапуск
git pull
docker-compose up -d --build

# Просмотр использования ресурсов
docker stats
```

### Логи и отладка:
```bash
# Просмотр логов бота в реальном времени
docker-compose logs -f bot

# Последние 100 строк логов
docker-compose logs --tail=100 bot

# Логи базы данных
docker-compose logs postgres

# Вход в контейнер для отладки
docker-compose exec bot sh
```

## 💾 Резервное копирование

### Автоматическое резервное копирование:
```bash
# Создание скрипта резервного копирования
sudo nano /opt/backup-rock-coffee.sh
```

Содержимое скрипта:
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/rock-coffee"
DATE=$(date +%Y%m%d_%H%M%S)

# Создание директории для бэкапов
mkdir -p $BACKUP_DIR

# Резервная копия базы данных
docker-compose exec -T postgres pg_dump -U postgres rock_coffee > $BACKUP_DIR/database_$DATE.sql

# Архивирование конфигурационных файлов
tar -czf $BACKUP_DIR/config_$DATE.tar.gz .env docker-compose.yml nginx.conf

# Удаление бэкапов старше 30 дней
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Права на выполнение
sudo chmod +x /opt/backup-rock-coffee.sh

# Добавление в cron (ежедневно в 3:00)
sudo crontab -e
# Добавить строку:
0 3 * * * /opt/backup-rock-coffee.sh >> /var/log/backup-rock-coffee.log 2>&1
```

### Восстановление из бэкапа:
```bash
# Остановка сервисов
docker-compose down

# Восстановление базы данных
docker-compose up -d postgres
sleep 10
docker-compose exec -T postgres psql -U postgres -d rock_coffee < /opt/backups/rock-coffee/database_20240120_030000.sql

# Запуск всех сервисов
docker-compose up -d
```

## 🔐 SSL и домен (продакшен)

### Настройка домена:
```bash
# Редактирование nginx.conf для вашего домена
nano nginx.conf
# Замените 'localhost' на ваш домен
```

### Let's Encrypt SSL:
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d yourdomain.com

# Автообновление сертификата
sudo systemctl enable certbot.timer
```

## 📊 Мониторинг

### Системные ресурсы:
```bash
# Установка htop для мониторинга
sudo apt install htop

# Мониторинг Docker контейнеров
watch docker stats

# Проверка места на диске
df -h
du -sh /var/lib/docker/
```

### Логирование:
```bash
# Настройка logrotate для Docker логов
sudo nano /etc/logrotate.d/docker

# Содержимое:
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=1M
  missingok
  delaycompress
  copytruncate
}
```

## 🚨 Устранение неполадок

### Частые проблемы:

#### 1. Бот не отвечает:
```bash
# Проверка статуса контейнеров
docker-compose ps

# Перезапуск бота
docker-compose restart bot

# Проверка логов
docker-compose logs bot
```

#### 2. Ошибки подключения к БД:
```bash
# Проверка PostgreSQL
docker-compose logs postgres

# Подключение к БД для проверки
docker-compose exec postgres psql -U postgres -d rock_coffee -c "SELECT version();"
```

#### 3. Высокое использование ресурсов:
```bash
# Проверка статистики контейнеров
docker stats --no-stream

# Очистка неиспользуемых Docker объектов
docker system prune -a

# Перезапуск с ограничением памяти
nano docker-compose.yml
# Добавить в сервис bot:
# deploy:
#   resources:
#     limits:
#       memory: 512M
#       cpus: '1'
```

#### 4. Проблемы с правами доступа:
```bash
# Проверка владельцев файлов
ls -la

# Исправление прав
sudo chown -R $USER:$USER /opt/rock-coffee-bot

# Перезапуск с правильными правами
docker-compose down
docker-compose up -d
```

## 📈 Масштабирование

### При росте нагрузки:

#### Вертикальное масштабирование:
```yaml
# В docker-compose.yml добавить ограничения ресурсов
services:
  bot:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2'
        reservations:
          memory: 512M
          cpus: '1'
```

#### Горизонтальное масштабирование:
```bash
# Запуск нескольких инстансов бота
docker-compose up -d --scale bot=2
```

#### Использование внешней БД:
```yaml
# Подключение к внешней PostgreSQL
services:
  bot:
    environment:
      DB_HOST: your-external-postgres-host
      DB_PORT: 5432
# Убрать postgres из docker-compose.yml
```

## ✅ Чеклист деплоя

- [ ] Получен BOT_TOKEN от @BotFather
- [ ] Настроены переменные окружения в `.env`
- [ ] Сгенерированы SSL сертификаты (если нужны)
- [ ] Запущены все Docker контейнеры
- [ ] Добавлен первый администратор в БД
- [ ] Проверена работа бота командой `/start`
- [ ] Настроено автоматическое резервное копирование
- [ ] Настроен мониторинг и логирование
- [ ] Проверен health check endpoint
- [ ] Настроен автозапуск после перезагрузки сервера
- [ ] Созданы учетные записи для всех сотрудников

---

🎉 **Поздравляем! Rock Coffee Loyalty Bot готов к работе!**

Для получения поддержки обращайтесь в Issues репозитория или к разработчикам.