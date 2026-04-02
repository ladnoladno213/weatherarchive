# Анализ запроса генерации файла на RP5

## Цель
Определить точные параметры POST запроса для инициации генерации CSV файла.

## Инструкция по анализу через DevTools

### Шаг 1: Открыть DevTools
1. Открыть https://rp5.ru/archive.php?wmo_id=26063 в браузере
2. Нажать F12 (открыть DevTools)
3. Перейти на вкладку **Network**
4. Включить фильтр **XHR** или **Fetch**

### Шаг 2: Инициировать генерацию
1. На странице архива выбрать период (например, 01.01.2024 - 31.12.2024)
2. Нажать кнопку **"Скачать архив погоды"**
3. В DevTools появится запрос к серверу

### Шаг 3: Анализ запроса
Найти запрос к одному из endpoints:
- `reFileSynop.php`
- `reFileSynopShort.php`
- `responses/reFileSynop.php`
- Или аналогичный

### Шаг 4: Скопировать параметры

#### Request URL
```
https://rp5.ru/responses/reFileSynopShort.php
```

#### Request Method
```
POST
```

#### Request Headers
```
Accept: */*
Accept-Encoding: gzip, deflate, br
Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
Connection: keep-alive
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Cookie: PHPSESSID=...; lang=ru
Host: rp5.ru
Origin: https://rp5.ru
Referer: https://rp5.ru/archive.php?wmo_id=26063&lang=ru
User-Agent: Mozilla/5.0 ...
X-Requested-With: XMLHttpRequest
```

#### Form Data (нужно определить!)
Возможные параметры:
```
wmo_id: 26063
a_date1: 01.01.2024
a_date2: 31.12.2024
f_ed3: 12 или 13 (формат времени)
f_ed4: 1 (тип данных - SYNOP)
f_ed5: 1 (формат файла - CSV)
f_pe: 1 (период)
f_pe1: 01.01.2024
f_pe2: 31.12.2024
lng_id: 2 (язык - русский)
```

### Шаг 5: Проверка ответа

#### Успешный ответ
Может быть:
- JSON: `{"status": "ok", "file_id": "..."}`
- HTML: `<div>Файл готовится...</div>`
- Redirect: перенаправление на страницу скачивания

#### Ошибка
- `Error #FS001-0` - блокировка автоматических запросов
- `Error #FS002` - неверные параметры
- HTTP 403/404 - доступ запрещен

## Альтернативный подход: Selenium

Если POST запрос не работает из-за защиты, можно использовать Selenium:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def generate_with_selenium(station_id, start_date, end_date):
    """Генерирует файл через Selenium (эмуляция браузера)."""
    
    # Настройка драйвера
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')  # Без GUI
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=options)
    
    try:
        # Открываем страницу архива
        url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
        driver.get(url)
        
        # Ждем загрузки страницы
        time.sleep(2)
        
        # Заполняем форму
        # (нужно найти селекторы полей через DevTools)
        date_start = driver.find_element(By.ID, 'a_date1')
        date_start.clear()
        date_start.send_keys(start_date)
        
        date_end = driver.find_element(By.ID, 'a_date2')
        date_end.clear()
        date_end.send_keys(end_date)
        
        # Нажимаем кнопку "Скачать"
        download_btn = driver.find_element(By.ID, 'download_button')
        download_btn.click()
        
        # Ждем генерации (5-30 секунд)
        time.sleep(10)
        
        # Получаем ссылку на файл
        # (нужно определить, как RP5 возвращает ссылку)
        
        return True
        
    finally:
        driver.quit()
```

## Тестирование

### Тест 1: Простой POST запрос
```python
import requests

session = requests.Session()

# Получаем cookies
session.get('https://rp5.ru/')

# Отправляем POST
response = session.post(
    'https://rp5.ru/responses/reFileSynopShort.php',
    data={
        'wmo_id': '26063',
        'a_date1': '01.01.2024',
        'a_date2': '31.12.2024',
        'f_ed3': '12',
        'f_ed4': '1',
        'f_ed5': '1',
        'lng_id': '2'
    },
    headers={
        'User-Agent': 'Mozilla/5.0 ...',
        'Referer': 'https://rp5.ru/archive.php?wmo_id=26063',
        'X-Requested-With': 'XMLHttpRequest'
    }
)

print(response.status_code)
print(response.text)
```

### Тест 2: С полными заголовками
```python
headers = {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'ru-RU,ru;q=0.9',
    'Connection': 'keep-alive',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://rp5.ru',
    'Referer': 'https://rp5.ru/archive.php?wmo_id=26063&lang=ru',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Requested-With': 'XMLHttpRequest'
}
```

## Ожидаемые проблемы

### 1. Error #FS001-0
**Причина:** RP5 детектирует автоматический запрос

**Решения:**
- Добавить больше реалистичных заголовков
- Использовать cookies из реального браузера
- Добавить случайные задержки
- Использовать Selenium

### 2. CAPTCHA
**Причина:** Защита от ботов

**Решения:**
- Использовать Selenium с ручным решением CAPTCHA
- Использовать сервисы решения CAPTCHA (2captcha, anticaptcha)
- Ограничить частоту запросов

### 3. IP блокировка
**Причина:** Слишком много запросов с одного IP

**Решения:**
- Увеличить задержки между запросами
- Использовать прокси (не рекомендуется для этой задачи)
- Скачивать по несколько станций в день

## Рекомендации

1. **Начать с анализа DevTools** - определить точные параметры
2. **Тестировать на одной станции** - Санкт-Петербург (26063)
3. **Постепенно увеличивать нагрузку** - начать с 1-2 станций
4. **Добавить логирование** - сохранять все запросы и ответы
5. **Обрабатывать ошибки gracefully** - не падать при 403/404

## Следующие шаги

1. Открыть DevTools и проанализировать реальный запрос
2. Обновить `rp5_mass_downloader.py` с правильными параметрами
3. Протестировать на Санкт-Петербурге
4. Если работает - масштабировать на другие станции
5. Если не работает - рассмотреть Selenium

## Полезные ссылки

- DevTools Network: https://developer.chrome.com/docs/devtools/network/
- Selenium Python: https://selenium-python.readthedocs.io/
- Requests documentation: https://requests.readthedocs.io/
