const fetch = require('node-fetch');

async function testCity(cityName, expectedUTC) {
  console.log(`\n=== ${cityName} (UTC${expectedUTC >= 0 ? '+' : ''}${expectedUTC}) ===`);
  
  try {
    const res = await fetch(`http://localhost:3000/weather?city=${encodeURIComponent(cityName)}`);
    const html = await res.text();
    
    // Извлекаем часы из строки времени в таблице
    const timeMatches = html.match(/<td class="cell-[dn][^"]*"[^>]*>(\d{2})<\/td>/g);
    
    if (timeMatches && timeMatches.length > 0) {
      const hours = timeMatches.slice(0, 10).map(m => {
        const match = m.match(/>(\d{2})</);
        return match ? match[1] : null;
      }).filter(h => h !== null);
      
      console.log('Часы в прогнозе:', hours.join(', '));
      return hours;
    } else {
      console.log('❌ Часы не найдены в HTML');
      return [];
    }
  } catch (e) {
    console.error('Ошибка:', e.message);
    return [];
  }
}

async function main() {
  console.log('Тестирование отображения часов в прогнозе погоды\n');
  
  await testCity('Москва', 3);      // UTC+3: должно быть 03, 09, 15, 21
  await testCity('London', 0);      // UTC+0: должно быть 03, 09, 15, 21
  await testCity('Tokyo', 9);       // UTC+9: должно быть 03, 09, 15, 21
  await testCity('Ишим', 5);        // UTC+5: должно быть 05, 11, 17, 23
  await testCity('New York', -5);   // UTC-5: должно быть 01, 07, 13, 19
  
  console.log('\n✅ Тестирование завершено');
}

main().catch(console.error);
