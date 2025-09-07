# 🐘 Настройка PostgreSQL для Rock Coffee Bot

## 🔐 Пароль уже настроен: `RockCoffee2024!`

---

## 🚀 СПОСОБ 1: Автоматическая настройка (Windows)

Запустите скрипт:
```cmd
scripts\setup-postgres.bat
```

---

## 🛠️ СПОСОБ 2: Ручная настройка через pgAdmin

### 1. Откройте pgAdmin
### 2. Подключитесь к серверу PostgreSQL
### 3. Откройте Query Tool
### 4. Вставьте и выполните:

```sql
-- Установите пароль
ALTER USER postgres PASSWORD 'RockCoffee2024!';

-- Создайте базу данных
CREATE DATABASE rock_coffee_bot;

-- Предоставьте права доступа
GRANT ALL PRIVILEGES ON DATABASE rock_coffee_bot TO postgres;
```

---

## 💻 СПОСОБ 3: Через командную строку

Если psql доступен в PATH:
```cmd
psql -U postgres
```
Затем выполните SQL команды выше.

---

## ✅ ПРОВЕРКА НАСТРОЙКИ

После любого способа проверьте подключение:
```cmd
cd C:\Users\F12$\Desktop\rc_bot
npm run migrate
```

Если миграция прошла успешно - всё готово!

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

После успешной настройки PostgreSQL:

### 1️⃣ Примените миграции базы данных:
```cmd
npm run migrate
```

### 2️⃣ Запустите бота:
```cmd
npm run quick-start
```

### 3️⃣ Создайте администратора:
```cmd
# Подключитесь к базе данных
psql -h localhost -U postgres -d rock_coffee_bot

# Добавьте себя как админа (замените YOUR_TELEGRAM_ID)
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (YOUR_TELEGRAM_ID, 'your_username', 'Ваше Имя', 'admin', true);

# Выйдите
\q
```

### 4️⃣ Найдите бота в Telegram и отправьте `/start`

---

## 🆘 Если возникли проблемы

### PostgreSQL не запускается:
- Проверьте службы Windows (services.msc)
- Найдите "postgresql" и запустите

### Не можете подключиться:
- Убедитесь что пароль `RockCoffee2024!` установлен
- Проверьте что порт 5432 свободен

### Миграция не работает:
- Проверьте настройки в .env файле
- База данных `rock_coffee_bot` должна существовать

---

**✅ Все настройки готовы! Переходите к запуску бота.**