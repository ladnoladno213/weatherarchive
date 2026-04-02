// Тест вычисления целевых часов для разных UTC
const { getTargetHours } = require('./weather');

console.log('Тестирование целевых часов:\n');

const testCases = [
  { utc: 0, name: 'UTC+0' },
  { utc: 1, name: 'UTC+1' },
  { utc: 2, name: 'UTC+2' },
  { utc: 3, name: 'UTC+3' },
  { utc: 4, name: 'UTC+4' },
  { utc: 5, name: 'UTC+5' },
  { utc: 6, name: 'UTC+6' },
  { utc: 7, name: 'UTC+7' },
  { utc: 8, name: 'UTC+8' },
  { utc: 9, name: 'UTC+9' },
  { utc: 10, name: 'UTC+10' },
  { utc: 11, name: 'UTC+11' },
  { utc: 11.5, name: 'UTC+11:30' },
  { utc: 12, name: 'UTC+12' },
];

testCases.forEach(({ utc, name }) => {
  const archive = getTargetHours(utc, false);
  const forecast = getTargetHours(utc, true);
  
  console.log(`${name}:`);
  console.log(`  Архив (8):   ${archive.map(h => String(h).padStart(2, '0')).join(', ')}`);
  console.log(`  Прогноз (4): ${forecast.map(h => String(h).padStart(2, '0')).join(', ')}`);
  console.log('');
});

// Проверяем конкретные примеры из требований
console.log('\nПроверка примеров из требований:');

const checks = [
  { utc: 0, archive: [0, 3, 6, 9, 12, 15, 18, 21], forecast: [3, 9, 15, 21] },
  { utc: 2, archive: [2, 5, 8, 11, 14, 17, 20, 23], forecast: [5, 11, 17, 23] },
  { utc: 5, archive: [2, 5, 8, 11, 14, 17, 20, 23], forecast: [5, 11, 17, 23] },
  { utc: 11.5, archive: [2.5, 5.5, 8.5, 11.5, 14.5, 17.5, 20.5, 23.5], forecast: [5.5, 11.5, 17.5, 23.5] },
];

let allCorrect = true;
checks.forEach(({ utc, archive: expected, forecast: expectedForecast }) => {
  const archive = getTargetHours(utc, false);
  const forecast = getTargetHours(utc, true);
  
  // Для дробных часов округляем для сравнения
  const archiveStr = archive.map(h => h.toFixed(1)).join(',');
  const expectedStr = expected.map(h => h.toFixed(1)).join(',');
  const forecastStr = forecast.map(h => h.toFixed(1)).join(',');
  const expectedForecastStr = expectedForecast.map(h => h.toFixed(1)).join(',');
  
  const archiveOk = archiveStr === expectedStr;
  const forecastOk = forecastStr === expectedForecastStr;
  
  if (!archiveOk || !forecastOk) {
    console.log(`❌ UTC+${utc}:`);
    if (!archiveOk) {
      console.log(`  Архив: ожидалось [${expectedStr}], получено [${archiveStr}]`);
    }
    if (!forecastOk) {
      console.log(`  Прогноз: ожидалось [${expectedForecastStr}], получено [${forecastStr}]`);
    }
    allCorrect = false;
  } else {
    console.log(`✅ UTC+${utc}: OK`);
  }
});

if (allCorrect) {
  console.log('\n✅ Все проверки прошли успешно!');
} else {
  console.log('\n❌ Есть ошибки в вычислениях!');
}
