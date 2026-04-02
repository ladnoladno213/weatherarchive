/**
 * Тест обнаружения гроз в Ишиме для всех известных дат с грозами
 * Проверяем точность мультимодельной системы
 */

const fetch = require('node-fetch');

// Ишим, Тюменская область
const lat = 56.1128;
const lon = 69.4889;

// Даты когда точно была гроза
const thunderstormDates = [
  '2025-04-26',
  '2025-04-28',
  '2025-05-23',
  '2025-05-29',
  '2025-06-20',
  '2025-06-21',
  '2025-07-05',
  '2025-07-30',
  '2025-07-31',
  '2025-08-28',
  '2025-09-01',
  '2025-09-25',
];

// 11 глобальных моделей
const models = {
  jma: 'jma_gsm',
  ecmwf_hres: 'ecmwf_ifs',
  ecmwf_025: 'ecmwf_ifs025',
  gfs: 'gfs_global',
  ukmo: 'ukmo_global_deterministic_10km',
  ecmwf: 'ecmwf_ifs04',
  gem: 'gem_global',
  icon: 'icon_global',
  cma: 'cma_grapes_global',
  arpege: 'arpege_world',
  bom: 'bom_access_global'
};

async function fetchModelData(model, date) {
  const hourly = 'weather_code,cape,precipitation,showers';
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourly}&timezone=auto&models=${model}`;
  
  try {
    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) return null;
    const data = await response.json();
    return data.error ? null : data;
  } catch (e) {
    return null;
  }
}

function detectThunderstorms(modelData) {
  const detections = [];
  
  for (const [name, data] of Object.entries(modelData)) {
    if (!data || !data.hourly) continue;
    
    for (let i = 0; i < data.hourly.time.length; i++) {
      const code = data.hourly.weather_code?.[i];
      const cape = data.hourly.cape?.[i];
      const precip = (data.hourly.precipitation?.[i] || 0) + (data.hourly.showers?.[i] || 0);
      
      let detected = false;
      let method = '';
      
      // Критерии обнаружения (обновлённые)
      if (code >= 95 && code <= 99) {
        detected = true;
        method = 'code';
      } else if (code >= 80 && code <= 82 && cape > 500) {
        detected = true;
        method = 'showers+cape';
      } else if (code >= 51 && code <= 67 && cape > 800 && precip > 0.3) {
        detected = true;
        method = 'rain+cape';
      } else if (cape > 500 && precip > 2) {
        detected = true;
        method = 'cape+precip';
      } else if (cape > 1000 && precip > 0.3) {
        detected = true;
        method = 'cape_high';
      } else if (cape > 1500 && precip > 0.1) {
        detected = true;
        method = 'cape_very_high';
      } else if (cape > 2000) {
        detected = true;
        method = 'cape_extreme';
      } else if (precip > 10) {
        detected = true;
        method = 'heavy_rain';
      }
      
      if (detected) {
        detections.push({
          model: name,
          hour: data.hourly.time[i].split('T')[1].substring(0, 5),
          method,
          code,
          cape: cape?.toFixed(0),
          precip: precip.toFixed(1)
        });
      }
    }
  }
  
  return detections;
}

async function testDate(date) {
  console.log(`\n${date}:`);
  
  // Загружаем данные от всех моделей параллельно
  const promises = Object.entries(models).map(async ([name, model]) => {
    const data = await fetchModelData(model, date);
    return [name, data];
  });
  
  const results = await Promise.all(promises);
  const modelData = Object.fromEntries(results);
  
  const available = Object.values(modelData).filter(d => d !== null).length;
  
  // Обнаруживаем грозы
  const detections = detectThunderstorms(modelData);
  
  if (detections.length === 0) {
    console.log(`  ❌ НЕ ОБНАРУЖЕНО (${available}/11 моделей доступно)`);
    return { date, detected: false, available, detections: 0, models: [] };
  }
  
  // Группируем по моделям
  const modelCounts = {};
  detections.forEach(d => {
    modelCounts[d.model] = (modelCounts[d.model] || 0) + 1;
  });
  
  const modelList = Object.keys(modelCounts).map(m => m.toUpperCase()).join(', ');
  const modelCount = Object.keys(modelCounts).length;
  const hourCount = detections.length;
  
  console.log(`  ✅ ОБНАРУЖЕНО: ${hourCount} часов, ${modelCount}/11 моделей`);
  console.log(`     Модели: ${modelList}`);
  
  return {
    date,
    detected: true,
    available,
    detections: hourCount,
    modelCount,
    models: Object.keys(modelCounts)
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('ТЕСТ ОБНАРУЖЕНИЯ ГРОЗ В ИШИМЕ');
  console.log('='.repeat(70));
  console.log(`Координаты: ${lat}, ${lon}`);
  console.log(`Дат для проверки: ${thunderstormDates.length}`);
  console.log(`Моделей: 11 глобальных`);
  console.log('');
  
  const results = [];
  
  for (const date of thunderstormDates) {
    const result = await testDate(date);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Статистика
  console.log('\n' + '='.repeat(70));
  console.log('ИТОГОВАЯ СТАТИСТИКА');
  console.log('='.repeat(70));
  
  const detected = results.filter(r => r.detected).length;
  const notDetected = results.filter(r => !r.detected).length;
  const avgModels = results.filter(r => r.detected).reduce((sum, r) => sum + r.modelCount, 0) / detected || 0;
  const avgHours = results.filter(r => r.detected).reduce((sum, r) => sum + r.detections, 0) / detected || 0;
  
  console.log(`\nВсего дат с грозами: ${thunderstormDates.length}`);
  console.log(`Обнаружено: ${detected} (${(detected/thunderstormDates.length*100).toFixed(1)}%)`);
  console.log(`Пропущено: ${notDetected} (${(notDetected/thunderstormDates.length*100).toFixed(1)}%)`);
  console.log(`\nСреднее количество моделей: ${avgModels.toFixed(1)}/11`);
  console.log(`Среднее количество часов с грозой: ${avgHours.toFixed(1)}`);
  
  // Самые надёжные модели
  const modelStats = {};
  results.forEach(r => {
    if (r.detected) {
      r.models.forEach(m => {
        modelStats[m] = (modelStats[m] || 0) + 1;
      });
    }
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('НАДЁЖНОСТЬ МОДЕЛЕЙ');
  console.log('='.repeat(70));
  console.log('(сколько раз модель обнаружила грозу из ' + detected + ' случаев)\n');
  
  const sorted = Object.entries(modelStats).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([model, count]) => {
    const percent = (count / detected * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(count / detected * 20));
    console.log(`${model.toUpperCase().padEnd(12)} ${count.toString().padStart(2)}/${detected} (${percent.padStart(3)}%) ${bar}`);
  });
  
  if (notDetected > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('ПРОПУЩЕННЫЕ ДАТЫ');
    console.log('='.repeat(70));
    results.filter(r => !r.detected).forEach(r => {
      console.log(`❌ ${r.date}`);
    });
  }
}

main().catch(console.error);
