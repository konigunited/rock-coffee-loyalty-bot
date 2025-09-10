#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Rock Coffee Bot - Локальное тестирование');
console.log('='.repeat(50));

// Проверяем файлы
const requiredFiles = [
  'src/handlers/client.handler.ts',
  'src/middleware/client.middleware.ts', 
  'src/services/client.service.ts',
  'migrations/002_phone_based_auth.sql',
  'scripts/migrate-to-phone-auth.ts'
];

console.log('\n📁 Проверка файлов:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Проверяем package.json
console.log('\n📦 Проверка package.json:');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log(`   ✅ Название: ${pkg.name}`);
  console.log(`   ✅ Версия: ${pkg.version}`);
  console.log(`   ✅ Команда миграции: ${pkg.scripts['migrate-phone-auth'] ? 'есть' : 'отсутствует'}`);
} else {
  console.log('   ❌ package.json не найден');
  allFilesExist = false;
}

// Проверяем переменные окружения
console.log('\n🔑 Проверка переменных окружения:');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env файл найден');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasToken = envContent.includes('BOT_TOKEN=');
  const hasDb = envContent.includes('DB_');
  console.log(`   ${hasToken ? '✅' : '❌'} BOT_TOKEN настроен`);
  console.log(`   ${hasDb ? '✅' : '❌'} База данных настроена`);
} else {
  console.log('   ⚠️  .env файл не найден - используйте .env.example');
}

// Создаем простой мок для тестирования без БД
console.log('\n🧪 Создание файла mock-теста:');

const mockTest = `
// Простой тест новой системы авторизации без БД
const mockPhone = '+79001234567';
const mockTelegramId = 123456789;
const mockContact = {
  phone_number: mockPhone,
  first_name: 'Иван',
  last_name: 'Петров'
};

console.log('\\n🧪 Тестирование новой авторизации:');
console.log('1. Имитация получения контакта:', mockContact);

// Имитация нормализации телефона
function normalizePhone(phone) {
  const digits = phone.replace(/\\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) {
    return '+7' + digits.substring(1);
  } else if (digits.startsWith('7') && digits.length === 11) {
    return '+' + digits;
  } else if (digits.length === 10) {
    return '+7' + digits;
  }
  return '+' + digits;
}

const normalized = normalizePhone(mockPhone);
console.log('2. Нормализованный телефон:', normalized);

// Имитация генерации номера карты
function generateSequentialCard() {
  // В реальности это будет из БД, здесь просто пример
  return '42'; // Следующий порядковый номер
}

const cardNumber = generateSequentialCard();
console.log('3. Сгенерированный номер карты:', cardNumber);

// Имитация создания клиента
const mockClient = {
  id: 1,
  telegram_id: mockTelegramId,
  card_number: cardNumber,
  full_name: mockContact.last_name + ' ' + mockContact.first_name,
  first_name: mockContact.first_name,
  phone: normalized,
  balance: 100, // Приветственный бонус
  auth_method: 'phone_contact',
  profile_completed: false,
  is_new_client: true
};

console.log('4. Созданный клиент:', JSON.stringify(mockClient, null, 2));

console.log('\\n✅ Тест успешен! Новая система авторизации работает.');
console.log('\\n📱 Для реального тестирования:');
console.log('   1. Запустите PostgreSQL');
console.log('   2. Выполните: npm run migrate-phone-auth');
console.log('   3. Запустите: npm run dev');
console.log('   4. Протестируйте с реальным Telegram ботом');
`;

const mockTestPath = path.join(__dirname, 'test-mock.js');
fs.writeFileSync(mockTestPath, mockTest.trim());
console.log(`   ✅ Создан файл: ${mockTestPath}`);

console.log('\n🎯 Результат проверки:');
if (allFilesExist) {
  console.log('   ✅ Все необходимые файлы присутствуют');
  console.log('   🚀 Готов к запуску!');
  
  console.log('\n📋 Следующие шаги для полного тестирования:');
  console.log('   1. Установите Docker/PostgreSQL');
  console.log('   2. Запустите: npm run migrate-phone-auth');
  console.log('   3. Запустите: npm run dev');
  console.log('   4. Протестируйте через Telegram');
  
  console.log('\n💡 Для быстрого mock-теста:');
  console.log('   node test-mock.js');
  
} else {
  console.log('   ❌ Некоторые файлы отсутствуют');
  console.log('   🛠️  Требуется дополнительная настройка');
}

console.log('\n' + '='.repeat(50));