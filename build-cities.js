/**
 * Скрипт сборки базы городов из дампов GeoNames
 * Запуск: node build-cities.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function readLines(filePath, onLine) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    onLine(line);
  }
}

async function main() {
  console.log('Читаем cities1000.txt...');

  // Поля cities1000.txt (tab-separated):
  // 0:geonameId 1:name 2:asciiname 3:alternatenames 4:lat 5:lon
  // 6:featureClass 7:featureCode 8:countryCode 9:cc2
  // 10:admin1Code 11:admin2Code 12:admin3Code 13:admin4Code
  // 14:population 15:elevation 16:dem 17:timezone 18:modificationDate

  const cities = new Map(); // geonameId → city object
  await readLines(path.join(__dirname, 'data/cities1000.txt'), line => {
    if (!line.trim()) return;
    const f = line.split('\t');
    const id = parseInt(f[0]);
    cities.set(id, {
      id,
      name: f[1],       // английское название
      lat: parseFloat(f[4]),
      lon: parseFloat(f[5]),
      cc: f[8],         // country code (RU, DE, etc.)
      adm1: f[10],      // admin1 code
      pop: parseInt(f[14]) || 0,
      nameRu: null,     // заполним из alternateNames
    });
  });
  console.log(`Загружено городов: ${cities.size}`);

  console.log('Читаем alternateNamesV2.txt (только ru)...');
  // Поля: 0:alternateNameId 1:geonameId 2:isolanguage 3:alternateName
  // 4:isPreferredName 5:isShortName 6:isColloquial 7:isHistoric 8:from 9:to
  let ruCount = 0;
  await readLines(path.join(__dirname, 'data/alternateNamesV2.txt'), line => {
    if (!line.trim()) return;
    const f = line.split('\t');
    if (f[2] !== 'ru') return;
    const id = parseInt(f[1]);
    if (!cities.has(id)) return;
    const city = cities.get(id);
    const isPreferred = f[4] === '1';
    // Берём предпочтительное название, или первое попавшееся
    if (!city.nameRu || isPreferred) {
      city.nameRu = f[3];
      ruCount++;
    }
  });
  console.log(`Русских названий добавлено: ${ruCount}`);

  // Сохраняем как массив, сортируем по стране и admin1
  const arr = Array.from(cities.values());
  arr.sort((a, b) => {
    if (a.cc !== b.cc) return a.cc.localeCompare(b.cc);
    if (a.adm1 !== b.adm1) return a.adm1.localeCompare(b.adm1);
    return (b.pop - a.pop); // внутри региона — по населению убыв.
  });

  const outPath = path.join(__dirname, 'data/cities.json');
  fs.writeFileSync(outPath, JSON.stringify(arr), 'utf8');
  console.log(`Сохранено в data/cities.json (${arr.length} городов, ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(console.error);
