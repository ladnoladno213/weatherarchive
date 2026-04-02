const fs = require('fs');
const path = require('path');

// Загружаем список всех городов
const citiesPath = path.join(__dirname, 'data', 'cities.json');
const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));

console.log('Список городов России с ID (отсортировано по населению)\n');
console.log('='.repeat(100));
console.log('ID'.padEnd(12) + 'Название'.padEnd(35) + 'Название (EN)'.padEnd(30) + 'Население');
console.log('='.repeat(100));

// Фильтруем только Россию
const russianCities = cities
  .filter(c => c.cc === 'RU')
  .sort((a, b) => (b.pop || 0) - (a.pop || 0));

console.log(`\nВсего городов России: ${russianCities.length}\n`);

// Выводим все города России
russianCities.forEach((c, i) => {
  const id = c.id.toString().padEnd(12);
  const nameRu = (c.nameRu || c.name).padEnd(35);
  const nameEn = c.name.padEnd(30);
  const pop = (c.pop || 0).toLocaleString('ru-RU');
  
  console.log(`${id}${nameRu}${nameEn}${pop}`);
});

console.log('\n' + '='.repeat(100));

// Сохраняем в файл для удобства
const output = russianCities.map(c => ({
  id: c.id,
  nameRu: c.nameRu || c.name,
  nameEn: c.name,
  population: c.pop || 0,
  lat: c.lat,
  lon: c.lon,
}));

fs.writeFileSync('russian-cities-list.json', JSON.stringify(output, null, 2), 'utf8');
console.log('\nСписок также сохранён в файл: russian-cities-list.json');
console.log('Теперь можно искать WMO ID для этих городов на http://rp5.ru');
