const { searchRP5Stations } = require('./rp5-station-finder');

async function test() {
  console.log('Тестирование поиска станций RP5...\n');
  
  // Тестируем поиск для известного города
  const cities = ['Москва', 'Ишим', 'Санкт-Петербург'];
  
  for (const city of cities) {
    console.log(`\nПоиск станций для: ${city}`);
    console.log('='.repeat(80));
    
    const stations = await searchRP5Stations(city);
    console.log(`Найдено станций: ${stations.length}`);
    
    if (stations.length > 0) {
      console.log('\nПервые 3 результата:');
      stations.slice(0, 3).forEach((s, i) => {
        console.log(`\n${i+1}.`);
        console.log(JSON.stringify(s, null, 2));
      });
    } else {
      console.log('Станции не найдены');
    }
    
    // Задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

test().catch(console.error);
