const express = require('express');
const path = require('path');
const fs = require('fs');
const { getWeatherData, searchCity, getCountries, getRegions, getRegionsLocalized, getCities, getCitiesLocalized, toSlug, countrySlug, regionSlug, getTargetHours } = require('./weather');
const geoDB = require('./data/geo-db');
const regionsGn = require('./locales/regions-gn');
const { WW: WMO_WW, W_PAST, wwToWCode } = require('./data/wmo-codes');
const { JSDOM } = require('jsdom');
const { getAirportById, getAirportByICAO, findNearestAirport, findNearestAirports, getAllAirports } = require('./data/airports');
const { loadRP5CSV } = require('./rp5-csv-loader');
const { getRP5CSVPath } = require('./rp5-csv-downloader');

const GEONAMES_USER = 'vvvholder';

// Простой пароль для доступа к редактированию (в production использовать переменные окружения)
const EDIT_PASSWORD = process.env.EDIT_PASSWORD || 'admin123';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для парсинга JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/static',    express.static(path.join(__dirname, 'static')));
app.use('/resources', express.static(path.join(__dirname, 'resources')));
app.use('/cdn-cgi',   express.static(path.join(__dirname, 'cdn-cgi')));

// Хелпер: иконка облачности
function cloudIcon(state, isDay) {
  const sfx = isDay ? 'day' : 'night';
  const map = {
    0: { cls: 'clear',        label: 'Ясно' },
    1: { cls: 'cloud-light',  label: 'Малооблачно' },
    2: { cls: 'cloud-few',    label: 'Небольшая облачность' },
    3: { cls: 'cloud-partly', label: 'Переменная облачность' },
    4: { cls: 'cloud-mostly', label: 'Облачно с прояснениями' },
    5: { cls: 'cloudy',       label: 'Облачно' },
    6: { cls: 'cloud-heavy',  label: 'Значительная облачность' },
    7: { cls: 'overcast',     label: 'Пасмурно' },
  };
  const { cls, label } = map[state] || map[0];
  return `<span class="wi wi-${cls}-${sfx}" data-tooltip="${label}"></span>`;
}

// Хелпер: иконка осадков
function precipIcon(precip, mm, thunder, precipUnit) {
  if (!precip && !thunder) return '';
  const unit = precipUnit || 'мм';
  const labels = {
    'rain_light':        'Слабый дождь',
    'rain_moderate':     'Умеренный дождь',
    'rain_heavy':        'Сильный дождь',
    'freezing_light':    'Слабый переохлаждённый дождь',
    'freezing_moderate': 'Умеренный переохлаждённый дождь',
    'freezing_heavy':    'Сильный переохлаждённый дождь',
    'sleet_light':       'Слабый дождь со снегом',
    'sleet_moderate':    'Умеренный дождь со снегом',
    'sleet_heavy':       'Сильный дождь со снегом',
    'snow_light':        'Слабый снег',
    'snow_moderate':     'Умеренный снег',
    'snow_heavy':        'Сильный снег',
    'snow_rain_light':   'Слабый снег с дождём',
    'snow_rain_moderate':'Умеренный снег с дождём',
    'snow_rain_heavy':   'Сильный снег с дождём',
  };
  const classes = {
    'rain_light':        'wi-rain-light',
    'rain_moderate':     'wi-rain-moderate',
    'rain_heavy':        'wi-rain-heavy',
    'freezing_light':    'wi-freezing-rain-light',
    'freezing_moderate': 'wi-freezing-rain-moderate',
    'freezing_heavy':    'wi-freezing-rain-heavy',
    'sleet_light':       'wi-sleet-light',
    'sleet_moderate':    'wi-sleet-moderate',
    'sleet_heavy':       'wi-sleet-heavy',
    'snow_light':        'wi-snow-light',
    'snow_moderate':     'wi-snow-moderate',
    'snow_heavy':        'wi-snow-heavy',
    'snow_rain_light':   'wi-snow-rain-light',
    'snow_rain_moderate':'wi-snow-rain-moderate',
    'snow_rain_heavy':   'wi-snow-rain-heavy',
  };
  const cls = classes[precip];
  const label = labels[precip] || '';
  const precipTooltip = mm ? `${label} (${mm} ${unit})` : label;
  const fullTooltip = thunder
    ? (label ? `${precipTooltip}, возможна гроза` : 'Местами гроза')
    : precipTooltip;

  const precipHtml = cls ? `<span class="wi ${cls} precip-icon"></span>` : '';
  const thunderHtml = thunder
    ? `<img class="lightning-icon" src="/resources/sprites/lightning.png" alt="гроза">`
    : '';
  if (!precipHtml && !thunderHtml) return '';
  return `<span class="precip-wrap${thunder ? ' has-thunder' : ''}${precip ? ' precip-'+precip : ''}" data-tooltip="${fullTooltip}">${precipHtml}${thunderHtml}</span>`;
}

// Хелпер: иконка тумана
function fogIcon(fog, visUnit) {
  if (!fog) return '';
  const vM = fog.visibility; // всегда в метрах
  const pct = fog.pct;
  let cls, label;
  if (vM >= 1000)      { cls = 'wi-haze';      label = 'Дымка'; }
  else if (vM >= 500)  { cls = 'wi-fog';       label = 'Слабый туман'; }
  else if (vM >= 200)  { cls = 'wi-fog';       label = 'Умеренный туман'; }
  else if (vM >= 50)   { cls = 'wi-fog-heavy'; label = 'Сильный туман'; }
  else                 { cls = 'wi-fog-heavy'; label = 'Очень сильный туман'; }

  let visStr;
  if (visUnit === 'miles') {
    const miles = (vM / 1609.34).toFixed(2);
    visStr = `${miles} миль`;
  } else if (visUnit === 'm') {
    visStr = `${vM} м`;
  } else {
    // km (default)
    visStr = vM >= 1000 ? `${(vM / 1000).toFixed(1)} км` : `${vM} м`;
  }
  const tip = `${label} (видимость ${visStr}, вероятность ${pct}%)`;
  return `<span class="fog-icon-wrap" data-tooltip="${tip}"><span class="wi ${cls}"></span><span class="fog-pct">${pct}%</span></span>`;
}

// Хелперы цветовых схем (используются в архиве и прогнозе)
function tempClass(t) {
  if (t == null) return '';
  if (t >= 41) return 'tc-50'; if (t >= 31) return 'tc-40'; if (t >= 26) return 'tc-30';
  if (t >= 21) return 'tc-25'; if (t >= 16) return 'tc-20'; if (t >= 11) return 'tc-15';
  if (t >=  6) return 'tc-10'; if (t >=  1) return 'tc-5';  if (t ===  0) return 'tc-0';
  if (t >=  -5) return 'tc-m5'; if (t >= -10) return 'tc-m10'; if (t >= -15) return 'tc-m15';
  if (t >= -20) return 'tc-m20'; if (t >= -30) return 'tc-m30'; return 'tc-m40';
}
function tempTooltip(t) {
  if (t == null) return '';
  if (t >= 41) return 'Экстремальная жара'; if (t >= 31) return 'Сильная жара';
  if (t >= 26) return 'Жара'; if (t >= 21) return 'Тепло'; if (t >= 16) return 'Комфортно тепло';
  if (t >= 11) return 'Умеренно тепло'; if (t >=  6) return 'Прохладно'; if (t >=  1) return 'Холодновато';
  if (t ===  0) return '0 градусов'; if (t >=  -5) return 'Лёгкий мороз';
  if (t >= -10) return 'Умеренный мороз'; if (t >= -15) return 'Мороз';
  if (t >= -20) return 'Сильный мороз'; if (t >= -30) return 'Очень сильный мороз';
  return 'Экстремальный мороз';
}
function pressClass(p) {
  if (p == null) return '';
  if (p < 740) return 'press-vlow'; if (p <= 748) return 'press-low';
  if (p <= 765) return ''; if (p <= 775) return 'press-high'; return 'press-vhigh';
}
function pressTooltip(p) {
  if (p == null) return '';
  if (p < 740) return 'Очень низкое давление'; if (p <= 748) return 'Низкое давление';
  if (p <= 765) return 'Нормальное давление'; if (p <= 775) return 'Высокое давление';
  return 'Очень высокое давление';
}
function humClass(h) {
  if (h == null) return '';
  if (h <= 20) return 'hum-vlow'; if (h <= 35) return 'hum-low'; if (h <= 60) return '';
  if (h <= 80) return 'hum-elevated'; if (h <= 90) return 'hum-high'; return 'hum-vhigh';
}
function humTooltip(h) {
  if (h == null) return '';
  if (h <= 20) return 'Очень низкая влажность'; if (h <= 35) return 'Низкая влажность';
  if (h <= 60) return 'Комфортная влажность'; if (h <= 80) return 'Повышенная влажность';
  if (h <= 90) return 'Высокая влажность'; return 'Очень высокая влажность';
}
function windBfClass(ms) {
  if (ms == null) return '';
  if (ms <= 7.9) return ''; if (ms <= 10.7) return 'wind-b5'; if (ms <= 13.8) return 'wind-b6';
  if (ms <= 17.1) return 'wind-b7'; if (ms <= 20.7) return 'wind-b8'; if (ms <= 24.4) return 'wind-b9';
  if (ms <= 28.4) return 'wind-b10'; if (ms <= 32.6) return 'wind-b11'; return 'wind-b12';
}
function windBfLabel(ms) {
  if (ms == null) return '';
  if (ms <= 0.2) return 'Штиль'; if (ms <= 1.5) return 'Тихий'; if (ms <= 3.3) return 'Лёгкий';
  if (ms <= 5.4) return 'Слабый'; if (ms <= 7.9) return 'Умеренный'; if (ms <= 10.7) return 'Свежий';
  if (ms <= 13.8) return 'Сильный'; if (ms <= 17.1) return 'Крепкий'; if (ms <= 20.7) return 'Очень крепкий';
  if (ms <= 24.4) return 'Шторм'; if (ms <= 28.4) return 'Сильный шторм'; if (ms <= 32.6) return 'Жестокий шторм';
  return 'Ураган';
}

// Главная страница — список стран
app.get('/', (req, res) => {
  const countries = getCountries();
  res.render('countries', { countries, toSlug, title: 'Погода в странах мира' });
});

