const fetch = require('node-fetch');
const SunCalc = require('suncalc');
const geoDB = require('./data/geo-db');

// IP → координаты
async function getLocationByIP(ip) {
  const cleanIP = (ip === '::1' || ip === '127.0.0.1') ? '' : ip;
  const url = `http://ip-api.com/json/${cleanIP}?fields=lat,lon,city,regionName,country,countryCode&lang=ru`;
  const res = await fetch(url);
  const data = await res.json();
  return {
    lat: data.lat || 55.75,
    lon: data.lon || 37.62,
    city: data.city || 'Москва',
    region: data.regionName || '',
    country: data.country || 'Россия',
    country_code: data.countryCode || '',
    admin1: data.regionName || '',
    admin2: '',
    admin3: '',
    admin4: '',
  };
}

// Кэш для иерархии городов
const _hierCache = new Map();

function _hasCyrillic(s) { return /[а-яёА-ЯЁ]/.test(s || ''); }
function _hasLatin(s)    { return /[a-zA-Z]/.test(s || ''); }

// Поиск города через локальную базу
function searchCity(query) {
  const results = geoDB.search(query, 10);
  return results.map(c => ({
    id: c.id,
    name: c.nameRu || c.name,
    nameEn: c.name,
    region: c.adm1 || '',
    country: c.cc || '',
    country_code: c.cc || '',
    lat: c.lat,
    lon: c.lon,
    population: c.pop || 0,
  }));
}

// Получить иерархию по координатам используя локальную базу
async function getCityHierarchy(lat, lon) {
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
    // Используем локальную базу вместо GeoNames API
    const nearbyList = geoDB.findNearest(lat, lon, 1, 50);
    
    if (!nearbyList || nearbyList.length === 0) {
      console.log(`No nearby city found for ${lat}, ${lon}`);
      return empty;
    }
    
    const nearbyCity = nearbyList[0];
    
    const result = {
      cityName: nearbyCity.nameRu || nearbyCity.name,
      countryCode: nearbyCity.cc || '',
      stateCode: nearbyCity.adm1 || '',
      admin1: '', // Можно добавить mapping для регионов позже
      admin2: '',
      admin3: '',
      admin4: '',
    };
    
    _hierCache.set(key, result);
    return result;
    
  } catch (error) {
    console.error('Error in getCityHierarchy:', error);
    return empty;
  }
}

// Open-Meteo прогноз
async function getForecast(lat, lon, model) {
  const hourly = [
    'temperature_2m','apparent_temperature','precipitation','snowfall','rain','showers',
    'cloudcover','windspeed_10m','windgusts_10m','winddirection_10m',
    'relativehumidity_2m','surface_pressure','weathercode','is_day','visibility',
  ].join(',');
  const daily = 'sunrise,sunset';
  const modelParam = (model && model !== 'best_match') ? `&models=${model}` : '';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${hourly}&daily=${daily}&forecast_days=8&timezone=auto${modelParam}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || 'Open-Meteo error');
  return data;
}

// Конвертация единиц измерения
function convertUnits(slot, settings) {
  const s = Object.assign({}, slot);

  // Температура
  if (settings.temp_unit === 'fahrenheit') {
    const toF = c => Math.round(c * 9/5 + 32);
    s.temp      = toF(s.temp);
    s.feelsLike = s.feelsLike != null ? toF(s.feelsLike) : null;
    s.tempUnit  = '°F';
  } else {
    s.tempUnit = '°C';
  }

  // Ветер
  if (settings.wind_unit === 'kmh') {
    s.windSpeed = Math.round(s.windSpeed * 3.6);
    s.windGust  = s.windGust ? Math.round(s.windGust * 3.6) : null;
    s.windUnit  = 'км/ч';
  } else if (settings.wind_unit === 'mph') {
    s.windSpeed = Math.round(s.windSpeed * 2.237);
    s.windGust  = s.windGust ? Math.round(s.windGust * 2.237) : null;
    s.windUnit  = 'миль/ч';
  } else if (settings.wind_unit === 'kn') {
    s.windSpeed = Math.round(s.windSpeed * 1.944);
    s.windGust  = s.windGust ? Math.round(s.windGust * 1.944) : null;
    s.windUnit  = 'уз';
  } else {
    s.windUnit = 'м/с';
  }

  // Давление
  if (settings.pressure_unit === 'hpa' || settings.pressure_unit === 'mbar') {
    s.pressure     = Math.round(s.pressure / 0.750064);
    s.pressureUnit = settings.pressure_unit === 'hpa' ? 'гПа' : 'мбар';
  } else {
    s.pressureUnit = 'мм рт.ст.';
  }

  // Осадки
  if (settings.precip_unit === 'inch') {
    s.precipMm     = s.precipMm != null ? Math.round(s.precipMm / 25.4 * 100) / 100 : null;
    s.precipUnit   = 'дюйм';
  } else {
    s.precipUnit = 'мм';
  }

  return s;
}

// WMO weathercode → тип осадков для иконки
function precipType(code, rain, snow, showers) {
  if (code === 0) return null;
  if ([71,73,75,77,85,86].includes(code)) return 'snow';
  if ([66,67].includes(code)) return 'freezing';
  if ([68,69].includes(code)) return 'sleet';
  if ([51,53,55,56,57,61,63,65,80,81,82].includes(code)) return 'rain';
  // Гроза (95,96,99) — тип по фактическим осадкам
  if ([95,96,99].includes(code)) {
    if (snow > 0) return 'snow';
    return 'rain'; // гроза почти всегда с дождём
  }
  return null;
}

