/**
 * Альтернативная версия getCityHierarchy без GeoNames API
 * Использует только локальные данные из geo-db.js
 */

const geoDB = require('./data/geo-db');

// Кэш для иерархии
const _hierCache = new Map();

// Haversine формула для расчёта расстояния между координатами
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

// Получить иерархию по координатам используя только локальные данные
async function getCityHierarchyLocal(lat, lon) {
  const key = `${Math.round(lat * 100) / 100},${Math.round(lon * 100) / 100}`;
  if (_hierCache.has(key)) return _hierCache.get(key);
  
  const empty = { 
    cityName: '', 
    countryCode: '', 
    stateCode: '', 
    admin1: '', 
    admin2: '', 
    admin3: '', 
    admin4: '' 
  };
  
  try {
    // Ищем ближайший город в локальной базе
    const nearbyCity = geoDB.findNearest(lat, lon, 1)[0];
    
    if (!nearbyCity) return empty;
    
    const result = {
      cityName: nearbyCity.nameRu || nearbyCity.name,
      countryCode: nearbyCity.cc || '',
      stateCode: nearbyCity.adm1 || '',
      admin1: '', // Можно добавить mapping для регионов
      admin2: '',
      admin3: '',
      admin4: '',
    };
    
    _hierCache.set(key, result);
    return result;
    
  } catch (error) {
    console.error('Error in getCityHierarchyLocal:', error);
    return empty;
  }
}

module.exports = {
  getCityHierarchyLocal,
  getDistance
};
