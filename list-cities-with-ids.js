const fs = require('fs');
const path = require('path');

// Загружаем список всех городов
const citiesPath = path.join(__dirname, 'data', 'cities.json');
const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));

console.log('Список городов с ID (отсортировано по населению)\n');
console.log('='.repeat(100));
console.log('ID'.padEnd(12) + 'Название'.padEnd(30) + 'Название (EN)'.padEnd(30) + 'Население'.padEnd(15) + 'Страна');
console.log('='.repeat(100));

// Сортируем по населению
const sortedCities = cities
  .filter(c => c.pop > 0) // Только города с известным населением
  .sort((a, b) => b.pop - a.pop);

// Выводим топ-200 городов
sortedCities.slice(0, 200).forEach(c => {
  const id = c.id.toString().padEnd(12);
  const nameRu = (c.nameRu || c.name).padEnd(30);
  const nameEn = c.name.padEnd(30);
  const pop = c.pop.toLocaleString('ru-RU').padEnd(15);
  const country = c.cc;
  
  console.log(`${id}${nameRu}${nameEn}${pop}${country}`);
});

console.log('\n' + '='.repeat(100));
console.log(`Всего городов в базе: ${cities.length}`);
console.log(`Показано топ-200 по населению`);

// Сохраняем в файл для удобства
const output = sortedCities.slice(0, 200).map(c => ({
  id: c.id,
  nameRu: c.nameRu || c.name,
  nameEn: c.name,
  population: c.pop,
  country: c.cc,
  lat: c.lat,
  lon: c.lon,
}));

fs.writeFileSync('cities-list.json', JSON.stringify(output, null, 2), 'utf8');
console.log('\nСписок также сохранён в файл: cities-list.json');
