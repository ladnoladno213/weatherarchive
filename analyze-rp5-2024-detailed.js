const fs = require('fs');
const path = require('path');

// Читаем CSV файл
const csvPath = path.join(__dirname, '28573.01.02.2005.31.03.2026.1.0.0.ru.utf8.00000000.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n');

// Пропускаем заголовок
const dataLines = lines.slice(1).filter(line => line.trim());

console.log(`Всего строк данных: ${dataLines.length}`);

// Фильтруем только 2024 год
const data2024 = dataLines.filter(line => {
  const parts = line.split(';');
  const dateStr = parts[0];
  return dateStr && dateStr.includes('2024');
});

console.log(`Строк за 2024 год: ${data2024.length}\n`);

// Анализируем паттерны WW/W1/W2
const patterns = {
  // Когда WW пустой
  emptyWW: [],
  // Когда WW = "Состояние неба в общем не изменилось."
  unchangedSky: [],
  // Когда есть осадки в WW
  precipitation: [],
  // Когда есть гроза
  thunderstorm: [],
  // Когда есть ливень
  shower: [],
  // Когда есть морось
  drizzle: [],
  // Когда W2 показывает облачность
  w2Cloudiness: [],
  // Когда W2 показывает явление
  w2Phenomenon: [],
};

data2024.forEach(line => {
  const parts = line.split(';');
  const dateTime = parts[0];
  const T = parts[1];
  const N = parts[14];
  const WW = parts[15] || '';
  const W1 = parts[16] || '';
  const W2 = parts[17] || '';
  const RRR = parts[30] || '';
  const U = parts[9];
  
  const record = { dateTime, T, N, WW, W1, W2, RRR, U };
  
  if (!WW.trim()) {
    patterns.emptyWW.push(record);
  }
  
  if (WW.includes('Состояние неба в общем не изменилось')) {
    patterns.unchangedSky.push(record);
  }
  
  if (WW.includes('Дождь') || WW.includes('дождь') || WW.includes('Снег') || WW.includes('снег') || WW.includes('Ливневый') || WW.includes('ливневый')) {
    patterns.precipitation.push(record);
  }
  
  if (WW.includes('Гроза') || WW.includes('гроза')) {
    patterns.thunderstorm.push(record);
  }
  
  if (WW.includes('Ливневый') || WW.includes('ливневый')) {
    patterns.shower.push(record);
  }
  
  if (WW.includes('Морось') || WW.includes('морось')) {
    patterns.drizzle.push(record);
  }
  
  if (W2.includes('Облака покрывали')) {
    patterns.w2Cloudiness.push(record);
  } else if (W2.trim()) {
    patterns.w2Phenomenon.push(record);
  }
});

console.log('=== СТАТИСТИКА ПАТТЕРНОВ ===\n');
console.log(`Пустой WW: ${patterns.emptyWW.length} случаев`);
console.log(`"Состояние неба в общем не изменилось": ${patterns.unchangedSky.length} случаев`);
console.log(`Осадки в WW: ${patterns.precipitation.length} случаев`);
console.log(`Грозы: ${patterns.thunderstorm.length} случаев`);
console.log(`Ливни: ${patterns.shower.length} случаев`);
console.log(`Морось: ${patterns.drizzle.length} случаев`);
console.log(`W2 с облачностью: ${patterns.w2Cloudiness.length} случаев`);
console.log(`W2 с явлением: ${patterns.w2Phenomenon.length} случаев\n`);

// Анализируем когда W2 показывает облачность
console.log('=== КОГДА W2 ПОКАЗЫВАЕТ ОБЛАЧНОСТЬ ===\n');
const w2CloudW1Stats = {};
patterns.w2Cloudiness.forEach(r => {
  const w1 = r.W1.trim() || '(пусто)';
  w2CloudW1Stats[w1] = (w2CloudW1Stats[w1] || 0) + 1;
});

const sortedW1 = Object.entries(w2CloudW1Stats).sort((a, b) => b[1] - a[1]);
console.log('Что было в W1, когда W2 показывает облачность:');
sortedW1.slice(0, 10).forEach(([w1, count]) => {
  console.log(`  ${count} раз: "${w1}"`);
});

// Примеры
console.log('\nПримеры (первые 5):');
patterns.w2Cloudiness.slice(0, 5).forEach(r => {
  console.log(`  ${r.dateTime}: WW="${r.WW.substring(0, 50)}..." W1="${r.W1}" W2="${r.W2.substring(0, 50)}..."`);
});

// Анализируем когда W2 показывает явление (не облачность)
console.log('\n\n=== КОГДА W2 ПОКАЗЫВАЕТ ЯВЛЕНИЕ (НЕ ОБЛАЧНОСТЬ) ===\n');
const w2PhenW1Stats = {};
patterns.w2Phenomenon.forEach(r => {
  const w1 = r.W1.trim() || '(пусто)';
  w2PhenW1Stats[w1] = (w2PhenW1Stats[w1] || 0) + 1;
});

const sortedW1Phen = Object.entries(w2PhenW1Stats).sort((a, b) => b[1] - a[1]);
console.log('Что было в W1, когда W2 показывает явление:');
sortedW1Phen.slice(0, 10).forEach(([w1, count]) => {
  console.log(`  ${count} раз: "${w1}"`);
});

// Примеры
console.log('\nПримеры (первые 10):');
patterns.w2Phenomenon.slice(0, 10).forEach(r => {
  console.log(`  ${r.dateTime}: WW="${r.WW.substring(0, 40)}..." W1="${r.W1}" W2="${r.W2}"`);
});

