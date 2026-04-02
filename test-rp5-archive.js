// Тест нового API архива RP5

const { buildRP5ArchiveURL, downloadRP5Archive, testRP5ArchiveAvailability } = require('./rp5-archive-downloader.js');

async function testArchive() {
  console.log('=== Тест RP5 Archive API ===\n');
  
  // Тест 1: Построение URL
  console.log('1. Тест построения URL:');
  const url = buildRP5ArchiveURL('28573', '2005-02-01', '2026-04-01');
  console.log('URL:', url);
  console.log('Ожидаемый:', 'https://ru1.rp5.ru/download/files.synop/28/28573.01.02.2005.01.04.2026.1.0.0.ru.utf8.00000000.csv.gz');
  console.log('Совпадает:', url === 'https://ru1.rp5.ru/download/files.synop/28/28573.01.02.2005.01.04.2026.1.0.0.ru.utf8.00000000.csv.gz');
  console.log();
  
  // Тест 2: Проверка доступности
  console.log('2. Тест доступности архива для Ишима (28573):');
  const available = await testRP5ArchiveAvailability('28573');
  console.log('Доступен:', available ? '✓ Да' : '✗ Нет');
  console.log();
  
  // Тест 3: Проверка доступности для Москвы
  console.log('3. Тест доступности архива для Москвы (27612):');
  const availableMoscow = await testRP5ArchiveAvailability('27612');
  console.log('Доступен:', availableMoscow ? '✓ Да' : '✗ Нет');
  console.log();
  
  // Тест 4: Скачивание небольшого периода для Ишима
  console.log('4. Тест скачивания архива (июль 2023):');
  const filePath = await downloadRP5Archive('28573', '2023-07-01', '2023-07-31', 'ishim');
  
  if (filePath) {
    console.log('✓ Файл успешно скачан и распакован');
    console.log('Путь:', filePath);
  } else {
    console.log('✗ Не удалось скачать файл');
  }
}

testArchive().catch(console.error);
