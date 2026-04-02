// Тест часов в прогнозе погоды
const fetch = require('node-fetch');

async function testForecast() {
  try {
    console.log('Тестируем прогноз для Ишима (UTC+5)...\n');
    
    const response = await fetch('http://localhost:3000/weather?city=Ишим');
    const html = await response.text();
    
    // Ищем часы в прогнозе
    const timeMatches = html.match(/class="time-label">(\d{2}):(\d{2})</g);
    
    if (timeMatches) {
      console.log('Найденные часы в прогнозе:');
      const hours = timeMatches.map(m => {
        const match = m.match(/(\d{2}):(\d{2})/);
        return match ? match[1] : null;
      }).filter((h, i, arr) => arr.indexOf(h) === i); // уникальные
      
      console.log(hours.join(', '));
      console.log('\nОжидаемые часы для UTC+5: 05, 11, 17, 23');
      
      const expected = ['05', '11', '17', '23'];
      const hasAll = expected.every(h => hours.includes(h));
      
      if (hasAll) {
        console.log('✅ Все ожидаемые часы присутствуют!');
      } else {
        console.log('❌ Не все часы найдены');
      }
    } else {
      console.log('❌ Часы не найдены в HTML');
    }
    
  } catch (e) {
    console.error('Ошибка:', e.message);
  }
}

testForecast();
