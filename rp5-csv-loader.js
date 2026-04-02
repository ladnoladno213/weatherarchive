const fs = require('fs');

/**
 * Загружает исторические данные из CSV файла RP5
 * @param {string} csvPath - путь к CSV файлу
 * @param {string} geonameId - ID города (для проверки соответствия)
 * @returns {Map} - Map с ключами "YYYY-MM-DD_HH" и значениями-объектами с данными
 */
function loadRP5CSV(csvPath, geonameId) {
  // Проверяем существование файла
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.log(`[rp5-csv] File not found: ${csvPath}`);
    return new Map();
  }
  
  console.log(`[rp5-csv] Loading CSV for geonameId=${geonameId} from ${csvPath}`);
  
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  
  // Находим строку с заголовками (начинается с "Местное время")
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('"Местное время')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.log('[rp5-csv] Header not found');
    return new Map();
  }
  
  // Парсим заголовки
  const headerLine = lines[headerIndex];
  const headers = headerLine.split(';').map(h => h.replace(/"/g, '').trim());
  
  console.log(`[rp5-csv] Headers: ${headers.slice(0, 15).join(', ')}...`);
  
  // Индексы нужных столбцов
  const colIndex = {
    time: headers.indexOf('Местное время в Ишиме'),
    T: headers.indexOf('T'),
    Pa: headers.indexOf('Pa'),
    U: headers.indexOf('U'),
    DD: headers.indexOf('DD'),
    Ff: headers.indexOf('Ff'),
    ff10: headers.indexOf('ff10'),
    N: headers.indexOf('N'),
    WW: headers.indexOf('WW'),
    W1: headers.indexOf('W1'),
    W2: headers.indexOf('W2'),
    Tn: headers.indexOf('Tn'),
    Tx: headers.indexOf('Tx'),
    VV: headers.indexOf('VV'),
    Td: headers.indexOf('Td'),
    RRR: headers.indexOf('RRR'),
    tR: headers.indexOf('tR'),
    sss: headers.indexOf('sss')
  };
  
  const data = new Map();
  let rowCount = 0;
  
  // Парсим данные
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    
    // Парсим CSV строку (учитываем кавычки и точки с запятой внутри)
    const cols = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    
    if (cols.length < 10) continue;
    
    // Парсим дату и время
    const timeStr = cols[colIndex.time];
    if (!timeStr) continue;
    
    // Формат: "31.03.2026 23:00"
    const match = timeStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
    if (!match) continue;
    
    const [, day, month, year, hour, minute] = match;
    const dateKey = `${year}-${month}-${day}`;
    const key = `${dateKey}_${hour}`;
    
    // Парсим значения
    const parseValue = (val) => {
      if (!val || val === '' || val === ' ') return null;
      const num = parseFloat(val);
      return isNaN(num) ? val : num;
    };
    
    const parseText = (val) => {
      if (!val || val === '' || val === ' ') return null;
      return val;
    };
    
    data.set(key, {
      date: dateKey,
      time: hour,
      T: parseValue(cols[colIndex.T]),
      Pa: parseValue(cols[colIndex.Pa]),
      U: parseValue(cols[colIndex.U]),
      DD: parseText(cols[colIndex.DD]),
      Ff: parseValue(cols[colIndex.Ff]),
      ff10: parseValue(cols[colIndex.ff10]),
      N: parseText(cols[colIndex.N]),
      WW: parseText(cols[colIndex.WW]),
      W1: parseText(cols[colIndex.W1]),
      W2: parseText(cols[colIndex.W2]),
      Tn: parseValue(cols[colIndex.Tn]),
      Tx: parseValue(cols[colIndex.Tx]),
      VV: parseValue(cols[colIndex.VV]),
      Td: parseValue(cols[colIndex.Td]),
      RRR: parseText(cols[colIndex.RRR]),
      tR: parseValue(cols[colIndex.tR]),
      sss: parseValue(cols[colIndex.sss])
    });
    
    rowCount++;
  }
  
  console.log(`[rp5-csv] Loaded ${rowCount} rows`);
  return data;
}

module.exports = { loadRP5CSV };