// Интенсивность осадков по мм и типу
function precipIntensity(mm, type) {
  if (!mm || mm <= 0) return null;
  switch (type) {
    case 'rain':
      if (mm < 3)  return 'light';
      if (mm < 10) return 'moderate';
      return 'heavy';
    case 'snow':
      if (mm < 1)  return 'light';
      if (mm < 5)  return 'moderate';
      return 'heavy';
    case 'sleet':
      if (mm < 2.5) return 'light';
      if (mm < 7.5) return 'moderate';
      return 'heavy';
    case 'freezing':
      if (mm < 2)  return 'light';
      if (mm < 8)  return 'moderate';
      return 'heavy';
    default:
      return 'light';
  }
}

// Фаза луны (0-1) → CSS-класс и название
function moonPhaseInfo(phase) {
  // phase: 0=новолуние, 0.25=первая четверть, 0.5=полнолуние, 0.75=последняя четверть
  if (phase < 0.0625)                    return { cls: 'wi-moon-new',            label: 'Новолуние' };
  if (phase < 0.1875)                    return { cls: 'wi-moon-waxing-crescent', label: 'Растущий серп' };
  if (phase < 0.3125)                    return { cls: 'wi-moon-first-quarter',   label: 'Первая четверть' };
  if (phase < 0.4375)                    return { cls: 'wi-moon-waxing-gibbous',  label: 'Растущая Луна' };
  if (phase < 0.5625)                    return { cls: 'wi-moon-full',            label: 'Полнолуние' };
  if (phase < 0.6875)                    return { cls: 'wi-moon-waning-gibbous',  label: 'Убывающая Луна' };
  if (phase < 0.8125)                    return { cls: 'wi-moon-last-quarter',    label: 'Последняя четверть' };
  if (phase < 0.9375)                    return { cls: 'wi-moon-waning-crescent', label: 'Убывающий серп' };
  return                                        { cls: 'wi-moon-new',            label: 'Новолуние' };
}

// Форматировать время из ISO строки "2024-03-30T05:57"
function fmtTime(isoStr) {
  if (!isoStr) return '-';
  return isoStr.slice(11, 16);
}
function cloudState(pct) {
  if (pct <= 6)  return 0; // ясно
  if (pct <= 19) return 1; // малооблачно
  if (pct <= 31) return 2; // небольшая облачность
  if (pct <= 44) return 3; // переменная
  if (pct <= 56) return 4; // облачно с прояснениями
  if (pct <= 69) return 5; // облачно
  if (pct <= 81) return 6; // значительная облачность
  return 7;                // пасмурно
}

