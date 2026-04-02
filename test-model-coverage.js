/**
 * Тест покрытия моделей по годам
 * Проверяет, какие модели доступны для разных исторических периодов
 */

const fetch = require('node-fetch');

// Координаты Москвы для теста
const lat = 55.7558;
const lon = 37.6173;

// Тестовые периоды
const testPeriods = [
  { year: 2016, date: '2016-06-15', label: '2016 (JMA)' },
  { year: 2017, date: '2017-06-15', label: '2017 (JMA + ECMWF HRES)' },
  { year: 2021, date: '2021-06-15', label: '2021 (JMA + ECMWF + GFS)' },
  { year: 2022, date: '2022-06-15', label: '2022 (7 моделей)' },
  { year: 2023, date: '2023-06-15', label: '2023 (8 моделей)' },
  { year: 2024, date: '2024-06-15', label: '2024 (все 10 моделей)' },
];

const models = [
  { name: 'jma_gsm', label: 'JMA GSM', since: '2016-01-01' },
  { name: 'ecmwf_ifs', label: 'ECMWF IFS HRES', since: '2017-01-01' },
  { name: 'gfs_global', label: 'GFS', since: '2021-03-23' },
  { name: 'ukmo_global_deterministic_10km', label: 'UKMO', since: '2022-03-01' },
  { name: 'ecmwf_ifs04', label: 'ECMWF IFS 0.4°', since: '2022-11-07' },
  { name: 'gem_global', label: 'GEM', since: '2022-11-23' },
  { name: 'icon_global', label: 'ICON', since: '2022-11-24' },
  { name: 'cma_grapes_global', label: 'CMA GRAPES', since: '2023-12-31' },
  { name: 'arpege_world', label: 'ARPEGE', since: '2024-01-02' },
  { name: 'bom_access_global', label: 'BOM ACCESS', since: '2024-01-18' },
];

async function testModelForDate(model, date) {
  const hourly = 'weather_code,cape,precipitation,showers';
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourly}&timezone=auto&models=${model.name}`;
  
  try {
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    
    if (data.error) {
      return { available: false, reason: data.reason };
    }
    
    if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
      return { available: false, reason: 'No data' };
    }
    
    // Проверяем наличие данных о грозах
    const hasWeatherCode = data.hourly.weather_code && data.hourly.weather_code.some(v => v != null);
    const hasCape = data.hourly.cape && data.hourly.cape.some(v => v != null && v > 0);
    const hasPrecip = data.hourly.precipitation && data.hourly.precipitation.some(v => v != null && v > 0);
    
    return {
      available: true,
      hasWeatherCode,
      hasCape,
      hasPrecip,
      hours: data.hourly.time.length
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

async function testPeriod(period) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Тестирование периода: ${period.label} (${period.date})`);
  console.log('='.repeat(70));
  
  const results = [];
  
  for (const model of models) {
    // Проверяем, должна ли модель быть доступна для этой даты
    const shouldBeAvailable = period.date >= model.since;
    
    process.stdout.write(`${model.label.padEnd(20)} ... `);
    
    const result = await testModelForDate(model, period.date);
    
    if (result.available) {
      const features = [];
      if (result.hasWeatherCode) features.push('weather_code');
      if (result.hasCape) features.push('CAPE');
      if (result.hasPrecip) features.push('precip');
      
      console.log(`✅ OK (${result.hours}ч) [${features.join(', ')}]`);
      results.push({ model: model.label, status: 'ok', features });
    } else {
      if (shouldBeAvailable) {
        console.log(`❌ ОШИБКА: ${result.reason || 'Unknown'}`);
        results.push({ model: model.label, status: 'error', reason: result.reason });
      } else {
        console.log(`⏸️  Не доступна (ожидаемо)`);
        results.push({ model: model.label, status: 'expected_unavailable' });
      }
    }
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Статистика
  const available = results.filter(r => r.status === 'ok').length;
  const errors = results.filter(r => r.status === 'error').length;
  
  console.log(`\nИтого: ${available} моделей доступно, ${errors} ошибок`);
  
  return results;
}

async function main() {
  console.log('Тест покрытия моделей Historical Forecast API');
  console.log('Координаты: Москва (55.7558, 37.6173)');
  
  const allResults = {};
  
  for (const period of testPeriods) {
    allResults[period.year] = await testPeriod(period);
  }
  
  // Итоговая таблица
  console.log('\n' + '='.repeat(70));
  console.log('ИТОГОВАЯ ТАБЛИЦА ПОКРЫТИЯ');
  console.log('='.repeat(70));
  console.log('Модель'.padEnd(20) + testPeriods.map(p => p.year.toString().padEnd(8)).join(''));
  console.log('-'.repeat(70));
  
  for (const model of models) {
    let line = model.label.padEnd(20);
    for (const period of testPeriods) {
      const result = allResults[period.year].find(r => r.model === model.label);
      if (result.status === 'ok') {
        line += '✅      ';
      } else if (result.status === 'error') {
        line += '❌      ';
      } else {
        line += '⏸️       ';
      }
    }
    console.log(line);
  }
  
  console.log('\n✅ = Доступна');
  console.log('❌ = Ошибка (должна быть доступна)');
  console.log('⏸️  = Не доступна (ожидаемо)');
}

main().catch(console.error);
