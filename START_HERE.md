# 🎯 НАЧНИТЕ ЗДЕСЬ - Rock Coffee Bot

## 🤖 Ваш бот готов к запуску!

**Токен Telegram бота уже настроен:** `8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs`

---

## ⚡ Самый быстрый способ запустить

### 🪟 Для Windows:
```cmd
# 1. Откройте командную строку в папке проекта
# 2. Запустите автоматическую настройку:
scripts\setup.bat

# 3. Если все прошло успешно:
npm run dev
```

### 🐧 Для Linux/Mac:  
```bash
# 1. Откройте терминал в папке проекта
# 2. Запустите автоматическую настройку:
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Если все прошло успешно:
npm run dev
```

---

## 📋 Что вам нужно:

### ✅ Уже есть:
- [x] Токен Telegram бота  
- [x] Весь код системы
- [x] Конфигурационные файлы
- [x] Скрипты автоматической настройки
- [x] Docker конфигурация

### ❗ Нужно установить:
- [ ] **Node.js 16+** ([скачать](https://nodejs.org/))  
- [ ] **PostgreSQL 12+** ([скачать](https://www.postgresql.org/download/))

---

## 🗄️ Настройка базы данных

### Вариант 1: Локальный PostgreSQL
```sql
-- После установки PostgreSQL:
CREATE DATABASE rock_coffee_bot;
CREATE USER rock_coffee_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO rock_coffee_user;
```

### Вариант 2: Docker (если PostgreSQL не хотите ставить)
```bash
# Запуск PostgreSQL в Docker:
docker-compose up -d postgres

# Или запуск всей системы:
docker-compose up -d
```

---

## 👤 Создание администратора

После настройки БД добавьте себя как админа:

```sql
-- Подключитесь к базе:
psql -U postgres -d rock_coffee_bot

-- Добавьте себя (замените на свои данные):
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (12345678, 'your_username', 'Ваше Имя', 'admin', true);
```

**❓ Не знаете свой Telegram ID?** 
- Найдите @userinfobot в Telegram
- Отправьте ему любое сообщение  
- Он покажет ваш ID

---

## 🚀 Запуск и тестирование

```bash
# Запуск в режиме разработки:
npm run dev

# Если видите это сообщение - все работает:
# 🚀 Rock Coffee Loyalty Bot started on port 3000
# 📱 Bot is polling for updates...
```

**Тестирование:**
1. Найдите вашего бота в Telegram
2. Отправьте команду `/start`  
3. Должна появиться админ-панель с меню

---

## 📞 Если что-то не работает

### 🔍 Проверьте:
1. **Node.js установлен?** `node --version`
2. **PostgreSQL запущен?** Проверьте службы Windows/systemctl
3. **Пароль в .env правильный?** Отредактируйте файл `.env`
4. **База данных создана?** `psql -U postgres -l`

### 📖 Подробные инструкции:
- **Быстрый старт:** [`QUICKSTART.md`](QUICKSTART.md)
- **Полное руководство:** [`README.md`](README.md)

### 🐛 Частые ошибки:
- `"Database connection failed"` → проверьте PostgreSQL и пароль в .env
- `"Bot not responding"` → проверьте токен бота
- `"npm install failed"` → попробуйте удалить node_modules и npm install заново

---

## 🎉 После успешного запуска

Ваш Rock Coffee Bot будет иметь:

### 👥 4 роли пользователей:
- **Admin** (вы) - полный контроль системы
- **Manager** - управление клиентами и персоналом  
- **Barista** - операции с баллами (ограниченный доступ к данным)
- **Client** - регистрация и использование карты лояльности

### 🛠️ Основные функции:
- ✅ Система начисления/списания баллов  
- ✅ Регистрация клиентов через Telegram
- ✅ Административная панель с мониторингом
- ✅ Массовые уведомления клиентам
- ✅ Система резервного копирования
- ✅ Журнал всех операций

---

**🚀 Готовы запускать? Начните с команды выше! ☝️**