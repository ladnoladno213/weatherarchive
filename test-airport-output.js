// Тест архива аэропорта с выводом в файл
const http = require('http');
const fs = require('fs');

const airportId = 9000001; // Шереметьево
const url = `http://localhost:3000/archive?id=${airportId}&period=1`;

console.log(`Testing: ${url}`);

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const result = {
      status: res.statusCode,
      length: data.length,
      hasTable: data.includes('<table'),
      hasRows: data.includes('class="archiveRow"'),
      dataSource: (data.match(/Источник данных: ([^<]+)/) || [])[1],
    };
    
    // Извлекаем часы из таблицы
    const timeMatches = data.match(/class="time">(\d{2})<\/div>/g);
    if (timeMatches) {
      result.hours = timeMatches.map(m => m.match(/(\d{2})/)[1]).join(', ');
    }
    
    // Извлекаем температуры
    const tempMatches = data.match(/class="T">(-?\d+)/g);
    if (tempMatches) {
      result.tempCount = tempMatches.length;
      result.temps = tempMatches.slice(0, 5).map(m => m.match(/(-?\d+)/)[1]).join(', ');
    }
    
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync('test-airport-result.json', JSON.stringify(result, null, 2));
    console.log('\nResult saved to test-airport-result.json');
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
