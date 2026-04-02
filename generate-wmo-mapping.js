const fs = require('fs');
const path = require('path');
const { generateWMOMapping, saveMappingToFile } = require('./rp5-station-finder');

async function main() {
  console.log('Генерация маппинга WMO ID для всех городов на сайте...\n');
  
  // Загружаем список всех городов напрямую из cities.json
  const citiesPath = path.join(__dirname, 'data', 'cities.json');
  const allCities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
  console.log(`Всего городов в базе: ${allCities.length}\n`);
  
  // Преобразуем в нужный формат
  const cities = allCities.map(c => ({
    geonameId: c.id.toString(), // ID из cities.json
    name: c.nameRu || c.name,   // Используем русское название если есть
    lat: c.lat,
    lon: c.lon,
    population: c.pop || 0,
    country_code: c.cc,
  }));
  
  // Берём только крупные города (population > 50000) для начала
  const largeCities = cities.filter(c => c.population > 50000);
  console.log(`Крупных городов (> 50k): ${largeCities.length}\n`);
  
  // Или можно взять топ-100 по населению
  const topCities = cities
    .sort((a, b) => b.population - a.population)
    .slice(0, 100);
  
  console.log('Топ-100 городов по населению:\n');
  topCities.slice(0, 10).forEach((c, i) => {
    console.log(`${i+1}. ${c.name} (${c.population.toLocaleString()})`);
  });
  console.log('...\n');
  
  // Генерируем маппинг
  const { mapping, cityNames } = await generateWMOMapping(topCities);
  
  // Сохраняем в файл
  saveMappingToFile(mapping, cityNames, 'data/wmo-mapping.js');
  
  console.log('\n='.repeat(80));
  console.log(`Готово! Найдено станций: ${Object.keys(mapping).length} из ${topCities.length}`);
  console.log('Файл сохранён: data/wmo-mapping.js');
  console.log('\nТеперь система автоматически будет использовать RP5 данные для этих городов!');
}

main().catch(console.error);
