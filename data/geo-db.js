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

// Haversine формула для расчёта расстояния
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Найти N ближайших городов к координатам
function findNearest(lat, lon, limit = 1, maxDistance = 100) {
  load();
  const results = [];
  
  // Оптимизация: сначала фильтруем по грубой сетке (±1 градус ≈ 111 км)
  const latMin = lat - 1;
  const latMax = lat + 1;
  const lonMin = lon - 1;
  const lonMax = lon + 1;
  
  for (const c of _cities) {
    if (c.lat < latMin || c.lat > latMax || c.lon < lonMin || c.lon > lonMax) {
      continue;
    }
    
    const dist = getDistance(lat, lon, c.lat, c.lon);
    if (dist <= maxDistance) {
      results.push({ ...c, distance: dist });
    }
  }
  
  // Сортируем по расстоянию, потом по населению
  results.sort((a, b) => {
    const distDiff = a.distance - b.distance;
    if (Math.abs(distDiff) < 0.1) { // Если расстояние почти одинаковое
      return b.pop - a.pop; // Выбираем более крупный город
    }
    return distDiff;
  });
  
  return results.slice(0, limit);
}

module.exports = { 
  getById, 
  search, 
  getCitiesByCountry, 
  getCitiesByRegion,
  findNearest,
  getDistance
};
