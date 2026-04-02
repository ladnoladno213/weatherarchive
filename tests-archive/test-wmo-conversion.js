// Тест конвертации WMO кодов в текст
const { WW, W_PAST } = require('./data/wmo-codes');

console.log('=== Тест конвертации WMO кодов ===\n');

// Тестируем WW коды
const testWW = ['95', '66', '80', '65', '61', '63', '75', '71', '73', '45', '10'];
console.log('WW коды (текущая погода):');
testWW.forEach(code => {
  const text = WW[parseInt(code)];
  console.log(`  ${code} -> ${text || 'НЕ НАЙДЕНО'}`);
});

console.log('\nW коды (прошедшая погода):');
const testW = ['6', '7', '9', '17'];
testW.forEach(code => {
  const text = W_PAST[parseInt(code)];
  console.log(`  ${code} -> ${text || 'НЕ НАЙДЕНО'}`);
});

console.log('\n=== Тест завершён ===');