// Прогноз погоды — /weather?id=geonameId или /weather?city=name
app.get('/weather', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geonameId = req.query.id ? parseInt(req.query.id) : null;
    const cityName  = req.query.city || null;
    const settings = {
      temp_unit:     req.query.temp_unit     || 'celsius',
      wind_unit:     req.query.wind_unit     || 'ms',
      pressure_unit: req.query.pressure_unit || 'mmhg',
      precip_unit:   req.query.precip_unit   || 'mm',
      vis_unit:      req.query.vis_unit      || 'km',
      model:         req.query.model         || 'best_match',
    };
    const data = await getWeatherData(ip, cityName, settings, null, null, geonameId);
    const countries = getCountries();
    const countryObj = countries.find(c => c.code === data.country_code);
    if (countryObj) {
      data.countryNameEn = countryObj.nameEn;
    }
    if (data.stateCode && data.country_code) {
      const regions = getRegionsLocalized(data.country_code, 'ru');
      const regionObj = regions.find(r => r.code === data.stateCode);
      if (regionObj) {
        data.admin1    = regionObj.name;
        data.admin1En  = regionObj.nameEn;
      }
    }
    
    // Находим ближайшие аэропорты (максимум 3) и получаем для них температуру
    const nearestAirports = findNearestAirports(data.lat, data.lon, 3, 500);
    
    // Получаем последнюю температуру для каждого аэропорта из METAR
    for (const airport of nearestAirports) {
      try {
        // Получаем METAR данные за последние 24 часа
        const metarData = await fetchMETAR(airport.icao, 24);
        
        if (metarData && metarData.length > 0) {
          // Сортируем по времени (от новых к старым)
          metarData.sort((a, b) => b.obsTime - a.obsTime);
          
          // Берём температуру из самого свежего наблюдения
          const latest = metarData[0];
          if (latest.temp !== null && !isNaN(latest.temp)) {
            airport.temperature = latest.temp;
          }
        }
      } catch (e) {
        console.error(`[weather] Failed to get METAR for airport ${airport.icao}:`, e.message);
      }
    }
    
    data.nearestAirports = nearestAirports;
    
    // Получаем последние данные из архива погоды
    let archiveInfo = null;
    try {
      const lat = data.lat;
      const lon = data.lon;
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now.toISOString().slice(0, 10);
      const startDate = yesterday.toISOString().slice(0, 10);
      
      const hourly = ['temperature_2m','relativehumidity_2m','surface_pressure','windspeed_10m','winddirection_10m','cloudcover','weathercode'].join(',');
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&windspeed_unit=ms`;
      const archResponse = await fetch(url);
      const archData = await archResponse.json();
      
      if (archData.hourly && archData.hourly.time && archData.hourly.time.length > 0) {
        // Вычисляем UTC offset из timezone
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: archData.timezone }));
        const offsetMs = tzDate - utcDate;
        const utcOffsetHours = offsetMs / (1000 * 60 * 60);
        
        // Вычисляем целевые часы архива (как в /archive route)
        const startHour = ((utcOffsetHours % 3) + 3) % 3;
        const TARGET_HOURS = [
          startHour % 24,
          (startHour + 3) % 24,
          (startHour + 6) % 24,
          (startHour + 9) % 24,
          (startHour + 12) % 24,
          (startHour + 15) % 24,
          (startHour + 18) % 24,
          (startHour + 21) % 24
        ];
        const TARGET_HOURS_SET = new Set(TARGET_HOURS);
        
        // Находим последний ДОСТУПНЫЙ целевой час в данных
        // Данные появляются с задержкой ~30-40 минут после наблюдения
        const times = archData.hourly.time;
        const nowWithDelay = new Date(now.getTime() - 30 * 60 * 1000); // Вычитаем 30 минут задержки
        let lastIdx = -1;
        for (let i = times.length - 1; i >= 0; i--) {
          const hour = parseInt(times[i].slice(11, 13), 10);
          const periodTime = new Date(times[i]);
          
          // Проверяем что это целевой час И данные уже доступны
          if (TARGET_HOURS_SET.has(hour) && periodTime <= nowWithDelay) {
            lastIdx = i;
            break;
          }
        }
        
        if (lastIdx >= 0) {
          const lastTime = times[lastIdx];
          const lastTimeDate = new Date(lastTime);
          
          console.log(`[weather] Archive info: lastTime=${lastTime}, timezone=${archData.timezone}, TARGET_HOURS=${TARGET_HOURS.join(',')}`);
          
          // Рассчитываем время с учётом timezone
          const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: archData.timezone }));
          const diffMs = nowLocal - lastTimeDate;
          const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));
          const minutesAgo = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          
          const T = archData.hourly.temperature_2m?.[lastIdx];
          const U = archData.hourly.relativehumidity_2m?.[lastIdx];
          const P = archData.hourly.surface_pressure?.[lastIdx];
          const Ff = archData.hourly.windspeed_10m?.[lastIdx];
          const wdir = archData.hourly.winddirection_10m?.[lastIdx];
          const cloudcover = archData.hourly.cloudcover?.[lastIdx];
          const wcode = archData.hourly.weathercode?.[lastIdx];
          
          console.log(`[weather] Archive data: T=${T}, U=${U}, P=${P}, Ff=${Ff}, wdir=${wdir}, cloudcover=${cloudcover}, wcode=${wcode}`);
          
          const dirs = ['севера','северо-северо-востока','северо-востока','востоко-северо-востока','востока','востоко-юго-востока','юго-востока','юго-юго-востока','юга','юго-юго-запада','юго-запада','западо-юго-запада','запада','западо-северо-запада','северо-запада','северо-северо-запада'];
          const windDirText = wdir != null && !isNaN(wdir) ? dirs[Math.round(wdir / 22.5) % 16] : null;
          
          // Формируем текст времени
          let timeText = '';
          if (hoursAgo === 0 && minutesAgo < 30) {
            timeText = 'Менее получаса назад';
          } else if (hoursAgo === 0) {
            timeText = `${minutesAgo} ${minutesAgo === 1 ? 'минуту' : minutesAgo < 5 ? 'минуты' : 'минут'} назад`;
          } else if (hoursAgo === 1 && minutesAgo === 0) {
            timeText = '1 час назад';
          } else if (hoursAgo === 1) {
            timeText = `1 час ${minutesAgo} ${minutesAgo === 1 ? 'минуту' : minutesAgo < 5 ? 'минуты' : 'минут'} назад`;
          } else if (hoursAgo < 5) {
            timeText = `${hoursAgo} часа назад`;
          } else {
            timeText = `${hoursAgo} часов назад`;
          }
          
          let text = `${timeText} на метеостанции было `;
          if (T != null && !isNaN(T)) text += `${T > 0 ? '+' : ''}${Math.round(T * 10) / 10} °C`;
          
          // Используем WMO weathercode для описания погоды (как в архиве)
          if (wcode != null && WMO_WW[wcode]) {
            text += `, ${WMO_WW[wcode].toLowerCase()}`;
          } else if (cloudcover != null) {
            if (cloudcover <= 10) text += ', ясно';
            else if (cloudcover <= 30) text += ', малооблачно';
            else if (cloudcover <= 60) text += ', переменная облачность';
            else if (cloudcover <= 85) text += ', облачно';
            else text += ', пасмурно';
          }
          
          if (P != null && !isNaN(P)) {
            const Pmm = Math.round(P * 0.750064);
            if (Pmm < 740) text += ', низкое атмосферное давление';
            else if (Pmm <= 765) text += ', атмосферное давление в пределах нормы';
            else text += ', высокое атмосферное давление';
          }
          
          if (U != null && !isNaN(U)) {
            if (U <= 35) text += ', низкая влажность';
            else if (U <= 60) text += ', комфортная влажность';
            else if (U <= 80) text += ', повышенная влажность';
            else text += `, высокая влажность (${U}%)`;
          }
          
          if (Ff != null && !isNaN(Ff) && windDirText) {
            const Ffr = Math.round(Ff);
            if (Ffr <= 1) {
              text += ', штиль';
            } else {
              if (Ffr <= 3) text += `, тихий ветер (${Ffr} м/с)`;
              else if (Ffr <= 5) text += `, слабый ветер (${Ffr} м/с)`;
              else if (Ffr <= 7) text += `, умеренный ветер (${Ffr} м/с)`;
              else text += `, ветер ${Ffr} м/с`;
              text += `, дующий с ${windDirText}`;
            }
          }
          
          text += '. ';
          
          archiveInfo = { text, hoursAgo, minutesAgo };
        }
      }
    } catch (e) {
      console.error('[weather] Archive fetch error:', e.message);
    }
    
    data.archiveInfo = archiveInfo;
    renderWeather(res, data, settings);
  } catch (e) {
    console.error(e);
    res.status(500).send('Ошибка получения данных: ' + e.message);
  }
});

function renderWeather(res, data, settings) {
  res.render('index', {
    ...data,
    settings,
    toSlug,
    geonameId: data.geonameId || '',
    title: `Погода в ${data.city}`,
    description: `Прогноз погоды в ${data.city}`,
    cloudIcon,
    precipIcon: (precip, mm, thunder) => precipIcon(precip, mm, thunder, settings.precip_unit === 'inch' ? 'дюйм' : 'мм'),
    fogIcon: (fog) => fogIcon(fog, settings.vis_unit),
  });
}

// /countries → редирект на главную
app.get('/countries', (req, res) => res.redirect('/'));

// Список аэропортов
app.get('/airports', (req, res) => {
  try {
    const airports = getAllAirports();
    const countries = getCountries();
    
    // Группируем аэропорты по странам
    const byCountry = {};
    for (const airport of airports) {
      if (!byCountry[airport.country]) {
        const country = countries.find(c => c.code === airport.country);
        byCountry[airport.country] = {
          code: airport.country,
          name: country ? country.name : airport.country,
          nameEn: country ? country.nameEn : airport.country,
          airports: []
        };
      }
      byCountry[airport.country].airports.push(airport);
    }
    
    // Сортируем страны и аэропорты
    const sortedCountries = Object.values(byCountry).sort((a, b) => 
      a.name.localeCompare(b.name, 'ru')
    );
    
    for (const country of sortedCountries) {
      country.airports.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    
    res.render('airports', {
      title: 'Архив погоды аэропортов',
      countries: sortedCountries,
      totalAirports: airports.length,
    });
  } catch (e) {
    console.error('[airports] Error:', e.message);
    res.status(500).send('Server error');
  }
});

// API поиска города
app.get('/api/search', (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) return res.json([]);
    const { search } = require('./data/geo-db');
    const countries = getCountries();
    const countryCodesSet = new Set(countries.map(c => c.code));
    const results = search(q, 20)
      .filter(c => countryCodesSet.has(c.cc))
      .slice(0, 8)
      .map(c => {
        const country = countries.find(x => x.code === c.cc);
        return {
          id: c.id,
          name: c.nameRu || c.name,
          nameEn: c.name,
          region: c.adm1 || '',
          country: country ? country.name : c.cc,
          country_code: c.cc,
          countryNameEn: country ? country.nameEn : '',
          lat: c.lat,
          lon: c.lon,
        };
      });
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Демо эффектов ветра
app.get('/wind-demo', (req, res) => res.render('wind-demo', {}));

// Редактор спрайтов
app.get('/sprite-editor', (req, res) => res.sendFile(__dirname + '/sprite-editor.html'));

// Тест иконок
app.get('/icon-test', (req, res) => res.render('icon-test', { precipIcon, cloudIcon, fogIcon }));

/**
 * Получение METAR данных от Aviation Weather API
 * @param {string} icao - ICAO код аэропорта (например, "UUEE")
 * @param {number} hours - Количество часов назад (до 360 часов / 15 дней)
 * @returns {Promise<Array>} - Массив METAR наблюдений
 */
async function fetchMETAR(icao, hours = 48) {
  try {
    const fetch = require('node-fetch');
    const url = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=${hours}`;
    
    console.log(`[METAR] Fetching: ${url}`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WeatherWebsite/1.0 (weather archive service)',
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[METAR] HTTP error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[METAR] Received ${data.length} reports in ${Date.now() - startTime}ms`);
    
    return data;
  } catch (e) {
    console.error('[METAR] Error:', e.message);
    return null;
  }
}

/**
 * Получение исторических данных из Visual Crossing Weather API
 * Реальные наблюдения с метеостанций
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} startDate - Начальная дата (YYYY-MM-DD)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD)
 * @returns {Promise<Object>} - Данные наблюдений
 */
/**
 * Получение исторических данных из Meteostat API (реальные наблюдения с метеостанций)
 * Требует RapidAPI ключ
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} startDate - Начальная дата (YYYY-MM-DD)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD)
 * @param {string} timezone - Часовой пояс (например, 'Europe/Moscow')
 * @returns {Promise<Object>} - Данные наблюдений
 */
async function fetchMeteostat(lat, lon, startDate, endDate, timezone = 'UTC') {
  try {
    const fetch = require('node-fetch');
    
    // Meteostat через RapidAPI
    // Регистрация: https://rapidapi.com/meteostat/api/meteostat
    // Бесплатный тариф: 500 запросов/месяц
    // Максимум 30 дней за один запрос
    const apiKey = '36bd019135msh5c8f0fbfab2e82bp1db9c3jsn7b3822fce9cf';
    
    const url = `https://meteostat.p.rapidapi.com/point/hourly?lat=${lat}&lon=${lon}&start=${startDate}&end=${endDate}&tz=${encodeURIComponent(timezone)}`;
    
    console.log(`[Meteostat] Fetching: ${url}`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'meteostat.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[Meteostat] HTTP error: ${response.status}`);
      const text = await response.text();
      console.error(`[Meteostat] Response:`, text.substring(0, 200));
      return null;
    }
    
    const data = await response.json();
    console.log(`[Meteostat] Received data in ${Date.now() - startTime}ms`);
    console.log(`[Meteostat] Records: ${data.data?.length}, Meta:`, data.meta);
    
    return data;
  } catch (e) {
    console.error('[Meteostat] Error:', e.message);
    return null;
  }
}

async function fetchVisualCrossing(lat, lon, startDate, endDate) {
  try {
    const fetch = require('node-fetch');
    
    // Visual Crossing требует API ключ (бесплатный тариф: 1000 запросов/день)
    // Регистрация: https://www.visualcrossing.com/sign-up
    const apiKey = '5RKV2ZGMDH47UMP334P4TVX2T';
    
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/${startDate}/${endDate}?unitGroup=metric&include=hours&key=${apiKey}&contentType=json`;
    
    console.log(`[VisualCrossing] Fetching: ${url.replace(apiKey, 'API_KEY')}`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[VisualCrossing] HTTP error: ${response.status}`);
      const text = await response.text();
      console.error(`[VisualCrossing] Response:`, text.substring(0, 200));
      return null;
    }
    
    const data = await response.json();
    console.log(`[VisualCrossing] Received data in ${Date.now() - startTime}ms`);
    console.log(`[VisualCrossing] Days: ${data.days?.length}, Station: ${data.stations ? Object.keys(data.stations)[0] : 'unknown'}`);
    
    return data;
  } catch (e) {
    console.error('[VisualCrossing] Error:', e.message);
    return null;
  }
}

/**
 * Получение исторических данных из Open-Meteo Historical API
 * Использует реальные наблюдения с метеостанций (не модельные данные)
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} startDate - Начальная дата (YYYY-MM-DD)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD)
 * @returns {Promise<Object>} - Данные наблюдений
 */
/**
 * Получение данных о грозах из Historical Forecast API (мультимодельный подход)
 * Использует 11 глобальных моделей для максимальной точности
 * Покрытие: с 2016 года (JMA) до настоящего времени
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} startDate - Начальная дата (YYYY-MM-DD)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD)
 * @returns {Promise<Object>} - Данные о грозах от нескольких моделей
 */
