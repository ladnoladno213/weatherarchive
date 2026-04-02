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
  console.log(`Node.js version: ${process.version}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log('');
  
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
        console.error(`❌ Failed: ${station.wmoId} (download returned null)`);
        failCount++;
      }
    } catch (error) {
      console.error(`❌ Error for station ${station.wmoId}:`, error.message);
      console.error('Stack trace:', error.stack);
      failCount++;
    }
    
    // Пауза между запросами
    if (STATIONS.length > 1 && STATIONS.indexOf(station) < STATIONS.length - 1) {
      console.log('Waiting 5 seconds before next station...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${successCount} success, ${failCount} failed`);
  console.log('='.repeat(70));
  
  // Выходим с ошибкой если были неудачи
  if (failCount > 0) {
    console.error(`\nExiting with error code 1 due to ${failCount} failed downloads`);
    process.exit(1);
  }
  
  console.log('\nAll downloads completed successfully!');
  process.exit(0);
}

main().catch(error => {
  console.error('\n' + '='.repeat(70));
  console.error('FATAL ERROR:');
  console.error('='.repeat(70));
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('='.repeat(70));
  process.exit(1);
});
