/**
 * Тест Meteostat API
 * Проверяет получение реальных наблюдений с метеостанций
 */

const fetch = require('node-fetch');

async function testMeteostat() {
  try {
    // Координаты Москвы
    const lat = 55.7558;
    const lon = 37.6173;
    const startDate = '2026-03-25';
    const endDate = '2026-04-01';
    const timezone = 'Europe/Moscow';
    
    const apiKey = '36bd019135msh5c8f0fbfab2e82bp1db9c3jsn7b3822fce9cf';
    
    const url = `https://meteostat.p.rapidapi.com/point/hourly?lat=${lat}&lon=${lon}&start=${startDate}&end=${endDate}&tz=${encodeURIComponent(timezone)}`;
    
    console.log('Запрос к Meteostat API...');
    console.log('URL:', url);
    console.log('');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'meteostat.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });
    
    if (!response.ok) {
      console.error('HTTP ошибка:', response.status);
      const text = await response.text();
      console.error('Ответ:', text);
      return;
    }
    
    const data = await response.json();
    
    console.log('=== МЕТАДАННЫЕ ===');
    console.log(JSON.stringify(data.meta, null, 2));
    console.log('');
    
    console.log('=== ДАННЫЕ ===');
    console.log(`Всего записей: ${data.data?.length || 0}`);
    console.log('');
    
    if (data.data && data.data.length > 0) {
      console.log('Первые 5 записей:');
      data.data.slice(0, 5).forEach((record, i) => {
        console.log(`\n${i + 1}. ${record.time}`);
        console.log(`   Температура: ${record.temp}°C`);
        console.log(`   Точка росы: ${record.dwpt}°C`);
        console.log(`   Влажность: ${record.rhum}%`);
        console.log(`   Давление: ${record.pres} гПа (${Math.round(record.pres * 0.750064)} мм рт.ст.)`);
        console.log(`   Ветер: ${record.wspd} км/ч (${Math.round(record.wspd / 3.6)} м/с), направление ${record.wdir}°`);
        console.log(`   Порывы: ${record.wpgt} км/ч`);
        console.log(`   Осадки: ${record.prcp} мм`);
        console.log(`   Снег: ${record.snow} мм`);
        console.log(`   Код погоды: ${record.coco}`);
      });
      
      console.log('\n=== СТАТИСТИКА ===');
      const temps = data.data.filter(r => r.temp != null).map(r => r.temp);
      const minTemp = Math.min(...temps);
      const maxTemp = Math.max(...temps);
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      
      console.log(`Температура: мин ${minTemp}°C, макс ${maxTemp}°C, средняя ${avgTemp.toFixed(1)}°C`);
      
      const uniqueDates = [...new Set(data.data.map(r => r.time.slice(0, 10)))];
      console.log(`Уникальных дат: ${uniqueDates.length}`);
      console.log('Даты:', uniqueDates.join(', '));
    }
    
  } catch (e) {
    console.error('Ошибка:', e.message);
  }
}

testMeteostat();