async function fetchMultiModelThunderstorms(lat, lon, startDate, endDate) {
  try {
    const fetch = require('node-fetch');
    
    const hourly = [
      'weather_code',
      'cape',
      'precipitation',
      'showers'
    ].join(',');
    
    // Запрашиваем данные от множества моделей параллельно
    // Модели отсортированы по дате начала архива (старые первые)
    const models = [
      'jma_gsm',              // Japan JMA (55 км, с 2016-01-01) - САМАЯ СТАРАЯ
      'ecmwf_ifs',            // ECMWF IFS HRES (9 км, с 2017-01-01)
      'gfs_global',           // NOAA GFS (13 км, с 2021-03-23)
      'ukmo_global_deterministic_10km', // UK Met Office (10 км, с 2022-03-01)
      'ecmwf_ifs04',          // ECMWF IFS 0.4° (44 км, с 2022-11-07)
      'gem_global',           // Canadian GEM (15 км, с 2022-11-23)
      'icon_global',          // DWD ICON (11 км, с 2022-11-24)
      'cma_grapes_global',    // China CMA (15 км, с 2023-12-31)
      'arpege_world',         // Météo-France ARPEGE (25 км, с 2024-01-02)
      'bom_access_global',    // Australian BOM (15 км, с 2024-01-18)
      'ecmwf_ifs025'          // ECMWF IFS 0.25° (25 км, с 2024-02-03)
    ];
    
    const promises = models.map(async (model) => {
      const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&models=${model}`;
      
      console.log(`[MultiModel] Fetching ${model}...`);
      const startTime = Date.now();
      
      try {
        const response = await fetch(url, { timeout: 15000 });
        
        if (!response.ok) {
          console.error(`[MultiModel] ${model} HTTP error: ${response.status}`);
          return { model, data: null };
        }
        
        const data = await response.json();
        console.log(`[MultiModel] ${model} received in ${Date.now() - startTime}ms`);
        
        if (data.error) {
          console.error(`[MultiModel] ${model} API error: ${data.reason}`);
          return { model, data: null };
        }
        
        return { model, data };
      } catch (e) {
        console.error(`[MultiModel] ${model} error:`, e.message);
        return { model, data: null };
      }
    });
    
    const results = await Promise.all(promises);
    
    // Объединяем результаты
    const combined = {
      jma: results.find(r => r.model === 'jma_gsm')?.data,
      ecmwf_hres: results.find(r => r.model === 'ecmwf_ifs')?.data,
      gfs: results.find(r => r.model === 'gfs_global')?.data,
      ukmo: results.find(r => r.model === 'ukmo_global_deterministic_10km')?.data,
      ecmwf: results.find(r => r.model === 'ecmwf_ifs04')?.data,
      gem: results.find(r => r.model === 'gem_global')?.data,
      icon: results.find(r => r.model === 'icon_global')?.data,
      cma: results.find(r => r.model === 'cma_grapes_global')?.data,
      arpege: results.find(r => r.model === 'arpege_world')?.data,
      bom: results.find(r => r.model === 'bom_access_global')?.data,
      ecmwf_025: results.find(r => r.model === 'ecmwf_ifs025')?.data,
    };
    
    const availableModels = Object.entries(combined)
      .filter(([_, data]) => data !== null)
      .map(([name, _]) => name.toUpperCase());
    
    console.log(`[MultiModel] Available models: ${availableModels.join(', ')}`);
    
    return combined;
  } catch (e) {
    console.error('[MultiModel] Error:', e.message);
    return { icon: null, gfs: null, ecmwf: null, gem: null };
  }
}

/**
 * Анализ данных о грозах от нескольких моделей
 * @param {Object} modelData - Данные от всех моделей (11 моделей)
 * @param {string} datetime - Время в формате ISO
 * @param {number} cloudCover - Облачность (%) из основных данных
 * @returns {Object} - Результат анализа грозы
 */
function analyzeThunderstorm(modelData, datetime, cloudCover = null) {
  const result = {
    hasThunderstorm: false,
    description: null,
    confidence: 'none',
    models: [],
    modelCount: 0
  };
  
  const thunderstorms = [];
  
  // Проверяем все модели
  const modelNames = ['jma', 'ecmwf_hres', 'gfs', 'ukmo', 'ecmwf', 'gem', 'icon', 'cma', 'arpege', 'bom', 'ecmwf_025'];
  
  for (const modelName of modelNames) {
    const data = modelData[modelName];
    if (!data || !data.hourly) continue;
    
    const idx = data.hourly.time?.findIndex(t => t === datetime);
    if (idx < 0) continue;
    
    let code = data.hourly.weather_code?.[idx];
    const cape = data.hourly.cape?.[idx];
    const precip = data.hourly.precipitation?.[idx] || 0;
    const showers = data.hourly.showers?.[idx] || 0;
    const totalPrecip = precip + showers;
    
    let hasThunderstorm = false;
    let detectionMethod = '';
    
    // Метод 1: По коду погоды (если доступен)
    if (code >= 95 && code <= 99) {
      hasThunderstorm = true;
      detectionMethod = 'weather_code';
    }
    // Метод 2: Ливни (80-82) + CAPE = вероятная гроза
    else if (code >= 80 && code <= 82 && cape != null && cape > 500) {
      hasThunderstorm = true;
      detectionMethod = 'showers_cape';
      code = 95;
    }
    // Метод 3: Умеренные осадки (51-67) + умеренный CAPE
    else if (code >= 51 && code <= 67 && cape != null && cape > 800 && totalPrecip > 0.3) {
      hasThunderstorm = true;
      detectionMethod = 'rain_cape';
      code = 95;
    }
    // Метод 4: По CAPE и осадкам (смягчённые критерии)
    else if (cape != null && cape > 0) {
      // Умеренный CAPE + осадки
      if (cape > 500 && totalPrecip > 2) {
        hasThunderstorm = true;
        detectionMethod = 'cape_moderate';
        code = 95;
      }
      // Высокий CAPE + небольшие осадки
      else if (cape > 1000 && totalPrecip > 0.3) {
        hasThunderstorm = true;
        detectionMethod = 'cape_high';
        code = 95;
      }
      // Очень высокий CAPE + любые осадки
      else if (cape > 1500 && totalPrecip > 0.1) {
        hasThunderstorm = true;
        detectionMethod = 'cape_very_high';
        code = 95;
      }
      // Экстремальный CAPE даже без осадков
      else if (cape > 2000) {
        hasThunderstorm = true;
        detectionMethod = 'cape_extreme';
        code = 95;
      }
    }
    // Метод 5: Сильные осадки (>10mm/h) могут указывать на грозу
    else if (totalPrecip > 10) {
      hasThunderstorm = true;
      detectionMethod = 'heavy_precip';
      code = 95;
    }
    
    if (hasThunderstorm) {
      thunderstorms.push({
        model: modelName.toUpperCase(),
        code: code || 95,
        cape,
        precip,
        showers,
        totalPrecip,
        detectionMethod
      });
      result.models.push(modelName.toUpperCase());
    }
  }
  
  result.modelCount = thunderstorms.length;
  
  if (thunderstorms.length === 0) {
    return result; // Нет грозы
  }
  
  result.hasThunderstorm = true;
  
  // Определяем уверенность по количеству моделей (из 11 возможных)
  if (thunderstorms.length >= 3) {
    result.confidence = 'very_high'; // 3+ моделей (≥27%)
  } else if (thunderstorms.length >= 2) {
    result.confidence = 'high'; // 2 модели
  } else {
    result.confidence = 'medium'; // 1 модель
  }
  
  // Используем максимальные значения для описания
  const maxCode = Math.max(...thunderstorms.map(t => t.code));
  const maxCape = Math.max(...thunderstorms.map(t => t.cape || 0));
  const maxPrecip = Math.max(...thunderstorms.map(t => t.totalPrecip));
  
  result.description = getThunderstormDescription(maxCode, maxCape, maxPrecip, cloudCover);
  
  // Если при ясной погоде гроза не показывается, возвращаем пустой результат
  if (!result.description) {
    return { hasThunderstorm: false, description: null, confidence: 'none', models: [], modelCount: 0 };
  }
  
  return result;
}

/**
 * Получение описания грозы по коду и параметрам
 * @param {number} code - Код погоды WMO
 * @param {number} cape - CAPE (J/kg)
 * @param {number} totalPrecip - Осадки (мм)
 * @param {number} cloudCover - Облачность (%) - опционально
 * @returns {string} - Описание грозы
 */
function getThunderstormDescription(code, cape, totalPrecip, cloudCover = null) {
  // Проверяем наличие осадков
  const hasPrecip = totalPrecip > 0.1;
  
  // Проверяем ясную погоду (если есть данные об облачности)
  // При ясной погоде (облачность < 30%) грозы практически не бывает
  const isClear = cloudCover !== null && cloudCover < 30;
  
  if (isClear) {
    // При ясной погоде не показываем грозу
    return null;
  }
  
  if (code === 95) {
    // Гроза слабая или умеренная (код 95 - это общий код для обоих типов)
    let description = 'Гроза слабая или умеренная';
    
    // Добавляем информацию об осадках
    if (!hasPrecip) {
      description += ', но без осадков';
    }
    
    return description;
    
  } else if (code === 96) {
    // Гроза с небольшим градом
    return 'Гроза с небольшим градом';
    
  } else if (code === 97) {
    // Гроза сильная без града
    let description = 'Гроза сильная';
    if (!hasPrecip) {
      description += ', но без осадков';
    }
    return description;
    
  } else if (code === 98) {
    // Гроза с пыльной бурей
    return 'Гроза с пыльной бурей';
    
  } else if (code === 99) {
    // Гроза с сильным градом
    return 'Гроза с сильным градом';
  }
  
  // Если код неизвестен или не определён - общее описание
  return 'Гроза (с осадками или без них).';
}

async function fetchICONLightning(lat, lon, startDate, endDate) {
  try {
    const fetch = require('node-fetch');
    
    const hourly = [
      'weather_code',
      'cape',
      'precipitation',
      'showers'
    ].join(',');
    
    // Historical Forecast API с моделью ICON (доступно с 2022-11-24)
    const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&models=icon_global`;
    
    console.log(`[ICON Lightning] Fetching: ${url}`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[ICON Lightning] HTTP error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[ICON Lightning] Received data in ${Date.now() - startTime}ms`);
    
    if (data.error) {
      console.error(`[ICON Lightning] API error: ${data.reason}`);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('[ICON Lightning] Error:', e.message);
    return null;
  }
}

async function fetchOpenMeteoHistorical(lat, lon, startDate, endDate) {
  try {
    const fetch = require('node-fetch');
    
    const hourly = [
      'temperature_2m','relative_humidity_2m','dew_point_2m',
      'surface_pressure','wind_speed_10m','wind_gusts_10m','wind_direction_10m',
      'cloud_cover','visibility','weather_code','snow_depth','precipitation',
    ].join(',');
    
    // Используем historical-forecast API который содержит реальные наблюдения
    const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=auto&windspeed_unit=ms`;
    
    console.log(`[OpenMeteo Historical] Fetching: ${url}`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[OpenMeteo Historical] HTTP error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[OpenMeteo Historical] Received data in ${Date.now() - startTime}ms`);
    
    if (data.error) {
      console.error(`[OpenMeteo Historical] API error: ${data.reason}`);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('[OpenMeteo Historical] Error:', e.message);
    return null;
  }
}

/**
 * Получение данных Meteostat по координатам
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} startDate - Начальная дата (YYYY-MM-DD)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD)
 * @returns {Promise<Array>} - Массив наблюдений
 */
async function fetchMeteostat(lat, lon, startDate, endDate) {
  try {
    const fetch = require('node-fetch');
    
    // Сначала находим ближайшую станцию
    const stationsUrl = `https://meteostat.p.rapidapi.com/stations/nearby?lat=${lat}&lon=${lon}&limit=1`;
    
    console.log(`[Meteostat] Finding nearest station for ${lat},${lon}`);
    
    const stationsResponse = await fetch(stationsUrl, {
      headers: {
        'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY', // Нужен API ключ
        'X-RapidAPI-Host': 'meteostat.p.rapidapi.com'
      },
      timeout: 15000,
    });
    
    if (!stationsResponse.ok) {
      console.error(`[Meteostat] Stations HTTP error: ${stationsResponse.status}`);
      return null;
    }
    
    const stationsData = await stationsResponse.json();
    
    if (!stationsData.data || stationsData.data.length === 0) {
      console.log('[Meteostat] No stations found nearby');
      return null;
    }
    
    const station = stationsData.data[0];
    console.log(`[Meteostat] Using station: ${station.id} (${station.name}), distance: ${station.distance}km`);
    
    // Получаем данные со станции
    const dataUrl = `https://meteostat.p.rapidapi.com/stations/hourly?station=${station.id}&start=${startDate}&end=${endDate}`;
    
    console.log(`[Meteostat] Fetching data: ${dataUrl}`);
    
    const dataResponse = await fetch(dataUrl, {
      headers: {
        'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY',
        'X-RapidAPI-Host': 'meteostat.p.rapidapi.com'
      },
      timeout: 15000,
    });
    
    if (!dataResponse.ok) {
      console.error(`[Meteostat] Data HTTP error: ${dataResponse.status}`);
      return null;
    }
    
    const data = await dataResponse.json();
    console.log(`[Meteostat] Received ${data.data?.length || 0} observations`);
    
    return data.data || [];
  } catch (e) {
    console.error('[Meteostat] Error:', e.message);
    return null;
  }
}

/**
 * Получение METAR данных по координатам (ближайшая станция)
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {number} hours - Количество часов назад (до 360 часов / 15 дней)
 * @param {number} delta - Радиус поиска в градусах (по умолчанию 3 градуса = ~300 км)
 * @returns {Promise<Array>} - Массив METAR наблюдений
 */
async function fetchMETARByCoords(lat, lon, hours = 48, delta = 3) {
  try {
    const fetch = require('node-fetch');
    // Формат bbox: minLon,minLat,maxLon,maxLat
    const minLon = lon - delta;
    const minLat = lat - delta;
    const maxLon = lon + delta;
    const maxLat = lat + delta;
    const url = `https://aviationweather.gov/api/data/metar?bbox=${minLon},${minLat},${maxLon},${maxLat}&format=json&hours=${hours}`;
    
    console.log(`[METAR] Fetching by coords: ${url}`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WeatherWebsite/1.0 (weather archive service)',
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[METAR] HTTP error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const text = await response.text();
    console.log(`[METAR] Response length: ${text.length} bytes`);
    
    if (!text || text.trim().length === 0) {
      console.log('[METAR] Empty response - no stations in area');
      return null;
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[METAR] JSON parse error:', e.message);
      console.log('[METAR] Response text:', text.substring(0, 200));
      return null;
    }
    
    console.log(`[METAR] Received ${data.length} reports in ${Date.now() - startTime}ms`);
    
    // Если получили данные от нескольких станций, выбираем ближайшую
    if (data && data.length > 0) {
      // Группируем по станциям
      const byStation = {};
      for (const obs of data) {
        const icao = obs.icaoId;
        if (!byStation[icao]) byStation[icao] = [];
        byStation[icao].push(obs);
      }
      
      // Находим ближайшую станцию
      let closestStation = null;
      let minDist = Infinity;
      for (const icao in byStation) {
        const obs = byStation[icao][0];
        if (obs.lat != null && obs.lon != null) {
          const dist = Math.sqrt(Math.pow(obs.lat - lat, 2) + Math.pow(obs.lon - lon, 2));
          if (dist < minDist) {
            minDist = dist;
            closestStation = icao;
          }
        }
      }
      
      // Возвращаем данные только от ближайшей станции
      if (closestStation) {
        console.log(`[METAR] Using closest station: ${closestStation} (distance: ${minDist.toFixed(2)} degrees)`);
        return byStation[closestStation];
      }
    }
    
    return data;
  } catch (e) {
    console.error('[METAR] Error:', e.message);
    return null;
  }
}

/**
 * Парсинг погодных явлений из METAR строки
 * @param {string} wxString - Строка погодных явлений (например, "TS RA BR")
 * @returns {Object} - Объект с WW, W1, W2 текстовыми описаниями
 */
function parseMETARWeather(wxString) {
  if (!wxString) return { WW: null, W1: null, W2: null };
  
  const { METAR_WX } = require('./data/wmo-codes');
  
  // Убираем пробелы и разбиваем на группы
  const wx = wxString.toUpperCase().trim();
  
  // Пробуем найти прямое совпадение
  if (METAR_WX[wx]) {
    return { WW: METAR_WX[wx], W1: null, W2: null };
  }
  
  // Разбиваем на отдельные группы и ищем первую подходящую
  const groups = wx.split(/\s+/);
  for (const group of groups) {
    if (METAR_WX[group]) {
      return { WW: METAR_WX[group], W1: null, W2: null };
    }
  }
  
  // Если не нашли точное совпадение, пробуем разобрать по частям
  let WW = null;
  
  // Гроза
  if (wx.includes('TS')) {
    if (wx.includes('GR') || wx.includes('GS')) {
      WW = 'Гроза с градом';
    } else if (wx.includes('SN')) {
      WW = 'Гроза со снегом';
    } else if (wx.includes('RA')) {
      WW = 'Гроза с дождём';
    } else {
      WW = 'Гроза';
    }
  }
  // Ливни
  else if (wx.includes('SH')) {
    if (wx.includes('SN')) {
      WW = wx.includes('+') ? 'Сильный ливневый снег' : wx.includes('-') ? 'Слабый ливневый снег' : 'Ливневый снег';
    } else if (wx.includes('RA')) {
      WW = wx.includes('+') ? 'Сильный ливневый дождь' : wx.includes('-') ? 'Слабый ливневый дождь' : 'Ливневый дождь';
    } else if (wx.includes('GR') || wx.includes('GS')) {
      WW = 'Ливневый град';
    }
  }
  // Переохлаждённые осадки
  else if (wx.includes('FZ')) {
    if (wx.includes('RA')) {
      WW = 'Переохлаждённый дождь';
    } else if (wx.includes('DZ')) {
      WW = 'Переохлаждённая морось';
    } else if (wx.includes('FG')) {
      WW = 'Переохлаждённый туман';
    }
  }
  // Дождь
  else if (wx.includes('RA')) {
    if (wx.includes('SN')) {
      WW = wx.includes('+') ? 'Сильный дождь со снегом' : wx.includes('-') ? 'Слабый дождь со снегом' : 'Дождь со снегом';
    } else {
      WW = wx.includes('+') ? 'Сильный дождь' : wx.includes('-') ? 'Слабый дождь' : 'Дождь';
    }
  }
  // Снег
  else if (wx.includes('SN')) {
    WW = wx.includes('+') ? 'Сильный снег' : wx.includes('-') ? 'Слабый снег' : 'Снег';
  }
  // Морось
  else if (wx.includes('DZ')) {
    WW = wx.includes('+') ? 'Сильная морось' : wx.includes('-') ? 'Слабая морось' : 'Морось';
  }
  // Туман
  else if (wx.includes('FG')) {
    if (wx.includes('MI')) {
      WW = 'Поземный туман';
    } else if (wx.includes('BC')) {
      WW = 'Туман клочьями';
    } else if (wx.includes('PR')) {
      WW = 'Туман частичный';
    } else {
      WW = 'Туман';
    }
  }
  // Дымка/мгла
  else if (wx.includes('BR')) {
    WW = 'Дымка';
  } else if (wx.includes('HZ')) {
    WW = 'Мгла';
  }
  // Метель
  else if (wx.includes('BLSN')) {
    WW = 'Низовая метель';
  } else if (wx.includes('DRSN')) {
    WW = 'Низовая метель слабая';
  }
  // Пыль/песок
  else if (wx.includes('DU') || wx.includes('SA')) {
    if (wx.includes('BL')) {
      WW = wx.includes('DU') ? 'Пыль, поднятая ветром' : 'Песок, поднятый ветром';
    } else if (wx.includes('DR')) {
      WW = wx.includes('DU') ? 'Пыль низовая' : 'Песок низовой';
    } else if (wx.includes('SS')) {
      WW = 'Песчаная буря';
    } else if (wx.includes('DS')) {
      WW = 'Пыльная буря';
    } else {
      WW = wx.includes('DU') ? 'Пыль' : 'Песок';
    }
  }
  // Другие явления
  else if (wx.includes('FU')) {
    WW = 'Дым';
  } else if (wx.includes('VA')) {
    WW = 'Вулканический пепел';
  } else if (wx.includes('SQ')) {
    WW = 'Шквалы';
  } else if (wx.includes('FC')) {
    WW = wx.includes('+') ? 'Смерч' : 'Воронкообразное облако';
  } else if (wx.includes('PO')) {
    WW = 'Пыльные вихри';
  } else if (wx.includes('GR') || wx.includes('GS')) {
    WW = 'Град';
  } else if (wx.includes('IC')) {
    WW = 'Ледяные кристаллы';
  } else if (wx.includes('PL')) {
    WW = 'Ледяная крупа';
  } else if (wx.includes('SG')) {
    WW = 'Снежные зёрна';
  }
  
  return { WW, W1: null, W2: null };
}

/**
 * Парсинг METAR данных в формат архива
 * @param {Array} metarData - Массив METAR наблюдений
 * @param {Object} airport - Информация об аэропорте
 * @param {string} timezone - Timezone аэропорта (например, "Europe/Moscow")
 * @param {Array} targetHours - Целевые часы для фильтрации (в UTC)
 * @returns {Array} - Массив строк для архива
 */
function parseMETARToArchive(metarData, airport, timezone = 'UTC', targetHours = null) {
  if (!metarData || metarData.length === 0) return [];
  
  const rows = [];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const dirs = ['С','С-С-В','С-В','В-С-В','В','В-Ю-В','Ю-В','Ю-Ю-В','Ю','Ю-Ю-З','Ю-З','З-Ю-З','З','З-С-З','С-З','С-С-З'];
  
  // Если указаны целевые часы, группируем наблюдения и выбираем ближайшие
  if (targetHours && targetHours.length > 0) {
    // Группируем наблюдения по дате и целевому часу
    const grouped = {}; // ключ: "YYYY-MM-DD:HH", значение: массив наблюдений
    
    for (const metar of metarData) {
      try {
        const obsTimeUTC = new Date(metar.obsTime);
        
        // Конвертируем в местное время
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          weekday: 'short',
          hour12: false
        });
        const parts = formatter.formatToParts(obsTimeUTC);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const hourLocal = parseInt(parts.find(p => p.type === 'hour').value);
        const minute = parseInt(parts.find(p => p.type === 'minute').value);
        const weekday = parts.find(p => p.type === 'weekday').value;
        
        // Находим ближайший целевой час
        let closestTarget = null;
        let minDiff = Infinity;
        
        for (const targetHour of targetHours) {
          let diff = Math.abs(hourLocal - targetHour);
          if (diff > 12) diff = 24 - diff; // Переход через полночь
          
          if (diff < minDiff) {
            minDiff = diff;
            closestTarget = targetHour;
          }
        }
        
        // Пропускаем если разница больше 1.5 часов
        if (minDiff > 1.5) continue;
        
        const dateKey = `${year}-${month}-${day}`;
        const groupKey = `${dateKey}:${closestTarget}`;
        
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        
        grouped[groupKey].push({
          metar,
          hourLocal,
          minute,
          weekday,
          year,
          month,
          day,
          targetHour: closestTarget,
          timeDiff: minDiff
        });
      } catch (e) {
        console.error('[METAR] Parse error:', e.message);
      }
    }
    
    // Для каждой группы выбираем ОДНО наблюдение (самое близкое по времени)
    for (const groupKey in grouped) {
      const observations = grouped[groupKey];
      
      // Сортируем по разнице времени и берём первое (самое близкое)
      observations.sort((a, b) => {
        const diffA = Math.abs(a.hourLocal + a.minute / 60 - a.targetHour);
        const diffB = Math.abs(b.hourLocal + b.minute / 60 - b.targetHour);
        return diffA - diffB;
      });
      
      const best = observations[0];
      const metar = best.metar;
      
      const weekdayMap = { 'Sun': 'Вс', 'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб' };
      const dayName = weekdayMap[best.weekday] || best.weekday;
      const monthIndex = parseInt(best.month) - 1;
      const monthName = months[monthIndex];
      const dateKey = `${best.year}-${best.month}-${best.day}`;
      const dateLabel = `${best.year}г.\\n${best.day} ${monthName},\\n${dayName}`;
      const displayHour = best.targetHour.toString().padStart(2, '0');
      
      const T = metar.temp !== null && !isNaN(metar.temp) ? metar.temp : null;
      const Td = metar.dewp !== null && !isNaN(metar.dewp) ? metar.dewp : null;
      // altim приходит в inHg (дюймы ртутного столба), конвертируем в мм рт.ст.
      // Если altim > 100, значит это уже в гПа, конвертируем: гПа * 0.750064 = мм рт.ст.
      let P = null;
      if (metar.altim !== null && !isNaN(metar.altim)) {
        if (metar.altim > 100) {
          P = Math.round(metar.altim * 0.750064);
        } else {
          P = Math.round(metar.altim * 25.4);
        }
      }
      const windDir = metar.wdir !== null && !isNaN(metar.wdir) ? dirs[Math.round(metar.wdir / 22.5) % 16] : '';
      const Ff = metar.wspd !== null && !isNaN(metar.wspd) ? Math.round(metar.wspd * 0.514444) : null;
      const gust = metar.wgst !== null && !isNaN(metar.wgst) ? Math.round(metar.wgst * 0.514444) : null;
      const VV = metar.visib !== null && !isNaN(metar.visib) ? Math.round(metar.visib * 1.60934 * 10) / 10 : null;
      
      let N = null;
      if (metar.cover) {
        const cover = metar.cover.toUpperCase();
        let oktas = null;
        if (cover === 'CLR' || cover === 'SKC') oktas = 0;
        else if (cover === 'FEW') oktas = 2;
        else if (cover === 'SCT') oktas = 4;
        else if (cover === 'BKN') oktas = 6;
        else if (cover === 'OVC' || cover === 'VV') oktas = 8;
        
        // Конвертируем окты в проценты (как в основном архиве)
        if (oktas !== null) {
          N = Math.round(oktas / 8 * 100);
        }
      }
      
      const weather = parseMETARWeather(metar.wxString || '');
      
      // Конвертируем коды в текстовые описания
      const wwText = weather.WW ? WMO_WW[parseInt(weather.WW)] || weather.WW : null;
      const w1Text = weather.W1 ? W_PAST[parseInt(weather.W1)] || weather.W1 : null;
      const w2Text = weather.W2 ? W_PAST[parseInt(weather.W2)] || weather.W2 : null;
      
      rows.push({
        date: dateKey,
        dateLabel,
        time: displayHour,
        T,
        Po: null,
        Pa: P,
        U: null,
        windDir,
        Ff,
        ff10: null,
        gust,
        N,
        WW: wwText,
        W1: w1Text,
        W2: w2Text,
        Tn: null,
        Tx: null,
        VV,
        Td,
        RRR: null,
        tR: null,
        sss: null,
      });
    }
  }
  // Без фильтрации - берём все наблюдения
  else {
    console.log(`[METAR] Processing ${metarData.length} observations without filtering`);
    if (metarData.length > 0) {
      console.log(`[METAR] First observation obsTime:`, metarData[0].obsTime, 'type:', typeof metarData[0].obsTime);
    }
    
    for (const metar of metarData) {
      try {
        // Проверяем что obsTime существует и валиден
        if (!metar.obsTime) {
          console.error('[METAR] Missing obsTime:', metar);
          continue;
        }
        
        // obsTime приходит как Unix timestamp в СЕКУНДАХ, нужно умножить на 1000 для миллисекунд
        const obsTimeUTC = new Date(metar.obsTime * 1000);
        
        // Проверяем что дата валидна
        if (isNaN(obsTimeUTC.getTime())) {
          console.error('[METAR] Invalid obsTime:', metar.obsTime);
          continue;
        }
        
        // Конвертируем в местное время используя Intl.DateTimeFormat (правильный способ)
        const formatter = new Intl.DateTimeFormat('ru-RU', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(obsTimeUTC);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const hour = parts.find(p => p.type === 'hour').value;
        
        // Получаем день недели
        const obsTimeLocalDate = new Date(obsTimeUTC.toLocaleString('en-US', { timeZone: timezone }));
        const dayOfWeek = obsTimeLocalDate.getDay();
        
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const dayName = dayNames[dayOfWeek];
        const monthIndex = parseInt(month) - 1;
        const monthName = months[monthIndex];
        const date = `${year}-${month}-${day}`;
        const dateLabel = `${year}г.\\n${day} ${monthName},\\n${dayName}`;
        
        const T = metar.temp !== null && !isNaN(metar.temp) ? metar.temp : null;
        const Td = metar.dewp !== null && !isNaN(metar.dewp) ? metar.dewp : null;
        // altim приходит в inHg (дюймы ртутного столба), конвертируем в мм рт.ст.
        // Нормальное значение altim: 29.92 inHg = 760 мм рт.ст.
        // Если altim > 100, значит это уже в гПа, конвертируем: гПа * 0.750064 = мм рт.ст.
        let P = null;
        if (metar.altim !== null && !isNaN(metar.altim)) {
          if (metar.altim > 100) {
            // Это гПа (гектопаскали)
            P = Math.round(metar.altim * 0.750064);
          } else {
            // Это inHg (дюймы ртутного столба)
            P = Math.round(metar.altim * 25.4);
          }
        }
        const windDir = metar.wdir !== null && !isNaN(metar.wdir) ? dirs[Math.round(metar.wdir / 22.5) % 16] : '';
        const Ff = metar.wspd !== null && !isNaN(metar.wspd) ? Math.round(metar.wspd * 0.514444) : null;
        const gust = metar.wgst !== null && !isNaN(metar.wgst) ? Math.round(metar.wgst * 0.514444) : null;
        const VV = metar.visib !== null && !isNaN(metar.visib) ? Math.round(metar.visib * 1.60934 * 10) / 10 : null;
        
        let N = null;
        if (metar.cover) {
          const cover = metar.cover.toUpperCase();
          let oktas = null;
          if (cover === 'CLR' || cover === 'SKC') oktas = 0;
          else if (cover === 'FEW') oktas = 2;
          else if (cover === 'SCT') oktas = 4;
          else if (cover === 'BKN') oktas = 6;
          else if (cover === 'OVC' || cover === 'VV') oktas = 8;
          
          // Конвертируем окты в проценты (как в основном архиве)
          if (oktas !== null) {
            N = Math.round(oktas / 8 * 100);
          }
        }
        
        const weather = parseMETARWeather(metar.wxString || '');
        
        // Конвертируем коды в текстовые описания
        const wwText = weather.WW ? WMO_WW[parseInt(weather.WW)] || weather.WW : null;
        const w1Text = weather.W1 ? W_PAST[parseInt(weather.W1)] || weather.W1 : null;
        const w2Text = weather.W2 ? W_PAST[parseInt(weather.W2)] || weather.W2 : null;
        
        rows.push({
          date,
          dateLabel,
          time: hour,
          T,
          Po: null,
          Pa: P,
          U: null,
          windDir,
          Ff,
          ff10: null,
          gust,
          N,
          WW: wwText,
          W1: w1Text,
          W2: w2Text,
          Tn: null,
          Tx: null,
          VV,
          Td,
          RRR: null,
          tR: null,
          sss: null,
          obsTime: obsTimeUTC.getTime() // Для сортировки
        });
      } catch (e) {
        console.error('[METAR] Parse error:', e.message);
      }
    }
    
    // Сортируем по времени наблюдения (от новых к старым - обратный порядок)
    rows.sort((a, b) => b.obsTime - a.obsTime);
    
    // Удаляем поле obsTime (оно было нужно только для сортировки)
    rows.forEach(row => delete row.obsTime);
  }
  
  console.log(`[METAR] Parsed ${rows.length} observations`);
  return rows;
}

// Вспомогательная функция для получения offset timezone в миллисекундах
function getTimezoneOffset(timezone) {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return tzDate - utcDate;
  } catch (e) {
    console.error('[Timezone] Error getting offset:', e.message);
    return 0;
  }
}

/**
 * Парсинг архива погоды с RP5 через HTTP запрос
 * @param {string} cityNameRu - Название города на русском (например, "Ишим")
 * @param {string} startDate - Начальная дата в формате YYYY-MM-DD
 * @param {string} endDate - Конечная дата в формате YYYY-MM-DD
 * @returns {Promise<Array>} - Массив строк с данными погоды
 */
async function parseRP5Archive(cityNameRu, startDate, endDate) {
  try {
    // Пробуем использовать puppeteer-extra со stealth плагином
    let puppeteerExtra, StealthPlugin;
    try {
      puppeteerExtra = require('puppeteer-extra');
      StealthPlugin = require('puppeteer-extra-plugin-stealth');
    } catch (e) {
      console.log('[RP5] puppeteer-extra not available, falling back to HTTP');
      puppeteerExtra = null;
    }
    
    if (puppeteerExtra && StealthPlugin) {
      // Используем Puppeteer со stealth плагином
      return await parseRP5WithPuppeteer(cityNameRu, startDate, endDate, puppeteerExtra, StealthPlugin);
    } else {
      // Используем простой HTTP запрос
      return await parseRP5WithHTTP(cityNameRu, startDate, endDate);
    }
  } catch (e) {
    console.error('[RP5] Error:', e.message);
    return null;
  }
}

/**
 * Парсинг RP5 через Puppeteer со stealth плагином
 */
async function parseRP5WithPuppeteer(cityNameRu, startDate, endDate, puppeteerExtra, StealthPlugin) {
  let browser = null;
  try {
    puppeteerExtra.use(StealthPlugin());
    
    const cityUrlPart = `Архив_погоды_в_${cityNameRu.replace(/ /g, '_')}`;
    const url = `https://rp5.ru/${encodeURIComponent(cityUrlPart)}`;
    
    console.log(`[RP5] Fetching with Puppeteer+Stealth: ${url}`);
    const startTime = Date.now();
    
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    
    const page = await browser.newPage();
    
    // Более реалистичный user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    // Устанавливаем viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Добавляем дополнительные заголовки
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    });
    
    // Переопределяем navigator.webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });
    
    // Переходим на страницу с более длительным таймаутом
    console.log('[RP5] Navigating to page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Ждём немного для загрузки JavaScript
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Проверяем, есть ли Cloudflare challenge
    const pageContent = await page.content();
    if (pageContent.includes('Checking your browser') || pageContent.includes('Just a moment')) {
      console.log('[RP5] Cloudflare challenge detected, waiting...');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
    
    // Пытаемся найти таблицу
    console.log('[RP5] Looking for #archiveString table...');
    const tableExists = await page.evaluate(() => {
      return document.querySelector('#archiveString') !== null;
    });
    
    if (!tableExists) {
      console.log('[RP5] Table not found, saving page HTML for debugging...');
      const html = await page.content();
      const title = await page.title();
      console.log(`[RP5] Page HTML length: ${html.length}, contains "archiveString": ${html.includes('archiveString')}`);
      console.log(`[RP5] Page title: "${title}"`);
      console.log(`[RP5] Page URL: ${page.url()}`);
      
      // Проверяем, есть ли Cloudflare challenge
      if (html.includes('Checking your browser') || html.includes('Just a moment') || html.includes('challenge-platform')) {
        console.log('[RP5] Cloudflare challenge detected in final page');
      }
      
      // Сохраняем первые 500 символов для отладки
      console.log(`[RP5] HTML preview: ${html.substring(0, 500)}`);
      
      await browser.close();
      return null;
    }
    
    console.log(`[RP5] Table found! Page loaded in ${Date.now() - startTime}ms`);
    
    // Извлекаем HTML
    const html = await page.content();
    
    await browser.close();
    browser = null;
    
    return parseRP5HTML(html, startTime);
    
  } catch (e) {
    console.error('[RP5] Puppeteer error:', e.message);
    console.error('[RP5] Stack:', e.stack);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return null;
  }
}

/**
 * Парсинг RP5 через HTTP запрос (резервный вариант)
 */
async function parseRP5WithHTTP(cityNameRu, startDate, endDate) {
  try {
    const fetch = require('node-fetch');
    
    // Формируем URL для RP5
    const cityUrlPart = `Архив_погоды_в_${cityNameRu.replace(/ /g, '_')}`;
    const url = `https://rp5.ru/${encodeURIComponent(cityUrlPart)}`;
    
    console.log(`[RP5] Fetching: ${url}`);
    const startTime = Date.now();
    
    // Делаем HTTP запрос с заголовками браузера
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.error(`[RP5] HTTP error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`[RP5] Page loaded in ${Date.now() - startTime}ms, size: ${html.length} bytes`);
    
    return parseRP5HTML(html, startTime);
    
  } catch (e) {
    console.error('[RP5] HTTP error:', e.message);
    return null;
  }
}

/**
 * Парсинг HTML от RP5
 */
function parseRP5HTML(html, startTime) {
  try {
    
    // Парсим HTML с помощью JSDOM
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const table = document.querySelector('#archiveString');
    if (!table) {
      console.error('[RP5] Table #archiveString not found after Puppeteer');
      return null;
    }
    
    const rows = [];
    const tableRows = table.querySelectorAll('tr');
    
    let currentDate = null;
    let currentDateLabel = null;
    
    const months = {
      'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
      'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
      'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
    };
    const dayNamesShort = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    
    // Пропускаем заголовок (первые 2 строки)
    for (let i = 2; i < tableRows.length; i++) {
      const tr = tableRows[i];
      const cells = tr.querySelectorAll('td');
      
      if (cells.length === 0) continue;
      
      // Проверяем, есть ли ячейка с датой (первая ячейка с rowspan)
      const firstCell = cells[0];
      if (firstCell.hasAttribute('rowspan')) {
        // Это новая дата
        const dateText = firstCell.textContent.trim();
        // Парсим дату из формата "2026г. 31 марта, вторник"
        const dateMatch = dateText.match(/(\d{4})г\.\s*(\d{1,2})\s+(\S+)/);
        if (dateMatch) {
          const year = dateMatch[1];
          const day = dateMatch[2].padStart(2, '0');
          const monthName = dateMatch[3].replace(',', '');
          const month = months[monthName];
          
          if (month) {
            currentDate = `${year}-${month}-${day}`;
            // Форматируем dateLabel как на RP5
            const d = new Date(currentDate);
            const dayName = dayNamesShort[d.getDay()];
            currentDateLabel = `${year}г.\\n${parseInt(day)} ${monthName},\\n${dayName}`;
          }
        }
      }
      
      // Определяем индекс начала данных
      const dataStartIdx = firstCell.hasAttribute('rowspan') ? 1 : 0;
      
      if (cells.length < dataStartIdx + 1) continue;
      
      // Извлекаем время
      const timeCell = cells[dataStartIdx];
      const timeText = timeCell ? timeCell.textContent.trim() : '';
      const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch || !currentDate) continue;
      
      const hour = timeMatch[1].padStart(2, '0');
      
      // Парсим числовые значения
      const parseNum = (val) => {
        if (!val || val === '' || val === '—') return null;
        const cleaned = val.replace(',', '.').replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };
      
      // Извлекаем данные из ячеек
      const T = parseNum(cells[dataStartIdx + 1]?.textContent);
      const Po = parseNum(cells[dataStartIdx + 2]?.textContent);
      const P = parseNum(cells[dataStartIdx + 3]?.textContent);
      const Pa = parseNum(cells[dataStartIdx + 4]?.textContent);
      const U = parseNum(cells[dataStartIdx + 5]?.textContent);
      
      // Направление ветра
      const DD = cells[dataStartIdx + 6]?.textContent.trim() || '';
      let windDir = '';
      if (DD) {
        const windMatch = DD.match(/(С|Ю|В|З|С-В|С-З|Ю-В|Ю-З|С-С-В|С-С-З|Ю-Ю-В|Ю-Ю-З|В-С-В|В-Ю-В|З-С-З|З-Ю-З)/);
        if (windMatch) windDir = windMatch[1];
      }
      
      // Скорость ветра
      const Ff = parseNum(cells[dataStartIdx + 7]?.textContent);
      const ff10 = parseNum(cells[dataStartIdx + 8]?.textContent);
      const ff3 = parseNum(cells[dataStartIdx + 9]?.textContent);
      
      // Облачность
      const NText = cells[dataStartIdx + 10]?.textContent.trim() || '';
      const N = NText.includes('–') ? parseNum(NText.split('–')[0]) : parseNum(NText);
      
      // Погодные явления
      const WW = cells[dataStartIdx + 11]?.textContent.trim() || null;
      const W1 = cells[dataStartIdx + 12]?.textContent.trim() || null;
      const W2 = cells[dataStartIdx + 13]?.textContent.trim() || null;
      
      // Температуры
      const Tn = parseNum(cells[dataStartIdx + 14]?.textContent);
      const Tx = parseNum(cells[dataStartIdx + 15]?.textContent);
      
      // Видимость и точка росы
      const VV = parseNum(cells[dataStartIdx + 21]?.textContent);
      const Td = parseNum(cells[dataStartIdx + 22]?.textContent);
      
      // Осадки
      const RRRText = cells[dataStartIdx + 23]?.textContent.trim() || null;
      let RRR = null;
      if (RRRText && RRRText !== '—') {
        if (RRRText.includes('Осадков нет')) RRR = 'Осадков нет';
        else if (RRRText.includes('Следы')) RRR = 'Следы осадков';
        else RRR = parseNum(RRRText);
      }
      const tR = parseNum(cells[dataStartIdx + 24]?.textContent);
      
      // Снежный покров
      const sss = parseNum(cells[dataStartIdx + 28]?.textContent);
      
      rows.push({
        date: currentDate,
        dateLabel: currentDateLabel,
        time: hour,
        T, Po, Pa: Pa || P, U, windDir, Ff, ff10, gust: ff3, N,
        WW, W1, W2, Tn, Tx, VV, Td, RRR, tR, sss,
      });
    }
    
    console.log(`[RP5] Parsed ${rows.length} rows in ${Date.now() - startTime}ms total`);
    return rows;
    
  } catch (e) {
    console.error('[RP5] Parse error:', e.message);
    return null;
  }
}

// Функции для работы с редактированиями архива
const EDITS_FILE = path.join(__dirname, 'data', 'archive-edits.json');

function loadEdits() {
  try {
    const data = fs.readFileSync(EDITS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { edits: {} };
  }
}

function saveEdits(edits) {
  fs.writeFileSync(EDITS_FILE, JSON.stringify(edits, null, 2), 'utf8');
}

function getEditKey(geonameId, date, time) {
  return `${geonameId}_${date}_${time}`;
}

function applyEdits(rows, geonameId, startDate = null, endDate = null) {
  const editsData = loadEdits();
  const processedKeys = new Set();
  
  // Применяем редактирования к существующим строкам (НЕ МЕНЯЕМ ПОРЯДОК!)
  const editedRows = rows.map(row => {
    const key = getEditKey(geonameId, row.date, row.time);
    processedKeys.add(key);
    
    if (editsData.edits[key]) {
      // Применяем редактирования
      const editedRow = { ...row };
      for (const [field, value] of Object.entries(editsData.edits[key])) {
        if (field !== 'date' && field !== 'time') {
          editedRow[field] = value;
        }
      }
      return editedRow;
    }
    return row;
  });
  
  // Собираем новые периоды из edits (которых нет в API данных)
  const newPeriods = [];
  for (const [key, editData] of Object.entries(editsData.edits)) {
    if (!processedKeys.has(key) && key.startsWith(`${geonameId}_`)) {
      // Проверяем диапазон дат если указан
      if (startDate && endDate) {
        const editDate = new Date(editData.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (editDate < start || editDate > end) {
          continue;
        }
      }
      
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      const d = new Date(editData.date);
      const dateLabel = `${editData.date.slice(0,4)}г.\n${d.getDate()} ${months[d.getMonth()]},\n${dayNames[d.getDay()]}`;
      
      newPeriods.push({
        date: editData.date,
        dateLabel: dateLabel,
        time: editData.time,
        T: editData.T ?? null,
        Pa: editData.Pa ?? null,
        U: editData.U ?? null,
        windDir: editData.windDir ?? null,
        Ff: editData.Ff ?? null,
        ff10: editData.ff10 ?? null,
        gust: editData.gust ?? null,
        N: editData.N ?? null,
        WW: editData.WW ?? null,
        W1: editData.W1 ?? null,
        W2: editData.W2 ?? null,
        Tn: editData.Tn ?? null,
        Tx: editData.Tx ?? null,
        VV: editData.VV ?? null,
        Td: editData.Td ?? null,
        RRR: editData.RRR ?? null,
        tR: editData.tR ?? null,
        sss: editData.sss ?? null,
      });
    }
  }
  
  // Если есть новые периоды, вставляем их в правильные позиции
  if (newPeriods.length > 0) {
    // Определяем порядок сортировки существующих данных
    // Проверяем первые две строки чтобы понять порядок (прямой или обратный)
    let isReversed = false;
    if (editedRows.length >= 2) {
      const first = editedRows[0];
      const second = editedRows[1];
      const firstDateTime = `${first.date} ${first.time}`;
      const secondDateTime = `${second.date} ${second.time}`;
      isReversed = firstDateTime > secondDateTime; // Если первая строка новее второй = обратный порядок
    }
    
    // Вставляем каждый новый период в правильную позицию
    for (const newPeriod of newPeriods) {
      const newDateTime = `${newPeriod.date} ${newPeriod.time}`;
      let inserted = false;
      
      for (let i = 0; i < editedRows.length; i++) {
        const currentDateTime = `${editedRows[i].date} ${editedRows[i].time}`;
        
        // Логика вставки зависит от порядка сортировки
        if (isReversed) {
          // Обратный порядок (новые сверху): вставляем ПЕРЕД первой строкой которая СТАРШЕ
          if (newDateTime > currentDateTime) {
            editedRows.splice(i, 0, newPeriod);
            inserted = true;
            break;
          }
        } else {
          // Прямой порядок (старые сверху): вставляем ПЕРЕД первой строкой которая НОВЕЕ
          if (newDateTime < currentDateTime) {
            editedRows.splice(i, 0, newPeriod);
            inserted = true;
            break;
          }
        }
      }
      
      // Если не вставили, добавляем в конец
      if (!inserted) {
        editedRows.push(newPeriod);
      }
    }
  }
  
  return editedRows;
}

// Архив погоды — /archive?id=geonameId или /archive?id=airportId или /archive?city=name
app.get('/archive', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const id = req.query.id ? parseInt(req.query.id) : null;
    const cityName  = req.query.city || null;
    const period = parseInt(req.query.period) || 1;
    const useRP5 = req.query.source !== 'openmeteo'; // По умолчанию используем RP5
    
    // Проверяем, это аэропорт или город
    const isAirport = id && id >= 9000000;
    
    if (isAirport) {
      // Это аэропорт
      const airport = getAirportById(id);
      if (!airport) {
        return res.status(404).send('Аэропорт не найден (id=' + id + ')');
      }
      
      // Конечная дата — сегодня (или указанная пользователем)
      const today = new Date();
      const defaultEnd = today.toISOString().slice(0, 10);
      const endDateStr = req.query.date || defaultEnd;
      const startDate = new Date(endDateStr);
      startDate.setDate(startDate.getDate() - period + 1);
      const startStr = startDate.toISOString().slice(0, 10);
      
      console.log(`[archive] Airport: ${airport.name} (${airport.icao}), period: ${startStr} to ${endDateStr}`);
      
      // Получаем METAR данные
      const hours = period * 24;
      const metarData = await fetchMETAR(airport.icao, hours);
      
      let rows = [];
      let dataSource = 'METAR (наблюдения аэропорта)';
      
      // Вычисляем UTC offset из timezone аэропорта
      const now = new Date();
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: airport.timezone || 'UTC' }));
      const offsetMs = tzDate - utcDate;
      const utcOffsetHours = offsetMs / (1000 * 60 * 60);
      
      console.log(`[archive] Airport timezone: ${airport.timezone}, UTC offset: ${utcOffsetHours}`);
      
      // Находим ближайший город к аэропорту для ссылки на прогноз погоды
      let nearestCity = null;
      try {
        const { search } = require('./data/geo-db');
        // Сначала пробуем найти по названию города
        const cities = search(airport.city || airport.name, 20);
        if (cities && cities.length > 0) {
          // Вычисляем расстояние до каждого города и берём ближайший
          const haversine = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Радиус Земли в км
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          };
          
          let minDist = Infinity;
          for (const city of cities) {
            const dist = haversine(airport.lat, airport.lon, city.lat, city.lon);
            if (dist < minDist) {
              minDist = dist;
              nearestCity = city;
            }
          }
        }
      } catch (e) {
        console.error('[archive] Failed to find nearest city:', e.message);
      }
      
      if (metarData && metarData.length > 0) {
        // Передаём null вместо targetHours чтобы показать ВСЕ часы (0-23)
        rows = parseMETARToArchive(metarData, airport, airport.timezone || 'UTC', null);
        console.log(`[archive] METAR data: ${rows.length} observations`);
      } else {
        console.log('[archive] No METAR data available');
        dataSource = 'Нет данных';
      }
      
      console.log(`[archive] Parsed rows: ${rows.length}`);
      
      // Группируем по датам
      const byDate = {};
      for (const row of rows) {
        if (!byDate[row.date]) byDate[row.date] = [];
        byDate[row.date].push(row);
      }
      
      // Сортируем даты
      const dates = Object.keys(byDate).sort();
      
      return res.render('archive', {
        title: `Архив погоды — ${airport.name}`,
        city: airport.name,
        cityEn: airport.nameEn,
        country: airport.country,
        countryNameEn: '',
        admin1: airport.city,
        admin1En: airport.cityEn,
        lat: airport.lat,
        lon: airport.lon,
        dates,
        byDate,
        dataSource,
        isAirport: true,
        airportICAO: airport.icao,
        nearestCity: nearestCity,
        TARGET_HOURS_ARRAY: Array.from({length: 24}, (_, i) => i), // Все часы 0-23
        precipIcon,
        cloudIcon,
        fogIcon,
        req: req,
        period: period,
        endDate: endDateStr,
        geonameId: id,
        rows: rows,
        tempClass,
        tempTooltip,
        pressClass,
        pressTooltip,
        humClass,
        humTooltip,
        windBfClass,
        windBfLabel,
      });
    }
    
    // Это обычный город
    const geonameId = id;
    
    // Конечная дата — сегодня по умолчанию (показываем самые последние доступные данные)
    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const endDateStr = req.query.date || defaultEnd;
    const startDate = new Date(endDateStr);
    
    // Для периода "1 сутки" запрашиваем данные за 2 дня чтобы получить все 8 периодов
    // (8 периодов по 3 часа = 24 часа, но они могут быть на стыке двух дней)
    if (period === 1) {
      startDate.setDate(startDate.getDate() - 1);
    } else {
      startDate.setDate(startDate.getDate() - period + 1);
    }
    const startStr = startDate.toISOString().slice(0, 10);

    const weatherData = await getWeatherData(ip, cityName, {}, null, null, geonameId);
    const lat = weatherData.lat;
    const lon = weatherData.lon;

    const countries = getCountries();
    const countryObj = countries.find(c => c.code === weatherData.country_code);
    const countryNameEn = countryObj ? countryObj.nameEn : '';
    let admin1Ru = weatherData.admin1 || '';
    if (weatherData.stateCode && weatherData.country_code) {
      const regions = getRegionsLocalized(weatherData.country_code, 'ru');
      const regionObj = regions.find(r => r.code === weatherData.stateCode);
      if (regionObj) admin1Ru = regionObj.name;
    }

    let rows = [];
    let dataSource = 'Open-Meteo + мультимодель (грозы)';
    
    console.log('[archive] Starting, dataSource=', dataSource);
    
    // Загружаем исторические данные из CSV файла RP5 (если доступны)
    // Автоматически скачиваем с RP5 если файла нет или он устарел
    let rp5Data = null;
    const csvPath = await getRP5CSVPath(geonameId, startStr, endDateStr);
    if (csvPath) {
      console.log('[archive] Loading RP5 CSV data...');
      rp5Data = loadRP5CSV(csvPath, geonameId);
      if (rp5Data && rp5Data.size > 0) {
        console.log(`[archive] RP5 CSV loaded: ${rp5Data.size} records`);
        dataSource = 'RP5 (реальные наблюдения) + Open-Meteo (грозы)';
      }
    }
    
    // Получаем данные о грозах из нескольких моделей (ICON + GFS + ECMWF + GEM)
    let multiModelData = null;
    console.log('[archive] Fetching thunderstorm data from multiple models...');
    multiModelData = await fetchMultiModelThunderstorms(lat, lon, startStr, endDateStr);
    if (multiModelData && Object.values(multiModelData).some(d => d !== null)) {
      const modelNames = Object.entries(multiModelData)
        .filter(([_, data]) => data !== null)
        .map(([name, _]) => name.toUpperCase());
      console.log(`[archive] Multi-model data fetched: ${modelNames.join('+')}`);
    } else {
      console.log('[archive] Multi-model data fetch failed, using Open-Meteo only');
      dataSource = 'Open-Meteo (модельные данные)';
    }
    
    // Используем Open-Meteo Archive для основных данных
    // Если данные недоступны (например, период 2022-2024), используем ICON Historical Forecast
    let archData = null;
    let useICONForAll = false;
    
    {
      const hourly = [
        'temperature_2m','relativehumidity_2m','dewpoint_2m',
        'surface_pressure','windspeed_10m','windgusts_10m','winddirection_10m',
        'cloudcover','visibility','weathercode','snow_depth','precipitation',
      ].join(',');
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endDateStr}&hourly=${hourly}&timezone=auto&windspeed_unit=ms`;
      const archResponse = await fetch(url);
      archData = await archResponse.json();
      console.log(`[archive] Open-Meteo Archive url=${url}`);
      console.log(`[archive] Open-Meteo Archive status=${archResponse.status} error=${archData.error} reason=${archData.reason}`);
      
      // Проверяем, есть ли данные
      if (archData.error || !archData.hourly || !archData.hourly.time || archData.hourly.time.length === 0) {
        console.log('[archive] Open-Meteo Archive has no data, trying ICON Historical Forecast...');
        
        // Пробуем получить все данные из ICON
        if (!iconData) {
          iconData = await fetchICONLightning(lat, lon, startStr, endDateStr);
        }
        
        // Получаем полный набор данных из ICON
        const iconHourly = [
          'temperature_2m','relative_humidity_2m','dew_point_2m',
          'surface_pressure','wind_speed_10m','wind_gusts_10m','wind_direction_10m',
          'cloud_cover','visibility','weather_code','snow_depth','precipitation',
          'cape','showers'
        ].join(',');
        const iconUrl = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endDateStr}&hourly=${iconHourly}&timezone=auto&windspeed_unit=ms&models=icon_global`;
        
        console.log(`[archive] ICON Full Data url=${iconUrl}`);
        const iconResponse = await fetch(iconUrl);
        const iconFullData = await iconResponse.json();
        
        if (iconFullData && iconFullData.hourly && iconFullData.hourly.time && iconFullData.hourly.time.length > 0) {
          console.log(`[archive] ICON Historical Forecast has data: ${iconFullData.hourly.time.length} records`);
          archData = iconFullData;
          useICONForAll = true;
          dataSource = 'ICON Historical Forecast (архив прогнозов с 2022)';
          
          // Переименовываем поля для совместимости
          archData.hourly.relativehumidity_2m = archData.hourly.relative_humidity_2m;
          archData.hourly.dewpoint_2m = archData.hourly.dew_point_2m;
          archData.hourly.windspeed_10m = archData.hourly.wind_speed_10m;
          archData.hourly.windgusts_10m = archData.hourly.wind_gusts_10m;
          archData.hourly.winddirection_10m = archData.hourly.wind_direction_10m;
          archData.hourly.cloudcover = archData.hourly.cloud_cover;
          archData.hourly.weathercode = archData.hourly.weather_code;
          archData.hourly.snow_depth = archData.hourly.snow_depth;
        } else {
          console.log('[archive] ICON Historical Forecast also has no data');
          // Возвращаемся к пустым данным Open-Meteo
        }
      }

      rows = [];
      const times = archData.hourly?.time || [];
      const h = archData.hourly || {};
      const dirs = ['С','С-С-В','С-В','В-С-В','В','В-Ю-В','Ю-В','Ю-Ю-В','Ю','Ю-Ю-З','Ю-З','З-Ю-З','З','З-С-З','С-З','С-С-З'];
      const windDirRu = deg => deg == null ? '' : dirs[Math.round(deg / 22.5) % 16];
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      
      // Вычисляем UTC offset из timezone
      // Используем timezone из API (например "Asia/Yekaterinburg")
      const now = new Date();
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: archData.timezone }));
      const offsetMs = tzDate - utcDate;
      const utcOffsetHours = offsetMs / (1000 * 60 * 60);
      
      // Функция для вычисления целевых часов
      const getTargetHours = (utcOffset, isForecast = false) => {
        const startHour = ((utcOffset % 3) + 3) % 3;
        if (isForecast) {
          const forecastStart = startHour + 3;
          return [
            forecastStart % 24,
            (forecastStart + 6) % 24,
            (forecastStart + 12) % 24,
            (forecastStart + 18) % 24
          ];
        } else {
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
      };
      
      const TARGET_HOURS_ARRAY = getTargetHours(utcOffsetHours, false); // false = архив
      const TARGET_HOURS = new Set(TARGET_HOURS_ARRAY);
      console.log(`[archive] UTC offset: ${utcOffsetHours}, Target hours:`, TARGET_HOURS_ARRAY);
      
      // 3-й период (индекс 2) для Tn и осадков, 7-й период (индекс 6) для Tx и осадков
      const tnHour = TARGET_HOURS_ARRAY[2]; // 3-й период
      const txHour = TARGET_HOURS_ARRAY[6]; // 7-й период

      // Предварительный проход: накопление осадков и мин/макс температуры по дням
      const precipSum = {};
      const dayMinT = {}, dayMaxT = {};
      for (let i = 0; i < times.length; i++) {
        // Извлекаем час из ISO строки времени (уже в timezone города)
        const hour = parseInt(times[i].slice(11, 13), 10);
        const dateKey = times[i].slice(0, 10);
        const T = h.temperature_2m?.[i];
        if (T != null) {
          if (dayMinT[dateKey] == null || T < dayMinT[dateKey]) dayMinT[dateKey] = Math.round(T * 10) / 10;
          if (dayMaxT[dateKey] == null || T > dayMaxT[dateKey]) dayMaxT[dateKey] = Math.round(T * 10) / 10;
        }
        // Осадки в 3-м периоде (за предыдущие 12 часов)
        if (hour === tnHour) {
          let sum = 0;
          for (let j = Math.max(0, i - 12); j <= i; j++) sum += (h.precipitation?.[j] ?? 0);
          precipSum[`${dateKey}_${String(hour).padStart(2,'0')}`] = Math.round(sum * 10) / 10;
        }
        // Осадки в 7-м периоде (за предыдущие 12 часов)
        if (hour === txHour) {
          let sum = 0;
          for (let j = Math.max(0, i - 12); j <= i; j++) sum += (h.precipitation?.[j] ?? 0);
          precipSum[`${dateKey}_${String(hour).padStart(2,'0')}`] = Math.round(sum * 10) / 10;
        }
      }

      // Переменные для отслеживания повторений WW
      let lastWW = null;
      let wwRepeatCount = 0;

      for (let i = 0; i < times.length; i++) {
        // Извлекаем час из ISO строки времени (уже в timezone города)
        const hour = parseInt(times[i].slice(11, 13), 10);
        if (!TARGET_HOURS.has(hour)) continue;
        
        // Пропускаем будущие периоды (данные ещё не доступны)
        // Данные появляются с задержкой ~30-40 минут после наблюдения
        const periodTime = new Date(times[i]);
        const nowWithDelay = new Date(now.getTime() - 30 * 60 * 1000); // Вычитаем 30 минут задержки
        if (periodTime > nowWithDelay) {
          console.log(`[archive] Skipping future period: ${times[i]}`);
          continue;
        }

        const dateKey = times[i].slice(0, 10);
        const T   = h.temperature_2m?.[i]    != null ? Math.round(h.temperature_2m[i] * 10) / 10 : null;
        const Pa  = h.surface_pressure?.[i]  != null ? Math.round(h.surface_pressure[i] * 0.750064) : null;
        const U   = h.relativehumidity_2m?.[i] ?? null;
        const Ff  = h.windspeed_10m?.[i]     != null ? Math.round(h.windspeed_10m[i]) : null;
        const gust= h.windgusts_10m?.[i]     != null ? Math.round(h.windgusts_10m[i]) : null;
        const Cl  = h.cloudcover?.[i]        ?? null;
        const rawVV = h.visibility?.[i];
        const VV  = rawVV != null ? Math.round(rawVV / 1000 * 10) / 10 : null;
        const Td  = h.dewpoint_2m?.[i]       != null ? Math.round(h.dewpoint_2m[i] * 10) / 10 : null;
        const rawSss = h.snow_depth?.[i];
        const sss = rawSss != null && rawSss > 0 ? Math.round(rawSss * 100) : null;
        const wcode = h.weathercode?.[i] ?? null;
        
        // Корректируем weathercode: заменяем морось на ливень
        // Open-Meteo часто путает морось (50-55) и ливни (80-82)
        // Решение: всегда заменяем морось на ливень для более точного описания
        let correctedWcode = wcode;
        if (wcode >= 50 && wcode <= 57) {
          // Морось → Ливневый дождь слабый
          correctedWcode = 80;
        }
        
        let WW = correctedWcode != null ? (WMO_WW[correctedWcode] || null) : null;
        
        // Для W1/W2 используем оригинальный код (не корректированный)
        const prevCode1 = i >= 3 ? (h.weathercode?.[i-3] ?? null) : null;
        const prevCode2 = i >= 6 ? (h.weathercode?.[i-6] ?? null) : null;
        
        // Корректируем prevCode1 и prevCode2 тоже
        let correctedPrevCode1 = prevCode1;
        if (prevCode1 >= 50 && prevCode1 <= 57) {
          correctedPrevCode1 = 80;
        }
        
        let correctedPrevCode2 = prevCode2;
        if (prevCode2 >= 50 && prevCode2 <= 57) {
          correctedPrevCode2 = 80;
        }
        
        // W1 и W2 - прошедшая погода (за 3-6 и 6-12 часов)
        // ВАЖНОЕ ПРАВИЛО RP5: Либо ВСЕ ТРИ столбца (WW, W1, W2) заполнены, либо ВСЕ ТРИ пустые
        let W1 = null;
        let W2 = null;
        
        // Приоритеты явлений
        const w1Priorities = {
          9: 100, // Гроза
          8: 90,  // Ливень
          7: 80,  // Снег
          6: 70,  // Дождь
          5: 60,  // Морось
          4: 50,  // Туман
          3: 40,  // Метель
        };
        
        // Функция для определения кода облачности
        const getCloudCode = (cloudcover) => {
          if (cloudcover == null) return 1;
          if (cloudcover <= 50) return 0;
          if (cloudcover < 100) return 1;
          return 2;
        };
        
        // ШАГ 1: Ищем РЕАЛЬНЫЕ явления (не облачность) в диапазонах
        let w1BestCode = null;
        let w1BestPriority = -1;
        let w1CloudCodes = [];
        
        for (let j = 3; j <= 6 && i >= j; j++) {
          const prevCode = h.weathercode?.[i - j] ?? null;
          const prevCloud = h.cloudcover?.[i - j] ?? null;
          
          if (prevCode != null) {
            let correctedCode = prevCode;
            if (prevCode >= 50 && prevCode <= 57) {
              correctedCode = 80;
            }
            
            const wCode = wwToWCode(correctedCode);
            const priority = w1Priorities[wCode] || 0;
            
            if (priority > w1BestPriority) {
              w1BestCode = wCode;
              w1BestPriority = priority;
            }
          }
          
          if (prevCloud != null) {
            w1CloudCodes.push(getCloudCode(prevCloud));
          }
        }
        
        let w2BestCode = null;
        let w2BestPriority = -1;
        let w2CloudCodes = [];
        
        for (let j = 6; j <= 12 && i >= j; j++) {
          const prevCode = h.weathercode?.[i - j] ?? null;
          const prevCloud = h.cloudcover?.[i - j] ?? null;
          
          if (prevCode != null) {
            let correctedCode = prevCode;
            if (prevCode >= 50 && prevCode <= 57) {
              correctedCode = 80;
            }
            
            const wCode = wwToWCode(correctedCode);
            const priority = w1Priorities[wCode] || 0;
            
            if (priority > w2BestPriority) {
              w2BestCode = wCode;
              w2BestPriority = priority;
            }
          }
          
          if (prevCloud != null) {
            w2CloudCodes.push(getCloudCode(prevCloud));
          }
        }
        
        // Средние коды облачности
        let w1CloudCode = null;
        if (w1CloudCodes.length > 0) {
          const avgCloud = w1CloudCodes.reduce((a, b) => a + b, 0) / w1CloudCodes.length;
          w1CloudCode = Math.round(avgCloud);
        }
        
        let w2CloudCode = null;
        if (w2CloudCodes.length > 0) {
          const avgCloud = w2CloudCodes.reduce((a, b) => a + b, 0) / w2CloudCodes.length;
          w2CloudCode = Math.round(avgCloud);
        }
        
        // ШАГ 2: Заполняем W1 и W2 на основе найденных явлений
        // Заполняем W1
        if (w1BestCode != null && w1BestPriority > 0) {
          W1 = W_PAST[w1BestCode] || null;
        } else if (w1CloudCode != null) {
          W1 = W_PAST[w1CloudCode] || null;
        }
        
        // Заполняем W2
        if (w2BestCode != null && w2BestPriority > 0) {
          W2 = W_PAST[w2BestCode] || null;
        } else if (w2CloudCode != null) {
          W2 = W_PAST[w2CloudCode] || null;
        }
        
        // Правило "не дублировать": если W1 и W2 одинаковые, заменяем W2 на облачность
        if (W1 && W2 && W1 === W2 && w2CloudCode != null) {
          W2 = W_PAST[w2CloudCode] || null;
        }
        
        // Добавляем данные о грозах из нескольких моделей (только если не используем ICON для всех данных)
        if (!useICONForAll && multiModelData && Object.values(multiModelData).some(d => d !== null)) {
          const analysis = analyzeThunderstorm(multiModelData, times[i], Cl);
          
          // Проверяем грозу в предыдущем часе (для "гроза в течение последнего часа")
          let hadThunderstormLastHour = false;
          if (i >= 1) {
            const prevCl = h.cloudcover?.[i - 1] ?? null;
            const prevAnalysis = analyzeThunderstorm(multiModelData, times[i - 1], prevCl);
            hadThunderstormLastHour = prevAnalysis.hasThunderstorm;
          }
          
          // Проверяем грозу в диапазоне 3-6 часов для W1
          let hadThunderstormInW1Range = false;
          for (let j = 3; j <= 6 && i >= j; j++) {
            const prevCl = h.cloudcover?.[i - j] ?? null;
            const prevAnalysis = analyzeThunderstorm(multiModelData, times[i - j], prevCl);
            if (prevAnalysis.hasThunderstorm) {
              hadThunderstormInW1Range = true;
              break;
            }
          }
          
          // Проверяем грозу в диапазоне 6-12 часов для W2
          let hadThunderstormInW2Range = false;
          for (let j = 6; j <= 12 && i >= j; j++) {
            const prevCl = h.cloudcover?.[i - j] ?? null;
            const prevAnalysis = analyzeThunderstorm(multiModelData, times[i - j], prevCl);
            if (prevAnalysis.hasThunderstorm) {
              hadThunderstormInW2Range = true;
              break;
            }
          }
          
          if (analysis.hasThunderstorm) {
            console.log(`[archive] Thunderstorm at ${times[i]}: ${analysis.description} (confidence: ${analysis.confidence}, models: ${analysis.models.join('+')} [${analysis.modelCount}/11])`);
            
            // Обновляем WW - используем описание грозы из анализа
            WW = analysis.description;
            
            // Обновляем W1 - гроза в текущем периоде
            // Правило из RP5: если гроза, то W1 = "Гроза (грозы) с осадками или без них."
            W1 = 'Гроза (грозы) с осадками или без них.';
            
            // W2 - проверяем что было в диапазоне 6-12 часов
            if (hadThunderstormInW2Range) {
              W2 = 'Гроза (грозы) с осадками или без них.';
            } else {
              // Если в W2 нет грозы, показываем ливень или облачность
              const hadShowersInW2 = (() => {
                for (let j = 6; j <= 12 && i >= j; j++) {
                  const code = h.weathercode?.[i - j] ?? null;
                  if (code >= 80 && code <= 86) return true;
                }
                return false;
              })();
              
              if (hadShowersInW2) {
                W2 = 'Ливень (ливни).';
              } else if (w2CloudCode != null) {
                W2 = W_PAST[w2CloudCode] || null;
              }
            }
            
            // Правило "не дублировать": если W1 и W2 одинаковые, заменяем W2 на облачность
            if (W1 && W2 && W1 === W2 && w2CloudCode != null) {
              W2 = W_PAST[w2CloudCode] || null;
            }
            
          } else if (hadThunderstormLastHour) {
            // Гроза была в предыдущем часе, но сейчас нет
            console.log(`[archive] Thunderstorm in last hour at ${times[i]}`);
            
            // Правило из RP5: после грозы часто пишут "Состояние неба в общем не изменилось"
            // Если есть текущее явление, добавляем "Гроза в течение последнего часа"
            // Если нет текущего явления, показываем "Состояние неба в общем не изменилось"
            if (WW && WW !== 'Состояние неба в общем не изменилось.') {
              WW = `Гроза в течение последнего часа. ${WW}`;
            } else if (!WW || WW === 'Состояние неба в общем не изменилось.') {
              WW = 'Состояние неба в общем не изменилось.';
            }
            
            // W1 - гроза была в предыдущем часе
            W1 = 'Гроза (грозы) с осадками или без них.';
            
            // W2 - показываем ливень или облачность
            if (hadThunderstormInW2Range) {
              W2 = 'Гроза (грозы) с осадками или без них.';
            } else {
              const hadShowersInW2 = (() => {
                for (let j = 6; j <= 12 && i >= j; j++) {
                  const code = h.weathercode?.[i - j] ?? null;
                  if (code >= 80 && code <= 86) return true;
                }
                return false;
              })();
              
              if (hadShowersInW2) {
                W2 = 'Ливень (ливни).';
              } else if (w2CloudCode != null) {
                W2 = W_PAST[w2CloudCode] || null;
              }
            }
            
            // Правило "не дублировать": если W1 и W2 одинаковые, заменяем W2 на облачность
            if (W1 && W2 && W1 === W2 && w2CloudCode != null) {
              W2 = W_PAST[w2CloudCode] || null;
            }
            
          } else if (hadThunderstormInW1Range) {
            // Гроза была в диапазоне 3-6 часов назад
            // Обновляем W1 только если там еще нет грозы
            if (!W1 || !W1.includes('Гроза')) {
              W1 = 'Гроза (грозы) с осадками или без них.';
            }
            
            // Если W1 заполнен, W2 тоже должен быть заполнен
            if (W1 && !W2) {
              if (hadThunderstormInW2Range) {
                W2 = 'Гроза (грозы) с осадками или без них.';
              } else {
                const hadShowersInW2 = (() => {
                  for (let j = 6; j <= 12 && i >= j; j++) {
                    const code = h.weathercode?.[i - j] ?? null;
                    if (code >= 80 && code <= 86) return true;
                  }
                  return false;
                })();
                
                if (hadShowersInW2) {
                  W2 = 'Ливень (ливни).';
                } else if (w2CloudCode != null) {
                  W2 = W_PAST[w2CloudCode] || null;
                }
              }
            }
            
            // Правило "не дублировать": если W1 и W2 одинаковые, заменяем W2 на облачность
            if (W1 && W2 && W1 === W2 && w2CloudCode != null) {
              W2 = W_PAST[w2CloudCode] || null;
            }
          }
          
          // Если гроза была в диапазоне W2, но не в W1
          if (hadThunderstormInW2Range && !hadThunderstormInW1Range && !hadThunderstormLastHour && !analysis.hasThunderstorm) {
            // Обновляем W2 только если там еще нет грозы
            if (!W2 || !W2.includes('Гроза')) {
              W2 = 'Гроза (грозы) с осадками или без них.';
            }
            
            // Если W2 заполнен, W1 тоже должен быть заполнен
            if (W2 && !W1) {
              if (w1BestCode != null && w1BestPriority > 0) {
                W1 = W_PAST[w1BestCode] || null;
              } else if (w1CloudCode != null) {
                W1 = W_PAST[w1CloudCode] || null;
              }
            }
            
            // Правило "не дублировать": если W1 и W2 одинаковые, заменяем W2 на облачность
            if (W1 && W2 && W1 === W2 && w2CloudCode != null) {
              W2 = W_PAST[w2CloudCode] || null;
            }
          }
        }
        
        // КРИТИЧЕСКОЕ ПРАВИЛО RP5: Либо ВСЕ ТРИ столбца (WW, W1, W2) заполнены, либо ВСЕ ТРИ пустые
        // Это правило применяется ПОСЛЕ всей логики грозы, чтобы гроза не сломала его
        // ВАЖНО: Облачность ("Облачность увеличивалась", "Состояние неба...") - это НЕ явление!
        // Явления: гроза, дождь, снег, морось, туман, дымка, ливень
        const isRealPhenomenonWW = WW && (
          WW.includes('Гроза') || WW.includes('гроза') ||
          WW.includes('Дождь') || WW.includes('дождь') ||
          WW.includes('Снег') || WW.includes('снег') ||
          WW.includes('Морось') || WW.includes('морось') ||
          WW.includes('Туман') || WW.includes('туман') ||
          WW.includes('Дымка') || WW.includes('дымка') ||
          WW.includes('Ливневый') || WW.includes('ливневый') ||
          WW.includes('Ливень') || WW.includes('ливень') ||
          WW.includes('Град') || WW.includes('град') ||
          WW.includes('Метель') || WW.includes('метель') ||
          WW.includes('Видна молния') || WW.includes('Зарница') ||
          WW.includes('Видны наковальни')
        );
        
        const isRealPhenomenonW1 = W1 && (
          W1.includes('Гроза') || W1.includes('гроза') ||
          W1.includes('Дождь') || W1.includes('дождь') ||
          W1.includes('Снег') || W1.includes('снег') ||
          W1.includes('Морось') || W1.includes('морось') ||
          W1.includes('Туман') || W1.includes('туман') ||
          W1.includes('Дымка') || W1.includes('дымка') ||
          W1.includes('Ливень') || W1.includes('ливень') ||
          W1.includes('Град') || W1.includes('град') ||
          W1.includes('Метель') || W1.includes('метель')
        );
        
        const isRealPhenomenonW2 = W2 && (
          W2.includes('Гроза') || W2.includes('гроза') ||
          W2.includes('Дождь') || W2.includes('дождь') ||
          W2.includes('Снег') || W2.includes('снег') ||
          W2.includes('Морось') || W2.includes('морось') ||
          W2.includes('Туман') || W2.includes('туман') ||
          W2.includes('Дымка') || W2.includes('дымка') ||
          W2.includes('Ливень') || W2.includes('ливень') ||
          W2.includes('Град') || W2.includes('град') ||
          W2.includes('Метель') || W2.includes('метель')
        );
        
        const hasAnyRealPhenomenon = isRealPhenomenonWW || isRealPhenomenonW1 || isRealPhenomenonW2;
        
        if (!hasAnyRealPhenomenon) {
          // Нет никаких РЕАЛЬНЫХ явлений - ВСЕ ТРИ пустые
          WW = null;
          W1 = null;
          W2 = null;
        } else {
          // Есть хоть одно РЕАЛЬНОЕ явление - ВСЕ ТРИ должны быть заполнены
          // ПРИНУДИТЕЛЬНО заполняем каждый пустой столбец
          
          // Если WW пустой, добавляем "Состояние неба..."
          if (!WW) {
            if (Cl >= 50) {
              WW = 'Состояние неба в общем не изменилось.';
            } else {
              // Если облачность низкая, используем другое описание
              WW = 'Облачность уменьшалась';
            }
          }
          
          // Если W1 пустой, ОБЯЗАТЕЛЬНО заполняем облачностью
          if (!W1) {
            if (w1CloudCode != null) {
              W1 = W_PAST[w1CloudCode];
            } else {
              // Используем текущую облачность как запасной вариант
              const currentCloudCode = getCloudCode(Cl);
              W1 = W_PAST[currentCloudCode];
            }
            // Если всё ещё null, используем дефолтное значение
            if (!W1) {
              W1 = 'Облака покрывали более половины неба в течение части периода и половину или менее в течение другой части';
            }
          }
          
          // Если W2 пустой, ОБЯЗАТЕЛЬНО заполняем облачностью
          if (!W2) {
            if (w2CloudCode != null) {
              W2 = W_PAST[w2CloudCode];
            } else {
              // Используем текущую облачность как запасной вариант
              const currentCloudCode = getCloudCode(Cl);
              W2 = W_PAST[currentCloudCode];
            }
            // Если всё ещё null, используем дефолтное значение
            if (!W2) {
              W2 = 'Облака покрывали более половины неба в течение части периода и половину или менее в течение другой части';
            }
          }
        }
        
        // Дедупликация WW - показываем максимум 2 раза подряд (кроме важных явлений)
        // Важные явления (грозы, осадки, туман, дымка) показываем без ограничений
        const isImportantPhenomenon = WW && (
          WW.includes('Гроза') || WW.includes('гроза') ||
          WW.includes('Туман') || WW.includes('туман') ||
          WW.includes('Дымка') || WW.includes('дымка') ||
          WW.includes('Дождь') || WW.includes('дождь') ||
          WW.includes('Снег') || WW.includes('снег') ||
          WW.includes('Морось') || WW.includes('морось') ||
          WW.includes('Ливневый') || WW.includes('ливневый')
        );
        
        if (!isImportantPhenomenon && WW === lastWW && WW !== null) {
          wwRepeatCount++;
          // "Состояние неба в общем не изменилось" показываем максимум 3 раза подряд
          const maxRepeats = WW === 'Состояние неба в общем не изменилось.' ? 3 : 2;
          if (wwRepeatCount > maxRepeats) {
            // ВАЖНО: Если убираем WW, нужно убрать и W1, W2 (правило "все три столбца")
            WW = null;
            W1 = null;
            W2 = null;
          }
        } else {
          wwRepeatCount = 1;
          lastWW = WW;
        }

        // Осадки в 3-м и 7-м периодах
        let RRR = null, tR = null;
        if (hour === tnHour || hour === txHour) {
          const key = `${dateKey}_${String(hour).padStart(2,'0')}`;
          const s = precipSum[key];
          tR = 12;
          if (s != null) {
            if (s < 0.05) RRR = 'Осадков нет';
            else if (s < 0.1) RRR = 'Следы осадков';
            else RRR = s;
          }
        }

        // Tn в 3-м периоде, Tx в 7-м периоде
        const Tn = hour === tnHour ? (dayMinT[dateKey] ?? null) : null;
        const Tx = hour === txHour ? (dayMaxT[dateKey] ?? null) : null;
        
        // Снежный покров только в 3-м периоде (вместе с Tn и осадками)
        const sssValue = hour === tnHour ? sss : null;
        
        // Видимость показываем только при явлениях которые влияют на неё:
        // туман (45, 48), дымка (10), осадки (51-67, 71-77, 80-82, 85-86), гроза (95-99)
        let VVValue = null;
        if (wcode != null) {
          const showVisibility = 
            wcode === 10 || // Дымка
            wcode === 45 || wcode === 48 || // Туман
            (wcode >= 51 && wcode <= 67) || // Дождь
            (wcode >= 71 && wcode <= 77) || // Снег
            (wcode >= 80 && wcode <= 82) || // Ливни
            (wcode >= 85 && wcode <= 86) || // Снежные ливни
            (wcode >= 95 && wcode <= 99);   // Гроза
          
          if (showVisibility) {
            VVValue = VV; // Показываем видимость даже если она null (будет "—")
            // Логируем для отладки
            if (i < 5) { // Только первые 5 записей
              console.log(`[archive] VV at ${times[i]}: wcode=${wcode}, VV=${VV}, VVValue=${VVValue}`);
            }
          }
        }

        const d = new Date(dateKey);
        const dateLabel = `${dateKey.slice(0,4)}г.\n${d.getDate()} ${months[d.getMonth()]},\n${dayNames[d.getDay()]}`;
        
        // Проверяем, есть ли данные в CSV для этого периода
        const csvKey = `${dateKey}_${String(hour).padStart(2,'0')}`;
        const csvRow = rp5Data ? rp5Data.get(csvKey) : null;
        
        // Если есть CSV данные, используем их (кроме WW/W1/W2 - их берём из нашей логики)
        if (csvRow) {
          rows.push({
            date: dateKey, dateLabel, time: String(hour).padStart(2, '0'),
            T: csvRow.T !== null ? csvRow.T : T,
            Pa: csvRow.Pa !== null ? csvRow.Pa : Pa,
            U: csvRow.U !== null ? csvRow.U : U,
            windDir: csvRow.DD || windDirRu(h.winddirection_10m?.[i]),
            Ff: csvRow.Ff !== null ? csvRow.Ff : Ff,
            ff10: csvRow.ff10 !== null ? csvRow.ff10 : gust,
            gust: csvRow.ff10 !== null ? csvRow.ff10 : gust,
            N: Cl, // Облачность берём из Open-Meteo для единообразия
            WW, W1, W2, // WW/W1/W2 берём из нашей логики (с грозами)
            Tn: csvRow.Tn !== null ? csvRow.Tn : Tn,
            Tx: csvRow.Tx !== null ? csvRow.Tx : Tx,
            VV: csvRow.VV !== null ? csvRow.VV : VVValue,
            Td: csvRow.Td !== null ? csvRow.Td : Td,
            RRR: csvRow.RRR || RRR,
            tR: csvRow.tR !== null ? csvRow.tR : tR,
            sss: csvRow.sss !== null ? csvRow.sss : sssValue,
          });
        } else {
          // Используем данные Open-Meteo
          rows.push({
            date: dateKey, dateLabel, time: String(hour).padStart(2, '0'),
            T, Pa, U, windDir: windDirRu(h.winddirection_10m?.[i]), Ff,
            ff10: gust, gust,
            N: Cl,
            WW, W1, W2, Tn, Tx,
            VV: VVValue, Td, RRR, tR,
            sss: sssValue,
          });
        }
      }
      console.log(`[archive] Open-Meteo rows=${rows.length} times=${times.length}`);

      // Применяем редактирования из файла
      rows = applyEdits(rows, geonameId, startStr, endDateStr);

      // Переворачиваем: последний день/час сверху, как на rp5
      rows.reverse();
      
      // По умолчанию показываем только последние 8 периодов (если не указан период выборки)
      if (period === 1 && rows.length > 8) {
        rows = rows.slice(0, 8);
        console.log(`[archive] Showing last 8 periods only`);
      }
    }

    console.log('[archive] Before render, dataSource=', dataSource, 'rows=', rows.length);

    res.render('archive', {
      title: `Архив погоды — ${weatherData.city}`,
      city: weatherData.city, country: weatherData.country,
      country_code: weatherData.country_code, countryNameEn,
      admin1: admin1Ru, geonameId: geonameId || weatherData.geonameId || '',
      endDate: endDateStr, period, rows, dataSource,
      tempClass, tempTooltip, pressClass, pressTooltip,
      humClass, humTooltip, windBfClass, windBfLabel,
      isAirport: false,
      airportICAO: null,
      req: req,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Ошибка: ' + e.message);
  }
});

// Статистика погоды — /stats?id=geonameId
app.get('/stats', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const id = req.query.id ? parseInt(req.query.id) : null;
    const cityName = req.query.city || null;
    const years = parseInt(req.query.years) || 1;
    
    const geonameId = id;
    
    // Конечная дата — сегодня
    const today = new Date();
    const endDateStr = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - years);
    const startStr = startDate.toISOString().slice(0, 10);
    
    const weatherData = await getWeatherData(ip, cityName, {}, null, null, geonameId);
    const lat = weatherData.lat;
    const lon = weatherData.lon;
    
    const countries = getCountries();
    const countryObj = countries.find(c => c.code === weatherData.country_code);
    const countryNameEn = countryObj ? countryObj.nameEn : '';
    let admin1Ru = weatherData.admin1 || '';
    if (weatherData.stateCode && weatherData.country_code) {
      const regions = getRegionsLocalized(weatherData.country_code, 'ru');
      const regionObj = regions.find(r => r.code === weatherData.stateCode);
      if (regionObj) admin1Ru = regionObj.name;
    }
    
    console.log(`[stats] Fetching data for ${weatherData.city} (${lat}, ${lon}) from ${startStr} to ${endDateStr} (${years} years)`);
    
    // Разбиваем запрос на части по годам чтобы избежать timeout
    let allDailyData = {
      time: [],
      temperature_2m_mean: [],
      temperature_2m_min: [],
      temperature_2m_max: [],
      precipitation_sum: [],
      weathercode: [],
      windspeed_10m_max: [],
      windgusts_10m_max: [],
      winddirection_10m_dominant: [],
      cloudcover_mean: [],
    };
    
    const startYear = new Date(startStr).getFullYear();
    const endYear = new Date(endDateStr).getFullYear();
    
    console.log(`[stats] Fetching data year by year from ${startYear} to ${endYear}`);
    
    for (let year = startYear; year <= endYear; year++) {
      const yearStart = year === startYear ? startStr : `${year}-01-01`;
      const yearEnd = year === endYear ? endDateStr : `${year}-12-31`;
      
      // Используем archive API с daily данными и облачностью
      const daily = [
        'temperature_2m_mean','temperature_2m_min','temperature_2m_max',
        'precipitation_sum',
        'weathercode',
        'windspeed_10m_max','windgusts_10m_max','winddirection_10m_dominant',
        'cloudcover_mean',
      ].join(',');
      
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${yearStart}&end_date=${yearEnd}&daily=${daily}&timezone=auto&windspeed_unit=ms`;
      
      console.log(`[stats] Fetching year ${year}: ${url}`);
      
      try {
        const response = await fetch(url, { 
          timeout: 30000,
          headers: {
            'User-Agent': 'WeatherWebsite/1.0'
          }
        });
        const data = await response.json();
        
        if (data.error || !data.daily || !data.daily.time) {
          console.log(`[stats] No data for year ${year}: ${data.error || 'no daily data'}`);
          continue;
        }
        
        // Добавляем данные этого года к общему массиву
        const d = data.daily;
        allDailyData.time.push(...(d.time || []));
        allDailyData.temperature_2m_mean.push(...(d.temperature_2m_mean || []));
        allDailyData.temperature_2m_min.push(...(d.temperature_2m_min || []));
        allDailyData.temperature_2m_max.push(...(d.temperature_2m_max || []));
        allDailyData.precipitation_sum.push(...(d.precipitation_sum || []));
        allDailyData.weathercode.push(...(d.weathercode || []));
        allDailyData.windspeed_10m_max.push(...(d.windspeed_10m_max || []));
        allDailyData.windgusts_10m_max.push(...(d.windgusts_10m_max || []));
        allDailyData.winddirection_10m_dominant.push(...(d.winddirection_10m_dominant || []));
        allDailyData.cloudcover_mean.push(...(d.cloudcover_mean || []));
        
        console.log(`[stats] Year ${year}: ${d.time?.length || 0} days fetched`);
        
      } catch (fetchError) {
        console.error(`[stats] Fetch error for year ${year}:`, fetchError.message);
      }
    }
    
    const data = { daily: allDailyData };
    console.log(`[stats] Total days fetched: ${allDailyData.time.length}`);
    
    let dataSource = 'Open-Meteo Archive (исторические данные)';
    let rows = [];
    
    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      console.log('[stats] No data available');
      dataSource = 'Нет данных за выбранный период';
    } else {
      console.log(`[stats] Processing ${data.daily.time.length} daily records`);
      
      // Группируем данные по месяцам
      const monthlyData = {};
      const d = data.daily;
      const dirs = ['С','С-С-В','С-В','В-С-В','В','В-Ю-В','Ю-В','Ю-Ю-В','Ю','Ю-Ю-З','Ю-З','З-Ю-З','З','З-С-З','С-З','С-С-З'];
      const windDirRu = deg => deg == null ? '' : dirs[Math.round(deg / 22.5) % 16];
      
      for (let i = 0; i < d.time.length; i++) {
        const dateKey = d.time[i].slice(0, 7); // YYYY-MM
        
        if (!monthlyData[dateKey]) {
          monthlyData[dateKey] = {
            temps: [],
            tempMins: [],
            tempMaxs: [],
            windSpeeds: [],
            windGusts: [],
            windDirs: [],
            weatherCodes: [],
            precipitations: [],
            cloudCovers: [],
          };
        }
        
        const T = d.temperature_2m_mean?.[i];
        const Tmin = d.temperature_2m_min?.[i];
        const Tmax = d.temperature_2m_max?.[i];
        const windSpeed = d.windspeed_10m_max?.[i];
        const windGust = d.windgusts_10m_max?.[i];
        const windDir = d.winddirection_10m_dominant?.[i];
        const wcode = d.weathercode?.[i];
        const precip = d.precipitation_sum?.[i];
        const cloud = d.cloudcover_mean?.[i];
        
        if (T != null) monthlyData[dateKey].temps.push(T);
        if (Tmin != null) monthlyData[dateKey].tempMins.push(Tmin);
        if (Tmax != null) monthlyData[dateKey].tempMaxs.push(Tmax);
        if (windSpeed != null) monthlyData[dateKey].windSpeeds.push(windSpeed);
        if (windGust != null) monthlyData[dateKey].windGusts.push(windGust);
        if (windDir != null) monthlyData[dateKey].windDirs.push(windDir);
        if (wcode != null) monthlyData[dateKey].weatherCodes.push(wcode);
        if (precip != null) monthlyData[dateKey].precipitations.push(precip);
        if (cloud != null) monthlyData[dateKey].cloudCovers.push(cloud);
      }
      
      // Вычисляем статистику по месяцам
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      
      for (const [monthKey, data] of Object.entries(monthlyData)) {
        const [year, month] = monthKey.split('-');
        const monthNum = parseInt(month) - 1;
        const monthLabel = `${year}г.\n${months[monthNum]}`;
        
        // Средние значения
        const avgTemp = data.temps.length > 0 
          ? Math.round(data.temps.reduce((a, b) => a + b, 0) / data.temps.length * 10) / 10 
          : null;
        const avgWind = data.windSpeeds.length > 0 
          ? Math.round(data.windSpeeds.reduce((a, b) => a + b, 0) / data.windSpeeds.length) 
          : null;
        const maxWind = data.windSpeeds.length > 0 
          ? Math.round(Math.max(...data.windSpeeds)) 
          : null;
        const maxGust = data.windGusts.length > 0 
          ? Math.round(Math.max(...data.windGusts)) 
          : null;
        
        // Минимальная и максимальная температура
        const minTemp = data.tempMins.length > 0 
          ? Math.round(Math.min(...data.tempMins) * 10) / 10 
          : null;
        const maxTemp = data.tempMaxs.length > 0 
          ? Math.round(Math.max(...data.tempMaxs) * 10) / 10 
          : null;
        
        // Средняя облачность в процентах (уже в процентах из API)
        const avgCloud = data.cloudCovers.length > 0 
          ? Math.round(data.cloudCovers.reduce((a, b) => a + b, 0) / data.cloudCovers.length) 
          : null;
        
        // Сумма осадков за месяц
        const totalPrecip = data.precipitations.length > 0 
          ? Math.round(data.precipitations.reduce((a, b) => a + b, 0) * 10) / 10 
          : null;
        
        // Преобладающее направление ветра
        const windDirCounts = {};
        for (const dir of data.windDirs) {
          const dirStr = windDirRu(dir);
          windDirCounts[dirStr] = (windDirCounts[dirStr] || 0) + 1;
        }
        const dominantWindDir = Object.keys(windDirCounts).length > 0
          ? Object.entries(windDirCounts).sort((a, b) => b[1] - a[1])[0][0]
          : null;
        
        // Наиболее значимые погодные явления для WW
        // Приоритет: гроза > град > снег > дождь > туман > дымка
        const weatherCodeCounts = {};
        for (const code of data.weatherCodes) {
          weatherCodeCounts[code] = (weatherCodeCounts[code] || 0) + 1;
        }
        
        // Определяем приоритет погодных явлений
        const priorityOrder = [
          95, 96, 99, // Гроза (с градом и без)
          17, 29, 30, // Гроза в прошлом
          86, 87, 88, 89, // Град
          71, 73, 75, 77, 85, 86, // Снег
          51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, // Дождь и ливни
          45, 48, // Туман
          10, // Дымка
        ];
        
        // Ищем самое приоритетное явление из тех что были
        let dominantWeatherCode = null;
        for (const priorityCode of priorityOrder) {
          if (weatherCodeCounts[priorityCode]) {
            dominantWeatherCode = priorityCode;
            break;
          }
        }
        
        // Если приоритетных явлений не было, берём самое частое
        if (dominantWeatherCode === null && Object.keys(weatherCodeCounts).length > 0) {
          dominantWeatherCode = parseInt(Object.entries(weatherCodeCounts).sort((a, b) => b[1] - a[1])[0][0]);
        }
        
        // Формируем WW на основе найденного кода
        // ВАЖНО: показываем ТОЛЬКО реальные погодные явления (дождь, снег, туман, гроза, град и т.д.)
        // Убираем всю информацию об облачности - для этого есть колонка N
        let WW = null;
        if (dominantWeatherCode != null) {
          const rawWW = WMO_WW[dominantWeatherCode] || null;
          
          // Строгий фильтр: убираем "Ясно", всю информацию об облачности и состоянии неба
          // Оставляем только реальные явления: дождь, снег, туман, гроза, град, метель и т.д.
          if (rawWW && 
              rawWW !== 'Ясно' && 
              !rawWW.includes('Облачность') && 
              !rawWW.includes('облачность') &&
              !rawWW.includes('Состояние неба')) {
            WW = rawWW;
          }
        }
        
        rows.push({
          monthLabel,
          T: avgTemp,
          windDir: dominantWindDir,
          Ff: avgWind,
          ff10: maxWind,
          gust: maxGust,
          N: avgCloud, // Средняя облачность в процентах
          WW, // Только реальные погодные явления
          Tn: minTemp,
          Tx: maxTemp,
          RRR: totalPrecip, // Сумма осадков за месяц
        });
      }
      
      // Сортируем по дате (новые месяцы сверху)
      rows.sort((a, b) => {
        const aYear = parseInt(a.monthLabel.split('г.')[0]);
        const aMonth = months.indexOf(a.monthLabel.split('\n')[1]);
        const bYear = parseInt(b.monthLabel.split('г.')[0]);
        const bMonth = months.indexOf(b.monthLabel.split('\n')[1]);
        
        if (aYear !== bYear) return bYear - aYear;
        return bMonth - aMonth;
      });
      
      console.log(`[stats] Generated ${rows.length} monthly statistics`);
    }
    
    res.render('stats', {
      title: `Статистика погоды — ${weatherData.city}`,
      city: weatherData.city,
      country: weatherData.country,
      admin1: admin1Ru,
      lat,
      lon,
      geonameId: geonameId || weatherData.geonameId || '',
      years,
      rows,
      dataSource,
      tempClass,
      tempTooltip,
      pressClass,
      pressTooltip,
      humClass,
      humTooltip,
      windBfClass,
      windBfLabel,
    });
  } catch (e) {
    console.error('[stats] Error:', e);
    res.status(500).send('Ошибка: ' + e.message);
  }
});

// Редактирование архива — /archive/edit?id=geonameId
app.get('/archive/edit', async (req, res) => {
  try {
    const authenticated = req.query.auth === 'true';
    const id = req.query.id ? parseInt(req.query.id) : null;
    const period = parseInt(req.query.period) || 1;
    const selectedHour = req.query.hour || 'all'; // 'all' или конкретный час '00', '03', и т.д.
    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const endDateStr = req.query.date || defaultEnd;
    
    if (!authenticated) {
      return res.render('archive-edit', {
        authenticated: false,
        geonameId: id,
        endDate: endDateStr,
        period,
        city: '',
        rows: [],
        req
      });
    }
    
    // Получаем данные архива
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const cityName = req.query.city || null;
    const geonameId = id;
    
    // В редакторе показываем только выбранную дату (не запрашиваем предыдущий день)
    const startDate = new Date(endDateStr);
    startDate.setDate(startDate.getDate() - period + 1);
    const startStr = startDate.toISOString().slice(0, 10);
    
    const weatherData = await getWeatherData(ip, cityName, {}, null, null, geonameId);
    const lat = weatherData.lat;
    const lon = weatherData.lon;
    
    // Получаем данные о грозах из нескольких моделей
    let multiModelData = null;
    multiModelData = await fetchMultiModelThunderstorms(lat, lon, startStr, endDateStr);
    
    // Получаем данные из Open-Meteo Archive
    const hourly = [
      'temperature_2m','relativehumidity_2m','dewpoint_2m',
      'surface_pressure','windspeed_10m','windgusts_10m','winddirection_10m',
      'cloudcover','visibility','weathercode','snow_depth','precipitation',
    ].join(',');
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endDateStr}&hourly=${hourly}&timezone=auto&windspeed_unit=ms`;
    
    const archResponse = await fetch(url);
    const archData = await archResponse.json();
    
    let rows = [];
    
    if (archData && archData.hourly && archData.hourly.time && archData.hourly.time.length > 0) {
      const h = archData.hourly;
      const times = h.time;
      const dirs = ['С','С-С-В','С-В','В-С-В','В','В-Ю-В','Ю-В','Ю-Ю-В','Ю','Ю-Ю-З','Ю-З','З-Ю-З','З','З-С-З','С-З','С-С-З'];
      const windDirRu = deg => deg == null ? '' : dirs[Math.round(deg / 22.5) % 16];
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      
      // Вычисляем UTC offset
      const now = new Date();
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: archData.timezone }));
      const offsetMs = tzDate - utcDate;
      const utcOffsetHours = offsetMs / (1000 * 60 * 60);
      
      // Целевые часы (8 периодов)
      const getTargetHours = (utcOffset) => {
        const startHour = ((utcOffset % 3) + 3) % 3;
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
      };
      
      const TARGET_HOURS_ARRAY = getTargetHours(utcOffsetHours);
      const TARGET_HOURS = new Set(TARGET_HOURS_ARRAY);
      const tnHour = TARGET_HOURS_ARRAY[2];
      const txHour = TARGET_HOURS_ARRAY[6];
      
      // Предварительный проход для осадков и температур
      const precipSum = {};
      const dayMinT = {}, dayMaxT = {};
      for (let i = 0; i < times.length; i++) {
        const hour = parseInt(times[i].slice(11, 13), 10);
        const dateKey = times[i].slice(0, 10);
        const T = h.temperature_2m?.[i];
        if (T != null) {
          if (dayMinT[dateKey] == null || T < dayMinT[dateKey]) dayMinT[dateKey] = Math.round(T * 10) / 10;
          if (dayMaxT[dateKey] == null || T > dayMaxT[dateKey]) dayMaxT[dateKey] = Math.round(T * 10) / 10;
        }
        if (hour === tnHour || hour === txHour) {
          let sum = 0;
          for (let j = Math.max(0, i - 12); j <= i; j++) sum += (h.precipitation?.[j] ?? 0);
          precipSum[`${dateKey}_${String(hour).padStart(2,'0')}`] = Math.round(sum * 10) / 10;
        }
      }
      
      // Основной проход - только целевые часы
      for (let i = 0; i < times.length; i++) {
        const hour = parseInt(times[i].slice(11, 13), 10);
        if (!TARGET_HOURS.has(hour)) continue;
        
        // Пропускаем будущие периоды (данные ещё не доступны)
        const periodTime = new Date(times[i]);
        const nowWithDelay = new Date(now.getTime() - 30 * 60 * 1000); // Вычитаем 30 минут задержки
        if (periodTime > nowWithDelay) {
          console.log(`[archive/edit] Skipping future period: ${times[i]}`);
          continue;
        }
        
        // Фильтр по выбранному часу
        if (selectedHour !== 'all' && String(hour).padStart(2, '0') !== selectedHour) continue;
        
        const dateKey = times[i].slice(0, 10);
        const T = h.temperature_2m?.[i] != null ? Math.round(h.temperature_2m[i] * 10) / 10 : null;
        const Pa = h.surface_pressure?.[i] != null ? Math.round(h.surface_pressure[i] * 0.750064) : null;
        const U = h.relativehumidity_2m?.[i] ?? null;
        const Ff = h.windspeed_10m?.[i] != null ? Math.round(h.windspeed_10m[i]) : null;
        const gust = h.windgusts_10m?.[i] != null ? Math.round(h.windgusts_10m[i]) : null;
        const Cl = h.cloudcover?.[i] ?? null;
        const rawVV = h.visibility?.[i];
        const VV = rawVV != null ? Math.round(rawVV / 1000 * 10) / 10 : null;
        const Td = h.dewpoint_2m?.[i] != null ? Math.round(h.dewpoint_2m[i] * 10) / 10 : null;
        const rawSss = h.snow_depth?.[i];
        const sss = rawSss != null && rawSss > 0 ? Math.round(rawSss * 100) : null;
        const wcode = h.weathercode?.[i] ?? null;
        let WW = wcode != null ? (WMO_WW[wcode] || null) : null;
        
        const prevCode1 = i >= 3 ? (h.weathercode?.[i-3] ?? null) : null;
        const prevCode2 = i >= 6 ? (h.weathercode?.[i-6] ?? null) : null;
        let W1 = prevCode1 != null ? (W_PAST[wwToWCode(prevCode1)] || null) : null;
        let W2 = prevCode2 != null ? (W_PAST[wwToWCode(prevCode2)] || null) : null;
        
        // Осадки и температуры
        let RRR = null, tR = null;
        if (hour === tnHour || hour === txHour) {
          const key = `${dateKey}_${String(hour).padStart(2,'0')}`;
          const s = precipSum[key];
          tR = 12;
          if (s != null) {
            if (s < 0.05) RRR = 'Осадков нет';
            else if (s < 0.1) RRR = 'Следы осадков';
            else RRR = s;
          }
        }
        
        const Tn = hour === tnHour ? (dayMinT[dateKey] ?? null) : null;
        const Tx = hour === txHour ? (dayMaxT[dateKey] ?? null) : null;
        const sssValue = hour === tnHour ? sss : null;
        
        // Видимость только при осадках/тумане
        let VVValue = null;
        if (wcode != null) {
          const showVisibility = 
            wcode === 10 || wcode === 45 || wcode === 48 ||
            (wcode >= 51 && wcode <= 67) || (wcode >= 71 && wcode <= 77) ||
            (wcode >= 80 && wcode <= 82) || (wcode >= 85 && wcode <= 86) ||
            (wcode >= 95 && wcode <= 99);
          if (showVisibility) VVValue = VV;
        }
        
        const d = new Date(dateKey);
        const dateLabel = `${dateKey.slice(0,4)}г.\n${d.getDate()} ${months[d.getMonth()]},\n${dayNames[d.getDay()]}`;
        
        rows.push({
          date: dateKey,
          dateLabel,
          time: String(hour).padStart(2, '0'),
          T, Pa, U,
          windDir: windDirRu(h.winddirection_10m?.[i]),
          Ff, ff10: gust, gust,
          N: Cl,
          WW, W1, W2,
          Tn, Tx,
          VV: VVValue, Td,
          RRR, tR,
          sss: sssValue,
        });
      }
      
      rows.reverse();
      
      // Для периода "1 сутки" показываем только выбранную дату
      if (period === 1) {
        rows = rows.filter(row => row.date === endDateStr);
      }
      
      // Не ограничиваем количество строк если выбран конкретный час
      if (selectedHour === 'all' && period === 1 && rows.length > 8) {
        rows = rows.slice(0, 8);
      }
    }
    
    // Применяем существующие редактирования
    rows = applyEdits(rows, geonameId, startStr, endDateStr);
    
    res.render('archive-edit', {
      authenticated: true,
      geonameId,
      endDate: endDateStr,
      period,
      city: weatherData.city,
      rows,
      req
    });
  } catch (e) {
    console.error('[archive/edit] Error:', e);
    res.status(500).send('Ошибка: ' + e.message);
  }
});

// Авторизация для редактирования
app.post('/archive/edit/auth', (req, res) => {
  const { password, id, date, period } = req.body;
  if (password === EDIT_PASSWORD) {
    res.redirect(`/archive/edit?id=${id}&date=${date}&period=${period}&auth=true`);
  } else {
    res.send('Неверный пароль. <a href="/archive/edit?id=' + id + '&date=' + date + '&period=' + period + '">Попробовать снова</a>');
  }
});

// Сохранение редактирований
app.post('/archive/edit/save', (req, res) => {
  try {
    const { edits, deletions } = req.body;
    console.log('[archive/edit/save] Received edits:', Object.keys(edits).length, 'records');
    console.log('[archive/edit/save] Received deletions:', deletions?.length || 0, 'records');
    
    const editsData = loadEdits();
    
    // Объединяем новые редактирования с существующими
    Object.assign(editsData.edits, edits);
    
    // Удаляем записи (возврат к оригиналу)
    if (deletions && Array.isArray(deletions)) {
      deletions.forEach(key => {
        console.log('[archive/edit/save] Deleting:', key);
        delete editsData.edits[key];
      });
    }
    
    saveEdits(editsData);
    console.log('[archive/edit/save] Saved successfully. Total edits:', Object.keys(editsData.edits).length);
    res.json({ success: true });
  } catch (e) {
    console.error('[archive/edit/save] Error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Архив погоды (тестовая страница) — /archivetest?id=geonameId
app.get('/archivetest', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const id = req.query.id ? parseInt(req.query.id) : null;
    const cityName  = req.query.city || null;
    const period = parseInt(req.query.period) || 1;
    
    const geonameId = id;
    
    // Конечная дата — сегодня по умолчанию
    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const endDateStr = req.query.date || defaultEnd;
    const startDate = new Date(endDateStr);
    
    if (period === 1) {
      startDate.setDate(startDate.getDate() - 1);
    } else {
      startDate.setDate(startDate.getDate() - period + 1);
    }
    const startStr = startDate.toISOString().slice(0, 10);

    const weatherData = await getWeatherData(ip, cityName, {}, null, null, geonameId);
    const lat = weatherData.lat;
    const lon = weatherData.lon;

    const countries = getCountries();
    const countryObj = countries.find(c => c.code === weatherData.country_code);
    const countryNameEn = countryObj ? countryObj.nameEn : '';
    let admin1Ru = weatherData.admin1 || '';
    if (weatherData.stateCode && weatherData.country_code) {
      const regions = getRegionsLocalized(weatherData.country_code, 'ru');
      const regionObj = regions.find(r => r.code === weatherData.stateCode);
      if (regionObj) admin1Ru = regionObj.name;
    }

    let rows = [];
    let dataSource = 'Нет данных';
    
    console.log('[archivetest] Fetching Meteostat data...');
    
    // Используем Meteostat API (реальные наблюдения с метеостанций)
    const meteoData = await fetchMeteostat(lat, lon, startStr, endDateStr, weatherData.timezone || 'UTC');
    
    if (meteoData && meteoData.data && meteoData.data.length > 0) {
      console.log('[archivetest] Got Meteostat data');
      dataSource = 'Meteostat (реальные наблюдения с метеостанций)';
      
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      const dirs = ['С','С-С-В','С-В','В-С-В','В','В-Ю-В','Ю-В','Ю-Ю-В','Ю','Ю-Ю-З','Ю-З','З-Ю-З','З','З-С-З','С-З','С-С-З'];
      const windDirRu = deg => deg == null ? '' : dirs[Math.round(deg / 22.5) % 16];
      
      // Маппинг кодов погоды Meteostat (coco) в русский текст
      const cocoToRu = {
        1: 'Ясно', 2: 'Малооблачно', 3: 'Облачно', 4: 'Пасмурно',
        5: 'Туман', 6: 'Ледяной туман',
        7: 'Слабый дождь', 8: 'Дождь', 9: 'Сильный дождь',
        10: 'Ледяной дождь', 11: 'Сильный ледяной дождь',
        12: 'Мокрый снег', 13: 'Сильный мокрый снег',
        14: 'Слабый снег', 15: 'Снег', 16: 'Сильный снег',
        17: 'Ливень', 18: 'Сильный ливень',
        19: 'Ливень с мокрым снегом', 20: 'Сильный ливень с мокрым снегом',
        21: 'Снежный ливень', 22: 'Сильный снежный ливень',
        23: 'Молния', 24: 'Град', 25: 'Гроза', 26: 'Сильная гроза', 27: 'Шторм'
      };
      
      for (const record of meteoData.data) {
        // time формат: "2020-01-01 00:00:00"
        const dateKey = record.time.slice(0, 10);
        const time = record.time.slice(11, 13);
        
        const d = new Date(dateKey);
        const dateLabel = `${d.getFullYear()}г.\n${d.getDate()} ${months[d.getMonth()]},\n${dayNames[d.getDay()]}`;
        
        const T = record.temp != null ? Math.round(record.temp * 10) / 10 : null;
        const Pa = record.pres != null ? Math.round(record.pres * 0.750064) : null; // гПа -> мм рт.ст.
        const U = record.rhum != null ? Math.round(record.rhum) : null;
        const Ff = record.wspd != null ? Math.round(record.wspd / 3.6) : null; // км/ч -> м/с
        const gust = record.wpgt != null ? Math.round(record.wpgt / 3.6) : null; // км/ч -> м/с
        const Cl = null; // Meteostat не предоставляет облачность в процентах
        const VV = null; // Видимость не в данных
        const Td = record.dwpt != null ? Math.round(record.dwpt * 10) / 10 : null;
        const sss = record.snow != null && record.snow > 0 ? Math.round(record.snow / 10) : null; // мм -> см
        const precip = record.prcp != null ? record.prcp : null;
        
        // Конвертируем код погоды (coco) в текст
        const WW = record.coco != null ? (cocoToRu[record.coco] || null) : null;
        
        rows.push({
          date: dateKey,
          dateLabel,
          time,
          T, Pa, U,
          windDir: windDirRu(record.wdir),
          Ff, ff10: gust, gust,
          N: Cl,
          WW, W1: null, W2: null,
          Tn: null, Tx: null,
          VV, Td,
          RRR: precip, tR: null, sss,
        });
      }
      
      // Сортируем от новых к старым (самый последний час сверху)
      rows.sort((a, b) => {
        const dateTimeA = `${a.date} ${a.time}`;
        const dateTimeB = `${b.date} ${b.time}`;
        return dateTimeB.localeCompare(dateTimeA);
      });
      
      console.log(`[archivetest] Parsed ${rows.length} rows from Meteostat`);
    } else {
      console.log('[archivetest] No Meteostat data available');
    }

    res.render('archivetest', {
      title: `Архив погоды (Meteostat) — ${weatherData.city}`,
      city: weatherData.city, country: weatherData.country,
      country_code: weatherData.country_code, countryNameEn,
      admin1: admin1Ru, geonameId: geonameId || weatherData.geonameId || '',
      endDate: endDateStr, period, rows, dataSource,
      tempClass, tempTooltip, pressClass, pressTooltip,
      humClass, humTooltip, windBfClass, windBfLabel,
      isAirport: false,
      airportICAO: null,
      req: req,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Ошибка: ' + e.message);
  }
});

// Регионы страны — /:countrySlug
const RESERVED_SLUGS = new Set(['weather','archive','archivetest','api','wind-demo','sprite-editor','icon-test','static','resources','cdn-cgi','countries','favicon.ico']);

app.get('/:countrySlug', async (req, res) => {
  if (RESERVED_SLUGS.has(req.params.countrySlug)) return res.status(404).send('Not found');
  try {
    const slug = req.params.countrySlug;
    const lang = req.query.lang || 'ru';
    const countries = getCountries();
    const country = countries.find(c => c.nameEn === slug);
    if (!country) return res.status(404).send('Страна не найдена');
    const regions = getRegionsLocalized(country.code, lang);
    // Показываем только регионы у которых есть города в базе
    const regionsWithCities = regions.filter(r => {
      const gnCode = (regionsGn[country.code] && regionsGn[country.code][r.code]) || r.code;
      return geoDB.getCitiesByRegion(country.code, gnCode).length > 0;
    });
    res.render('regions', { country, regions: regionsWithCities, toSlug, title: country.name });
  } catch (e) {
    res.status(500).send('Ошибка: ' + e.message);
  }
});

// Города региона — /:countrySlug/:regionSlug
app.get('/:countrySlug/:regionSlug', async (req, res) => {
  if (RESERVED_SLUGS.has(req.params.regionSlug)) return res.status(404).send('Not found');
  try {
    const { countrySlug, regionSlug } = req.params;
    const lang = req.query.lang || 'ru';
    const countries = getCountries();
    const country = countries.find(c => c.nameEn === countrySlug);
    if (!country) return res.status(404).send('Страна не найдена');
    const regions = getRegionsLocalized(country.code, lang);
    const region = regions.find(r => toSlug(r.nameEn) === regionSlug);
    if (!region) return res.status(404).send('Регион не найден');
    const cities = getCitiesLocalized(country.code, region.code, lang);
    res.render('cities', { country, admin1: region.name, admin1En: region.nameEn, stateCode: region.code, cities, toSlug, title: `${region.name} — ${country.name}` });
  } catch (e) {
    res.status(500).send('Ошибка: ' + e.message);
  }
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
