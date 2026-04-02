// База данных аэропортов с ICAO кодами
// ID начинаются с 9000000+ чтобы не пересекаться с geonames

const airports = [
  // Россия
  { id: 9000001, icao: 'UUEE', name: 'Шереметьево', nameEn: 'Sheremetyevo', city: 'Москва', cityEn: 'Moscow', country: 'RU', lat: 55.9726, lon: 37.4146, timezone: 'Europe/Moscow' },
  { id: 9000002, icao: 'UUDD', name: 'Домодедово', nameEn: 'Domodedovo', city: 'Москва', cityEn: 'Moscow', country: 'RU', lat: 55.4088, lon: 37.9063, timezone: 'Europe/Moscow' },
  { id: 9000003, icao: 'UUWW', name: 'Внуково', nameEn: 'Vnukovo', city: 'Москва', cityEn: 'Moscow', country: 'RU', lat: 55.5914, lon: 37.2615, timezone: 'Europe/Moscow' },
  { id: 9000004, icao: 'ULLI', name: 'Пулково', nameEn: 'Pulkovo', city: 'Санкт-Петербург', cityEn: 'Saint Petersburg', country: 'RU', lat: 59.8003, lon: 30.2625, timezone: 'Europe/Moscow' },
  { id: 9000005, icao: 'USSS', name: 'Кольцово', nameEn: 'Koltsovo', city: 'Екатеринбург', cityEn: 'Yekaterinburg', country: 'RU', lat: 56.7431, lon: 60.8027, timezone: 'Asia/Yekaterinburg' },
  { id: 9000006, icao: 'UNNT', name: 'Толмачёво', nameEn: 'Tolmachevo', city: 'Новосибирск', cityEn: 'Novosibirsk', country: 'RU', lat: 55.0126, lon: 82.6507, timezone: 'Asia/Novosibirsk' },
  { id: 9000007, icao: 'UWKD', name: 'Казань', nameEn: 'Kazan', city: 'Казань', cityEn: 'Kazan', country: 'RU', lat: 55.6062, lon: 49.2787, timezone: 'Europe/Moscow' },
  { id: 9000008, icao: 'UUOO', name: 'Внуково-3', nameEn: 'Vnukovo-3', city: 'Москва', cityEn: 'Moscow', country: 'RU', lat: 55.5547, lon: 37.2833, timezone: 'Europe/Moscow' },
  { id: 9000009, icao: 'URSS', name: 'Адлер', nameEn: 'Adler', city: 'Сочи', cityEn: 'Sochi', country: 'RU', lat: 43.4499, lon: 39.9566, timezone: 'Europe/Moscow' },
  { id: 9000010, icao: 'URKK', name: 'Пашковский', nameEn: 'Pashkovsky', city: 'Краснодар', cityEn: 'Krasnodar', country: 'RU', lat: 45.0347, lon: 39.1705, timezone: 'Europe/Moscow' },
  { id: 9000018, icao: 'URRR', name: 'Ростов-на-Дону', nameEn: 'Rostov-on-Don', city: 'Ростов-на-Дону', cityEn: 'Rostov-on-Don', country: 'RU', lat: 47.2582, lon: 39.8180, timezone: 'Europe/Moscow' },
  { id: 9000019, icao: 'UWWW', name: 'Курумоч', nameEn: 'Kurumoch', city: 'Самара', cityEn: 'Samara', country: 'RU', lat: 53.5049, lon: 50.1643, timezone: 'Europe/Samara' },
  { id: 9000021, icao: 'UIII', name: 'Иркутск', nameEn: 'Irkutsk', city: 'Иркутск', cityEn: 'Irkutsk', country: 'RU', lat: 52.2680, lon: 104.3889, timezone: 'Asia/Irkutsk' },
  { id: 9000022, icao: 'UHPP', name: 'Елизово', nameEn: 'Yelizovo', city: 'Петропавловск-Камчатский', cityEn: 'Petropavlovsk-Kamchatsky', country: 'RU', lat: 53.1679, lon: 158.4538, timezone: 'Asia/Kamchatka' },
  { id: 9000023, icao: 'UHHH', name: 'Хабаровск', nameEn: 'Khabarovsk', city: 'Хабаровск', cityEn: 'Khabarovsk', country: 'RU', lat: 48.5280, lon: 135.1884, timezone: 'Asia/Vladivostok' },
  { id: 9000024, icao: 'UHWW', name: 'Владивосток', nameEn: 'Vladivostok', city: 'Владивосток', cityEn: 'Vladivostok', country: 'RU', lat: 43.3990, lon: 132.1483, timezone: 'Asia/Vladivostok' },
  { id: 9000026, icao: 'USPP', name: 'Рощино', nameEn: 'Roshchino', city: 'Тюмень', cityEn: 'Tyumen', country: 'RU', lat: 57.1896, lon: 65.3243, timezone: 'Asia/Yekaterinburg' },
  { id: 9000027, icao: 'UNOO', name: 'Омск', nameEn: 'Omsk', city: 'Омск', cityEn: 'Omsk', country: 'RU', lat: 54.9670, lon: 73.3105, timezone: 'Asia/Omsk' },
  { id: 9000028, icao: 'USCM', name: 'Магнитогорск', nameEn: 'Magnitogorsk', city: 'Магнитогорск', cityEn: 'Magnitogorsk', country: 'RU', lat: 53.3931, lon: 58.7557, timezone: 'Asia/Yekaterinburg' },
  { id: 9000029, icao: 'USCC', name: 'Челябинск', nameEn: 'Chelyabinsk', city: 'Челябинск', cityEn: 'Chelyabinsk', country: 'RU', lat: 55.3058, lon: 61.5033, timezone: 'Asia/Yekaterinburg' },
  { id: 9000030, icao: 'USMU', name: 'Минеральные Воды', nameEn: 'Mineralnye Vody', city: 'Минеральные Воды', cityEn: 'Mineralnye Vody', country: 'RU', lat: 44.2251, lon: 43.0819, timezone: 'Europe/Moscow' },
  
  // Казахстан
  { id: 9000101, icao: 'UAAA', name: 'Алматы', nameEn: 'Almaty', city: 'Алматы', cityEn: 'Almaty', country: 'KZ', lat: 43.3521, lon: 77.0405, timezone: 'Asia/Almaty' },
  { id: 9000102, icao: 'UACC', name: 'Астана', nameEn: 'Astana', city: 'Астана', cityEn: 'Astana', country: 'KZ', lat: 51.0222, lon: 71.4669, timezone: 'Asia/Almaty' },
  
  // Беларусь
  { id: 9000201, icao: 'UMMS', name: 'Минск-2', nameEn: 'Minsk-2', city: 'Минск', cityEn: 'Minsk', country: 'BY', lat: 53.8825, lon: 28.0307, timezone: 'Europe/Minsk' },
  
  // Украина
  { id: 9000301, icao: 'UKBB', name: 'Борисполь', nameEn: 'Boryspil', city: 'Киев', cityEn: 'Kyiv', country: 'UA', lat: 50.3450, lon: 30.8947, timezone: 'Europe/Kiev' },
  
  // Узбекистан
  { id: 9000401, icao: 'UTTT', name: 'Ташкент', nameEn: 'Tashkent', city: 'Ташкент', cityEn: 'Tashkent', country: 'UZ', lat: 41.2579, lon: 69.2811, timezone: 'Asia/Tashkent' },
  
  // Грузия
  { id: 9000501, icao: 'UGTB', name: 'Тбилиси', nameEn: 'Tbilisi', city: 'Тбилиси', cityEn: 'Tbilisi', country: 'GE', lat: 41.6692, lon: 44.9547, timezone: 'Asia/Tbilisi' },
  
  // Армения
  { id: 9000601, icao: 'UDYZ', name: 'Звартноц', nameEn: 'Zvartnots', city: 'Ереван', cityEn: 'Yerevan', country: 'AM', lat: 40.1473, lon: 44.3959, timezone: 'Asia/Yerevan' },
  
  // Азербайджан
  { id: 9000701, icao: 'UBBB', name: 'Гейдар Алиев', nameEn: 'Heydar Aliyev', city: 'Баку', cityEn: 'Baku', country: 'AZ', lat: 40.4675, lon: 50.0467, timezone: 'Asia/Baku' },
];

