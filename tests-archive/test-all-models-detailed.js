/**
 * Детальный тест всех моделей для определения гроз
 * Проверяем, какие модели возвращают данные и какие коды погоды
 */

const fetch = require('node-fetch');

async function testSingleModel(model, lat, lon, startDate, endDate) {
  const hourly = [
    'weather_code',
    'cape',
    'precipitation',
    'showers'
  ].join(',');
  
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&models=${model}`;
  
  console.log(`\n=== Тестируем модель: ${model.toUpperCase()} ===`);
  console.log(`URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, { timeout: 20000 });
    const elapsed = Date.now() - startTime;
    
    console.log(`Статус: ${response.status}`);
    console.log(`Время ответа: ${elapsed}ms`);
    
    if (!response.ok) {
      console.log(`❌ HTTP ошибка: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API ошибка: ${data.reason}`);
      return null;
    }
    
    if (!data.hourly || !data.hourly.time) {
      console.log(`❌ Нет почасовых данных`);
      return null;
    }
    
    console.log(`✅ Данные получены`);
    console.log(`Записей: ${data.hourly.time.length}`);
    console.log(`Timezone: ${data.timezone}`);
    
    // Анализируем коды погоды
    const weatherCodes = data.hourly.weather_code || [];
    const uniqueCodes = [...new Set(weatherCodes.filter(c => c != null))];
    console.log(`Уникальные коды погоды: ${uniqueCodes.sort((a,b) => a-b).join(', ')}`);
    
    // Ищем грозы (коды 95-99)
    const thunderstormIndices = [];
    for (let i = 0; i < weatherCodes.length; i++) {
      if (weatherCodes[i] >= 95 && weatherCodes[i] <= 99) {
        thunderstormIndices.push(i);
      }
    }
    
    if (thunderstormIndices.length > 0) {
      console.log(`⚡ Найдено гроз: ${thunderstormIndices.length}`);
      console.log(`Периоды с грозами:`);
      thunderstormIndices.slice(0, 5).forEach(idx => {
        const time = data.hourly.time[idx];
        const code = weatherCodes[idx];
        const cape = data.hourly.cape?.[idx];
        const precip = data.hourly.precipitation?.[idx];
        const showers = data.hourly.showers?.[idx];
        console.log(`  ${time}: code=${code}, CAPE=${cape}, precip=${precip}, showers=${showers}`);
      });
      if (thunderstormIndices.length > 5) {
        console.log(`  ... и ещё ${thunderstormIndices.length - 5} периодов`);
      }
    } else {
      console.log(`⚠️  Гроз не найдено (коды 95-99 отсутствуют)`);
    }
    
    // Проверяем наличие CAPE
    const capeValues = data.hourly.cape || [];
    const nonNullCape = capeValues.filter(c => c != null && c > 0);
    if (nonNullCape.length > 0) {
      const maxCape = Math.max(...nonNullCape);
      const avgCape = nonNullCape.reduce((a,b) => a+b, 0) / nonNullCape.length;
      console.log(`CAPE: макс=${maxCape.toFixed(0)}, средний=${avgCape.toFixed(0)}, записей с CAPE=${nonNullCape.length}`);
    } else {
      console.log(`⚠️  CAPE данные отсутствуют или все null`);
    }
    
    return {
      model,
      success: true,
      recordCount: data.hourly.time.length,
      thunderstormCount: thunderstormIndices.length,
      uniqueCodes: uniqueCodes.length,
      hasCape: nonNullCape.length > 0
    };
    
  } catch (e) {
    console.log(`❌ Ошибка: ${e.message}`);
    return null;
  }
}

async function testAllModels() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ДЕТАЛЬНЫЙ ТЕСТ ВСЕХ МОДЕЛЕЙ ДЛЯ ОПРЕДЕЛЕНИЯ ГРОЗ         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Координаты Москвы
  const lat = 55.7558;
  const lon = 37.6173;
  
  // Тестируем летний период (больше вероятность гроз)
  const startDate = '2024-07-01';
  const endDate = '2024-07-07';
  
  console.log(`\nЛокация: Москва (${lat}, ${lon})`);
  console.log(`Период: ${startDate} - ${endDate} (летний период, больше гроз)`);
  
  const models = [
    'icon_global',
    'gfs_global',
    'ecmwf_ifs04',
    'gem_global'
  ];
  
  const results = [];
  
  for (const model of models) {
    const result = await testSingleModel(model, lat, lon, startDate, endDate);
    if (result) {
      results.push(result);
    }
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  СВОДКА РЕЗУЛЬТАТОВ                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Модель          | Записей | Грозы | Коды | CAPE');
  console.log('----------------|---------|-------|------|------');
  
  results.forEach(r => {
    const modelName = r.model.toUpperCase().padEnd(15);
    const records = String(r.recordCount).padStart(7);
    const thunderstorms = String(r.thunderstormCount).padStart(5);
    const codes = String(r.uniqueCodes).padStart(4);
    const cape = r.hasCape ? '  ✓' : '  ✗';
    console.log(`${modelName} | ${records} | ${thunderstorms} | ${codes} | ${cape}`);
  });
  
  const totalThunderstorms = results.reduce((sum, r) => sum + r.thunderstormCount, 0);
  const avgThunderstorms = totalThunderstorms / results.length;
  
  console.log('\n📊 СТАТИСТИКА:');
  console.log(`  Успешных моделей: ${results.length} из ${models.length}`);
  console.log(`  Всего гроз найдено: ${totalThunderstorms}`);
  console.log(`  Среднее по моделям: ${avgThunderstorms.toFixed(1)}`);
  
  if (totalThunderstorms === 0) {
    console.log('\n⚠️  ВНИМАНИЕ: Ни одна модель не нашла гроз в этом периоде!');
    console.log('   Возможные причины:');
    console.log('   1. В выбранном периоде действительно не было гроз');
    console.log('   2. Модели не предсказывали грозы для этой локации');
    console.log('   3. Попробуйте другой период или локацию');
  } else {
    console.log('\n✅ Модели работают корректно и находят грозы');
  }
}

testAllModels();
