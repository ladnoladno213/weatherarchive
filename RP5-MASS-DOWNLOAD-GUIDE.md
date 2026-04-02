# RP5 Mass Download Guide - Руководство по массовому скачиванию

## Обзор

Этот документ описывает стратегию массового скачивания архивов с RP5 с учетом системы on-demand generation.

## Созданные файлы

### 1. `rp5_mass_downloader.py`
Основной скрипт для массового скачивания с автоматической генерацией файлов.

**Возможности:**
- Инициация генерации через POST запрос
- Ожидание создания файла (2-5 сек)
- Скачивание с retry механизмом
- Поддержка нескольких серверов (ru1, ru2, ru3)
- Ограниченная параллельность (max 2 потока)
- Автоматическая распаковка .gz
- Статистика скачивания

### 2. `test-rp5-generation.py`
Тестовый скрипт для проверки различных методов генерации.

**Тесты:**
- Метод 1: POST на reFileSynopShort.php
- Метод 2: POST на reFileSynop.php
- Метод 3: Прямое скачивание
- Метод 4: Полный цикл (генерация + скачивание)

### 3. `analyze-rp5-generation-request.md`
Инструкция по анализу запросов через DevTools.

## Использование

### Шаг 1: Тестирование

Сначала протестируйте, какой метод работает:

```bash
python test-rp5-generation.py
```

Скрипт проверит 4 разных метода и покажет, какой работает.

### Шаг 2: Анализ через DevTools (если тесты не прошли)

1. Откройте https://rp5.ru/archive.php?wmo_id=26063
2. Откройте DevTools (F12) → вкладка Network
3. Нажмите "Скачать архив погоды"
4. Найдите POST запрос к `reFileSynop*.php`
5. Скопируйте параметры из вкладки "Payload"
6. Обновите `rp5_mass_downloader.py` с правильными параметрами

### Шаг 3: Массовое скачивание

```python
from rp5_mass_downloader import RP5MassDownloader

# Список станций
stations = [
    '26063',  # Санкт-Петербург
    '27612',  # Москва
    '28573',  # Ишим
    '29634',  # Новосибирск
    '28698',  # Екатеринбург
]

# Создаем загрузчик
downloader = RP5MassDownloader()

try:
    # Скачиваем все станции
    results = downloader.download_stations(
        station_ids=stations,
        start_date='01.04.2016',
        end_date='01.04.2026',
        max_workers=2  # Не более 2 параллельных потоков
    )
    
    # Обрабатываем результаты
    for station_id, file_path in results:
        if file_path:
            print(f"[OK] {station_id}: {file_path}")
            
            # Загружаем в DataFrame
            df = downloader.load_csv_to_dataframe(file_path)
            if df is not None:
                print(f"     Строк: {len(df)}")
        else:
            print(f"[FAIL] {station_id}: не скачан")
            
finally:
    downloader.close()
```

## Стратегии работы

### Стратегия 1: Автоматическая генерация (идеально)

**Если POST запрос работает:**

```python
# Полный автоматический цикл
for station_id in stations:
    # 1. Инициировать генерацию
    downloader.generate_file(station_id, start_date, end_date)
    
    # 2. Подождать
    time.sleep(5)
    
    # 3. Скачать
    file_path = downloader.download_file(station_id, start_date, end_date)
```

**Плюсы:**
- Полностью автоматизировано
- Не требует ручного вмешательства
- Можно запускать по cron

**Минусы:**
- Может не работать из-за защиты RP5
- Требует точных параметров POST запроса

### Стратегия 2: Полуавтоматическая (гибридная)

**Если POST не работает, но прямое скачивание работает:**

```python
# Пользователь генерирует вручную, скрипт скачивает
for station_id in stations:
    file_path = downloader.download_file(station_id, start_date, end_date)
    
    if not file_path:
        # Показать ссылку для ручной генерации
        url = f"https://rp5.ru/archive.php?wmo_id={station_id}"
        print(f"Сгенерируйте: {url}")
        input("Нажмите Enter после генерации...")
        
        # Повторить попытку
        file_path = downloader.download_file(station_id, start_date, end_date)
```

**Плюсы:**
- Надежно работает
- Обходит защиту RP5
- Скрипт автоматизирует скачивание

**Минусы:**
- Требует ручного вмешательства
- Не подходит для cron

### Стратегия 3: Selenium (максимальная надежность)

**Если нужна полная автоматизация:**

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def generate_with_selenium(station_id, start_date, end_date):
    """Генерирует файл через Selenium."""
    
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    
    driver = webdriver.Chrome(options=options)
    
    try:
        # Открываем страницу
        url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
        driver.get(url)
        time.sleep(2)
        
        # Заполняем форму
        driver.find_element(By.ID, 'a_date1').send_keys(start_date)
        driver.find_element(By.ID, 'a_date2').send_keys(end_date)
        
        # Нажимаем кнопку
        driver.find_element(By.ID, 'download_button').click()
        
        # Ждем генерации
        time.sleep(10)
        
        return True
        
    finally:
        driver.quit()

# Использование
for station_id in stations:
    # Генерируем через Selenium
    generate_with_selenium(station_id, start_date, end_date)
    
    # Скачиваем через requests
    file_path = downloader.download_file(station_id, start_date, end_date)
