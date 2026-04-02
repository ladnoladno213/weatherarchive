const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

/**
 * Прямой загрузчик архивных CSV файлов с RP5
 * 
 * Обнаружен прямой доступ к архиву RP5:
 * https://ru1.rp5.ru/download/files.synop/28/28573.01.02.2005.01.04.2026.1.0.0.ru.utf8.00000000.csv.gz
 * 
 * Структура URL:
 * - Базовый URL: https://ru1.rp5.ru/download/files.synop/
 * - Папка: первые 2 цифры WMO ID (например, 28 для 28573)
 * - Имя файла: WMO_ID.DD.MM.YYYY.DD.MM.YYYY.1.0.0.ru.utf8.00000000.csv.gz
 */

// Проверяем доступность fetch (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('[rp5-archive] ERROR: fetch is not available. Please use Node.js 18 or higher.');
  console.error('[rp5-archive] Current Node.js version:', process.version);
  process.exit(1);
}

// Загружаем маппинг WMO ID
let wmoMapping = {};
try {
  wmoMapping = require('./data/wmo-mapping.js');
  console.log(`[rp5-archive] Loaded WMO mapping for ${Object.keys(wmoMapping).length} cities`);
} catch (error) {
  console.log('[rp5-archive] Warning: Could not load WMO mapping');
}

/**
 * Формирует URL для скачивания архивного CSV с RP5
 * @param {string} wmoId - WMO ID станции (например, "28573")
 * @param {string} startDate - дата начала (YYYY-MM-DD)
 * @param {string} endDate - дата окончания (YYYY-MM-DD)
 * @returns {string} URL для скачивания
 */
function buildRP5ArchiveURL(wmoId, startDate, endDate) {
  // Конвертируем даты из YYYY-MM-DD в DD.MM.YYYY
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };
  
  const startDateRP5 = formatDate(startDate);
  const endDateRP5 = formatDate(endDate);
  
  // Первые 2 цифры WMO ID для папки
  const folder = wmoId.substring(0, 2);
  
  // Формируем URL
  const baseUrl = 'https://ru1.rp5.ru/download/files.synop';
  const fileName = `${wmoId}.${startDateRP5}.${endDateRP5}.1.0.0.ru.utf8.00000000.csv.gz`;
  
  return `${baseUrl}/${folder}/${fileName}`;
}

/**
 * Скачивает и распаковывает архивный CSV файл с RP5
 * @param {string} wmoId - WMO ID станции
 * @param {string} startDate - дата начала (YYYY-MM-DD)
 * @param {string} endDate - дата окончания (YYYY-MM-DD)
 * @param {string} cityName - название города (для имени файла)
 * @returns {Promise<string|null>} путь к распакованному CSV файлу или null
 */
