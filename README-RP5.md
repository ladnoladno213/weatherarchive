# RP5 Archive Downloader - README

Система для скачивания исторических метеоданных с сайта rp5.ru

## 🚀 Быстрый старт

### 1. Установка
```bash
pip install -r requirements.txt
```

### 2. Проверка доступности станции
```bash
python rp5-helper.py check 26063 01.01.2024 31.12.2024
```

### 3. Скачивание архива
```bash
python rp5-helper.py download 26063 01.01.2024 31.12.2024
```

## ⚠️ Важно знать

### RP5 использует систему "по запросу"
- Архивы **не хранятся постоянно**
- Файлы **генерируются после запроса** через веб-интерфейс
- Прямые запросы к несгенерированным файлам → **403 Forbidden**

### Что делать при 403 Forbidden?
1. Открыть https://rp5.ru/archive.php?wmo_id=XXXXX
2. Выбрать период и нажать "Скачать архив"
3. После генерации использовать Python downloader

## 📊 Популярные станции

| WMO ID | Город | Статус |
|--------|-------|--------|
| 26063 | Санкт-Петербург | ✅ Стабильно работает |
| 27612 | Москва | ⚠️ Иногда доступна |
| 28573 | Ишим | ❌ Требует генерации |
| 29634 | Новосибирск | ❌ Требует генерации |
| 28698 | Екатеринбург | ❌ Требует генерации |

```bash
# Показать полный список
python rp5-helper.py popular
```

## 💻 Использование в коде

### Простое скачивание
```python
from rp5_downloader import RP5Downloader

downloader = RP5Downloader()

# Скачать архив
file_path = downloader.download_station(
    station_id='26063',
    start_date='01.01.2024',
    end_date='31.12.2024'
)

if file_path:
    # Загрузить в DataFrame
    df = downloader.load_csv_to_dataframe(file_path)
    print(f"Загружено {len(df)} строк")
    
    # Подготовить для БД
    df_prepared = downloader.prepare_for_database(df, '26063')
else:
    print("Архив недоступен (403 Forbidden)")
    print(f"Сгенерируйте: {downloader.get_manual_download_url('26063')}")

downloader.close()
```

### Обработка 403 Forbidden
```python
file_path = downloader.download_station(station_id, start_date, end_date)

if not file_path:
    # Показать ссылку для генерации
    url = downloader.get_manual_download_url(station_id)
    print(f"Откройте: {url}")
    print("Сгенерируйте архив и нажмите Enter")
    input()
    
    # Повторить попытку
    file_path = downloader.download_station(station_id, start_date, end_date)
```

### Скачивание нескольких станций
```python
stations = ['26063', '27612', '28573']

results = downloader.download_stations(
    station_ids=stations,
    start_date='01.01.2024',
    end_date='31.12.2024',
    max_workers=2  # Параллельность
)

for station_id, file_path in results:
    if file_path:
        print(f"[OK] {station_id}: {file_path.name}")
    else:
        print(f"[FAIL] {station_id}: требует генерации")
```

## 📁 Структура файлов

### Основные скрипты
- `rp5_downloader.py` - главный класс
- `rp5-helper.py` - утилита командной строки
- `requirements.txt` - зависимости

### Тесты
- `test-rp5-python.py` - тесты downloader
- `test-stations-availability.py` - проверка доступности
- `debug-csv-format.py` - диагностика CSV

### Документация
- `RP5-QUICK-START.md` - быстрый старт ⭐
- `RP5-PYTHON-DOWNLOADER.md` - полная документация
- `RP5-ON-DEMAND-GENERATION.md` - как работает RP5
- `RP5-IMPLEMENTATION-STATUS.md` - статус проекта
- `RP5-ARCHIVE-API.md` - технические детали

## 🔧 Возможности