// Функция поиска аэропорта по ID
function getAirportById(id) {
  return airports.find(a => a.id === id);
}

// Функция поиска аэропорта по ICAO коду
function getAirportByICAO(icao) {
  return airports.find(a => a.icao === icao);
}

// Функция поиска аэропортов по городу
function getAirportsByCity(cityName) {
  const cityLower = cityName.toLowerCase();
  return airports.filter(a => 
    a.city.toLowerCase() === cityLower || 
    a.cityEn.toLowerCase() === cityLower
  );
}

// Функция поиска ближайшего аэропорта к координатам
function findNearestAirport(lat, lon, maxDistanceKm = 100) {
  let nearest = null;
  let minDistance = Infinity;
  
  for (const airport of airports) {
    const distance = calculateDistance(lat, lon, airport.lat, airport.lon);
    if (distance < minDistance && distance <= maxDistanceKm) {
      minDistance = distance;
      nearest = { ...airport, distance };
    }
  }
  
  return nearest;
}

// Функция расчёта расстояния между двумя точками (формула гаверсинуса)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * Math.PI / 180;
}

// Функция поиска нескольких ближайших аэропортов
function findNearestAirports(lat, lon, count = 3, maxDistanceKm = 500) {
  const airportsWithDistance = airports.map(airport => ({
    ...airport,
    distance: calculateDistance(lat, lon, airport.lat, airport.lon)
  }));
  
  return airportsWithDistance
    .filter(a => a.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

// Получить все аэропорты
function getAllAirports() {
  return airports;
}

module.exports = {
  airports,
  getAirportById,
  getAirportByICAO,
  getAirportsByCity,
  findNearestAirport,
  findNearestAirports,
  getAllAirports,
};
