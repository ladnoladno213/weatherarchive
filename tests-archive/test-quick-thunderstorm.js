/**
 * Быстрый тест обнаружения гроз - проверяем один день
 */

const fetch = require('node-fetch');

// Ишим, Тюменская область - 20 июня 2025
const lat = 56.1128;
const lon = 69.4889;
const date = '2025-06-20';

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

async function fetchAll() {
  const hourly = 'weather_code,cape,precipitation,showers';
  
  const promises = Object.entries(models).map(async ([name, model]) => {
    const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourly}&timezone=auto&models=${model}`;
    
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (!response.ok) return [name, null];
      const data = await response.json();
      return [name, data.error ? null : data];
    } catch (e) {
      return [name, null];
    }
  });
  
  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

function analyzeAll(modelData) {
  const firstModel = Object.values(modelData).find(d => d !== null);
  if (!firstModel) return;
  
  console.log('\nАнализ по часам:\n');
  
  for (let i = 0; i < firstModel.hourly.time.length; i++) {
    const time = firstModel.hourly.time[i];
    const hour = time.split('T')[1].substring(0, 5);
    
    const detections = [];
    
    for (const [name, data] of Object.entries(modelData)) {
      if (!data || !data.hourly) continue;
      
      const code = data.hourly.weather_code?.[i];
      const cape = data.hourly.cape?.[i];
      const precip = (data.hourly.precipitation?.[i] || 0) + (data.hourly.showers?.[i] || 0);
      
      let detected = false;
      let method = '';
      
      if (code >= 95 && code <= 99) {
        detected = true;
        method = `code=${code}`;
      } else if (code >= 80 && code <= 82 && cape > 500) {
        detected = true;
        method = `showers+CAPE=${cape?.toFixed(0)}`;
      } else if (code >= 51 && code <= 67 && cape > 800 && precip > 0.3) {
        detected = true;
        method = `rain+CAPE=${cape.toFixed(0)}`;
      } else if (cape > 500 && precip > 2) {
        detected = true;
        method = `CAPE=${cape.toFixed(0)},p=${precip.toFixed(1)}`;
      } else if (cape > 1000 && precip > 0.3) {
        detected = true;
        method = `CAPE=${cape.toFixed(0)},p=${precip.toFixed(1)}`;
      } else if (cape > 1500 && precip > 0.1) {
        detected = true;
        method = `CAPE=${cape.toFixed(0)},p=${precip.toFixed(1)}`;
      } else if (cape > 2000) {
        detected = true;
        method = `CAPE=${cape.toFixed(0)}`;
      } else if (precip > 10) {
        detected = true;
        method = `heavy_rain=${precip.toFixed(1)}mm`;
      }
      
      if (detected) {
        detections.push(`${name.toUpperCase()}[${method}]`);
      }
    }
    
    if (detections.length > 0) {
      console.log(`${hour}: ГРОЗА (${detections.length}/10) - ${detections.join(', ')}`);
    }
  }
}

async function main() {
  console.log(`Тест обнаружения гроз: Ишим, ${date}`);
  console.log(`Координаты: ${lat}, ${lon}`);
  console.log('Загрузка данных от 10 моделей...\n');
  
  const modelData = await fetchAll();
  
  const available = Object.entries(modelData).filter(([_, d]) => d !== null);
  console.log(`Доступно: ${available.length}/10 моделей`);
  console.log(`Модели: ${available.map(([n, _]) => n.toUpperCase()).join(', ')}`);
  
  analyzeAll(modelData);
  
  console.log('\n' + '='.repeat(60));
  console.log('КРИТЕРИИ ОБНАРУЖЕНИЯ (ФИНАЛЬНЫЕ):');
  console.log('1. code 95-99 (прямое обнаружение грозы)');
  console.log('2. code 80-82 + CAPE>500 (ливни + конвекция)');
  console.log('3. code 51-67 + CAPE>800 + precip>0.3mm (дождь + конвекция)');
  console.log('4. CAPE>500 + precip>2mm');
  console.log('5. CAPE>1000 + precip>0.3mm');
  console.log('6. CAPE>1500 + precip>0.1mm');
  console.log('7. CAPE>2000 (экстремальная конвекция)');
  console.log('8. precip>10mm (очень сильные осадки)');
  console.log('\nУверенность: 4+ моделей = очень высокая, 2-3 = высокая, 1 = средняя');
}

main().catch(console.error);
