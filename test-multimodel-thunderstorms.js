/**
 * Тест мультимодельного определения гроз (ICON + GFS)
 */

const fetch = require('node-fetch');

async function fetchMultiModelThunderstorms(lat, lon, startDate, endDate) {
  const hourly = [
    'weather_code',
    'cape',
    'precipitation',
    'showers'
  ].join(',');
  
  const models = ['icon_global', 'gfs_global'];
  const promises = models.map(async (model) => {
    const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&models=${model}`;
    
    console.log(`Fetching ${model}...`);
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, { timeout: 15000 });
      
      if (!response.ok) {
        console.error(`${model} HTTP error: ${response.status}`);
        return { model, data: null };
      }
      
      const data = await response.json();
      console.log(`${model} received in ${Date.now() - startTime}ms`);
      
      if (data.error) {
        console.error(`${model} API error: ${data.reason}`);
        return { model, data: null };
      }
      
      return { model, data };
    } catch (e) {
      console.error(`${model} error:`, e.message);
      return { model, data: null };
    }
  });
  
  const results = await Promise.all(promises);
  
  return {
    icon: results.find(r => r.model === 'icon_global')?.data,
    gfs: results.find(r => r.model === 'gfs_global')?.data,
  };
}

function analyzeThunderstorm(iconData, gfsData, datetime) {
  const result = {
    hasThunderstorm: false,
    description: null,
    confidence: 'none',
    models: []
  };
  
  let iconThunderstorm = null;
  if (iconData && iconData.hourly) {
    const idx = iconData.hourly.time?.findIndex(t => t === datetime);
    if (idx >= 0) {
      const code = iconData.hourly.weather_code?.[idx];
      const cape = iconData.hourly.cape?.[idx];
      const precip = iconData.hourly.precipitation?.[idx] || 0;
      const showers = iconData.hourly.showers?.[idx] || 0;
      
      if (code >= 95 && code <= 99) {
        iconThunderstorm = { code, cape, precip, showers };
        result.models.push('ICON');
      }
    }
  }
  
  let gfsThunderstorm = null;
  if (gfsData && gfsData.hourly) {
    const idx = gfsData.hourly.time?.findIndex(t => t === datetime);
    if (idx >= 0) {
      const code = gfsData.hourly.weather_code?.[idx];
      const cape = gfsData.hourly.cape?.[idx];
      const precip = gfsData.hourly.precipitation?.[idx] || 0;
      const showers = gfsData.hourly.showers?.[idx] || 0;
      
      if (code >= 95 && code <= 99) {
        gfsThunderstorm = { code, cape, precip, showers };
        result.models.push('GFS');
      }
    }
  }
  
  if (!iconThunderstorm && !gfsThunderstorm) {
    return result;
  }
  
  result.hasThunderstorm = true;
  
  if (iconThunderstorm && gfsThunderstorm) {
    result.confidence = 'high';
    const maxCode = Math.max(iconThunderstorm.code, gfsThunderstorm.code);
    const maxCape = Math.max(iconThunderstorm.cape || 0, gfsThunderstorm.cape || 0);
    const maxPrecip = Math.max(
      (iconThunderstorm.precip + iconThunderstorm.showers),
      (gfsThunderstorm.precip + gfsThunderstorm.showers)
    );
    
    result.description = getThunderstormDescription(maxCode, maxCape, maxPrecip);
    result.description += ' (подтверждена ICON+GFS)';
    result.details = {
      icon: { code: iconThunderstorm.code, cape: iconThunderstorm.cape },
      gfs: { code: gfsThunderstorm.code, cape: gfsThunderstorm.cape }
    };
  } else {
    result.confidence = 'medium';
    const data = iconThunderstorm || gfsThunderstorm;
    const totalPrecip = data.precip + data.showers;
    
    result.description = getThunderstormDescription(data.code, data.cape, totalPrecip);
    result.description += ` (по данным ${iconThunderstorm ? 'ICON' : 'GFS'})`;
    result.details = iconThunderstorm || gfsThunderstorm;
  }
  
  return result;
}

function getThunderstormDescription(code, cape, totalPrecip) {
  if (code === 95) {
    if (cape > 1000 || totalPrecip > 10) {
      return 'Гроза умеренная';
    } else {
      return 'Гроза слабая';
    }
  } else if (code === 96) {
    return 'Гроза с небольшим градом';
  } else if (code === 97) {
    return 'Гроза сильная';
  } else if (code === 98) {
    return 'Гроза с пыльной бурей';
  } else if (code === 99) {
    return 'Гроза с сильным градом';
  }
  return 'Гроза';
}

async function testMultiModel() {
  console.log('=== ТЕСТ МУЛЬТИМОДЕЛЬНОГО ОПРЕДЕЛЕНИЯ ГРОЗ ===\n');
  
  // Координаты Москвы
  const lat = 55.7558;
  const lon = 37.6173;
  const startDate = '2026-03-25';
  const endDate = '2026-04-01';
  
  console.log(`Локация: Москва (${lat}, ${lon})`);
  console.log(`Период: ${startDate} - ${endDate}\n`);
  
  const data = await fetchMultiModelThunderstorms(lat, lon, startDate, endDate);
  
  console.log('\n=== РЕЗУЛЬТАТЫ ===');
  console.log(`ICON данные: ${data.icon ? 'Да' : 'Нет'}`);
  console.log(`GFS данные: ${data.gfs ? 'Да' : 'Нет'}`);
  
  if (!data.icon && !data.gfs) {
    console.log('\nНет данных от моделей');
    return;
  }
  
  // Показываем информацию о данных
  if (data.icon) {
    console.log(`  ICON записей: ${data.icon.hourly?.time?.length || 0}`);
  }
  if (data.gfs) {
    console.log(`  GFS записей: ${data.gfs.hourly?.time?.length || 0}`);
  }
  
  // Анализируем все периоды
  const times = data.icon?.hourly?.time || data.gfs?.hourly?.time || [];
  
  console.log(`\nВсего периодов: ${times.length}`);
  console.log('\n=== АНАЛИЗ ГРОЗ ===\n');
  
  let thunderstormCount = 0;
  let highConfidence = 0;
  let mediumConfidence = 0;
  
  for (const time of times) {
    const analysis = analyzeThunderstorm(data.icon, data.gfs, time);
    
    if (analysis.hasThunderstorm) {
      thunderstormCount++;
      
      if (analysis.confidence === 'high') {
        highConfidence++;
      } else {
        mediumConfidence++;
      }
      
      console.log(`${time}`);
      console.log(`  ${analysis.description}`);
      console.log(`  Уверенность: ${analysis.confidence}`);
      console.log(`  Модели: ${analysis.models.join(', ')}`);
      if (analysis.details) {
        if (analysis.details.icon) {
          console.log(`  ICON: code=${analysis.details.icon.code}, CAPE=${analysis.details.icon.cape}`);
        }
        if (analysis.details.gfs) {
          console.log(`  GFS: code=${analysis.details.gfs.code}, CAPE=${analysis.details.gfs.cape}`);
        }
      }
      console.log('');
    }
  }
  
  console.log('=== СТАТИСТИКА ===');
  console.log(`Всего периодов с грозами: ${thunderstormCount} из ${times.length}`);
  console.log(`Высокая уверенность (обе модели): ${highConfidence}`);
  console.log(`Средняя уверенность (одна модель): ${mediumConfidence}`);
  console.log(`Процент гроз: ${(thunderstormCount / times.length * 100).toFixed(1)}%`);
}

testMultiModel();
