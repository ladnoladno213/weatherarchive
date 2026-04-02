/**
 * Детальный анализ для Ишима 20-21 июня 2025
 * Смотрим ВСЕ параметры от всех моделей
 */

const fetch = require('node-fetch');

const lat = 56.1128;
const lon = 69.4889;
const dates = ['2025-06-20', '2025-06-21'];

const models = {
  jma: 'jma_gsm',
  ecmwf_hres: 'ecmwf_ifs',
  gfs: 'gfs_global',
  ukmo: 'ukmo_global_deterministic_10km',
  ecmwf: 'ecmwf_ifs04',
  gem: 'gem_global',
  icon: 'icon_global',
  cma: 'cma_grapes_global',
  arpege: 'arpege_world',
  bom: 'bom_access_global'
};

async function fetchModel(model, date) {
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

async function analyzeDate(date) {
  console.log('\n' + '='.repeat(70));
  console.log(`ДАТА: ${date}`);
  console.log('='.repeat(70));
  
  console.log('Загрузка данных...');
  
  const promises = Object.entries(models).map(async ([name, model]) => {
    const data = await fetchModel(model, date);
    return [name, data];
  });
  
  const results = await Promise.all(promises);
  const modelData = Object.fromEntries(results);
  
  const available = Object.entries(modelData).filter(([_, d]) => d !== null);
  console.log(`Доступно: ${available.length}/10 моделей\n`);
  
  const firstModel = Object.values(modelData).find(d => d !== null);
  if (!firstModel) return;
  
  // Анализируем каждый час
  for (let i = 0; i < firstModel.hourly.time.length; i++) {
    const time = firstModel.hourly.time[i];
    const hour = time.split('T')[1].substring(0, 5);
    
    console.log(`\n${hour}:`);
    console.log('-'.repeat(70));
    
    let hasAnyThunderstorm = false;
    
    for (const [name, data] of Object.entries(modelData)) {
      if (!data || !data.hourly) continue;
      
      const code = data.hourly.weather_code?.[i];
      const cape = data.hourly.cape?.[i];
      const precip = data.hourly.precipitation?.[i] || 0;
      const showers = data.hourly.showers?.[i] || 0;
      const total = precip + showers;
      
      // Проверяем все критерии
      const checks = [];
      
      if (code >= 95 && code <= 99) {
        checks.push(`✅ CODE=${code}`);
        hasAnyThunderstorm = true;
      } else if (code >= 80 && code <= 82) {
        checks.push(`🌧️ SHOWERS=${code}`);
        if (cape > 800) {
          checks.push(`✅ +CAPE=${cape.toFixed(0)}`);
          hasAnyThunderstorm = true;
        }
      } else if (code != null) {
        checks.push(`code=${code}`);
      }
      
      if (cape != null) {
        if (cape > 3000) {
          checks.push(`✅ CAPE=${cape.toFixed(0)}(EXTREME)`);
          hasAnyThunderstorm = true;
        } else if (cape > 2500 && total > 0.5) {
          checks.push(`✅ CAPE=${cape.toFixed(0)}+p=${total.toFixed(1)}`);
          hasAnyThunderstorm = true;
        } else if (cape > 1500 && total > 1) {
          checks.push(`✅ CAPE=${cape.toFixed(0)}+p=${total.toFixed(1)}`);
          hasAnyThunderstorm = true;
        } else if (cape > 800 && total > 3) {
          checks.push(`✅ CAPE=${cape.toFixed(0)}+p=${total.toFixed(1)}`);
          hasAnyThunderstorm = true;
        } else if (cape > 500) {
          checks.push(`CAPE=${cape.toFixed(0)}`);
        }
      }
      
      if (total > 15) {
        checks.push(`✅ HEAVY_RAIN=${total.toFixed(1)}mm`);
        hasAnyThunderstorm = true;
      } else if (total > 5) {
        checks.push(`rain=${total.toFixed(1)}mm`);
      } else if (total > 0) {
        checks.push(`p=${total.toFixed(1)}mm`);
      }
      
      const status = checks.some(c => c.startsWith('✅')) ? '✅' : '  ';
      console.log(`  ${status} ${name.toUpperCase().padEnd(12)} ${checks.join(', ')}`);
    }
    
    if (!hasAnyThunderstorm) {
      // Пропускаем часы без гроз для краткости
      continue;
    }
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('ДЕТАЛЬНЫЙ АНАЛИЗ: Ишим, 20-21 июня 2025');
  console.log('='.repeat(70));
  console.log(`Координаты: ${lat}, ${lon}`);
  
  for (const date of dates) {
    await analyzeDate(date);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('ЛЕГЕНДА:');
  console.log('='.repeat(70));
  console.log('✅ - Критерий обнаружения грозы сработал');
  console.log('🌧️ - Ливни (код 80-82)');
  console.log('CODE=95-99 - Прямое обнаружение грозы');
  console.log('CAPE - Конвективная энергия (J/kg)');
  console.log('p/rain - Осадки (мм/час)');
}

main().catch(console.error);
