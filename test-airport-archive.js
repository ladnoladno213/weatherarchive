// Тест архива погоды для аэропорта
const http = require('http');

// Тестируем Шереметьево (Москва, UTC+3)
const airportId = 9000001;
const url = `http://localhost:3000/archive?id=${airportId}&period=1`;

console.log(`Тестируем архив аэропорта: ${url}`);
console.log('');

http.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Статус: ${res.statusCode}`);
    console.log(`Длина ответа: ${data.length} символов`);
    
    // Проверяем наличие данных в таблице
    const hasTable = data.includes('<table');
    const hasData = data.includes('class="archiveRow"');
    const filteredRows = data.match(/Filtered rows: (\d+)/);
    
    console.log(`Таблица найдена: ${hasTable}`);
    console.log(`Строки данных найдены: ${hasData}`);
    if (filteredRows) {
      console.log(`Количество отфильтрованных строк: ${filteredRows[1]}`);
    }
    
    // Проверяем наличие времени в таблице
    const timeMatches = data.match(/time">(\d{2})<\/div>/g);
    if (timeMatches) {
      const times = timeMatches.map(m => m.match(/(\d{2})/)[1]);
      console.log(`Найденные часы: ${times.join(', ')}`);
    } else {
      console.log('Часы не найдены в таблице');
    }
    
    // Проверяем наличие температуры
    const tempMatches = data.match(/class="T">(-?\d+)/g);
    if (tempMatches) {
      console.log(`Найдено значений температуры: ${tempMatches.length}`);
    } else {
      console.log('Температура не найдена');
    }
  });
}).on('error', (err) => {
  console.error('Ошибка запроса:', err.message);
});
