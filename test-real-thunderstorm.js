/**
 * Тест обнаружения реальных гроз
 * Проверяем конкретные даты, когда точно были грозы
 */

const fetch = require('node-fetch');

// Координаты Москвы
const lat = 55.7558;
const lon = 37.6173;

// Тестовые даты - летние дни 2024 когда обычно бывают грозы
const testDates = [
  '2024-06-15',
  '2024-07-15',
  '2024-08-15',
];

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

async function fetchModelData(model, date) {
  const hourly = 'weather_code,cape,precipitation,showers';
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourly}&timezone=auto&models=${model}`;
  
  try {
    const response = await fetch(url, { timeout: 15000 });
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error || !data.hourly) return null;
    
    return data;
  } catch (e) {
    return null;
  }
}

function analyzeHour(modelData, hourIndex) {
  const results = [];
  
  for (const [modelName, data] of Object.entries(modelData)) {
    if (!data || !data.hourly) continue;
    
    const code = data.hourly.weather_code?.[hourIndex];
    const cape = data.hourly.cape?.[hourIndex];
    const precip = data.hourly.precipitation?.[hourIndex] || 0;
    const showers = data.hourly.showers?.[hourIndex] || 0;
    const totalPrecip = precip + showers;
    
    let hasThunderstorm = false;
    let method = '';
    let reason = '';
    
    // Метод 1: По коду погоды
    if (code >= 95 && code <= 99) {
      hasThunderstorm = true;
      method = 'weather_code';
      reason = `code=${code}`;
    }
    // Метод 2: Ливни + CAPE
    else if (code >= 80 && code <= 82 && cape != null && cape > 800) {
      hasThunderstorm = true;
      method = 'showers_cape';
      reason = `code=${code}, CAPE=${cape.toFixed(0)}`;
    }
    // Метод 3: По CAPE и осадкам (смягчённые критерии)
    else if (cape != null && cape > 0) {
      if (cape > 800 && totalPrecip > 3) {
        hasThunderstorm = true;
        method = 'cape_moderate';
        reason = `CAPE=${cape.toFixed(0)}, precip=${totalPrecip.toFixed(1)}mm`;
      } else if (cape > 1500 && totalPrecip > 1) {
        hasThunderstorm = true;
        method = 'cape_high';
        reason = `CAPE=${cape.toFixed(0)}, precip=${totalPrecip.toFixed(1)}mm`;
      } else if (cape > 2500 && totalPrecip > 0.5) {
        hasThunderstorm = true;
        method = 'cape_very_high';
        reason = `CAPE=${cape.toFixed(0)}, precip=${totalPrecip.toFixed(1)}mm`;
      } else if (cape > 3000) {
        hasThunderstorm = true;
        method = 'cape_extreme';
        reason = `CAPE=${cape.toFixed(0)}`;
      }
    }
    // Метод 4: Сильные осадки
    else if (totalPrecip > 15) {
      hasThunderstorm = true;
      method = 'heavy_precip';
      reason = `precip=${totalPrecip.toFixed(1)}mm`;
    }
    
    results.push({
      model: modelName,
      hasThunderstorm,
      method,
      reason,
      code,
      cape: cape?.toFixed(0) || 'N/A',
      precip: totalPrecip.toFixed(1)
    });
  }
  
  return results;
}

async function testDate(date) {
  console.log('\n' + '='.repeat(70));
  console.log(`Дата: ${date}`);
  console.log('='.repeat(70));
  
  // Запрашиваем данные от всех моделей
  console.log('Загрузка данных...');
  const modelData = {};
  
  for (const model of models) {
    const data = await fetchModelData(model, date);
    const shortName = model.replace('_global', '').replace('_deterministic_10km', '').replace('_gsm', '').replace('_ifs', '').replace('_grapes', '').replace('_world', '').replace('_access', '');
    modelData[shortName] = data;
  }
  
  const availableCount = Object.values(modelData).filter(d => d !== null).length;
  console.log(`Доступно моделей: ${availableCount}/10\n`);
  
  // Анализируем каждый час
  const firstModel = Object.values(modelData).find(d => d !== null);
  if (!firstModel) {
    console.log('Нет данных!');
    return;
  }
  
  let totalThunderstorms = 0;
  
  for (let i = 0; i < firstModel.hourly.time.length; i++) {
    const time = firstModel.hourly.time[i];
    const hour = time.split('T')[1].substring(0, 5);
    
    const results = analyzeHour(modelData, i);
    const thunderstormModels = results.filter(r => r.hasThunderstorm);
    
    if (thunderstormModels.length > 0) {
      totalThunderstorms++;
      console.log(`\n${hour} - ГРОЗА! (${thunderstormModels.length}/10 моделей)`);
      
      for (const t of thunderstormModels) {
        console.log(`  ✅ ${t.model.toUpperCase().padEnd(10)} [${t.method}] ${t.reason}`);
      }
      
      // Показываем модели, которые НЕ обнаружили грозу
      const noThunderstorm = results.filter(r => !r.hasThunderstorm && r.code != null);
      if (noThunderstorm.length > 0) {
        console.log(`  Не обнаружили:`);
        for (const t of noThunderstorm) {
          console.log(`    ⚪ ${t.model.toUpperCase().padEnd(10)} code=${t.code || 'N/A'}, CAPE=${t.cape}, precip=${t.precip}mm`);
        }
      }
    }
  }
  
  console.log(`\nИтого: ${totalThunderstorms} часов с грозами из 24`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('ТЕСТ ОБНАРУЖЕНИЯ РЕАЛЬНЫХ ГРОЗ');
  console.log('='.repeat(70));
  console.log(`Координаты: Москва (${lat}, ${lon})`);
  
  for (const date of testDates) {
    await testDate(date);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('АНАЛИЗ КРИТЕРИЕВ');
  console.log('='.repeat(70));
  console.log('\nТекущие критерии обнаружения (СМЯГЧЁННЫЕ):');
  console.log('1. weather_code 95-99 (прямое обнаружение)');
  console.log('2. weather_code 80-82 (ливни) + CAPE > 800');
  console.log('3. CAPE > 800 + precip > 3mm');
  console.log('4. CAPE > 1500 + precip > 1mm');
  console.log('5. CAPE > 2500 + precip > 0.5mm');
  console.log('6. CAPE > 3000 (любые условия)');
  console.log('7. Осадки > 15mm/h (очень сильные ливни)');
}

main().catch(console.error);
