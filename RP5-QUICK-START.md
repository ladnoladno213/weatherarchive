# RP5 Quick Start - Быстрый старт

## Проблема: 403 Forbidden

Если вы получаете ошибку **403 Forbidden** при попытке скачать архив - это нормально!

RP5 генерирует архивы **только по запросу**. Файл нужно сначала создать через веб-интерфейс.

## Решение за 3 шага

### Шаг 1: Проверьте доступность

```bash
python rp5-helper.py check 28573 01.01.2024 31.12.2024
```

Скрипт покажет:
- ✅ Если файл доступен - скачает автоматически
- ❌ Если 403 - даст ссылку для генерации

### Шаг 2: Сгенерируйте архив (если нужно)

Если получили 403:

1. Откройте ссылку из вывода скрипта (например: `https://rp5.ru/archive.php?wmo_id=28573`)
2. На странице выберите период
3. Нажмите **"Скачать архив"**
4. Дождитесь генерации (обычно 5-30 секунд)

### Шаг 3: Скачайте через Python

```bash
python rp5-helper.py download 28573 01.01.2024 31.12.2024
```

Или используйте в коде:

```python
from rp5_downloader import RP5Downloader

downloader = RP5Downloader()

# Скачать архив
file_path = downloader.download_station(
    station_id='28573',
    start_date='01.01.2024',
    end_date='31.12.2024'
)

if file_path:
    # Загрузить в DataFrame
    df = downloader.load_csv_to_dataframe(file_path)
    print(f"Загружено {len(df)} строк")
else:
    # Показать ссылку для генерации
    url = downloader.get_manual_download_url('28573')
    print(f"Сгенерируйте архив: {url}")

downloader.close()
```

## Популярные станции (обычно доступны)

Эти станции часто запрашиваются и обычно находятся в кэше:

```bash
# Санкт-Петербург (почти всегда работает)
python rp5-helper.py check 26063 01.01.2024 31.12.2024

# Москва (иногда доступна)
python rp5-helper.py check 27612 01.01.2024 31.12.2024
```

Полный список:
```bash
python rp5-helper.py popular
```

## Автоматизация

Для автоматического скачивания нескольких станций:

```python
from rp5_downloader import RP5Downloader

stations = ['26063', '27612', '28573']
downloader = RP5Downloader()

for station_id in stations:
    print(f"\nСтанция {station_id}:")
    
    file_path = downloader.download_station(
        station_id=station_id,
        start_date='01.01.2024',
        end_date='31.12.2024'
    )
    
    if file_path:
        print(f"  [OK] Скачано: {file_path}")
    else:
        url = downloader.get_manual_download_url(station_id)
        print(f"  [FAIL] Требуется генерация: {url}")

downloader.close()
```

## Советы

### 1. Используйте короткие периоды для тестов
```bash
# Быстрая генерация (1 месяц)
python rp5-helper.py check 28573 01.01.2024 31.01.2024
```

### 2. Кэшируйте скачанные файлы
Сохраняйте файлы локально, чтобы не скачивать повторно:
```python
import os

if os.path.exists('data/rp5-csv/28573.csv'):
    df = pd.read_csv('data/rp5-csv/28573.csv', sep=';', comment='#')
else:
    # Скачать новый
    file_path = downloader.download_station(...)
```

### 3. Обрабатывайте 403 gracefully
```python
file_path = downloader.download_station(station_id, start_date, end_date)

if not file_path:
    # Не паниковать - это нормально!
    print(f"Архив требует генерации")
    print(f"Откройте: {downloader.get_manual_download_url(station_id)}")
    # Можно попросить пользователя сгенерировать
    # Или использовать альтернативный источник данных
```

## Альтернативы

Если RP5 не подходит:

1. **NOAA ISD** - бесплатно, но другой формат
2. **Meteostat API** - ограниченные данные
3. **Open-Meteo** - исторические данные через API
4. **Коммерческие API** - платно, но надежно

См. `ALTERNATIVE-DATA-SOURCES.md`

## Troubleshooting

### Все станции возвращают 403
- Это нормально! Генерируйте архивы вручную
- Попробуйте Санкт-Петербург (26063) - обычно работает

### Ошибка "Invalid CSV format"
- Проверьте, что файл скачался полностью
- Убедитесь, что это CSV, а не HTML с ошибкой

### Долгая генерация на сайте
- Большие периоды (>5 лет) генерируются дольше
- Попробуйте разбить на меньшие периоды

## Дополнительная информация

- `RP5-PYTHON-DOWNLOADER.md` - полная документация
- `RP5-ON-DEMAND-GENERATION.md` - как работает система RP5
- `RP5-ARCHIVE-API.md` - технические детали API
