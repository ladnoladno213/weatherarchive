/**
 * Тест ICON Historical Forecast API для данных о грозах
 * Проверяет получение lightning_potential и weather_code
 */

const fetch = require('node-fetch');

async function testICONLightning() {
  try {
    // Координаты Москвы
    const lat = 55.7558;
    const lon = 37.6173;
    const startDate = '2026-03-25';
    const endDate = '2026-04-01';
    
    const hourly = [
      'weather_code',
      'lightning_potential',
      'cape',
      'precipitation',
      'showers'
    ].join(',');
    
    // Historical Forecast API с моделью ICON (доступно с 2022-11-24)
    const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&models=icon_global`;
    
    console.log('Запрос к ICON Historical Forecast API...');
    console.log('URL:', url);
    console.log('');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('HTTP ошибка:', response.status);
      const text = await response.text();
      console.error('Ответ:', text);
      return;
    }
    
    const data = await response.json();
    
    console.log('=== МЕТАДАННЫЕ ===');
    console.log('Timezone:', data.timezone);
    console.log('Elevation:', data.elevation, 'm');
    console.log('');
    
    console.log('=== ДАННЫЕ ===');
    console.log(`Всего записей: ${data.hourly?.time?.length || 0}`);
    console.log('');
    
    if (data.hourly && data.hourly.time) {
      const times = data.hourly.time;
      const lightning = data.hourly.lightning_potential || [];
      const cape = data.hourly.cape || [];
      const weatherCode = data.hourly.weather_code || [];
      const precip = data.hourly.precipitation || [];
      const showers = data.hourly.showers || [];
      
      console.log('Первые 10 записей:');
      for (let i = 0; i < Math.min(10, times.length); i++) {
        console.log(`\n${i + 1}. ${times[i]}`);
        console.log(`   Weather code: ${weatherCode[i]}`);
        console.log(`   Lightning potential: ${lightning[i]} J/kg`);
        console.log(`   CAPE: ${cape[i]} J/kg`);
        console.log(`   Precipitation: ${precip[i]} mm`);
        console.log(`   Showers: ${showers[i]} mm`);
      }
      
      // Ищем периоды с грозами
      console.log('\n=== ПЕРИОДЫ С ГРОЗАМИ ===');
      let thunderstormCount = 0;
      for (let i = 0; i < times.length; i++) {
        const hasLightning = lightning[i] > 0;
        const hasThunderstorm = weatherCode[i] >= 95 && weatherCode[i] <= 99;
        const highCAPE = cape[i] > 500;
        
        if (hasLightning || hasThunderstorm) {
          thunderstormCount++;
          console.log(`\n${times[i]}`);
          console.log(`  Lightning: ${lightning[i]} J/kg`);
          console.log(`  CAPE: ${cape[i]} J/kg`);
          console.log(`  Weather code: ${weatherCode[i]}`);
          console.log(`  Precipitation: ${precip[i]} mm`);
        }
      }
      
      console.log(`\n\nВсего периодов с грозами: ${thunderstormCount} из ${times.length}`);
      
      // Статистика
      const maxLightning = Math.max(...lightning.filter(v => v != null));
      const maxCAPE = Math.max(...cape.filter(v => v != null));
      console.log(`\nМаксимальный lightning_potential: ${maxLightning} J/kg`);
      console.log(`Максимальный CAPE: ${maxCAPE} J/kg`);
    }
    
  } catch (e) {
    console.error('Ошибка:', e.message);
  }
}

testICONLightning();
