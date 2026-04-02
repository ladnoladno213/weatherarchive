const { downloadRP5CSV, getRP5CSVPath } = require('./rp5-csv-downloader');

async function test() {
  console.log('Тестирование автоматической загрузки CSV с RP5...\n');
  
  // Тест 1: Скачивание CSV для Ишима за последний месяц
  const geonameId = '1505453'; // Ишим
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  
  console.log(`Период: ${startStr} - ${endStr}\n`);
  
  // Получаем путь к CSV (скачает если нужно)
  const csvPath = await getRP5CSVPath(geonameId, startStr, endStr);
  
  if (csvPath) {
    console.log('\n✓ Успешно!');
    console.log(`Файл: ${csvPath}`);
  } else {
    console.log('\n✗ Ошибка загрузки');
  }
}

test().catch(console.error);
