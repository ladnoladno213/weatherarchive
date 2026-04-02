# RP5 Mass Download System - Система массового скачивания

## 🎯 Цель

Стабильная система для массового скачивания архивов погоды с RP5.ru через механизм генерации CSV файлов.

## 📦 Что создано

### Основные скрипты

1. **`rp5_mass_downloader.py`** - Главный класс для массового скачивания
   - Инициация генерации файлов через POST запрос
   - Ожидание создания файла (2-5 сек)
   - Скачивание с retry механизмом (до 5 попыток)
   - Поддержка 3 серверов (ru1, ru2, ru3)
   - Ограниченная параллельность (max 2 потока)
   - Автоматическая распаковка .gz
   - Статистика скачивания

2. **`test-rp5-generation.py`** - Тестирование методов генерации
   - Метод 1: POST на reFileSynopShort.php
   - Метод 2: POST на reFileSynop.php
   - Метод 3: Прямое скачивание
   - Метод 4: Полный цикл (генерация + скачивание)

3. **`rp5-helper.py`** - Утилита командной строки
   - Проверка доступности станций
   - Скачивание с повторными попытками
   - Генерация URL для ручного скачивания

### Документация

1. **`QUICK-START-MASS-DOWNLOAD.md`** ⭐ - Быстрый старт (5 минут)
2. **`RP5-MASS-DOWNLOAD-GUIDE.md`** - Полное руководство
3. **`analyze-rp5-generation-request.md`** - Анализ через DevTools
4. **`RP5-ON-DEMAND-GENERATION.md`** - Как работает система RP5

## 🚀 Быстрый старт

### Шаг 1: Установка зависимостей

```bash
pip install -r requirements.txt
```

### Шаг 2: Тестирование

```bash
python test-rp5-generation.py
```

Скрипт проверит 4 метода и покажет, какой работает.

### Шаг 3: Массовое скачивание

```python
from rp5_mass_downloader import RP5MassDownloader

# Список станций (WMO ID)
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

## 📋 Требования выполнены

### ✅ Технические требования

- [x] Python + requests
- [x] requests.Session() для cookies
- [x] GET на https://rp5.ru/ перед действиями
- [x] Реалистичные заголовки (User-Agent, Referer, Accept-Language)
- [x] Случайные задержки (1-3 сек между станциями, 2-5 сек после генерации)
- [x] Ограниченная параллельность (max 2 потока)
- [x] Поддержка нескольких серверов (ru1, ru2, ru3)
- [x] Сохранение как {station_id}.csv.gz
- [x] Автоматическая распаковка gzip
- [x] Чтение через pandas
- [x] Логирование (успехи, ошибки, повторы)
- [x] Чистый код, разбитый на функции
- [x] Возможность передать список станций

### ✅ Логика работы

- [x] Инициация генерации CSV через POST запрос
- [x] Ожидание 2-5 секунд после генерации
- [x] Скачивание по прямой ссылке
- [x] Retry при 403/404 (до 5 попыток)
- [x] Повторная генерация при неудаче

## 🔧 Архитектура

### Класс RP5MassDownloader

```python
class RP5MassDownloader:
    def __init__(self, output_dir='data/rp5-csv')
    
    # Основные методы
    def generate_file(station_id, start_date, end_date) -> bool
    def download_file(station_id, start_date, end_date) -> Path
    def download_station_with_generation(station_id, ...) -> Path
    def download_stations(station_ids, ...) -> List[Tuple]
    
    # Вспомогательные методы
    def load_csv_to_dataframe(csv_path) -> DataFrame
    def close()
```

### Функции

1. **`generate_file()`** - Инициирует генерацию через POST
2. **`download_file()`** - Скачивает файл с retry
3. **`download_station_with_generation()`** - Полный цикл для одной станции
4. **`download_stations()`** - Массовое скачивание с параллельностью

## 📊 Стратегии использования

### Стратегия 1: Автоматическая (если POST работает)

```python
# Полностью автоматизировано
downloader = RP5MassDownloader()
results = downloader.download_stations(stations, start_date, end_date)
```

**Плюсы:** Полная автоматизация, можно запускать по cron  
**Минусы:** Может не работать из-за защиты RP5

### Стратегия 2: Полуавтоматическая (рекомендуется)

```python
# Ручная генерация + автоматическое скачивание
for station_id in stations:
    file_path = downloader.download_file(station_id, start_date, end_date)
    
    if not file_path:
        print(f"Сгенерируйте: https://rp5.ru/archive.php?wmo_id={station_id}")
        input("Нажмите Enter после генерации...")
        file_path = downloader.download_file(station_id, start_date, end_date)
