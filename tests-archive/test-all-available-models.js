/**
 * Тест ВСЕХ доступных моделей из Historical Forecast API
 * Проверяем, какие модели предоставляют weather_code для обнаружения гроз
 */

const fetch = require('node-fetch');

// Ишим, 20 июня 2025 - известная гроза
const lat = 56.1128;
const lon = 69.4889;
const date = '2025-06-20';

// ВСЕ ГЛОБАЛЬНЫЕ модели из документации Open-Meteo Historical Forecast API
const allModels = {
  // Глобальные модели
  'icon_global': { name: 'ICON Global', provider: 'DWD', resolution: '11 km', since: '2022-11-24' },
  'gfs_global': { name: 'GFS Global', provider: 'NOAA', resolution: '13 km', since: '2021-03-23' },
  'ecmwf_ifs': { name: 'ECMWF IFS HRES', provider: 'ECMWF', resolution: '9 km', since: '2017-01-01' },
  'ecmwf_ifs04': { name: 'ECMWF IFS 0.4°', provider: 'ECMWF', resolution: '44 km', since: '2022-11-07' },
  'ecmwf_ifs025': { name: 'ECMWF IFS 0.25°', provider: 'ECMWF', resolution: '25 km', since: '2024-02-03' },
  'ukmo_global_deterministic_10km': { name: 'UKMO Global', provider: 'UK Met Office', resolution: '10 km', since: '2022-03-01' },
  'jma_gsm': { name: 'JMA GSM', provider: 'JMA', resolution: '55 km', since: '2016-01-01' },
  'gem_global': { name: 'GEM Global', provider: 'CMC', resolution: '15 km', since: '2022-11-23' },
  'cma_grapes_global': { name: 'CMA GRAPES', provider: 'CMA', resolution: '15 km', since: '2023-12-31' },
  'bom_access_global': { name: 'BOM ACCESS', provider: 'BOM', resolution: '15 km', since: '2024-01-18' },
  'arpege_world': { name: 'ARPEGE World', provider: 'Météo-France', resolution: '25 km', since: '2024-01-02' },
};

async function testModel(modelId, modelInfo) {
  const hourly = 'weather_code,cape,precipitation,showers';
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourly}&timezone=auto&models=${modelId}`;
  
  try {
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      return { status: 'http_error', code: response.status };
    }
    
    const data = await response.json();
    
    if (data.error) {
      return { status: 'api_error', reason: data.reason };
    }
    
    if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
      return { status: 'no_data' };
    }
    
    // Проверяем наличие данных
    const hasWeatherCode = data.hourly.weather_code && data.hourly.weather_code.some(v => v != null);
    const hasCape = data.hourly.cape && data.hourly.cape.some(v => v != null && v > 0);
    const hasPrecip = data.hourly.precipitation && data.hourly.precipitation.some(v => v != null);
    
    // Проверяем наличие гроз
    let thunderstormHours = 0;
    if (hasWeatherCode) {
      thunderstormHours = data.hourly.weather_code.filter(c => c >= 95 && c <= 99).length;
    }
    
    return {
      status: 'ok',
      hours: data.hourly.time.length,
      hasWeatherCode,
      hasCape,
      hasPrecip,
      thunderstormHours
    };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('ТЕСТ ВСЕХ ДОСТУПНЫХ МОДЕЛЕЙ HISTORICAL FORECAST API');
  console.log('='.repeat(80));
  console.log(`Локация: Ишим (${lat}, ${lon})`);
  console.log(`Дата: ${date} (известная гроза в 18:00)`);
  console.log('');
  
  const results = [];
  
  console.log('Тестирование моделей...\n');
  
  for (const [modelId, modelInfo] of Object.entries(allModels)) {
    process.stdout.write(`${modelInfo.name.padEnd(30)} ... `);
    
    const result = await testModel(modelId, modelInfo);
    
    if (result.status === 'ok') {
      const features = [];
      if (result.hasWeatherCode) features.push('weather_code');
      if (result.hasCape) features.push('CAPE');
      if (result.hasPrecip) features.push('precip');
      
      const thunderInfo = result.thunderstormHours > 0 ? ` 🌩️ ${result.thunderstormHours}ч` : '';
      console.log(`✅ [${features.join(', ')}]${thunderInfo}`);
      
      results.push({
        modelId,
        ...modelInfo,
        ...result
      });
    } else if (result.status === 'no_data') {
      console.log(`⚪ Нет данных`);
    } else if (result.status === 'http_error') {
      console.log(`❌ HTTP ${result.code}`);
    } else if (result.status === 'api_error') {
      console.log(`❌ ${result.reason}`);
    } else {
      console.log(`❌ ${result.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Статистика
  console.log('\n' + '='.repeat(80));
  console.log('СТАТИСТИКА');
  console.log('='.repeat(80));
  
  const withWeatherCode = results.filter(r => r.hasWeatherCode);
  const withCape = results.filter(r => r.hasCape);
  const withThunderstorms = results.filter(r => r.thunderstormHours > 0);
  
  console.log(`\nВсего протестировано: ${Object.keys(allModels).length} моделей`);
  console.log(`Доступно данных: ${results.length} моделей`);
  console.log(`С weather_code: ${withWeatherCode.length} моделей`);
  console.log(`С CAPE: ${withCape.length} моделей`);
  console.log(`Обнаружили грозу: ${withThunderstorms.length} моделей`);
  
  if (withThunderstorms.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('МОДЕЛИ, ОБНАРУЖИВШИЕ ГРОЗУ:');
    console.log('='.repeat(80));
    
    for (const model of withThunderstorms) {
      console.log(`✅ ${model.name.padEnd(30)} ${model.thunderstormHours} часов с грозой`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('РЕКОМЕНДАЦИИ ДЛЯ МУЛЬТИМОДЕЛЬНОЙ СИСТЕМЫ:');
  console.log('='.repeat(80));
  console.log(`\nИспользовать ${withWeatherCode.length} моделей с weather_code:`);
  withWeatherCode.forEach(m => console.log(`  - ${m.modelId} (${m.name})`));
}

main().catch(console.error);
