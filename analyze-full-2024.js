const fs = require('fs');
const readline = require('readline');

async function analyzeFullYear2024() {
  const fileStream = fs.createReadStream('28573.01.02.2005.31.03.2026.1.0.0.ru.utf8.00000000.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headerLine = null;
  let headers = [];
  const data2024 = [];
  
  console.log('Начинаем чтение CSV файла...\n');
  
  for await (const line of rl) {
    if (line.startsWith('#')) continue;
    
    if (!headerLine) {
      headerLine = line;
      headers = line.split(';').map(h => h.trim().replace(/"/g, ''));
      continue;
    }
    
    const values = line.split(';');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
    });
    
    // Фильтруем только 2024 год
    const dateTime = row['Местное время в Ишиме'];
    if (dateTime && dateTime.includes('.2024 ')) {
      data2024.push(row);
    }
  }

  console.log(`Всего записей за 2024 год: ${data2024.length}\n`);
  
  // Создаем отчет
  let report = '# ПОЛНЫЙ АНАЛИЗ ПОГОДЫ ЗА 2024 ГОД (ИШИМ)\n\n';
  report += `Всего записей: ${data2024.length}\n\n`;
  
  // Статистика по WW
  const wwStats = {};
  data2024.forEach(r => {
    const ww = r['WW'] || '(пусто)';
    wwStats[ww] = (wwStats[ww] || 0) + 1;
  });
  
  report += '## СТАТИСТИКА WW (ТЕКУЩАЯ ПОГОДА)\n\n';
  Object.entries(wwStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ww, count]) => {
      report += `${count} раз: "${ww}"\n`;
    });
  
  // Статистика по W1
  const w1Stats = {};
  data2024.forEach(r => {
    const w1 = r['W1'] || '(пусто)';
    w1Stats[w1] = (w1Stats[w1] || 0) + 1;
  });
  
  report += '\n## СТАТИСТИКА W1 (ПРОШЕДШАЯ ПОГОДА 3-6 ЧАСОВ)\n\n';
  Object.entries(w1Stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([w1, count]) => {
      report += `${count} раз: "${w1}"\n`;
    });
  
  // Статистика по W2
  const w2Stats = {};
  data2024.forEach(r => {
    const w2 = r['W2'] || '(пусто)';
    w2Stats[w2] = (w2Stats[w2] || 0) + 1;
  });
  
  report += '\n## СТАТИСТИКА W2 (ПРОШЕДШАЯ ПОГОДА 6-12 ЧАСОВ)\n\n';
  Object.entries(w2Stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([w2, count]) => {
      report += `${count} раз: "${w2}"\n`;
    });
  
  // Комбинации WW/W1/W2
  const combinations = {};
  data2024.forEach(r => {
    const ww = r['WW'] || '';
    const w1 = r['W1'] || '';
    const w2 = r['W2'] || '';
    
    if (!ww && !w1 && !w2) return;
    
    const key = `WW: "${ww}" | W1: "${w1}" | W2: "${w2}"`;
    
    if (!combinations[key]) {
      combinations[key] = {
        count: 0,
        examples: []
      };
    }
    
    combinations[key].count++;
    
    if (combinations[key].examples.length < 3) {
      combinations[key].examples.push({
        date: r['Местное время в Ишиме'],
        T: r['T'],
        RRR: r['RRR'],
        N: r['N'],
        U: r['U']
      });
    }
  });
  
  report += '\n## ТОП 50 КОМБИНАЦИЙ WW/W1/W2\n\n';
  Object.entries(combinations)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)
    .forEach(([key, data]) => {
      report += `\n### ${data.count} раз(а):\n${key}\n`;
      report += 'Примеры:\n';
      data.examples.forEach(ex => {
        report += `- ${ex.date}: T=${ex.T}°C, RRR=${ex.RRR}, N=${ex.N}%, U=${ex.U}%\n`;
      });
    });
  
  // Анализ конкретных явлений
  report += '\n## ДЕТАЛЬНЫЙ АНАЛИЗ ЯВЛЕНИЙ\n\n';
  
  // Морось
  const drizzle = data2024.filter(r => 
    r['WW'] && (r['WW'].toLowerCase().includes('морось'))
  );
  report += `### МОРОСЬ (${drizzle.length} случаев)\n\n`;
  drizzle.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, RRR=${r['RRR']}, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Ливни
  const showers = data2024.filter(r => 
    r['WW'] && (r['WW'].toLowerCase().includes('ливневый') || r['WW'].toLowerCase().includes('ливень'))
  );
  report += `\n### ЛИВНИ (${showers.length} случаев)\n\n`;
  showers.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, RRR=${r['RRR']}, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Дождь обычный
  const rain = data2024.filter(r => 
    r['WW'] && r['WW'].toLowerCase().includes('дождь') && 
    !r['WW'].toLowerCase().includes('ливневый') &&
    !r['WW'].toLowerCase().includes('морось')
  );
  report += `\n### ДОЖДЬ ОБЫЧНЫЙ (${rain.length} случаев)\n\n`;
  rain.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, RRR=${r['RRR']}, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Снег
  const snow = data2024.filter(r => 
    r['WW'] && r['WW'].toLowerCase().includes('снег') && !r['WW'].toLowerCase().includes('ливневый')
  );
  report += `\n### СНЕГ (${snow.length} случаев)\n\n`;
  snow.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, RRR=${r['RRR']}, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Грозы
  const thunderstorms = data2024.filter(r => 
    r['WW'] && (r['WW'].toLowerCase().includes('гроза'))
  );
  report += `\n### ГРОЗЫ (${thunderstorms.length} случаев)\n\n`;
  thunderstorms.forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, RRR=${r['RRR']}, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Туман
  const fog = data2024.filter(r => 
    r['WW'] && (r['WW'].toLowerCase().includes('туман'))
  );
  report += `\n### ТУМАН (${fog.length} случаев)\n\n`;
  fog.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, VV=${r['VV']}км, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Дымка
  const haze = data2024.filter(r => 
    r['WW'] && (r['WW'].toLowerCase().includes('дымка'))
  );
  report += `\n### ДЫМКА (${haze.length} случаев)\n\n`;
  haze.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, VV=${r['VV']}км, N=${r['N']}%, U=${r['U']}%\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Метель и поземок
  const blizzard = data2024.filter(r => 
    r['WW'] && (r['WW'].toLowerCase().includes('метель') || r['WW'].toLowerCase().includes('поземок'))
  );
  report += `\n### МЕТЕЛЬ И ПОЗЕМОК (${blizzard.length} случаев)\n\n`;
  blizzard.slice(0, 20).forEach(r => {
    report += `${r['Местное время в Ишиме']}: T=${r['T']}°C, RRR=${r['RRR']}, N=${r['N']}%, Ff=${r['Ff']}м/с\n`;
    report += `  WW: "${r['WW']}"\n`;
    report += `  W1: "${r['W1']}"\n`;
    report += `  W2: "${r['W2']}"\n\n`;
  });
  
  // Анализ W2 с облачностью
  const w2WithClouds = data2024.filter(r => 
    r['W2'] && r['W2'].includes('Облака покрывали')
  );
  report += `\n### W2 С ОБЛАЧНОСТЬЮ (${w2WithClouds.length} случаев)\n\n`;
  report += 'Что было в W1 при этом:\n\n';
  const w1WhenW2Clouds = {};
  w2WithClouds.forEach(r => {
    const w1 = r['W1'] || '(пусто)';
    w1WhenW2Clouds[w1] = (w1WhenW2Clouds[w1] || 0) + 1;
  });
  Object.entries(w1WhenW2Clouds)
    .sort((a, b) => b[1] - a[1])
    .forEach(([w1, count]) => {
      report += `${count} раз: "${w1}"\n`;
    });
  
  // Сохраняем отчет
  fs.writeFileSync('FULL-2024-ANALYSIS.md', report, 'utf8');
  console.log('\nОтчет сохранен в файл: FULL-2024-ANALYSIS.md');
  console.log('Анализ завершен!');
}

analyzeFullYear2024().catch(console.error);