async function downloadRP5Archive(wmoId, startDate, endDate, cityName = null) {
  // Пробуем разные серверы RP5
  const servers = ['ru1', 'ru2', 'ru3', 'ru4', 'ru5'];
  
  for (const server of servers) {
    const baseUrl = `https://${server}.rp5.ru/download/files.synop`;
    const formatDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-');
      return `${day}.${month}.${year}`;
    };
    
    const startDateRP5 = formatDate(startDate);
    const endDateRP5 = formatDate(endDate);
    const folder = wmoId.substring(0, 2);
    const fileName = `${wmoId}.${startDateRP5}.${endDateRP5}.1.0.0.ru.utf8.00000000.csv.gz`;
    const url = `${baseUrl}/${folder}/${fileName}`;
    
    console.log(`[rp5-archive] Trying server ${server}...`);
    console.log(`[rp5-archive] URL: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': `https://rp5.ru/archive.php?wmo_id=${wmoId}&lang=ru`,
          'Origin': 'https://rp5.ru',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
        }
      });
      
      if (response.ok) {
        console.log(`[rp5-archive] Success on server ${server}!`);
        
        // Создаём папку для CSV файлов
        const csvDir = path.join(__dirname, 'data', 'rp5-csv');
        if (!fs.existsSync(csvDir)) {
          fs.mkdirSync(csvDir, { recursive: true });
        }
        
        // Формируем имя файла (без .gz)
        const city = cityName || wmoId;
        const fileName = `${wmoId}.${startDate}.${endDate}.${city}.utf8.csv`;
        const filePath = path.join(csvDir, fileName);
        
        // Скачиваем и распаковываем на лету
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`[rp5-archive] Downloaded ${(buffer.length / 1024).toFixed(2)} KB (compressed)`);
        
        // Распаковываем gzip
        const decompressed = zlib.gunzipSync(buffer);
        
        console.log(`[rp5-archive] Decompressed to ${(decompressed.length / 1024).toFixed(2)} KB`);
        
        // Проверяем, что это CSV (должен начинаться с #)
        const content = decompressed.toString('utf8');
        if (!content.startsWith('#')) {
          console.error('[rp5-archive] Invalid CSV format - does not start with #');
          console.error('[rp5-archive] First 200 chars:', content.substring(0, 200));
          continue; // Пробуем следующий сервер
        }
        
        // Сохраняем файл
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`[rp5-archive] Saved to: ${filePath}`);
        console.log(`[rp5-archive] File size: ${(content.length / 1024).toFixed(2)} KB`);
        
        // Подсчитываем количество строк данных
        const lines = content.split('\n').filter(line => line && !line.startsWith('#'));
        console.log(`[rp5-archive] Data rows: ${lines.length}`);
        
        return filePath;
      } else {
        console.log(`[rp5-archive] Server ${server} returned: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`[rp5-archive] Server ${server} error: ${error.message}`);
    }
  }
  
  console.error('[rp5-archive] All servers failed');
  return null;
}

/**
 * Получает путь к CSV файлу для города (скачивает если нужно)
 * @param {string} geonameId - ID города из GeoNames
 * @param {string} startDate - дата начала (YYYY-MM-DD)
 * @param {string} endDate - дата окончания (YYYY-MM-DD)
 * @returns {Promise<string|null>} путь к CSV файлу или null
 */
async function getRP5ArchivePath(geonameId, startDate, endDate) {
  const wmoId = wmoMapping[geonameId];
  if (!wmoId) {
    console.log(`[rp5-archive] No WMO mapping for geonameId=${geonameId}`);
    return null;
  }
  
  const csvDir = path.join(__dirname, 'data', 'rp5-csv');
  
  // Ищем существующий файл для этого WMO ID
  if (fs.existsSync(csvDir)) {
    const files = fs.readdirSync(csvDir);
    const pattern = new RegExp(`^${wmoId}\\..*\\.csv$`);
    const existingFile = files.find(f => pattern.test(f));
    
    if (existingFile) {
      const filePath = path.join(csvDir, existingFile);
      const stats = fs.statSync(filePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      
      // Если файл свежий (< 7 дней), используем его
      if (ageHours < 24 * 7) {
        console.log(`[rp5-archive] Using cached file: ${existingFile} (age: ${(ageHours / 24).toFixed(1)} days)`);
        return filePath;
      } else {
        console.log(`[rp5-archive] Cached file is old (${(ageHours / 24).toFixed(1)} days), re-downloading...`);
      }
    }
  }
  
  // Также проверяем корень проекта
  const rootFiles = fs.readdirSync(__dirname);
  const rootPattern = new RegExp(`^${wmoId}\\..*\\.csv$`);
  const rootFile = rootFiles.find(f => rootPattern.test(f));
  
  if (rootFile) {
    const filePath = path.join(__dirname, rootFile);
    console.log(`[rp5-archive] Using root CSV file: ${rootFile}`);
    return filePath;
  }
  
  // Скачиваем новый файл
  // Для архива используем максимальный период (с начала работы станции до сегодня)
  // RP5 автоматически ограничит период доступными данными
  const archiveStartDate = '2000-01-01'; // Начинаем с 2000 года
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`[rp5-archive] Downloading full archive from ${archiveStartDate} to ${today}`);
  
  return await downloadRP5Archive(wmoId, archiveStartDate, today, geonameId);
}

/**
 * Тестирует доступность архива для WMO ID
 * @param {string} wmoId - WMO ID станции
 * @returns {Promise<boolean>} true если архив доступен
 */
async function testRP5ArchiveAvailability(wmoId) {
  const url = buildRP5ArchiveURL(wmoId, '2020-01-01', '2020-12-31');
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://rp5.ru/',
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

module.exports = {
  buildRP5ArchiveURL,
  downloadRP5Archive,
  getRP5ArchivePath,
  testRP5ArchiveAvailability,
};