```

**Плюсы:** Надежно работает, обходит защиту  
**Минусы:** Требует ручного вмешательства

### Стратегия 3: Selenium (полная автоматизация)

```python
# Эмуляция браузера через Selenium
from selenium import webdriver

def generate_with_selenium(station_id):
    driver = webdriver.Chrome()
    driver.get(f'https://rp5.ru/archive.php?wmo_id={station_id}')
    # Заполнить форму и нажать кнопку
    # ...
    driver.quit()

for station_id in stations:
    generate_with_selenium(station_id)
    file_path = downloader.download_file(station_id, start_date, end_date)
```

**Плюсы:** Полная автоматизация, обходит защиту  
**Минусы:** Требует Selenium, медленнее

## 🎛️ Настройка параметров

### Задержки

```python
# В rp5_mass_downloader.py

# Между станциями
delay = random.uniform(1, 3)  # секунды

# После генерации
wait_time = random.uniform(2, 5)  # секунды

# При retry
wait_time = random.uniform(3, 7)  # секунды
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
# Количество повторов всего цикла
max_retries = 5

# Количество попыток скачивания с одного сервера
max_attempts = 3
```

## 📝 Логирование

### Базовое логирование

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
```

### Логирование в файл

```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rp5_download.log'),
        logging.StreamHandler()
    ]
)
```

### Статистика

```python
# Автоматически собирается в downloader.stats
print(f"Успешно: {downloader.stats['success']}")
print(f"Ошибок: {downloader.stats['failed']}")
print(f"Повторов: {downloader.stats['retries']}")
```

## 🔍 Анализ запросов через DevTools

Если автоматическая генерация не работает:

1. Откройте https://rp5.ru/archive.php?wmo_id=26063
2. F12 → Network → XHR
3. Нажмите "Скачать архив погоды"
4. Найдите POST запрос к `reFileSynop*.php`
5. Скопируйте параметры из вкладки "Payload"
6. Обновите `rp5_mass_downloader.py`:

```python
# В методе generate_file()
data = {
    'wmo_id': station_id,
    'a_date1': start_date,
    'a_date2': end_date,
    # ... ваши параметры из DevTools
}
```

Подробнее: `analyze-rp5-generation-request.md`

## ⏰ Запуск по расписанию

### Linux (cron)

```bash
# Редактировать crontab
crontab -e

# Запускать каждый день в 3:00
0 3 * * * cd /path/to/project && python3 rp5_mass_downloader.py >> /var/log/rp5.log 2>&1
```

### Windows (Task Scheduler)

```powershell
schtasks /create /tn "RP5 Download" /tr "python C:\path\to\rp5_mass_downloader.py" /sc daily /st 03:00
```

## 🐛 Troubleshooting

### Все станции возвращают 403

**Причина:** Файлы не сгенерированы  
**Решение:** Используйте полуавтоматический режим или Selenium

### Error #FS001-0

**Причина:** RP5 блокирует автоматические запросы  
**Решение:** 
1. Проверьте параметры POST через DevTools
2. Используйте Selenium
3. Используйте полуавтоматический режим

### Timeout errors

**Причина:** Медленное соединение или большой файл  
**Решение:** Увеличьте timeout:

```python
response = session.get(url, timeout=60)  # Было 30
```

### Слишком медленно

**Причина:** Консервативные настройки  
**Решение:** Увеличьте параллельность (осторожно!):

```python
max_workers = 3  # Было 2
```

## 📚 Документация

### Быстрый старт
- `QUICK-START-MASS-DOWNLOAD.md` - За 5 минут

### Руководства
- `RP5-MASS-DOWNLOAD-GUIDE.md` - Полное руководство
- `RP5-ON-DEMAND-GENERATION.md` - Как работает RP5
- `analyze-rp5-generation-request.md` - Анализ через DevTools

