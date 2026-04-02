#!/usr/bin/env node
/**
 * RP5 GitHub Actions Downloader
 * Скачивает архивные данные для заданных станций
 */

const { downloadRP5Archive } = require('./rp5-archive-downloader.js');

// Список станций для скачивания
const STATIONS = [
  {
    wmoId: '28573',
    cityName: 'Ishim',
    startDate: '2005-01-01',
    endDate: '2026-04-02'
  },
  // Добавьте другие станции здесь
];

async function main() {
  console.log('='.repeat(70));
  console.log('RP5 GITHUB ACTIONS DOWNLOADER');
  console.log('='.repeat(70));
  
  let successCount = 0;
  let failCount = 0;
  
  for (const station of STATIONS) {
    console.log(`\nProcessing station ${station.wmoId} (${station.cityName})...`);
    
    try {
      const filePath = await downloadRP5Archive(
        station.wmoId,
        station.startDate,
        station.endDate,
        station.cityName
      );
      
      if (filePath) {
        console.log(`✅ Success: ${filePath}`);
        successCount++;
      } else {
        console.error(`❌ Failed: ${station.wmoId}`);
        failCount++;
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      failCount++;
    }
    
    // Пауза между запросами
    if (STATIONS.length > 1) {
      console.log('Waiting 5 seconds before next station...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${successCount} success, ${failCount} failed`);
  console.log('='.repeat(70));
  
  // Выходим с ошибкой если были неудачи
  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
