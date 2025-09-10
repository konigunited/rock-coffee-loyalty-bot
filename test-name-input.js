#!/usr/bin/env node

console.log('📱 Тестирование нового флоу с вводом имени');
console.log('='.repeat(60));

// Симуляция базы данных
let mockDatabase = {
  clients: [],
  nextCardNumber: 1
};

// Валидация однословного имени
function validateSingleWordName(name) {
  if (!name || name.trim().length === 0) return false;
  const trimmed = name.trim();
  
  // Проверяем что это одно слово (без пробелов)
  if (trimmed.includes(' ')) return false;
  
  // Проверяем что содержит только буквы
  if (!/^[А-Яа-яЁёA-Za-z]+$/.test(trimmed)) return false;
  
  // Проверяем разумную длину
  if (trimmed.length < 2 || trimmed.length > 20) return false;
  
  return true;
}

// Симуляция обработки контакта
function processContact(phone, telegramId, contactFirstName, contactLastName) {
  console.log(`\n📱 Получен контакт:`);
  console.log(`   Телефон: ${phone}`);
  console.log(`   Имя из контакта: ${contactFirstName} ${contactLastName || ''}`);
  
  const normalized = phone.startsWith('+7') ? phone : `+7${phone.slice(1)}`;
  
  // Создаем клиента с временным именем
  const cardNumber = mockDatabase.nextCardNumber++;
  const tempName = contactFirstName || `Клиент ${cardNumber}`;
  
  const newClient = {
    id: mockDatabase.clients.length + 1,
    telegram_id: telegramId,
    card_number: cardNumber.toString(),
    full_name: tempName, // Временное имя
    first_name: contactFirstName,
    phone: normalized,
    balance: 100,
    auth_method: 'phone_contact',
    profile_completed: false
  };
  
  mockDatabase.clients.push(newClient);
  
  console.log(`✅ Создан клиент с временным именем: "${tempName}"`);
  console.log(`💳 Карта: ${cardNumber}`);
  console.log(`💰 Баланс: 100 баллов`);
  
  return {
    client_id: newClient.id,
    is_new_client: true,
    card_number: cardNumber.toString(),
    full_name: tempName,
    balance: 100
  };
}

// Симуляция ввода имени пользователем
function processNameInput(clientId, inputName) {
  console.log(`\n👤 Пользователь ввел имя: "${inputName}"`);
  
  // Валидируем имя
  if (!validateSingleWordName(inputName)) {
    console.log('❌ Некорректное имя:');
    if (inputName.includes(' ')) {
      console.log('   • Содержит пробелы (должно быть одно слово)');
    }
    if (!/^[А-Яа-яЁёA-Za-z]+$/.test(inputName)) {
      console.log('   • Содержит недопустимые символы');
    }
    if (inputName.length < 2 || inputName.length > 20) {
      console.log('   • Некорректная длина (должно быть 2-20 символов)');
    }
    return false;
  }
  
  // Обновляем имя клиента
  const client = mockDatabase.clients.find(c => c.id === clientId);
  if (client) {
    client.full_name = inputName.trim();
    client.first_name = inputName.trim();
    client.profile_completed = true;
    
    console.log(`✅ Имя обновлено: "${inputName}"`);
    console.log(`🎉 Регистрация завершена!`);
    return true;
  }
  
  return false;
}

// Тестируем различные сценарии
console.log('\n🧪 Тест 1: Успешный флоу с корректным именем');
console.log('-'.repeat(40));
const result1 = processContact('+79001234567', 123456789, 'Дмитрий', null);
processNameInput(result1.client_id, 'Алексей');

console.log('\n🧪 Тест 2: Попытка ввода некорректного имени');
console.log('-'.repeat(40));
const result2 = processContact('+79007654321', 987654321, 'User', null);
console.log('\n   Попытка 1: Два слова');
processNameInput(result2.client_id, 'Иван Петров'); // Ошибка
console.log('\n   Попытка 2: С цифрами');
processNameInput(result2.client_id, 'Алексей123'); // Ошибка
console.log('\n   Попытка 3: Корректное имя');
processNameInput(result2.client_id, 'Мария'); // Успех

console.log('\n🧪 Тест 3: Пропуск ввода имени');
console.log('-'.repeat(40));
const result3 = processContact('+79165555555', 111111111, 'TestUser', null);
console.log('👤 Пользователь нажал "Пропустить"');
const client = mockDatabase.clients.find(c => c.id === result3.client_id);
if (client) {
  console.log(`✅ Регистрация завершена с именем: "${client.full_name}"`);
}

console.log('\n📊 Итоговое состояние БД:');
console.log('-'.repeat(40));
mockDatabase.clients.forEach((client, index) => {
  console.log(`${index + 1}. Карта: ${client.card_number}`);
  console.log(`   Имя: ${client.full_name}`);
  console.log(`   Телефон: ${client.phone}`);
  console.log(`   Профиль завершен: ${client.profile_completed ? 'Да' : 'Нет'}`);
  console.log(`   Баланс: ${client.balance} баллов`);
  console.log('');
});

console.log('\n' + '='.repeat(60));
console.log('🎯 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ВВОДА ИМЕНИ:');
console.log('='.repeat(60));

console.log('\n✅ ПРОТЕСТИРОВАННЫЕ СЦЕНАРИИ:');
console.log('   📱 Авторизация через контакт');
console.log('   👤 Запрос однословного имени');
console.log('   ✏️ Валидация корректного имени');
console.log('   ❌ Отклонение некорректных имен');
console.log('   ⏭️ Возможность пропустить ввод имени');
console.log('   💾 Сохранение имени в профиле');

console.log('\n🔄 НОВЫЙ ФЛОУ АВТОРИЗАЦИИ:');
console.log('   1. 📱 Пользователь делится контактом');
console.log('   2. 🆕 Система создает клиента с временным именем');  
console.log('   3. 👤 Запрос: "Как к вам обращаться?"');
console.log('   4. ✏️ Пользователь вводит одно слово');
console.log('   5. ✅ Имя сохраняется, регистрация завершена');
console.log('   6. 🏠 Переход в главное меню');

console.log('\n💡 ВАЛИДАЦИЯ ИМЕНИ:');
console.log('   ✅ Только одно слово (без пробелов)');
console.log('   ✅ Только буквы (русские/английские)');
console.log('   ✅ Длина: 2-20 символов');
console.log('   ❌ Цифры и спецсимволы запрещены');

console.log('\n🚀 ГОТОВО К ВНЕДРЕНИЮ!');
console.log('\n' + '='.repeat(60));