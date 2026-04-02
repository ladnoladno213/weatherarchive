# Quick Start - Массовое скачивание RP5

## За 5 минут

### Шаг 1: Тестирование (2 мин)

```bash
python test-rp5-generation.py
```

Скрипт проверит 4 метода и покажет, какой работает.

### Шаг 2: Если тесты прошли - запускайте массовое скачивание (3 мин)

```python
from rp5_mass_downloader import RP5MassDownloader

stations = ['26063', '27612', '28573']  # Ваши станции

downloader = RP5MassDownloader()

try:
    results = downloader.download_stations(
        station_ids=stations,
        start_date='01.04.2016',
        end_date='01.04.2026',
        max_workers=2
    )
    
    for station_id, file_path in results:
        if file_path:
            print(f"[OK] {station_id}: {file_path}")
        else:
            print(f"[FAIL] {station_id}")
            
finally:
    downloader.close()
```

### Шаг 3: Если тесты НЕ прошли - анализ через DevTools

1. Откройте https://rp5.ru/archive.php?wmo_id=26063
2. F12 → Network → XHR
3. Нажмите "Скачать архив"
4. Найдите POST запрос к `reFileSynop*.php`
5. Скопируйте параметры из Payload
6. Обновите `rp5_mass_downloader.py`:

```python
# В методе generate_file() обновите:
data = {
    'wmo_id': station_id,
    'a_date1': start_date,
    'a_date2': end_date,
    # ... ваши параметры из DevTools
}
```

## Если ничего не работает

### Вариант 1: Полуавтоматический (рекомендуется)

```python
from rp5_mass_downloader import RP5MassDownloader

downloader = RP5MassDownloader()

for station_id in ['26063', '27612', '28573']:
    # Пробуем скачать
    file_path = downloader.download_file(
        station_id, '01.04.2016', '01.04.2026'
    )
    
    if not file_path:
        # Показываем ссылку для ручной генерации
        print(f"\nОткройте: https://rp5.ru/archive.php?wmo_id={station_id}")
        print("Нажмите 'Скачать архив' и дождитесь генерации")
        input("Нажмите Enter после генерации...")
        
        # Повторяем попытку
        file_path = downloader.download_file(
            station_id, '01.04.2016', '01.04.2026'
        )
        
        if file_path:
            print(f"[OK] {station_id}: {file_path}")

downloader.close()
```

### Вариант 2: Selenium (полная автоматизация)

```bash
# Установка
pip install selenium
# Скачать ChromeDriver: https://chromedriver.chromium.org/
```

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def generate_with_selenium(station_id):
    options = webdriver.ChromeOptions()
    # options.add_argument('--headless')  # Без GUI
    
    driver = webdriver.Chrome(options=options)
    
    try:
        url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
        driver.get(url)
        time.sleep(2)
        
        # Заполнить форму и нажать кнопку
        # (нужно найти правильные селекторы)
        
        time.sleep(10)  # Ждем генерации
        
    finally:
        driver.quit()

# Использование
for station_id in stations:
    generate_with_selenium(station_id)
    file_path = downloader.download_file(station_id, ...)
```

## Советы

### 1. Начните с малого
```python
# Тестируйте на 1-2 станциях
test_stations = ['26063']  # Санкт-Петербург обычно работает
```

### 2. Используйте задержки
```python
import time
import random

for station_id in stations:
    download_station(station_id)
    time.sleep(random.uniform(2, 5))  # Задержка между станциями
```

### 3. Логируйте все
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    filename='rp5_download.log',
    format='%(asctime)s - %(message)s'
)
```

### 4. Сохраняйте статистику
```python
success = []
failed = []

for station_id in stations:
    if download_station(station_id):
        success.append(station_id)
    else:
        failed.append(station_id)

print(f"Успешно: {len(success)}/{len(stations)}")
print(f"Ошибок: {len(failed)}")
```

## Troubleshooting

### Все станции возвращают 403
**Решение:** Используйте полуавтоматический режим (ручная генерация + автоматическое скачивание)

### Error #FS001-0
**Решение:** RP5 блокирует автоматические запросы. Используйте Selenium или ручную генерацию.

### Timeout errors
**Решение:** Увеличьте timeout в запросах:
```python
response = session.get(url, timeout=60)  # Было 30
```

### Слишком медленно
**Решение:** Увеличьте параллельность (осторожно!):
```python
max_workers=3  # Было 2, но риск блокировки выше
```

## Дополнительная информация

- `RP5-MASS-DOWNLOAD-GUIDE.md` - полное руководство
- `rp5_mass_downloader.py` - основной скрипт
- `test-rp5-generation.py` - тестирование методов
- `analyze-rp5-generation-request.md` - анализ через DevTools

## Контрольный список

- [ ] Установлены зависимости (`pip install -r requirements.txt`)
- [ ] Запущен тест (`python test-rp5-generation.py`)
- [ ] Определен рабочий метод
- [ ] Протестировано на 1-2 станциях
- [ ] Настроено логирование
- [ ] Готов список станций для скачивания
- [ ] Определена стратегия (автоматическая/полуавтоматическая/Selenium)

Удачи! 🚀
