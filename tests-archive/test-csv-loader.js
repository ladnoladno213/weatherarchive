const { loadRP5CSV } = require('./rp5-csv-loader');

// Тестируем загрузку CSV для Ишима
const data = loadRP5CSV('28573.01.02.2005.31.03.2026.1.0.0.ru.utf8.00000000.csv', '1505453');

console.log('\nПримеры загруженных данных:');
console.log('='.repeat(80));

// Показываем несколько записей с реальными данными
const keys = Array.from(data.keys()).slice(0, 5);
keys.forEach(key => {
  const row = data.get(key);
  console.log(`\n${key}:`);
  console.log(`  T=${row.T}, Pa=${row.Pa}, U=${row.U}, Ff=${row.Ff}`);
  console.log(`  WW="${row.WW}"`);
  console.log(`  W1="${row.W1}"`);
  console.log(`  W2="${row.W2}"`);
});

// Проверяем конкретную дату из CSV (31 марта 2026, 08:00)
console.log('\n' + '='.repeat(80));
console.log('Проверка 31 марта 2026, 08:00:');
const testKey = '2026-03-31_08';
if (data.has(testKey)) {
  const row = data.get(testKey);
  console.log(JSON.stringify(row, null, 2));
} else {
  console.log('Данные не найдены');
}

// Проверяем дату с явлениями (например, 2024 год)
console.log('\n' + '='.repeat(80));
console.log('Ищем записи с явлениями (WW не пустой):');
let count = 0;
for (const [key, row] of data.entries()) {
  if (row.WW && row.WW !== ' ' && count < 5) {
    console.log(`\n${key}:`);
    console.log(`  T=${row.T}, U=${row.U}`);
    console.log(`  WW="${row.WW}"`);
    console.log(`  W1="${row.W1}"`);
    console.log(`  W2="${row.W2}"`);
    count++;
  }
}
