# Weather Statistics Page Implementation

## Overview
Implemented a new `/stats` route that displays monthly weather statistics for a location over 1, 3, 5, or 10 years.

## Files Modified

### 1. server.js
- Added `/stats` route (after `/archive` route)
- Fetches historical data from Open-Meteo Archive API
- Aggregates hourly data into monthly statistics:
  - Average temperature, pressure, humidity, wind speed, cloud cover, visibility
  - Min/max temperature for each month
  - Dominant wind direction
  - Most frequent weather phenomena (WW, W1, W2)
- Sorts months in descending order (newest first)

### 2. views/stats.ejs
- Created new template matching archive.ejs structure
- Uses same table structure (archiveTable) with months instead of hours
- Includes tabs for switching between archive and stats
- Period selection tabs: 1 год, 3 года, 5 лет, 10 лет
- Legend explaining all parameters

### 3. views/archive.ejs
- Updated stats tab link to use `/stats?id=<geonameId>` instead of `/archive/stats?city=...`
- Now uses geonameId for consistency

### 4. static/css/rp5.css
- Added `.period-tabs` styles for year selection buttons
- Matches archive-controls styling
- Active state uses blue background (#1a5cb5)

## Usage

### URL Format
```
http://localhost:3000/stats?id=<geonameId>&years=<1|3|5|10>
```

### Examples
- Moscow (1 year): `http://localhost:3000/stats?id=524901&years=1`
- Tyumen (3 years): `http://localhost:3000/stats?id=1508291&years=3`
- Ishim (5 years): `http://localhost:3000/stats?id=1505260&years=5`

### Navigation
- From archive page: Click "Статистика погоды" tab
- From stats page: Click "Архив погоды" tab to return
- Switch between 1/3/5/10 year periods using period tabs

## Data Source
- Open-Meteo Archive API (historical data from 1940 onwards)
- Monthly aggregation of hourly observations
- Same parameters as archive page: T, Po, U, DD, Ff, N, WW, W1, W2, Tn, Tx, VV

## Features
- Same table structure as archive page for consistency
- Color-coded temperature values (tempClass)
- Pressure and humidity classes (pressClass, humClass)
- Responsive design with horizontal scroll for narrow screens
- Tooltips on column headers
- "Нет данных" message when no data available

## Testing
Run `node test-stats.js` to verify the route works correctly.

## Notes
- Default period is 1 year if not specified
- Months are displayed in Russian format: "2025г.\nянваря"
- Statistics show averages except for Tn/Tx which show absolute min/max
- WW/W1/W2 show most frequent weather phenomena for the month
- "Ясно" is filtered out from WW (not a weather phenomenon)
