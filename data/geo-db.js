/**
 * Локальная база городов из GeoNames dump
 * Загружается один раз при старте сервера
 */
const fs = require('fs');
const path = require('path');

let _cities = null;
let _byId = null;
let _byCountry = null; // cc → [cities]

function load() {
  if (_cities) return;
  console.log('Загружаем базу городов...');
  _cities = JSON.parse(fs.readFileSync(path.join(__dirname, 'cities.json'), 'utf8'));
  _byId = new Map(_cities.map(c => [c.id, c]));
  _byCountry = new Map();
  for (const c of _cities) {
    if (!_byCountry.has(c.cc)) _byCountry.set(c.cc, []);
    _byCountry.get(c.cc).push(c);
  }
  console.log(`База городов загружена: ${_cities.length} записей`);
}

// Получить город по ID
function getById(id) {
  load();
  return _byId.get(parseInt(id)) || null;
}

// Поиск городов по названию (русское или английское)
function search(query, limit = 10) {
  load();
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];
  const results = [];
  for (const c of _cities) {
    const nameRuLow = (c.nameRu || '').toLowerCase();
    const nameLow   = c.name.toLowerCase();
    if (nameRuLow.startsWith(q) || nameLow.startsWith(q)) {
      results.push(c);
      if (results.length >= limit * 3) break; // берём с запасом для сортировки
    }
  }
  // Сортируем: точное совпадение сначала, потом по населению
  results.sort((a, b) => {
    const aExact = (a.nameRu||'').toLowerCase() === q || a.name.toLowerCase() === q;
    const bExact = (b.nameRu||'').toLowerCase() === q || b.name.toLowerCase() === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return b.pop - a.pop;
  });
  return results.slice(0, limit);
}

// Получить все города страны
function getCitiesByCountry(cc) {
  load();
  return _byCountry.get(cc.toUpperCase()) || [];
}

// Получить города страны + региона (admin1Code)
function getCitiesByRegion(cc, adm1) {
  load();
  const all = _byCountry.get(cc.toUpperCase()) || [];
  return all.filter(c => c.adm1 === adm1).sort((a, b) => b.pop - a.pop);
}

module.exports = { getById, search, getCitiesByCountry, getCitiesByRegion };
