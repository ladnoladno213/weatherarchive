const fs = require('fs');
const path = require('path');

/**
 * Автоматический загрузчик CSV файлов с RP5
 * 
 * RP5 предоставляет данные через форму на странице:
 * http://rp5.ru/archive.php?wmo_id=28573&lang=ru
 * 
 * Параметры формы:
 * - wmo_id: WMO ID станции
 * - datepicker1: дата начала (DD.MM.YYYY)
 * - datepicker2: дата окончания (DD.MM.YYYY)
 * - f_ed3: кодировка (8 = UTF-8)
 * - f_ed4: разделитель (1 = точка с запятой)
 * - f_ed5: формат (1 = только синоптические сроки)
 */

// Загружаем маппинг из файла (если существует)
let GEONAME_TO_WMO = {
  '1505453': '28573', // Ишим (по умолчанию)
};

let GEONAME_TO_CITY = {
  '1505453': 'ishim',
};

// Пытаемся загрузить сгенерированный маппинг
try {
  const mappingPath = path.join(__dirname, 'data', 'wmo-mapping.js');
  if (fs.existsSync(mappingPath)) {
    const mapping = require('./data/wmo-mapping');
    // Наш файл экспортирует просто объект, не вложенный
    if (typeof mapping === 'object' && !mapping.GEONAME_TO_WMO) {
      GEONAME_TO_WMO = { ...GEONAME_TO_WMO, ...mapping };
      console.log(`[rp5-downloader] Loaded WMO mapping for ${Object.keys(mapping).length} cities`);
    } else {
      GEONAME_TO_WMO = { ...GEONAME_TO_WMO, ...mapping.GEONAME_TO_WMO };
      GEONAME_TO_CITY = { ...GEONAME_TO_CITY, ...mapping.GEONAME_TO_CITY };
      console.log(`[rp5-downloader] Loaded WMO mapping for ${Object.keys(GEONAME_TO_WMO).length} cities`);
    }
  }
} catch (error) {
  console.log('[rp5-downloader] Using default WMO mapping:', error.message);
}

/**
 * Формирует URL для скачивания CSV с RP5
 * @param {string} wmoId - WMO ID станции
 * @param {string} startDate - дата начала (DD.MM.YYYY)
 * @param {string} endDate - дата окончания (DD.MM.YYYY)
 * @returns {string} URL для скачивания
 */
function buildRP5DownloadURL(wmoId, startDate, endDate) {
  // RP5 использует POST запрос для генерации CSV
  // Но можно использовать прямую ссылку с параметрами
  const params = new URLSearchParams({
    wmo_id: wmoId,
    datepicker1: startDate,
    datepicker2: endDate,
    f_ed3: '8',  // UTF-8
    f_ed4: '1',  // точка с запятой
    f_ed5: '1',  // только синоптические сроки
    f_ed2: '1',  // все дни
  });
  
  return `http://rp5.ru/responses/reFileSynop.php?${params.toString()}`;
}

/**
 * Скачивает CSV файл с RP5
 * @param {string} geonameId - ID города
 * @param {string} startDate - дата начала (YYYY-MM-DD)
 * @param {string} endDate - дата окончания (YYYY-MM-DD)
 * @returns {Promise<string>} путь к скачанному файлу
 */
async function downloadRP5CSV(geonameId, startDate, endDate) {
  const wmoId = GEONAME_TO_WMO[geonameId];
  if (!wmoId) {
    console.log(`[rp5-downloader] No WMO mapping for geonameId=${geonameId}`);
    return null;
  }
  
  const cityName = GEONAME_TO_CITY[geonameId] || geonameId;
  
  // Конвертируем даты из YYYY-MM-DD в DD.MM.YYYY
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };
  
  const startDateRP5 = formatDate(startDate);
  const endDateRP5 = formatDate(endDate);
  
  console.log(`[rp5-downloader] Downloading CSV for ${cityName} (WMO=${wmoId})`);
  console.log(`[rp5-downloader] Period: ${startDateRP5} - ${endDateRP5}`);
  
  // ВАЖНО: RP5 требует POST запрос с формой
  // Для автоматизации нужно использовать fetch с методом POST
  const url = 'http://rp5.ru/responses/reFileSynop.php';
  const formData = new URLSearchParams({
    wmo_id: wmoId,
    datepicker1: startDateRP5,
    datepicker2: endDateRP5,
    f_ed3: '8',  // UTF-8
    f_ed4: '1',  // точка с запятой
    f_ed5: '1',  // только синоптические сроки
    f_ed2: '1',  // все дни
  });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
    });
    
    if (!response.ok) {
      console.error(`[rp5-downloader] HTTP error: ${response.status}`);
      return null;
    }
    
    const content = await response.text();
    
    // Проверяем, что получили CSV (должен начинаться с комментария)
    if (!content.startsWith('#')) {
      console.error('[rp5-downloader] Invalid CSV format');
      console.error('[rp5-downloader] Response preview:', content.substring(0, 500));
      return null;
    }
    
    // Создаём папку для CSV файлов
    const csvDir = path.join(__dirname, 'data', 'rp5-csv');
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }
    
    // Формируем имя файла
    const fileName = `${wmoId}.${startDate}.${endDate}.${cityName}.utf8.csv`;
    const filePath = path.join(csvDir, fileName);
    
    // Сохраняем файл
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[rp5-downloader] Saved to: ${filePath}`);
    console.log(`[rp5-downloader] File size: ${(content.length / 1024).toFixed(2)} KB`);
    
    return filePath;
  } catch (error) {
    console.error('[rp5-downloader] Download failed:', error.message);
    return null;
  }
}

/**
 * Получает путь к CSV файлу для города (скачивает если нужно)
 * @param {string} geonameId - ID города
 * @param {string} startDate - дата начала (YYYY-MM-DD)
 * @param {string} endDate - дата окончания (YYYY-MM-DD)
 * @returns {Promise<string|null>} путь к CSV файлу или null
 */
async function getRP5CSVPath(geonameId, startDate, endDate) {
  const wmoId = GEONAME_TO_WMO[geonameId];
  if (!wmoId) {
    return null;
  }
  
  const cityName = GEONAME_TO_CITY[geonameId] || geonameId;
  const csvDir = path.join(__dirname, 'data', 'rp5-csv');
  
  // Ищем существующий файл
  if (fs.existsSync(csvDir)) {
    const files = fs.readdirSync(csvDir);
    const pattern = new RegExp(`^${wmoId}\\..*\\.${cityName}\\.utf8\\.csv$`);
    const existingFile = files.find(f => pattern.test(f));
    
    if (existingFile) {
      const filePath = path.join(csvDir, existingFile);
      const stats = fs.statSync(filePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      
      // Если файл свежий (< 24 часов), используем его
      if (ageHours < 24) {
        console.log(`[rp5-downloader] Using cached file: ${existingFile} (age: ${ageHours.toFixed(1)}h)`);
        return filePath;
      } else {
        console.log(`[rp5-downloader] Cached file is old (${ageHours.toFixed(1)}h), re-downloading...`);
      }
    }
  }
  
  // Скачиваем новый файл
  return await downloadRP5CSV(geonameId, startDate, endDate);
}

module.exports = {
  downloadRP5CSV,
  getRP5CSVPath,
  GEONAME_TO_WMO,
  GEONAME_TO_CITY,
};