### Справочники
- `README-RP5.md` - Общий README
- `RP5-PYTHON-DOWNLOADER.md` - Базовый downloader
- `RP5-IMPLEMENTATION-STATUS.md` - Статус проекта

## 🎯 Примеры использования

### Пример 1: Простое скачивание

```python
from rp5_mass_downloader import RP5MassDownloader

downloader = RP5MassDownloader()

try:
    file_path = downloader.download_station_with_generation(
        station_id='26063',
        start_date='01.04.2016',
        end_date='01.04.2026'
    )
    
    if file_path:
        print(f"Скачано: {file_path}")
        
        df = downloader.load_csv_to_dataframe(file_path)
        print(f"Строк: {len(df)}")
        
finally:
    downloader.close()
```

### Пример 2: Массовое скачивание с логированием

```python
import logging
from rp5_mass_downloader import RP5MassDownloader

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.FileHandler('rp5_download.log'),
        logging.StreamHandler()
    ]
)

stations = ['26063', '27612', '28573', '29634', '28698']

downloader = RP5MassDownloader()

try:
    results = downloader.download_stations(
        station_ids=stations,
        start_date='01.04.2016',
        end_date='01.04.2026',
        max_workers=2
    )
    
    # Сохраняем результаты
    success = [s for s, p in results if p]
    failed = [s for s, p in results if not p]
    
    print(f"\nУспешно: {len(success)}/{len(stations)}")
    print(f"Ошибок: {len(failed)}")
    
    if failed:
        print(f"Не скачаны: {', '.join(failed)}")
        
finally:
    downloader.close()
```

### Пример 3: Полуавтоматический режим

```python
from rp5_mass_downloader import RP5MassDownloader

stations = ['26063', '27612', '28573']
downloader = RP5MassDownloader()

try:
    for station_id in stations:
        print(f"\n{'='*60}")
        print(f"Станция: {station_id}")
        print('='*60)
        
        # Пробуем скачать
        file_path = downloader.download_file(
            station_id, '01.04.2016', '01.04.2026'
        )
        
        if not file_path:
            # Показываем инструкцию
            url = f"https://rp5.ru/archive.php?wmo_id={station_id}"
            print(f"\n[ТРЕБУЕТСЯ ДЕЙСТВИЕ]")
            print(f"1. Откройте: {url}")
            print(f"2. Выберите период: 01.04.2016 - 01.04.2026")
            print(f"3. Нажмите 'Скачать архив погоды'")
            print(f"4. Дождитесь генерации (5-30 сек)")
            
            input("\nНажмите Enter после генерации...")
            
            # Повторяем попытку
            file_path = downloader.download_file(
                station_id, '01.04.2016', '01.04.2026'
            )
            
            if file_path:
                print(f"[OK] Скачано: {file_path}")
            else:
                print(f"[FAIL] Не удалось скачать")
        else:
            print(f"[OK] Скачано: {file_path}")
            
finally:
    downloader.close()
```

## 🔗 Альтернативные источники

Если RP5 не подходит для массового скачивания:

1. **NOAA ISD** - бесплатно, FTP доступ, все станции мира
2. **Open-Meteo** - API для исторических данных
3. **Meteostat** - Python библиотека
4. **Коммерческие API** - платно, но надежно

См. `ALTERNATIVE-DATA-SOURCES.md`

## 📞 Поддержка

Если возникли вопросы:

1. Прочитайте `QUICK-START-MASS-DOWNLOAD.md`
2. Запустите `python test-rp5-generation.py`
3. Изучите `RP5-MASS-DOWNLOAD-GUIDE.md`
4. Проанализируйте запросы через DevTools

## ✅ Контрольный список

Перед запуском массового скачивания:

- [ ] Установлены зависимости
- [ ] Запущен тест генерации
- [ ] Определен рабочий метод
- [ ] Протестировано на 1-2 станциях
- [ ] Настроено логирование
- [ ] Подготовлен список станций
- [ ] Выбрана стратегия (автоматическая/полуавтоматическая/Selenium)
- [ ] Настроены задержки и параллельность
- [ ] Готов план обработки ошибок

## 🎉 Заключение

Система готова к использованию! Начните с тестирования на 1-2 станциях, определите рабочий метод, и масштабируйте постепенно.

**Рекомендация:** Используйте полуавтоматический режим для максимальной надежности.

Удачи! 🚀
