#!/bin/bash
# Rock Coffee Bot - Production Setup Script
# Автоматическая настройка безопасного окружения

set -e  # Exit on error

echo "🔒 Rock Coffee Bot - Production Setup"
echo "======================================"
echo ""

# Check if .env.production already exists
if [ -f .env.production ]; then
    echo "⚠️  .env.production уже существует!"
    read -p "Перезаписать? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отменено."
        exit 0
    fi
fi

echo "📝 Создание .env.production..."

# Check if .env.production.example exists
if [ ! -f .env.production.example ]; then
    echo "❌ Ошибка: .env.production.example не найден!"
    exit 1
fi

# Copy template
cp .env.production.example .env.production

echo "✅ Шаблон скопирован"
echo ""

# Generate secrets
echo "🔑 Генерация секретных ключей..."
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')

echo "✅ Секреты сгенерированы"
echo ""

# Get bot token
echo "🤖 Telegram Bot Token"
echo "Текущий токен: 8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs"
read -p "Использовать текущий? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    read -p "Введите BOT_TOKEN: " BOT_TOKEN
else
    BOT_TOKEN="8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs"
fi

# Get database password
echo ""
echo "🔐 Database Password"
echo "Текущий пароль: 7R4P5T4R"
read -p "Использовать текущий? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    read -s -p "Введите DB_PASSWORD: " DB_PASSWORD
    echo
else
    DB_PASSWORD="7R4P5T4R"
fi

# Replace placeholders in .env.production
echo ""
echo "💾 Сохранение конфигурации..."

sed -i "s|BOT_TOKEN=your_bot_token_here|BOT_TOKEN=$BOT_TOKEN|g" .env.production
sed -i "s|DB_PASSWORD=your_secure_password_here|DB_PASSWORD=$DB_PASSWORD|g" .env.production
sed -i "s|JWT_SECRET=your_secure_jwt_secret_minimum_32_characters_long|JWT_SECRET=$JWT_SECRET|g" .env.production
sed -i "s|SESSION_SECRET=your_secure_session_secret_here|SESSION_SECRET=$SESSION_SECRET|g" .env.production

echo "✅ .env.production создан и настроен!"
echo ""

# Show summary (without secrets)
echo "📋 Конфигурация:"
echo "  NODE_ENV: production"
echo "  BOT_TOKEN: ${BOT_TOKEN:0:10}..."
echo "  DB_PASSWORD: ${DB_PASSWORD:0:3}***"
echo "  JWT_SECRET: ***генерирован***"
echo "  SESSION_SECRET: ***генерирован***"
echo ""

# Ask to restart services
echo "🔄 Перезапустить сервисы?"
read -p "Выполнить docker-compose restart? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "🛑 Останавливаем контейнеры..."
    docker-compose down

    echo "🔨 Пересобираем образ..."
    docker-compose build bot

    echo "🚀 Запускаем сервисы..."
    docker-compose up -d

    echo ""
    echo "✅ Сервисы перезапущены!"
    echo ""

    # Show logs
    echo "📊 Логи запуска (последние 30 строк):"
    docker-compose logs --tail 30 bot
else
    echo ""
    echo "⚠️  Не забудьте перезапустить сервисы:"
    echo "   docker-compose down"
    echo "   docker-compose build bot"
    echo "   docker-compose up -d"
fi

echo ""
echo "🎉 Настройка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "  1. Проверьте логи: docker-compose logs -f bot"
echo "  2. Проверьте статус: docker-compose ps"
echo "  3. Протестируйте бота в Telegram"
echo ""
echo "📖 Полная документация: SECURITY.md"
