const fs = require('fs');

// Читаем первые 20 строк CSV файла
const content = fs.readFileSync('28573.01.02.2005.31.03.2026.1.0.0.ru.utf8.00000000.csv', 'utf8');
const lines = content.split('\n').slice(0, 20);

console.log('Первые 20 строк CSV файла:');
console.log('='.repeat(80));
lines.forEach((line, i) => {
  console.log(`${i}: ${line}`);
});
