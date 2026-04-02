// Простой тест METAR API
const https = require('https');

const icao = 'UUEE'; // Шереметьево
const hours = 24;
const url = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=${hours}`;

console.log(`Запрос: ${url}\n`);

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const metarData = JSON.parse(data);
      console.log(`Получено наблюдений: ${metarData.length}`);
      if (metarData.length > 0) {
        console.log(`\nПервое наблюдение:`);
        console.log(`  Время (UTC): ${metarData[0].obsTime}`);
        console.log(`  Температура: ${metarData[0].temp}°C`);
        console.log(`  Ветер: ${metarData[0].wspd} узлов`);
        console.log(`  Погода: ${metarData[0].wxString || 'нет'}`);
        
        // Проверяем часы
        const hours = metarData.map(m => new Date(m.obsTime).getUTCHours());
        console.log(`\nЧасы наблюдений (UTC): ${hours.join(', ')}`);
      }
    } catch (e) {
      console.error('Ошибка парсинга:', e.message);
      console.log('Ответ:', data.substring(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('Ошибка запроса:', err.message);
});