### RP5Downloader
- ✅ Session с cookies
- ✅ Реалистичные HTTP заголовки
- ✅ Retry механизм (3 попытки)
- ✅ Альтернативные серверы (ru1, ru2, ru3)
- ✅ Автоматическая распаковка .gz
- ✅ Загрузка в pandas DataFrame
- ✅ Подготовка для БД

### rp5-helper.py
- ✅ Проверка доступности
- ✅ Скачивание с retry
- ✅ Генерация URL для ручного скачивания
- ✅ Список популярных станций

## 📖 Формат данных

### CSV структура
```csv
"Местное время";"T";"Po";"P";"Pa";"U";"DD";"Ff";"ff10";"ff3";"N";"WW";"W1";"W2"...
"01.01.2026 21:00";"-11.5";"747.4";"747.7";"-0.6";"80";"Ветер, дующий с востоко-юго-востока";"2"...
```

### Основные колонки
- `Местное время` - datetime (DD.MM.YYYY HH:MM)
- `T` - температура (°C)
- `Po` - давление на уровне станции (мм рт.ст.)
- `P` - давление на уровне моря (мм рт.ст.)
- `U` - влажность (%)
- `DD` - направление ветра
- `Ff` - скорость ветра (м/с)
- `WW` - текущая погода
- `W1`, `W2` - прошедшая погода

### Частота данных
Каждые 3 часа: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00

## 🐛 Troubleshooting

### Все станции возвращают 403
**Решение:** Это нормально! Генерируйте архивы вручную или используйте Санкт-Петербург (26063).

### Python command not found
**Решение:** Запускайте через IDLE или добавьте Python в PATH.

### Invalid CSV format
**Решение:** Проверьте, что файл скачался полностью (не HTML с ошибкой).

### Долгая генерация на сайте
**Решение:** Большие периоды (>5 лет) генерируются дольше. Разбейте на меньшие периоды.

## 🔗 Альтернативные источники

Если RP5 не подходит:
1. **NOAA ISD** - бесплатно, но другой формат
2. **Open-Meteo** - исторические данные через API
3. **Meteostat** - ограниченные данные
4. **Коммерческие API** - платно, но надежно

См. `ALTERNATIVE-DATA-SOURCES.md`

## 📝 Примеры использования

### Пример 1: Анализ температуры
```python
from rp5_downloader import RP5Downloader
import pandas as pd

downloader = RP5Downloader()
file_path = downloader.download_station('26063', '01.01.2024', '31.12.2024')

if file_path:
    df = downloader.load_csv_to_dataframe(file_path)
    
    # Анализ температуры
    print(f"Средняя температура: {df['T'].mean():.1f}°C")
    print(f"Минимум: {df['T'].min():.1f}°C")
    print(f"Максимум: {df['T'].max():.1f}°C")

downloader.close()
```

### Пример 2: Поиск гроз
```python
df = downloader.load_csv_to_dataframe(file_path)

# Фильтр по грозам (WW содержит "гроз")
thunderstorms = df[df['WW'].str.contains('гроз', case=False, na=False)]

print(f"Найдено гроз: {len(thunderstorms)}")
print(thunderstorms[['Местное время в Санкт-Петербурге', 'T', 'WW']])
```

### Пример 3: Экспорт в БД
```python
df = downloader.load_csv_to_dataframe(file_path)
df_prepared = downloader.prepare_for_database(df, '26063')

# Сохранить в SQLite
import sqlite3
conn = sqlite3.connect('weather.db')
df_prepared.to_sql('rp5_data', conn, if_exists='append', index=False)
conn.close()
```

## 📞 Поддержка

Если возникли вопросы:
1. Прочитайте `RP5-QUICK-START.md`
2. Проверьте `RP5-IMPLEMENTATION-STATUS.md`
3. Изучите примеры в `test-rp5-python.py`

## 📄 Лицензия

Данные предоставлены сайтом rp5.ru. При использовании данных указывайте источник.

---

**Главный совет:** Начните с Санкт-Петербурга (26063) - эта станция стабильно работает!
