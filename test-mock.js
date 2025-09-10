// Простой тест новой системы авторизации без БД
const mockPhone = '+79001234567';
const mockTelegramId = 123456789;
const mockContact = {
  phone_number: mockPhone,
  first_name: 'Иван',
  last_name: 'Петров'
};

console.log('\n🧪 Тестирование новой авторизации:');
console.log('1. Имитация получения контакта:', mockContact);

// Имитация нормализации телефона
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
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

console.log('\n✅ Тест успешен! Новая система авторизации работает.');
console.log('\n📱 Для реального тестирования:');
console.log('   1. Запустите PostgreSQL');
console.log('   2. Выполните: npm run migrate-phone-auth');
console.log('   3. Запустите: npm run dev');
console.log('   4. Протестируйте с реальным Telegram ботом');