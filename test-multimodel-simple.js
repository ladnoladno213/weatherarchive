/**
 * Простой тест мультимодельной системы обнаружения гроз
 * Проверяет, как объединяются данные от всех моделей
 */

const fetch = require('node-fetch');

// Координаты Москвы
const lat = 55.7558;
const lon = 37.6173;

// Тестовая дата - летний день 2024 (все модели должны быть доступны)
const testDate = '2024-07-15';

const models = [
  'jma_gsm',
  'ecmwf_ifs',
  'gfs_global',
  'ukmo_global_deterministic_10km',
  'ecmwf_ifs04',
  'gem_global',
  'icon_global',
  'cma_grapes_global',
  'arpege_world',
  'bom_access_global'
];

async function fetchMultiModelThunderstorms(lat, lon, startDate, endDate) {
  const hourly = [
    'weather_code',
    'cape',
    'precipitation',
    'showers'
  ].join(',');
  
  const promises = models.map(async (model) => {
    const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&models=${model}`;
    
    console.log(`Запрос ${model}...`);
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, { timeout: 15000 });
      
      if (!response.ok) {
        console.log(`  ❌ ${model}: HTTP ${response.status}`);
        return { model, data: null };
      }
      
      const data = await response.json();
      const time = Date.now() - startTime;
      
      if (data.error) {
        console.log(`  ❌ ${model}: ${data.reason} (${time}ms)`);
        return { model, data: null };
      }
      
      // Проверяем наличие данных
      const hasData = data.hourly && data.hourly.time && data.hourly.time.length > 0;
      const hasWeatherCode = data.hourly?.weather_code?.some(v => v != null);
      const hasCape = data.hourly?.cape?.some(v => v != null && v > 0);
      const hasPrecip = data.hourly?.precipitation?.some(v => v != null);
      
      if (hasData) {
        const features = [];
        if (hasWeatherCode) features.push('weather_code');
        if (hasCape) features.push('CAPE');
        if (hasPrecip) features.push('precip');
        
        console.log(`  ✅ ${model}: ${data.hourly.time.length}ч [${features.join(', ')}] (${time}ms)`);
      } else {
        console.log(`  ⚠️  ${model}: нет данных (${time}ms)`);
      }
      
      return { model, data: hasData ? data : null };
    } catch (e) {
      console.log(`  ❌ ${model}: ${e.message}`);
      return { model, data: null };
    }
  });
  
  const results = await Promise.all(promises);
  
  const combined = {
    jma: results.find(r => r.model === 'jma_gsm')?.data,
    ecmwf_hres: results.find(r => r.model === 'ecmwf_ifs')?.data,
    gfs: results.find(r => r.model === 'gfs_global')?.data,
    ukmo: results.find(r => r.model === 'ukmo_global_deterministic_10km')?.data,
    ecmwf: results.find(r => r.model === 'ecmwf_ifs04')?.data,
    gem: results.find(r => r.model === 'gem_global')?.data,
    icon: results.find(r => r.model === 'icon_global')?.data,
    cma: results.find(r => r.model === 'cma_grapes_global')?.data,
    arpege: results.find(r => r.model === 'arpege_world')?.data,
    bom: results.find(r => r.model === 'bom_access_global')?.data,
  };
  
  return combined;
}

function analyzeThunderstorm(modelData, datetime) {
  const result = {
    hasThunderstorm: false,
    description: null,
    confidence: 'none',
    models: [],
    modelCount: 0
  };
  
  const thunderstorms = [];
  const modelNames = ['jma', 'ecmwf_hres', 'gfs', 'ukmo', 'ecmwf', 'gem', 'icon', 'cma', 'arpege', 'bom'];
  
  for (const modelName of modelNames) {
    const data = modelData[modelName];
    if (!data || !data.hourly) continue;
    
    const idx = data.hourly.time?.findIndex(t => t === datetime);
    if (idx < 0) continue;
    
    const code = data.hourly.weather_code?.[idx];
    const cape = data.hourly.cape?.[idx];
    const precip = data.hourly.precipitation?.[idx] || 0;
    const showers = data.hourly.showers?.[idx] || 0;
    const totalPrecip = precip + showers;
    
    let hasThunderstorm = false;
    let detectionMethod = '';
    
    // Метод 1: По коду погоды
    if (code >= 95 && code <= 99) {
      hasThunderstorm = true;
      detectionMethod = 'weather_code';
    }
    // Метод 2: По CAPE и осадкам
    else if (cape != null && cape > 0) {
      if (cape > 1500 && totalPrecip > 5) {
        hasThunderstorm = true;
        detectionMethod = 'cape_high';
      } else if (cape > 2500 && totalPrecip > 2) {
        hasThunderstorm = true;
        detectionMethod = 'cape_very_high';
      } else if (cape > 3500) {
        hasThunderstorm = true;
        detectionMethod = 'cape_extreme';
      }
    }
    
    if (hasThunderstorm) {
      thunderstorms.push({
        model: modelName.toUpperCase(),
        code: code || 95,
        cape,
        precip: totalPrecip,
        method: detectionMethod
      });
      result.models.push(modelName.toUpperCase());
    }
  }
  
  result.modelCount = thunderstorms.length;
  
  if (thunderstorms.length === 0) {
    return result;
  }
  
  result.hasThunderstorm = true;
  
  // Уверенность
  if (thunderstorms.length >= 5) {
    result.confidence = 'very_high';
  } else if (thunderstorms.length >= 3) {
    result.confidence = 'high';
  } else if (thunderstorms.length === 2) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
  }
  
  return { result, thunderstorms };
}

async function main() {
  console.log('='.repeat(70));
  console.log('ТЕСТ МУЛЬТИМОДЕЛЬНОЙ СИСТЕМЫ ОБНАРУЖЕНИЯ ГРОЗ');
  console.log('='.repeat(70));
  console.log(`Координаты: Москва (${lat}, ${lon})`);
  console.log(`Дата: ${testDate}`);
  console.log('');
  
  console.log('Запрос данных от всех моделей...\n');
  const modelData = await fetchMultiModelThunderstorms(lat, lon, testDate, testDate);
  
  console.log('\n' + '='.repeat(70));
  console.log('РЕЗУЛЬТАТЫ');
  console.log('='.repeat(70));
  
  const availableModels = Object.entries(modelData)
    .filter(([_, data]) => data !== null)
    .map(([name, _]) => name.toUpperCase());
  
  console.log(`\nДоступно моделей: ${availableModels.length} из 10`);
  console.log(`Модели: ${availableModels.join(', ')}`);
  
  // Анализируем несколько часов
  console.log('\n' + '='.repeat(70));
  console.log('АНАЛИЗ ГРОЗ ПО ЧАСАМ');
  console.log('='.repeat(70));
  
  const firstModel = Object.values(modelData).find(d => d !== null);
  if (firstModel && firstModel.hourly && firstModel.hourly.time) {
    // Проверяем каждый час
    for (let i = 0; i < firstModel.hourly.time.length; i++) {
      const datetime = firstModel.hourly.time[i];
      const hour = datetime.split('T')[1].substring(0, 5);
      
      const analysis = analyzeThunderstorm(modelData, datetime);
      const result = analysis.result;
      const thunderstorms = analysis.thunderstorms || [];
      
      if (result && result.hasThunderstorm) {
        console.log(`\n${hour} - ГРОЗА ОБНАРУЖЕНА!`);
        console.log(`  Уверенность: ${result.confidence} (${result.modelCount}/10 моделей)`);
        console.log(`  Модели: ${result.models.join(', ')}`);
        console.log(`  Детали:`);
        for (const t of thunderstorms) {
          console.log(`    ${t.model}: code=${t.code}, CAPE=${t.cape?.toFixed(0) || 'N/A'}, precip=${t.precip.toFixed(1)}mm [${t.method}]`);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('ТЕСТ ЗАВЕРШЁН');
  console.log('='.repeat(70));
}

main().catch(console.error);