// Анализируем морось детально
console.log('\n\n=== ДЕТАЛЬНЫЙ АНАЛИЗ МОРОСИ ===\n');
console.log(`Всего случаев мороси: ${patterns.drizzle.length}\n`);

// Группируем по температуре
const drizzleByTemp = {
  freezing: [], // < 0°C
  cold: [],     // 0-5°C
  mild: [],     // 5-10°C
  warm: []      // > 10°C
};

patterns.drizzle.forEach(r => {
  const temp = parseFloat(r.T);
  if (isNaN(temp)) return;
  
  if (temp < 0) drizzleByTemp.freezing.push(r);
  else if (temp < 5) drizzleByTemp.cold.push(r);
  else if (temp < 10) drizzleByTemp.mild.push(r);
  else drizzleByTemp.warm.push(r);
});

console.log('Распределение мороси по температуре:');
console.log(`  < 0°C (замерзающая): ${drizzleByTemp.freezing.length} случаев`);
console.log(`  0-5°C (холодная): ${drizzleByTemp.cold.length} случаев`);
console.log(`  5-10°C (прохладная): ${drizzleByTemp.mild.length} случаев`);
console.log(`  > 10°C (тёплая): ${drizzleByTemp.warm.length} случаев\n`);

// Примеры мороси
console.log('Примеры мороси:');
patterns.drizzle.slice(0, 5).forEach(r => {
  console.log(`  ${r.dateTime}: T=${r.T}°C, RRR=${r.RRR}, WW="${r.WW}"`);
  console.log(`    W1="${r.W1}", W2="${r.W2}"\n`);
});

// Анализируем ливни детально
console.log('\n=== ДЕТАЛЬНЫЙ АНАЛИЗ ЛИВНЕЙ ===\n');
console.log(`Всего случаев ливней: ${patterns.shower.length}\n`);

// Группируем по типу
const showerTypes = {};
patterns.shower.forEach(r => {
  const ww = r.WW;
  // Извлекаем тип ливня
  let type = 'Другое';
  if (ww.includes('Ливневый(ые) дождь(и) слабый(ые)')) type = 'Ливневый дождь слабый';
  else if (ww.includes('Ливневый(ые) дождь(и).')) type = 'Ливневый дождь';
  else if (ww.includes('Ливневый снег слабый')) type = 'Ливневый снег слабый';
  else if (ww.includes('Ливневый снег или ливневый дождь и снег')) type = 'Ливневый снег/дождь';
  else if (ww.includes('Ливневый(ые) дождь(и) со снегом')) type = 'Ливневый дождь со снегом';
  
  if (!showerTypes[type]) showerTypes[type] = [];
  showerTypes[type].push(r);
});

console.log('Типы ливней:');
Object.entries(showerTypes).sort((a, b) => b[1].length - a[1].length).forEach(([type, records]) => {
  console.log(`  ${type}: ${records.length} случаев`);
});

// Анализируем связь ливней с осадками
console.log('\n\nСвязь ливней с количеством осадков:');
const showersWithPrecip = patterns.shower.filter(r => r.RRR && r.RRR !== 'Осадков нет' && r.RRR !== 'Следы осадков');
console.log(`Ливней с измеримыми осадками: ${showersWithPrecip.length} из ${patterns.shower.length}`);

// Примеры ливней с осадками
console.log('\nПримеры ливней с осадками:');
showersWithPrecip.slice(0, 5).forEach(r => {
  console.log(`  ${r.dateTime}: T=${r.T}°C, RRR=${r.RRR}мм, WW="${r.WW.substring(0, 60)}..."`);
});

// Примеры ливней без осадков
const showersNoMeasurable = patterns.shower.filter(r => !r.RRR || r.RRR === 'Осадков нет' || r.RRR === 'Следы осадков');
console.log(`\nЛивней без измеримых осадков: ${showersNoMeasurable.length}`);
console.log('Примеры ливней без измеримых осадков:');
showersNoMeasurable.slice(0, 5).forEach(r => {
  console.log(`  ${r.dateTime}: T=${r.T}°C, RRR=${r.RRR}, WW="${r.WW.substring(0, 60)}..."`);
});

// Анализируем грозы
console.log('\n\n=== ДЕТАЛЬНЫЙ АНАЛИЗ ГРОЗ ===\n');
console.log(`Всего случаев гроз: ${patterns.thunderstorm.length}\n`);

// Типы гроз
const thunderstormTypes = {};
patterns.thunderstorm.forEach(r => {
  const ww = r.WW;
  let type = 'Другое';
  if (ww.includes('Гроза слабая или умеренная без града')) type = 'Гроза слабая/умеренная без града';
  else if (ww.includes('Гроза, но без осадков')) type = 'Гроза без осадков';
  else if (ww.includes('Гроза (с осадками или без них)')) type = 'Гроза (общее)';
  else if (ww.includes('Видна молния, грома не слышно')) type = 'Зарница';
  else if (ww.includes('градин')) type = 'Гроза с градом';
  
  if (!thunderstormTypes[type]) thunderstormTypes[type] = [];
  thunderstormTypes[type].push(r);
});

console.log('Типы гроз:');
Object.entries(thunderstormTypes).sort((a, b) => b[1].length - a[1].length).forEach(([type, records]) => {
  console.log(`  ${type}: ${records.length} случаев`);
});

// Примеры гроз
console.log('\nПримеры гроз:');
patterns.thunderstorm.slice(0, 5).forEach(r => {
  console.log(`  ${r.dateTime}: T=${r.T}°C, RRR=${r.RRR}, WW="${r.WW}"`);
  console.log(`    W1="${r.W1}", W2="${r.W2}"\n`);
});

console.log('\n=== АНАЛИЗ ЗАВЕРШЁН ===');