// Направление ветра (градусы → русское)
function windDirRu(deg) {
  const dirs = ['С','С-С-В','С-В','В-С-В','В','В-Ю-В','Ю-В','Ю-Ю-В','Ю','Ю-Ю-З','Ю-З','З-Ю-З','З','З-С-З','С-З','С-С-З'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// dayType для фона ячейки (чередование d/n/d2/n2)
function getDayType(isDay, dayIndex) {
  const even = dayIndex % 2 === 0;
  if (isDay)  return even ? 'd'  : 'd2';
  return even ? 'n' : 'n2';
}

// Форматирование даты на русском
function formatDateRu(dateStr) {
  const d = new Date(dateStr);
  const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

// Почасовые слоты для всех дней сразу
function buildAllHourlySlots(hourly, timezone) {
  const times = hourly.time;
  const slots = [];
  const dayMap = {};

  // Текущий момент в timezone города — порог = начало текущего часа
  const nowCityStr = new Date().toLocaleString('sv-SE', { timeZone: timezone });
  const [nowDatePart, nowTimePart] = nowCityStr.split(' ');
  const nowHour = parseInt(nowTimePart.slice(0, 2), 10);
  const nowHourStr = `${nowDatePart}T${String(nowHour).padStart(2, '0')}:00`;

  for (let i = 0; i < times.length; i++) {
    // Скрываем слот если его час уже наступил (4:41 → скрываем 04:00, показываем 05:00+)
    if (times[i].slice(0, 16) <= nowHourStr) continue;

    const dateKey = times[i].slice(0, 10);
    if (!(dateKey in dayMap)) {
      dayMap[dateKey] = Object.keys(dayMap).length;
    }
    const dayIndex = dayMap[dateKey];
    // Извлекаем час из ISO строки времени (уже в timezone города)
    const hour = parseInt(times[i].slice(11, 13), 10);
    const isDay = hourly.is_day[i] === 1;
    const mm = (hourly.rain[i] || 0) + (hourly.showers[i] || 0) + (hourly.snowfall[i] || 0);
    const pType = precipType(hourly.weathercode[i], hourly.rain[i], hourly.snowfall[i], hourly.showers[i]);
    const pInt  = precipIntensity(mm, pType);
    const thunder = [95, 96, 99].includes(hourly.weathercode[i]) && pType !== 'freezing';

    slots.push({
      time: String(hour).padStart(2, '0'),
      date: dateKey,
      dayIndex,
      dayType: getDayType(isDay, dayIndex),
      isDay,
      isFirst: hour === 0,
      isLast:  hour === 23,
      cloudState: cloudState(hourly.cloudcover[i]),
      precip: pType && pInt ? `${pType}_${pInt}` : null,
      precipMm: mm > 0 ? Math.round(mm * 10) / 10 : null,
      thunder,
      fog: hourly.visibility[i] < 10000 ? {
        pct: Math.round((1 - Math.min(hourly.visibility[i], 10000) / 10000) * 100),
        visibility: hourly.visibility[i],
      } : null,
      temp: Math.round(hourly.temperature_2m[i]),
      feelsLike: Math.round(hourly.apparent_temperature[i]),
      pressure: Math.round(hourly.surface_pressure[i] * 0.750064),
      windSpeed: Math.round(hourly.windspeed_10m[i] / 3.6),
      windGust: hourly.windgusts_10m[i] ? Math.round(hourly.windgusts_10m[i] / 3.6) : null,
      windDir: windDirRu(hourly.winddirection_10m[i]),
      windDeg: hourly.winddirection_10m[i],
      humidity: hourly.relativehumidity_2m[i],
    });
  }
  return slots;
}

// Почасовые слоты для конкретного дня (все 24 часа)
function buildHourlySlots(hourly, dateFilter) {
  const times = hourly.time;
  const slots = [];
  const dayIndex = 0;

  for (let i = 0; i < times.length; i++) {
    const dateKey = times[i].slice(0, 10);
    if (dateKey !== dateFilter) continue;

    // Извлекаем час из ISO строки времени (уже в timezone города)
    const hour = parseInt(times[i].slice(11, 13), 10);
    const isDay = hourly.is_day[i] === 1;
    const mm = (hourly.rain[i] || 0) + (hourly.showers[i] || 0) + (hourly.snowfall[i] || 0);
    const pType = precipType(hourly.weathercode[i], hourly.rain[i], hourly.snowfall[i], hourly.showers[i]);
    const pInt  = precipIntensity(mm, pType);
    const thunder = [95, 96, 99].includes(hourly.weathercode[i]) && pType !== 'freezing';

    slots.push({
      time: String(hour).padStart(2, '0'),
      date: dateKey,
      dayIndex,
      dayType: getDayType(isDay, dayIndex),
      isDay,
      isFirst: hour === 0,
      isLast:  hour === 23,
      cloudState: cloudState(hourly.cloudcover[i]),
      precip: pType && pInt ? `${pType}_${pInt}` : null,
      precipMm: mm > 0 ? Math.round(mm * 10) / 10 : null,
      thunder,
      fog: hourly.visibility[i] < 10000 ? {
        pct: Math.round((1 - Math.min(hourly.visibility[i], 10000) / 10000) * 100),
        visibility: hourly.visibility[i],
      } : null,
      temp: Math.round(hourly.temperature_2m[i]),
      feelsLike: Math.round(hourly.apparent_temperature[i]),
      pressure: Math.round(hourly.surface_pressure[i] * 0.750064),
      windSpeed: Math.round(hourly.windspeed_10m[i] / 3.6),
      windGust: hourly.windgusts_10m[i] ? Math.round(hourly.windgusts_10m[i] / 3.6) : null,
      windDir: windDirRu(hourly.winddirection_10m[i]),
      windDeg: hourly.winddirection_10m[i],
      humidity: hourly.relativehumidity_2m[i],
    });
  }
  return slots;
}

/**
 * Вычисляет часы для отображения на основе UTC offset
 * @param {number} utcOffsetHours - Смещение UTC в часах (может быть дробным, например 5.5)
 * @param {boolean} isForecast - true для прогноза (4 периода), false для архива (8 периодов)
 * @returns {Array<number>} - Массив часов для отображения
 */
function getTargetHours(utcOffsetHours, isForecast = false) {
  // Определяем начальный час: (UTC offset) % 3
  const startHour = ((utcOffsetHours % 3) + 3) % 3;
  
  if (isForecast) {
    // Прогноз: 4 периода, каждые 6 часов начиная с (startHour + 3)
    const forecastStart = startHour + 3;
    return [
      forecastStart % 24,
      (forecastStart + 6) % 24,
      (forecastStart + 12) % 24,
      (forecastStart + 18) % 24
    ];
  } else {
    // Архив: 8 периодов, каждые 3 часа начиная с startHour
    return [
      startHour % 24,
      (startHour + 3) % 24,
      (startHour + 6) % 24,
      (startHour + 9) % 24,
      (startHour + 12) % 24,
      (startHour + 15) % 24,
      (startHour + 18) % 24,
      (startHour + 21) % 24
    ];
  }
}

// Собрать слоты по 6 часов — только начиная с текущего момента
function buildSlots(hourly, timezone) {
  // Получаем UTC offset из timezone
  // Timezone приходит в формате типа "Europe/Moscow", "Asia/Tokyo" и т.д.
  // Нужно вычислить offset для текущего момента
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = tzDate - utcDate;
  const utcOffsetHours = offsetMs / (1000 * 60 * 60);
  
  const TARGET_HOURS = getTargetHours(utcOffsetHours, true); // true = прогноз
  
  const times = hourly.time;
  const slots = [];
  const dayMap = {};

  // Текущий момент в timezone города — берём только дату+час, минуты игнорируем
  // Слот за час X скрывается только когда наступил час X+1
  const nowDate = new Date();
  const nowCityStr = nowDate.toLocaleString('sv-SE', { timeZone: timezone });
  const [nowDatePart, nowTimePart] = nowCityStr.split(' ');
  const nowHour = parseInt(nowTimePart.slice(0, 2), 10);
  const nowHourStr = `${nowDatePart}T${String(nowHour).padStart(2, '0')}:00`;

  for (let i = 0; i < times.length; i++) {
    // Извлекаем час из ISO строки времени (уже в timezone города)
    const hour = parseInt(times[i].slice(11, 13), 10);
    if (!TARGET_HOURS.includes(hour)) continue;

    // Скрываем слот если его час уже наступил (4:41 → скрываем 04:00, показываем 05:00+)
    if (times[i].slice(0, 16) <= nowHourStr) continue;

    const dateKey = times[i].slice(0, 10);
    if (!(dateKey in dayMap)) {
      dayMap[dateKey] = Object.keys(dayMap).length;
    }
    const dayIndex = dayMap[dateKey];
    const isDay = hourly.is_day[i] === 1;
    const mm = (hourly.rain[i] || 0) + (hourly.showers[i] || 0) + (hourly.snowfall[i] || 0);
    const pType = precipType(hourly.weathercode[i], hourly.rain[i], hourly.snowfall[i], hourly.showers[i]);
    const pInt  = precipIntensity(mm, pType);
    const thunder = [95, 96, 99].includes(hourly.weathercode[i]) && pType !== 'freezing';

    slots.push({
      time: String(hour).padStart(2, '0'),
      date: dateKey,
      dayIndex,
      dayType: getDayType(isDay, dayIndex),
      isDay,
      isFirst: hour === 5,
      isLast:  hour === 23,
      cloudState: cloudState(hourly.cloudcover[i]),
      precip: pType && pInt ? `${pType}_${pInt}` : null,
      precipMm: mm > 0 ? Math.round(mm * 10) / 10 : null,
      thunder,
      fog: hourly.visibility[i] < 10000 ? {
        pct: Math.round((1 - Math.min(hourly.visibility[i], 10000) / 10000) * 100),
        visibility: hourly.visibility[i],
      } : null,
      temp: Math.round(hourly.temperature_2m[i]),
      feelsLike: Math.round(hourly.apparent_temperature[i]),
      pressure: Math.round(hourly.surface_pressure[i] * 0.750064),
      windSpeed: Math.round(hourly.windspeed_10m[i] / 3.6),
      windGust: hourly.windgusts_10m[i] ? Math.round(hourly.windgusts_10m[i] / 3.6) : null,
      windDir: windDirRu(hourly.winddirection_10m[i]),
      windDeg: hourly.winddirection_10m[i],
      humidity: hourly.relativehumidity_2m[i],
    });
  }
  return slots;
}

// Генерация текстового прогноза на день
function buildDayForecastText(daySlots) {
  if (!daySlots.length) return '';
  const temps = daySlots.map(s => s.temp);
  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  const tStr = `${tMin > 0 ? '+' : ''}${tMin}..${tMax > 0 ? '+' : ''}${tMax} °C`;

  const hasPrecip = daySlots.some(s => s.precip);
  const hasThunder = daySlots.some(s => s.thunder);
  const hasFog = daySlots.some(s => s.fog && s.fog.visibility < 1000);
  const winds = daySlots.map(s => s.windSpeed);
  const windMax = Math.max(...winds);

  let parts = [tStr];
  if (hasPrecip) {
    const types = [...new Set(daySlots.filter(s=>s.precip).map(s=>s.precip.split('_')[0]))];
    const typeMap = { rain:'дождь', snow:'снег', sleet:'дождь со снегом', freezing:'переохл. дождь' };
    parts.push(types.map(t => typeMap[t] || t).join(', '));
  } else {
    parts.push('без осадков');
  }
  if (hasThunder) parts.push('гроза');
  if (hasFog) parts.push('туман');
  if (windMax <= 3) parts.push('слабый ветер');
  else if (windMax <= 7) parts.push('умеренный ветер');
  else parts.push('сильный ветер');

  return parts.join(', ');
}
function buildDays(slots, daily, lat, lon, timezone) {
  const map = {};
  slots.forEach((s, i) => {
    if (!map[s.date]) map[s.date] = { date: s.date, slots: [], startIdx: i };
    map[s.date].slots.push(i);
  });

  return Object.values(map).map((d, idx) => {
    const label = idx === 0 ? `Сегодня, ${formatDateRu(d.date)}`
                : idx === 1 ? `Завтра, ${formatDateRu(d.date)}`
                : formatDateRu(d.date);
    const dt = new Date(d.date + 'T12:00:00');
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

    // Восход/заход из daily API (уже в локальном времени города, формат "2024-03-31T08:42")
    const di = daily ? (daily.time || []).indexOf(d.date) : -1;
    const fmtApi = iso => iso ? iso.slice(11, 16) : '-';
    const sunrise = di >= 0 && daily.sunrise ? fmtApi(daily.sunrise[di]) : '-';
    const sunset  = di >= 0 && daily.sunset  ? fmtApi(daily.sunset[di])  : '-';

    // Луна через SunCalc — форматируем в timezone города
    const moonTimes = SunCalc.getMoonTimes(dt, lat, lon);
    const moonIllum = SunCalc.getMoonIllumination(dt);
    const fmtTz = t => {
      if (!t || isNaN(t)) return '-';
      return t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    };

    const phase = moonIllum.phase;
    const moon = moonPhaseInfo(phase);

    return {
      label,
      date: d.date,
      isWeekend,
      colspan: d.slots.length,
      sliceStart: d.slots[0],
      sliceEnd: d.slots[d.slots.length - 1] + 1,
      sunrise,
      sunset,
      moonrise:  fmtTz(moonTimes.rise),
      moonset:   fmtTz(moonTimes.set),
      moonPhase: moon,
    };
  });
}

// Вкладки (7 суток + каждый день)
function buildTabs(days) {
  const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const tabs = [{ id: '7days', label: '7 суток', active: true }];
  days.forEach((d, i) => {
    const dt = new Date(d.date);
    const label = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : dayNames[dt.getDay()];
    tabs.push({ id: d.date, label, isWeekend: d.isWeekend });
  });
  return tabs;
}

// Главная функция — собрать все данные для шаблона
async function getWeatherData(ip, cityOverride, settings = {}, latOverride, lonOverride, geonameId) {
  let location;
  if (geonameId) {
    // Поиск по geonameId через локальную базу
    const c = geoDB.getById(geonameId);
    if (!c) throw new Error('Город не найден (id=' + geonameId + ')');
    const hier = await getCityHierarchy(c.lat, c.lon);
    location = {
      lat: c.lat, lon: c.lon,
      city: c.nameRu || c.name,
      region: hier.admin1 || '',
      country: '',  // заполнится из getCountries ниже
      country_code: c.cc || hier.countryCode || '',
      stateCode: hier.stateCode || '',
      geonameId: c.id,
      admin1En: '',
      admin1: hier.admin1,
      admin2: hier.admin2,
      admin3: hier.admin3,
      admin4: hier.admin4,
    };
  } else if (latOverride && lonOverride) {
    // Координаты переданы напрямую — используем GeoNames для иерархии
    const hier = await getCityHierarchy(latOverride, lonOverride);
    location = {
      lat: latOverride, lon: lonOverride,
      city: hier.cityName || cityOverride || '',
      region: hier.admin1 || '',
      country: hier.countryCode ? '' : '',  // будет заполнено ниже
      country_code: hier.countryCode || '',
      stateCode: hier.stateCode || '',
      admin1: hier.admin1,
      admin2: hier.admin2,
      admin3: hier.admin3,
      admin4: hier.admin4,
    };
  } else if (cityOverride) {
    const results = searchCity(cityOverride);
    if (results.length === 0) throw new Error('Город не найден');
    const r = results[0];
    const hier = await getCityHierarchy(r.lat, r.lon);
    location = {
      lat: r.lat, lon: r.lon,
      city: r.name,
      region: hier.admin1 || r.region,
      country: r.country,
      country_code: hier.countryCode || r.country_code,
      stateCode: hier.stateCode || '',
      geonameId: r.id || '',
      admin1: hier.admin1,
      admin2: hier.admin2,
      admin3: hier.admin3,
      admin4: hier.admin4,
    };
  } else {
    const ipLoc = await getLocationByIP(ip);
    // Получаем иерархию по координатам
    try {
      const hier = await getCityHierarchy(ipLoc.lat, ipLoc.lon);
      location = {
        ...ipLoc,
        city: hier.cityName || ipLoc.city,
        region: hier.admin1 || ipLoc.region,
        country_code: hier.countryCode || ipLoc.country_code,
        stateCode: hier.stateCode || '',
        admin1: hier.admin1 || ipLoc.admin1,
        admin2: hier.admin2,
        admin3: hier.admin3,
        admin4: hier.admin4,
      };
    } catch {
      location = { ...ipLoc, stateCode: '' };
    }
  }

  const forecast = await getForecast(location.lat, location.lon, settings.model);
  const rawSlots = buildSlots(forecast.hourly, forecast.timezone);
  const slots    = rawSlots.map(s => convertUnits(s, settings));
  const days     = buildDays(slots, forecast.daily, location.lat, location.lon, forecast.timezone);
  const tabs     = buildTabs(days);

  // Почасовые слоты для всех дней
  const rawHourly     = buildAllHourlySlots(forecast.hourly, forecast.timezone);
  const allHourlySlots = rawHourly.map(s => convertUnits(s, settings));
  const allHourlyDays  = buildDays(allHourlySlots, forecast.daily, location.lat, location.lon, forecast.timezone);

  // Текущие условия — ближайший час к текущему моменту в timezone города
  const nowCityStr = new Date().toLocaleString('sv-SE', { timeZone: forecast.timezone });
  const [nowDatePart, nowTimePart] = nowCityStr.split(' ');
  const nowHour = parseInt(nowTimePart.slice(0, 2), 10);
  const nowHourStr = `${nowDatePart}T${String(nowHour).padStart(2, '0')}:00`;
  const nowIdx = forecast.hourly.time.indexOf(nowHourStr);
  const now = nowIdx >= 0 ? convertUnits({
    temp:      Math.round(forecast.hourly.temperature_2m[nowIdx]),
    feelsLike: Math.round(forecast.hourly.apparent_temperature[nowIdx]),
    pressure: 0, windSpeed: 0, windGust: null, precipMm: null, // заглушки для конвертера
  }, settings) : (allHourlySlots[0] || slots[0] || {});

  // Текстовый прогноз на сегодня и завтра
  const todayDate    = days[0]?.date;
  const tomorrowDate = days[1]?.date;
  const todaySlots    = slots.filter(s => s.date === todayDate);
  const tomorrowSlots = slots.filter(s => s.date === tomorrowDate);
  const forecastText = [
    todayDate    ? `Сегодня ожидается ${buildDayForecastText(todaySlots)}.`    : '',
    tomorrowDate ? `Завтра: ${buildDayForecastText(tomorrowSlots)}.` : '',
  ].filter(Boolean).join(' ');

  return {
    city: location.city,
    region: location.region,
    country: location.country || getCountries().find(c => c.code === (location.country_code||'').toUpperCase())?.name || '',
    country_code: location.country_code || '',
    stateCode: location.stateCode || '',
    geonameId: location.geonameId || '',
    admin1En: location.admin1En || '',
    admin1: location.admin1 || '',
    admin2: location.admin2 || '',
    admin3: location.admin3 || '',
    admin4: location.admin4 || '',
    lat: location.lat,
    lon: location.lon,
    currentTemp: now.temp,
    currentFeelsLike: now.feelsLike,
    forecastText,
    tabs,
    days,
    slots,
    allHourlySlots,
    allHourlyDays,
    _hourly: forecast.hourly,
    _daily: forecast.daily,
  };
}

const { Country, State, City } = require('country-state-city');

// Получить регионы (штаты/области) по iso2 коду страны
const regionsRu = require('./locales/regions-ru');

// Кэш переводов штатов
const _stateNameCache = new Map();

// Получить русское название штата (используем английское название, так как локальной базы переводов нет)
async function _getStateNameRu(countryCode, stateCode, englishName) {
  // Просто возвращаем английское название
  // TODO: Можно добавить локальную базу переводов регионов
  return englishName;
}

function getRegions(countryCode) {
  const states = State.getStatesOfCountry(countryCode.toUpperCase());
  return states
    .filter(s => s.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map(s => ({ name: s.name, code: s.isoCode }));
}

// Получить регионы с локализованными названиями
function getRegionsLocalized(countryCode, lang) {
  const cc = countryCode.toUpperCase();
  const states = State.getStatesOfCountry(cc);
  const translations = (lang === 'ru' && regionsRu[cc]) ? regionsRu[cc] : {};
  return states
    .filter(s => s.name)
    .map(s => ({
      name: translations[s.isoCode] || s.name,
      nameEn: s.name,  // английское название для slug
      code: s.isoCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, lang === 'ru' ? 'ru' : 'en'));
}

// Получить города по iso2 коду страны и коду штата
function getCities(countryCode, stateCode) {
  const cities = City.getCitiesOfState(countryCode.toUpperCase(), stateCode);
  return cities
    .filter(c => c.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map(c => ({ name: c.name, lat: c.latitude, lon: c.longitude }));
}

const regionsGn = require('./locales/regions-gn');

// Кэш городов
const _citiesCache = new Map();

// Получить города с локализованными названиями — из локальной базы GeoNames
function getCitiesLocalized(countryCode, stateCode, lang) {
  const cc = countryCode.toUpperCase();
  const sc = stateCode.toUpperCase();
  const cacheKey = `${cc}_${sc}`;
  if (_citiesCache.has(cacheKey)) return _citiesCache.get(cacheKey);

  // Определяем adm1 код для нашей базы
  const gnCode = (regionsGn[cc] && regionsGn[cc][sc]) || sc;

  const cities = geoDB.getCitiesByRegion(cc, gnCode);
  const result = cities
    .map(c => ({
      id: c.id,
      name: c.nameRu || c.name,
      nameEn: c.name,
      lat: c.lat,
      lon: c.lon,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  _citiesCache.set(cacheKey, result);
  return result;
}

// Статичный список стран мира
// Преобразование английского названия в URL-slug (CamelCase)
function toSlug(str) {
  if (!str) return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .split(/[\s-]+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '')
    .join('');
}

// Slug страны — использует nameEn
function countrySlug(countryNameRu) {
  const countries = getCountries();
  const c = countries.find(x => x.name === countryNameRu);
  return c ? c.nameEn : toSlug(countryNameRu);
}

// Slug региона — использует английское название из country-state-city
function regionSlug(regionNameEn) {
  return toSlug(regionNameEn);
}

function getCountries() {
  return [
    { name: 'Австралия', nameEn: 'Australia', code: 'AU' },
    { name: 'Австрия', nameEn: 'Austria', code: 'AT' },
    { name: 'Азербайджан', nameEn: 'Azerbaijan', code: 'AZ' },
    { name: 'Албания', nameEn: 'Albania', code: 'AL' },
    { name: 'Алжир', nameEn: 'Algeria', code: 'DZ' },
    { name: 'Ангола', nameEn: 'Angola', code: 'AO' },
    { name: 'Андорра', nameEn: 'Andorra', code: 'AD' },
    { name: 'Антигуа и Барбуда', nameEn: 'AntiguaAndBarbuda', code: 'AG' },
    { name: 'Аргентина', nameEn: 'Argentina', code: 'AR' },
    { name: 'Армения', nameEn: 'Armenia', code: 'AM' },
    { name: 'Афганистан', nameEn: 'Afghanistan', code: 'AF' },
    { name: 'Багамы', nameEn: 'Bahamas', code: 'BS' },
    { name: 'Бангладеш', nameEn: 'Bangladesh', code: 'BD' },
    { name: 'Барбадос', nameEn: 'Barbados', code: 'BB' },
    { name: 'Бахрейн', nameEn: 'Bahrain', code: 'BH' },
    { name: 'Беларусь', nameEn: 'Belarus', code: 'BY' },
    { name: 'Белиз', nameEn: 'Belize', code: 'BZ' },
    { name: 'Бельгия', nameEn: 'Belgium', code: 'BE' },
    { name: 'Бенин', nameEn: 'Benin', code: 'BJ' },
    { name: 'Болгария', nameEn: 'Bulgaria', code: 'BG' },
    { name: 'Боливия', nameEn: 'Bolivia', code: 'BO' },
    { name: 'Босния и Герцеговина', nameEn: 'BosniaAndHerzegovina', code: 'BA' },
    { name: 'Ботсвана', nameEn: 'Botswana', code: 'BW' },
    { name: 'Бразилия', nameEn: 'Brazil', code: 'BR' },
    { name: 'Бруней', nameEn: 'Brunei', code: 'BN' },
    { name: 'Буркина-Фасо', nameEn: 'BurkinaFaso', code: 'BF' },
    { name: 'Бурунди', nameEn: 'Burundi', code: 'BI' },
    { name: 'Бутан', nameEn: 'Bhutan', code: 'BT' },
    { name: 'Вануату', nameEn: 'Vanuatu', code: 'VU' },
    { name: 'Великобритания', nameEn: 'UnitedKingdom', code: 'GB' },
    { name: 'Венгрия', nameEn: 'Hungary', code: 'HU' },
    { name: 'Венесуэла', nameEn: 'Venezuela', code: 'VE' },
    { name: 'Вьетнам', nameEn: 'Vietnam', code: 'VN' },
    { name: 'Габон', nameEn: 'Gabon', code: 'GA' },
    { name: 'Гаити', nameEn: 'Haiti', code: 'HT' },
    { name: 'Гайана', nameEn: 'Guyana', code: 'GY' },
    { name: 'Гамбия', nameEn: 'Gambia', code: 'GM' },
    { name: 'Гана', nameEn: 'Ghana', code: 'GH' },
    { name: 'Гватемала', nameEn: 'Guatemala', code: 'GT' },
    { name: 'Гвинея', nameEn: 'Guinea', code: 'GN' },
    { name: 'Гвинея-Бисау', nameEn: 'GuineaBissau', code: 'GW' },
    { name: 'Германия', nameEn: 'Germany', code: 'DE' },
    { name: 'Гондурас', nameEn: 'Honduras', code: 'HN' },
    { name: 'Греция', nameEn: 'Greece', code: 'GR' },
    { name: 'Грузия', nameEn: 'Georgia', code: 'GE' },
    { name: 'Дания', nameEn: 'Denmark', code: 'DK' },
    { name: 'Джибути', nameEn: 'Djibouti', code: 'DJ' },
    { name: 'Доминика', nameEn: 'Dominica', code: 'DM' },
    { name: 'Доминиканская Республика', nameEn: 'DominicanRepublic', code: 'DO' },
    { name: 'Египет', nameEn: 'Egypt', code: 'EG' },
    { name: 'Замбия', nameEn: 'Zambia', code: 'ZM' },
    { name: 'Зимбабве', nameEn: 'Zimbabwe', code: 'ZW' },
    { name: 'Израиль', nameEn: 'Israel', code: 'IL' },
    { name: 'Индия', nameEn: 'India', code: 'IN' },
    { name: 'Индонезия', nameEn: 'Indonesia', code: 'ID' },
    { name: 'Иордания', nameEn: 'Jordan', code: 'JO' },
    { name: 'Ирак', nameEn: 'Iraq', code: 'IQ' },
    { name: 'Иран', nameEn: 'Iran', code: 'IR' },
    { name: 'Ирландия', nameEn: 'Ireland', code: 'IE' },
    { name: 'Исландия', nameEn: 'Iceland', code: 'IS' },
    { name: 'Испания', nameEn: 'Spain', code: 'ES' },
    { name: 'Италия', nameEn: 'Italy', code: 'IT' },
    { name: 'Йемен', nameEn: 'Yemen', code: 'YE' },
    { name: 'Кабо-Верде', nameEn: 'CaboVerde', code: 'CV' },
    { name: 'Казахстан', nameEn: 'Kazakhstan', code: 'KZ' },
    { name: 'Камбоджа', nameEn: 'Cambodia', code: 'KH' },
    { name: 'Камерун', nameEn: 'Cameroon', code: 'CM' },
    { name: 'Канада', nameEn: 'Canada', code: 'CA' },
    { name: 'Катар', nameEn: 'Qatar', code: 'QA' },
    { name: 'Кения', nameEn: 'Kenya', code: 'KE' },
    { name: 'Кипр', nameEn: 'Cyprus', code: 'CY' },
    { name: 'Китай', nameEn: 'China', code: 'CN' },
    { name: 'Колумбия', nameEn: 'Colombia', code: 'CO' },
    { name: 'Коморы', nameEn: 'Comoros', code: 'KM' },
    { name: 'Конго', nameEn: 'Congo', code: 'CG' },
    { name: 'Конго (ДРК)', nameEn: 'CongoDRC', code: 'CD' },
    { name: 'Коста-Рика', nameEn: 'CostaRica', code: 'CR' },
    { name: 'Куба', nameEn: 'Cuba', code: 'CU' },
    { name: 'Кувейт', nameEn: 'Kuwait', code: 'KW' },
    { name: 'Кыргызстан', nameEn: 'Kyrgyzstan', code: 'KG' },
    { name: 'Лаос', nameEn: 'Laos', code: 'LA' },
    { name: 'Латвия', nameEn: 'Latvia', code: 'LV' },
    { name: 'Лесото', nameEn: 'Lesotho', code: 'LS' },
    { name: 'Либерия', nameEn: 'Liberia', code: 'LR' },
    { name: 'Ливан', nameEn: 'Lebanon', code: 'LB' },
    { name: 'Ливия', nameEn: 'Libya', code: 'LY' },
    { name: 'Литва', nameEn: 'Lithuania', code: 'LT' },
    { name: 'Лихтенштейн', nameEn: 'Liechtenstein', code: 'LI' },
    { name: 'Люксембург', nameEn: 'Luxembourg', code: 'LU' },
    { name: 'Маврикий', nameEn: 'Mauritius', code: 'MU' },
    { name: 'Мавритания', nameEn: 'Mauritania', code: 'MR' },
    { name: 'Мадагаскар', nameEn: 'Madagascar', code: 'MG' },
    { name: 'Малави', nameEn: 'Malawi', code: 'MW' },
    { name: 'Малайзия', nameEn: 'Malaysia', code: 'MY' },
    { name: 'Мальдивы', nameEn: 'Maldives', code: 'MV' },
    { name: 'Мальта', nameEn: 'Malta', code: 'MT' },
    { name: 'Марокко', nameEn: 'Morocco', code: 'MA' },
    { name: 'Мексика', nameEn: 'Mexico', code: 'MX' },
    { name: 'Мозамбик', nameEn: 'Mozambique', code: 'MZ' },
    { name: 'Молдова', nameEn: 'Moldova', code: 'MD' },
    { name: 'Монако', nameEn: 'Monaco', code: 'MC' },
    { name: 'Монголия', nameEn: 'Mongolia', code: 'MN' },
    { name: 'Мьянма', nameEn: 'Myanmar', code: 'MM' },
    { name: 'Намибия', nameEn: 'Namibia', code: 'NA' },
    { name: 'Непал', nameEn: 'Nepal', code: 'NP' },
    { name: 'Нигер', nameEn: 'Niger', code: 'NE' },
    { name: 'Нигерия', nameEn: 'Nigeria', code: 'NG' },
    { name: 'Нидерланды', nameEn: 'Netherlands', code: 'NL' },
    { name: 'Никарагуа', nameEn: 'Nicaragua', code: 'NI' },
    { name: 'Новая Зеландия', nameEn: 'NewZealand', code: 'NZ' },
    { name: 'Норвегия', nameEn: 'Norway', code: 'NO' },
    { name: 'ОАЭ', nameEn: 'UAE', code: 'AE' },
    { name: 'Оман', nameEn: 'Oman', code: 'OM' },
    { name: 'Пакистан', nameEn: 'Pakistan', code: 'PK' },
    { name: 'Панама', nameEn: 'Panama', code: 'PA' },
    { name: 'Папуа — Новая Гвинея', nameEn: 'PapuaNewGuinea', code: 'PG' },
    { name: 'Парагвай', nameEn: 'Paraguay', code: 'PY' },
    { name: 'Перу', nameEn: 'Peru', code: 'PE' },
    { name: 'Польша', nameEn: 'Poland', code: 'PL' },
    { name: 'Португалия', nameEn: 'Portugal', code: 'PT' },
    { name: 'Россия', nameEn: 'Russia', code: 'RU' },
    { name: 'Руанда', nameEn: 'Rwanda', code: 'RW' },
    { name: 'Румыния', nameEn: 'Romania', code: 'RO' },
    { name: 'Сальвадор', nameEn: 'ElSalvador', code: 'SV' },
    { name: 'Самоа', nameEn: 'Samoa', code: 'WS' },
    { name: 'Сан-Марино', nameEn: 'SanMarino', code: 'SM' },
    { name: 'Саудовская Аравия', nameEn: 'SaudiArabia', code: 'SA' },
    { name: 'Северная Македония', nameEn: 'NorthMacedonia', code: 'MK' },
    { name: 'Сенегал', nameEn: 'Senegal', code: 'SN' },
    { name: 'Сербия', nameEn: 'Serbia', code: 'RS' },
    { name: 'Сингапур', nameEn: 'Singapore', code: 'SG' },
    { name: 'Сирия', nameEn: 'Syria', code: 'SY' },
    { name: 'Словакия', nameEn: 'Slovakia', code: 'SK' },
    { name: 'Словения', nameEn: 'Slovenia', code: 'SI' },
    { name: 'Сомали', nameEn: 'Somalia', code: 'SO' },
    { name: 'Судан', nameEn: 'Sudan', code: 'SD' },
    { name: 'Суринам', nameEn: 'Suriname', code: 'SR' },
    { name: 'США', nameEn: 'USA', code: 'US' },
    { name: 'Сьерра-Леоне', nameEn: 'SierraLeone', code: 'SL' },
    { name: 'Таджикистан', nameEn: 'Tajikistan', code: 'TJ' },
    { name: 'Таиланд', nameEn: 'Thailand', code: 'TH' },
    { name: 'Тайвань', nameEn: 'Taiwan', code: 'TW' },
    { name: 'Танзания', nameEn: 'Tanzania', code: 'TZ' },
    { name: 'Того', nameEn: 'Togo', code: 'TG' },
    { name: 'Тонга', nameEn: 'Tonga', code: 'TO' },
    { name: 'Тринидад и Тобаго', nameEn: 'TrinidadAndTobago', code: 'TT' },
    { name: 'Тунис', nameEn: 'Tunisia', code: 'TN' },
    { name: 'Туркменистан', nameEn: 'Turkmenistan', code: 'TM' },
    { name: 'Турция', nameEn: 'Turkey', code: 'TR' },
    { name: 'Уганда', nameEn: 'Uganda', code: 'UG' },
    { name: 'Узбекистан', nameEn: 'Uzbekistan', code: 'UZ' },
    { name: 'Украина', nameEn: 'Ukraine', code: 'UA' },
    { name: 'Уругвай', nameEn: 'Uruguay', code: 'UY' },
    { name: 'Фиджи', nameEn: 'Fiji', code: 'FJ' },
    { name: 'Филиппины', nameEn: 'Philippines', code: 'PH' },
    { name: 'Финляндия', nameEn: 'Finland', code: 'FI' },
    { name: 'Франция', nameEn: 'France', code: 'FR' },
    { name: 'Хорватия', nameEn: 'Croatia', code: 'HR' },
    { name: 'ЦАР', nameEn: 'CAR', code: 'CF' },
    { name: 'Чад', nameEn: 'Chad', code: 'TD' },
    { name: 'Черногория', nameEn: 'Montenegro', code: 'ME' },
    { name: 'Чехия', nameEn: 'CzechRepublic', code: 'CZ' },
    { name: 'Чили', nameEn: 'Chile', code: 'CL' },
    { name: 'Швейцария', nameEn: 'Switzerland', code: 'CH' },
    { name: 'Швеция', nameEn: 'Sweden', code: 'SE' },
    { name: 'Шри-Ланка', nameEn: 'SriLanka', code: 'LK' },
    { name: 'Эквадор', nameEn: 'Ecuador', code: 'EC' },
    { name: 'Эстония', nameEn: 'Estonia', code: 'EE' },
    { name: 'Эфиопия', nameEn: 'Ethiopia', code: 'ET' },
    { name: 'ЮАР', nameEn: 'SouthAfrica', code: 'ZA' },
    { name: 'Южная Корея', nameEn: 'SouthKorea', code: 'KR' },
    { name: 'Южный Судан', nameEn: 'SouthSudan', code: 'SS' },
    { name: 'Ямайка', nameEn: 'Jamaica', code: 'JM' },
    { name: 'Япония', nameEn: 'Japan', code: 'JP' },
  ].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

module.exports = { getWeatherData, searchCity, buildHourlySlots, buildAllHourlySlots, getCountries, getRegions, getRegionsLocalized, getCities, getCitiesLocalized, toSlug, countrySlug, regionSlug, getTargetHours };
