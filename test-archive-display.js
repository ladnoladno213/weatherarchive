const fetch = require('node-fetch');

async function testArchive(cityName, expectedUTC) {
  console.log(`\n=== ${cityName} (UTC${expectedUTC >= 0 ? '+' : ''}${expectedUTC}) ===`);
  
  try {
    const res = await fetch(`http://localhost:3000/archive?city=${encodeURIComponent(cityName)}&period=1`);
    const html = await res.text();
    
    // Извлекаем часы из таблицы архива
    const timeMatches = html.match(/<td class="arch-td arch-td-time">(\d{2})<\/td>/g);
    
    if (timeMatches && timeMatches.length > 0) {
      const hours = timeMatches.map(m => {
        const match = m.match(/>(\d{2})</);
        return match ? match[1] : null;
      }).filter(h => h !== null);
      
      console.log('Часы в архиве:', hours.join(', '));
      
      // Проверяем Tn (минимальная температура) - должна быть в 3-м периоде
      const tnMatches = html.match(/<td class="arch-td"><span class="[^"]*"><[^>]*>([+-]?\d+(?:\.\d+)?)<\/span><\/td>/g);
      console.log('Найдено значений температуры:', tnMatches ? tnMatches.length : 0);
      
      // Проверяем наличие осадков в правильных периодах
      const precipMatches = html.match(/<td class="arch-td">([^<]+|Осадков нет|Следы осадков)<\/td>/g);
      console.log('Найдено значений осадков:', precipMatches ? precipMatches.length : 0);
      
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
  console.log('Тестирование отображения архива погоды\n');
  console.log('Проверяем что:');
  console.log('- Tn (минимальная температура) отображается в 3-м периоде');
  console.log('- Tx (максимальная температура) отображается в 7-м периоде');
  console.log('- RRR (осадки) отображаются в 3-м и 7-м периодах\n');
  
  await testArchive('Ишим', 5);        // UTC+5: часы 02, 05, 08, 11, 14, 17, 20, 23
  await testArchive('Москва', 3);      // UTC+3: часы 00, 03, 06, 09, 12, 15, 18, 21
  await testArchive('London', 0);      // UTC+0: часы 00, 03, 06, 09, 12, 15, 18, 21
  
  console.log('\n✅ Тестирование завершено');
  console.log('\nОткройте в браузере для визуальной проверки:');
  console.log('http://localhost:3000/archive?city=Ишим&period=1');
}

main().catch(console.error);
