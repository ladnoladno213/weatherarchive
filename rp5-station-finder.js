const fs = require('fs');
const path = require('path');

/**
 * Поиск ближайшей метеостанции RP5 по координатам
 * 
 * RP5 предоставляет поиск станций через API:
 * http://rp5.ru/responses/searchStations.php?term={query}
 * 
 * Также можно использовать прямой поиск по координатам
 */

/**
 * Расстояние между двумя точками (формула гаверсинуса)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Ищет станции RP5 по названию города
 * @param {string} cityName - название города
 * @returns {Promise<Array>} массив найденных станций
 */
async function searchRP5Stations(cityName) {
  const url = `http://rp5.ru/responses/searchStations.php?term=${encodeURIComponent(cityName)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.error(`[rp5-finder] HTTP error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[rp5-finder] Search failed:', error.message);
    return [];
  }
}

/**
 * Находит ближайшую станцию RP5 для города
 * @param {string} cityName - название города
 * @param {number} lat - широта
 * @param {number} lon - долгота
 * @returns {Promise<Object|null>} информация о станции или null
 */
async function findNearestRP5Station(cityName, lat, lon) {
  console.log(`[rp5-finder] Searching for station near ${cityName} (${lat}, ${lon})`);
  
  // Ищем станции по названию города
  const stations = await searchRP5Stations(cityName);
  
  if (stations.length === 0) {
    console.log('[rp5-finder] No stations found');
    return null;
  }
  
  console.log(`[rp5-finder] Found ${stations.length} stations`);
  
  // Находим ближайшую станцию
  let nearest = null;
  let minDistance = Infinity;
  
  for (const station of stations) {
    // RP5 возвращает станции в формате:
    // { value: "WMO_ID", label: "Название станции, Страна", lat: "XX.XX", lon: "YY.YY" }
    const stationLat = parseFloat(station.lat);
    const stationLon = parseFloat(station.lon);
    
    if (isNaN(stationLat) || isNaN(stationLon)) continue;
    
    const distance = haversineDistance(lat, lon, stationLat, stationLon);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = {
        wmoId: station.value,
        name: station.label,
        lat: stationLat,
        lon: stationLon,
        distance: distance,
      };
    }
  }
  
  if (nearest) {
    console.log(`[rp5-finder] Nearest station: ${nearest.name} (WMO=${nearest.wmoId}, distance=${nearest.distance.toFixed(1)}km)`);
  }
  
  return nearest;
}

/**
 * Генерирует маппинг geonameId -> WMO_ID для всех городов
 * @param {Array} cities - массив городов с полями {geonameId, name, lat, lon}
 * @returns {Promise<Object>} объект с маппингом
 */
async function generateWMOMapping(cities) {
  const mapping = {};
  const cityNames = {};
  
  console.log(`[rp5-finder] Generating WMO mapping for ${cities.length} cities...`);
  
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    console.log(`\n[${i+1}/${cities.length}] Processing ${city.name}...`);
    
    const station = await findNearestRP5Station(city.name, city.lat, city.lon);
    
    if (station && station.distance < 100) { // Только если станция в пределах 100км
      mapping[city.geonameId] = station.wmoId;
      cityNames[city.geonameId] = city.name.toLowerCase().replace(/\s+/g, '-');
      console.log(`✓ Mapped ${city.geonameId} -> ${station.wmoId}`);
    } else {
      console.log(`✗ No suitable station found for ${city.name}`);
    }
    
    // Задержка между запросами чтобы не перегружать RP5
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { mapping, cityNames };
}

/**
 * Сохраняет маппинг в файл
 */
function saveMappingToFile(mapping, cityNames, filePath) {
  const content = `// Автоматически сгенерированный маппинг geonameId -> WMO_ID
// Сгенерировано: ${new Date().toISOString()}

const GEONAME_TO_WMO = ${JSON.stringify(mapping, null, 2)};

const GEONAME_TO_CITY = ${JSON.stringify(cityNames, null, 2)};

module.exports = { GEONAME_TO_WMO, GEONAME_TO_CITY };
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n[rp5-finder] Mapping saved to ${filePath}`);
}

module.exports = {
  searchRP5Stations,
  findNearestRP5Station,
  generateWMOMapping,
  saveMappingToFile,
};
