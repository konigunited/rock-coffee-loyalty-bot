# 🚀 Быстрый старт Rock Coffee Bot

## ⚡ За 5 минут до запуска

### 1️⃣ Установите зависимости
```bash
npm install
```

### 2️⃣ Настройте базу данных PostgreSQL
```bash
# Создайте базу данных
psql -U postgres -c "CREATE DATABASE rock_coffee_bot;"

# Или через pgAdmin/другие инструменты
```

### 3️⃣ Настройте пароль в .env
Отредактируйте файл `.env`:
```env
DB_PASSWORD=ваш_пароль_postgresql
```

### 4️⃣ Примените миграции
```bash
npm run migrate
```

### 5️⃣ Создайте администратора
```bash
# Подключитесь к базе данных
psql -U postgres -d rock_coffee_bot

# Добавьте себя как админа (замените YOUR_TELEGRAM_ID на ваш реальный ID)
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (YOUR_TELEGRAM_ID, 'your_username', 'Ваше Имя', 'admin', true);

# Выйдите
\q
```

### 6️⃣ Запустите бота
```bash
npm run dev
```

### 7️⃣ Найдите бота в Telegram и отправьте /start

---

## 🆘 Как узнать свой Telegram ID?

### Способ 1: Через @userinfobot
1. Найдите в Telegram @userinfobot
2. Отправьте ему любое сообщение
3. Он покажет ваш ID

### Способ 2: Через @get_id_bot  
1. Найдите в Telegram @get_id_bot
2. Нажмите /start
3. Получите свой ID

### Способ 3: Временно добавить в код
Добавьте в `src/index.ts` после строки 75:
```typescript
console.log('User Telegram ID:', msg.from?.id);
```
Отправьте /start боту и посмотрите в консоль.

---

## 🐳 Альтернатива: Docker

Если PostgreSQL не установлен локально:

```bash
# Запуск всей системы в Docker
docker-compose up -d

# Создание админа через Docker
docker-compose exec postgres psql -U postgres -d rock_coffee_bot
INSERT INTO users (telegram_id, username, full_name, role, is_active) 
VALUES (YOUR_TELEGRAM_ID, 'your_username', 'Ваше Имя', 'admin', true);
\q
```

---

## ✅ Проверка работоспособности

1. **Бот отвечает**: Найдите бота в Telegram → /start
2. **База данных**: http://localhost:3000/health
3. **Админ-панель**: Должна показаться админ-панель после /start

---

## 🛠️ Автоматическая настройка

### Windows:
```cmd
scripts\setup.bat
```

### Linux/Mac:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

---

## 🔥 Типичные проблемы

### "npm run migrate" не работает
- Проверьте что PostgreSQL запущен
- Проверьте пароль в .env
- Попробуйте создать базу вручную

### Бот не отвечает  
- Проверьте токен бота в .env
- Убедитесь что нет других ботов с тем же токеном

### "Database connection failed"
- Убедитесь что PostgreSQL запущен
- Проверьте настройки в .env (host, port, database, user, password)

### "Permission denied"
- На Linux/Mac: `chmod +x scripts/setup.sh`
- Или запустите с sudo если нужно

---

**🎯 Готово! Ваш Rock Coffee Bot готов к работе!**

Токен уже настроен: `8369634150:AAHAlkUetDEm6lNSsyFZ1cghLXtLQV72Vcs`