```

**Плюсы:**
- Полностью автоматизировано
- Обходит большинство защит
- Эмулирует реального пользователя

**Минусы:**
- Требует установки Selenium и ChromeDriver
- Медленнее, чем прямые запросы
- Требует больше ресурсов

### Стратегия 4: Пакетная обработка

**Для большого количества станций:**

```python
# День 1: Генерируем первую партию (10 станций)
batch_1 = stations[:10]
for station_id in batch_1:
    generate_manually(station_id)  # Вручную через браузер

# День 2: Скачиваем первую партию + генерируем вторую
for station_id in batch_1:
    download_file(station_id)

batch_2 = stations[10:20]
for station_id in batch_2:
    generate_manually(station_id)

# И так далее...
```

**Плюсы:**
- Не перегружает RP5
- Минимальный риск блокировки
- Можно обрабатывать сотни станций

**Минусы:**
- Требует времени
- Ручная работа

## Параметры для оптимизации

### Задержки

```python
# Между станциями
delay_between_stations = random.uniform(1, 3)  # секунды

# После генерации
delay_after_generation = random.uniform(2, 5)  # секунды

# При retry
delay_on_retry = random.uniform(3, 7)  # секунды
```

### Параллельность

```python
# Консервативно (рекомендуется)
max_workers = 2

# Агрессивно (риск блокировки)
max_workers = 5

# Последовательно (максимально безопасно)
max_workers = 1
```

### Retry логика

```python
# Количество попыток
max_retries = 5

# Количество попыток на сервер
max_attempts_per_server = 3

# Общее количество попыток
total_attempts = max_retries * len(servers) * max_attempts_per_server
```

## Мониторинг и логирование

### Логирование в файл

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rp5_download.log'),
        logging.StreamHandler()
    ]
)
```

### Сохранение статистики

```python
import json
from datetime import datetime

stats = {
    'date': datetime.now().isoformat(),
    'total': len(stations),
    'success': 0,
    'failed': 0,
    'stations': {}
}

for station_id in stations:
    result = download_station(station_id)
    
    if result:
        stats['success'] += 1
        stats['stations'][station_id] = 'success'
    else:
        stats['failed'] += 1
        stats['stations'][station_id] = 'failed'

# Сохраняем
with open('download_stats.json', 'w') as f:
    json.dump(stats, f, indent=2)
```

### Прогресс бар

```python
from tqdm import tqdm

for station_id in tqdm(stations, desc="Скачивание"):
    download_station(station_id)
```

## Запуск по расписанию (cron)

### Linux cron

```bash
# Редактировать crontab
crontab -e

# Запускать каждый день в 3:00
0 3 * * * cd /path/to/project && python3 rp5_mass_downloader.py >> /var/log/rp5_download.log 2>&1

# Запускать каждую неделю в воскресенье
0 3 * * 0 cd /path/to/project && python3 rp5_mass_downloader.py
```

### Windows Task Scheduler

```powershell
# Создать задачу
schtasks /create /tn "RP5 Download" /tr "python C:\path\to\rp5_mass_downloader.py" /sc daily /st 03:00
```

## Обработка ошибок

### Типичные ошибки

```python
try:
    file_path = downloader.download_station(station_id, start_date, end_date)
    
except requests.exceptions.Timeout:
    logger.error(f"Timeout для станции {station_id}")
    
except requests.exceptions.ConnectionError:
    logger.error(f"Connection error для станции {station_id}")
    
except Exception as e:
    logger.error(f"Неожиданная ошибка: {e}")
```

### Graceful degradation

```python
# Если не удалось скачать - сохранить в список для повтора
failed_stations = []

for station_id in stations:
    file_path = download_station(station_id)
    
    if not file_path:
        failed_stations.append(station_id)

# Повторить для неудачных
if failed_stations:
    logger.info(f"Повтор для {len(failed_stations)} станций...")
    
    for station_id in failed_stations:
        download_station(station_id)
```

## Рекомендации

### Для разработки
1. Тестировать на 1-2 станциях
2. Использовать Санкт-Петербург (26063) - обычно доступен
3. Включить DEBUG логирование
4. Сохранять все запросы и ответы

### Для продакшена
1. Использовать консервативные задержки (2-5 сек)
2. Ограничить параллельность (max 2 потока)
3. Логировать в файл
4. Мониторить статистику
5. Обрабатывать ошибки gracefully

### Для массового скачивания
1. Разбить на партии (10-20 станций)
2. Скачивать по расписанию (1 партия в день)
3. Использовать гибридный подход (ручная генерация + автоматическое скачивание)
4. Кэшировать скачанные файлы

## Альтернативы

Если RP5 не подходит для массового скачивания:

1. **NOAA ISD** - бесплатно, FTP доступ, все станции мира
2. **Open-Meteo** - API для исторических данных
3. **Meteostat** - Python библиотека для метеоданных
4. **Коммерческие API** - платно, но надежно

См. `ALTERNATIVE-DATA-SOURCES.md`

## Заключение

Массовое скачивание с RP5 возможно, но требует:
- Правильных параметров POST запроса (анализ через DevTools)
- Консервативного подхода (задержки, ограничение параллельности)
- Обработки ошибок и retry логики
- Возможно, ручного вмешательства или Selenium

Начните с тестирования (`test-rp5-generation.py`), определите рабочий метод, и масштабируйте постепенно.
