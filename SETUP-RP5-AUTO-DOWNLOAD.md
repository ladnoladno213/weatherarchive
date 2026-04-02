# Настройка автоматической загрузки CSV с RP5

## Шаг 1: Генерация маппинга WMO ID

Запустите скрипт для автоматического поиска метеостанций RP5 для всех городов на сайте:

```bash
node generate-wmo-mapping.js
```

Этот скрипт:
1. Получит список всех городов с сайта
2. Для каждого города найдёт ближайшую метеостанцию RP5
3. Создаст файл `data/wmo-mapping.js` с маппингом geonameId → WMO_ID

Процесс займёт время (примерно 1-2 минуты на 100 городов из-за задержек между запросами).

## Шаг 2: Проверка маппинга

Откройте файл `data/wmo-mapping.js` и проверьте результаты:

```javascript
const GEONAME_TO_WMO = {
  "1505453": "28573",  // Ишим
  "524901": "27612",   // Москва
  "498817": "26063",   // Санкт-Петербург
  // ...
};
```

## Шаг 3: Тестирование

Запустите тестовый скрипт для проверки загрузки:

```bash
node test-rp5-downloader.js
```

Или протестируйте конкретный город:

```javascript
const { getRP5CSVPath } = require('./rp5-csv-downloader');

async function test() {
  const csvPath = await getRP5CSVPath('524901', '2024-01-01', '2024-12-31');
  console.log('CSV path:', csvPath);
}

test();
```

## Шаг 4: Запуск сервера

Теперь при запросе архива погоды система автоматически:
1. Проверит наличие WMO ID для города
2. Скачает CSV с RP5 (если нужно)
3. Использует реальные данные наблюдений

```bash
node server.js
```

Откройте в браузере:
- http://localhost:3000/archive?id=1505453 (Ишим)
- http://localhost:3000/archive?id=524901 (Москва)

## Параметры генерации

В файле `generate-wmo-mapping.js` можно настроить:

### Все города
```javascript
const { mapping, cityNames } = await generateWMOMapping(cities);
```

### Только крупные города (> 50k населения)
```javascript
const largeCities = cities.filter(c => c.population > 50000);
const { mapping, cityNames } = await generateWMOMapping(largeCities);
```

### Топ-N городов по населению
```javascript
const topCities = cities
  .sort((a, b) => b.population - a.population)
  .slice(0, 100);
const { mapping, cityNames } = await generateWMOMapping(topCities);
```

### Города конкретной страны
```javascript
const russianCities = cities.filter(c => c.country_code === 'RU');
const { mapping, cityNames } = await generateWMOMapping(russianCities);
```

## Ограничения

1. **Радиус поиска**: Станция должна быть в пределах 100км от города
2. **Задержка**: 1 секунда между запросами к RP5 (чтобы не перегружать сервер)
3. **Доступность**: Не для всех городов есть метеостанции WMO

## Ручное добавление

Если автоматический поиск не нашёл станцию, можно добавить вручную в `data/wmo-mapping.js`:

1. Найдите WMO ID на сайте RP5: http://rp5.ru
2. Добавьте в маппинг:

```javascript
const GEONAME_TO_WMO = {
  // ...
  "YOUR_GEONAME_ID": "WMO_ID",
};

const GEONAME_TO_CITY = {
  // ...
  "YOUR_GEONAME_ID": "city-name",
};
```

## Обновление маппинга

Чтобы обновить маппинг (например, добавить новые города):

1. Отредактируйте `generate-wmo-mapping.js`
2. Запустите: `node generate-wmo-mapping.js`
3. Перезапустите сервер

Существующий файл `data/wmo-mapping.js` будет перезаписан.

## Структура файлов

```
project/
├── rp5-station-finder.js      # Поиск станций RP5
├── rp5-csv-downloader.js      # Загрузка CSV
├── rp5-csv-loader.js          # Парсинг CSV
├── generate-wmo-mapping.js    # Генерация маппинга
├── data/
│   ├── wmo-mapping.js         # Сгенерированный маппинг
│   └── rp5-csv/               # Скачанные CSV файлы
│       ├── 28573.2024-01-01.2024-12-31.ishim.utf8.csv
│       └── ...
└── server.js                  # Основной сервер
```

## Источник данных

Данные предоставлены сайтом "Расписание Погоды" (rp5.ru).
При использовании данных необходимо указывать источник.
