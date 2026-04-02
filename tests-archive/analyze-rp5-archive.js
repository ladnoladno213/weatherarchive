/**
 * Скрипт для анализа архива погоды RP5 в формате CSV
 * Изучает коды WMO (WW, W1, W2) из реальных метеостанций
 */

const fs = require('fs');
const path = require('path');

// Путь к CSV файлу (скачанному с RP5)
const CSV_FILE = process.argv[2] || './rp5-archive.csv';

/**
 * Парсинг CSV файла с учетом кодировки UTF-8
 */
function parseCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Пропускаем комментарии (строки начинающиеся с #)
    let headerLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim().startsWith('#')) {
        headerLine = i;
        break;
      }
    }
    
    // Заголовки
    const headers = lines[headerLine].split(';').map(h => h.trim().replace(/"/g, ''));
    
    const data = [];
    for (let i = headerLine + 1; i < lines.length; i++) {
      if (!lines[i].trim() || lines[i].trim().startsWith('#')) continue;
      
      const values = lines[i].split(';').map(v => {
        let val = v.trim().replace(/"/g, '');
        // Пробел считаем пустым значением
        if (val === ' ') val = '';
        return val;
      });
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return { headers, data };
  } catch (error) {
    console.error('Ошибка чтения файла:', error.message);
    process.exit(1);
  }
}

/**
 * Анализ кодов WW, W1, W2
 */
function analyzeWeatherCodes(data) {
  const wwCodes = new Map(); // WW -> количество + примеры
  const w1Codes = new Map(); // W1 -> количество + примеры
  const w2Codes = new Map(); // W2 -> количество + примеры
  const combinations = new Map(); // WW+W1+W2 -> количество + примеры
  
  data.forEach(row => {
    const date = row['Местное время в Ишиме'] || row['Местное время'] || row['Дата'] || '';
    const ww = (row['WW'] || '').trim();
    const w1 = (row['W1'] || row['W\''] || '').trim();
    const w2 = (row['W2'] || row['W\'\''] || '').trim();
    const temp = row['T'] || '';
    const precip = row['RRR'] || '';
    
    // Пропускаем пустые строки
    if (!ww && !w1 && !w2) return;
    
    // Собираем статистику по WW
    if (ww) {
      if (!wwCodes.has(ww)) {
        wwCodes.set(ww, { count: 0, examples: [] });
      }
      const wwData = wwCodes.get(ww);
      wwData.count++;
      if (wwData.examples.length < 3) {
        wwData.examples.push({ date, temp, precip, w1, w2 });
      }
    }
    
    // Собираем статистику по W1
    if (w1) {
      if (!w1Codes.has(w1)) {
        w1Codes.set(w1, { count: 0, examples: [] });
      }
      const w1Data = w1Codes.get(w1);
      w1Data.count++;
      if (w1Data.examples.length < 3) {
        w1Data.examples.push({ date, temp, precip, ww, w2 });
      }
    }
    
    // Собираем статистику по W2
    if (w2) {
      if (!w2Codes.has(w2)) {
        w2Codes.set(w2, { count: 0, examples: [] });
      }
      const w2Data = w2Codes.get(w2);
      w2Data.count++;
      if (w2Data.examples.length < 3) {
        w2Data.examples.push({ date, temp, precip, ww, w1 });
      }
    }
    
    // Собираем комбинации
    if (ww || w1 || w2) {
      const combo = `${ww}|${w1}|${w2}`;
      if (!combinations.has(combo)) {
        combinations.set(combo, { count: 0, examples: [] });
      }
      const comboData = combinations.get(combo);
      comboData.count++;
      if (comboData.examples.length < 2) {
        comboData.examples.push({ date, temp, precip });
      }
    }
  });
  
  return { wwCodes, w1Codes, w2Codes, combinations };
}

/**
 * Поиск гроз
 */
function findThunderstorms(data) {
  const thunderstorms = [];
  
  data.forEach(row => {
    const date = row['Местное время в Ишиме'] || row['Местное время'] || row['Дата'] || '';
    const ww = (row['WW'] || '').toLowerCase().trim();
    const w1 = (row['W1'] || row['W\''] || '').toLowerCase().trim();
    const w2 = (row['W2'] || row['W\'\''] || '').toLowerCase().trim();
    
    if (ww.includes('гроз') || w1.includes('гроз') || w2.includes('гроз')) {
      thunderstorms.push({
        date,
        ww: row['WW'] || '',
        w1: row['W1'] || row['W\''] || '',
        w2: row['W2'] || row['W\'\''] || '',
        temp: row['T'] || '',
        precip: row['RRR'] || '',
        wind: row['Ff'] || ''
      });
    }
  });
  
  return thunderstorms;
}

/**
 * Поиск ливней
 */
function findShowers(data) {
  const showers = [];
  
  data.forEach(row => {
    const date = row['Местное время в Ишиме'] || row['Местное время'] || row['Дата'] || '';
    const ww = (row['WW'] || '').toLowerCase().trim();
    const w1 = (row['W1'] || row['W\''] || '').toLowerCase().trim();
    
    if (ww.includes('ливн') || w1.includes('ливн')) {
      showers.push({
        date,
        ww: row['WW'] || '',
        w1: row['W1'] || row['W\''] || '',
        w2: row['W2'] || row['W\'\''] || '',
        temp: row['T'] || '',
        precip: row['RRR'] || ''
      });
    }
  });
  
  return showers;
}

/**
 * Вывод результатов
 */
function printResults(analysis, thunderstorms, showers) {
  console.log('\n=== АНАЛИЗ АРХИВА ПОГОДЫ RP5 ===\n');
  
  // Статистика по WW
  console.log('--- КОДЫ WW (текущая погода) ---');
  const sortedWW = Array.from(analysis.wwCodes.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  sortedWW.forEach(([code, data]) => {
    console.log(`\n"${code}" - ${data.count} раз(а)`);
    data.examples.forEach(ex => {
      console.log(`  ${ex.date}: T=${ex.temp}°C, RRR=${ex.precip}, W1="${ex.w1}", W2="${ex.w2}"`);
    });
  });
  
  // Статистика по W1
  console.log('\n\n--- КОДЫ W1 (прошедшая погода 1) ---');
  const sortedW1 = Array.from(analysis.w1Codes.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  sortedW1.forEach(([code, data]) => {
    console.log(`\n"${code}" - ${data.count} раз(а)`);
    data.examples.forEach(ex => {
      console.log(`  ${ex.date}: T=${ex.temp}°C, WW="${ex.ww}"`);
    });
  });
  
  // Статистика по W2
  console.log('\n\n--- КОДЫ W2 (прошедшая погода 2) ---');
  const sortedW2 = Array.from(analysis.w2Codes.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  sortedW2.forEach(([code, data]) => {
    console.log(`\n"${code}" - ${data.count} раз(а)`);
    data.examples.forEach(ex => {
      console.log(`  ${ex.date}: T=${ex.temp}°C, WW="${ex.ww}"`);
    });
  });
  
  // Грозы
  if (thunderstorms.length > 0) {
    console.log('\n\n--- ГРОЗЫ (всего найдено: ' + thunderstorms.length + ') ---');
    thunderstorms.slice(0, 10).forEach(ts => {
      console.log(`\n${ts.date}:`);
      console.log(`  WW: "${ts.ww}"`);
      console.log(`  W1: "${ts.w1}"`);
      console.log(`  W2: "${ts.w2}"`);
      console.log(`  T=${ts.temp}°C, RRR=${ts.precip}мм, Ff=${ts.wind}м/с`);
    });
  }
  
  // Ливни
  if (showers.length > 0) {
    console.log('\n\n--- ЛИВНИ (всего найдено: ' + showers.length + ') ---');
    showers.slice(0, 10).forEach(sh => {
      console.log(`\n${sh.date}:`);
      console.log(`  WW: "${sh.ww}"`);
      console.log(`  W1: "${sh.w1}"`);
      console.log(`  W2: "${sh.w2}"`);
      console.log(`  T=${sh.temp}°C, RRR=${sh.precip}мм`);
    });
  }
  
  // Топ-10 комбинаций
  console.log('\n\n--- ТОП-10 КОМБИНАЦИЙ WW+W1+W2 ---');
  const sortedCombos = Array.from(analysis.combinations.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  sortedCombos.forEach(([combo, data]) => {
    const [ww, w1, w2] = combo.split('|');
    console.log(`\n${data.count} раз(а):`);
    console.log(`  WW: "${ww}"`);
    console.log(`  W1: "${w1}"`);
    console.log(`  W2: "${w2}"`);
    data.examples.forEach(ex => {
      console.log(`    ${ex.date}: T=${ex.temp}°C, RRR=${ex.precip}`);
    });
  });
}

/**
 * Сохранение результатов в файл
 */
function saveToFile(analysis, thunderstorms, showers) {
  const output = {
    summary: {
      totalWW: analysis.wwCodes.size,
      totalW1: analysis.w1Codes.size,
      totalW2: analysis.w2Codes.size,
      totalThunderstorms: thunderstorms.length,
      totalShowers: showers.length
    },
    wwCodes: Array.from(analysis.wwCodes.entries()).map(([code, data]) => ({
      code,
      count: data.count,
      examples: data.examples
    })),
    w1Codes: Array.from(analysis.w1Codes.entries()).map(([code, data]) => ({
      code,
      count: data.count,
      examples: data.examples
    })),
    w2Codes: Array.from(analysis.w2Codes.entries()).map(([code, data]) => ({
      code,
      count: data.count,
      examples: data.examples
    })),
    thunderstorms,
    showers
  };
  
  fs.writeFileSync('rp5-analysis.json', JSON.stringify(output, null, 2), 'utf8');
  console.log('\n\nРезультаты сохранены в файл: rp5-analysis.json');
}

// Главная функция
function main() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Файл не найден: ${CSV_FILE}`);
    console.log('\nИспользование:');
    console.log('  node analyze-rp5-archive.js <путь-к-csv-файлу>');
    console.log('\nПример:');
    console.log('  node analyze-rp5-archive.js ./rp5-ishim-2025-07.csv');
    process.exit(1);
  }
  
  console.log(`Чтение файла: ${CSV_FILE}`);
  const { headers, data } = parseCSV(CSV_FILE);
  
  console.log(`Найдено строк: ${data.length}`);
  console.log(`Колонки: ${headers.join(', ')}`);
  
  console.log('\nАнализ данных...');
  const analysis = analyzeWeatherCodes(data);
  const thunderstorms = findThunderstorms(data);
  const showers = findShowers(data);
  
  printResults(analysis, thunderstorms, showers);
  saveToFile(analysis, thunderstorms, showers);
}

main();
