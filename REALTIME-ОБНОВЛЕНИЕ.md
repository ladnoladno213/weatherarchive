# Real-time обновление данных RP5

## Задача

Скачивать свежие данные с RP5 **каждые 3 часа** для всех городов:
- 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 (Екатеринбург)
- Для всех городов, для которых грузится прогноз
- Автоматически, без участия человека

## Решение

### Вариант 1: VPS/Dedicated Server (РЕКОМЕНДУЮ)

Нужен отдельный сервер с постоянной работой.

**Почему не Vercel/GitHub Actions:**
- ❌ Vercel - нет Selenium
- ❌ GitHub Actions - лимит на частоту (макс 1 раз в 5 минут)
- ❌ Serverless - timeout 10-60 сек (нужно 5+ минут на все станции)

**Подходящие платформы:**
- ✅ **DigitalOcean** - $6/месяц
- ✅ **Hetzner** - €4/месяц
- ✅ **Contabo** - €5/месяц
- ✅ **Домашний сервер** - Raspberry Pi / старый ПК

### Настройка на VPS

#### 1. Установка зависимостей

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f -y

# Установка ChromeDriver
CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d'.' -f1)
wget https://storage.googleapis.com/chrome-for-testing-public/LATEST_RELEASE_${CHROME_VERSION}
DRIVER_VERSION=$(cat LATEST_RELEASE_${CHROME_VERSION})
wget https://storage.googleapis.com/chrome-for-testing-public/${DRIVER_VERSION}/linux64/chromedriver-linux64.zip
unzip chromedriver-linux64.zip
sudo mv chromedriver-linux64/chromedriver /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver

# Установка Python пакетов
pip3 install selenium requests
```

#### 2. Загрузка проекта

```bash
cd /opt
git clone https://github.com/your-username/weather-website.git
cd weather-website
```

#### 3. Настройка cron

```bash
# Создать папку для логов
mkdir -p logs

# Отредактировать crontab
crontab -e

# Вставить содержимое из crontab-rp5.txt
# (замените /path/to/project на /opt/weather-website)
```

#### 4. Проверка

```bash
# Ручной запуск для теста
python3 rp5-realtime-updater.py

# Проверка логов
tail -f logs/rp5-update.log

# Проверка cron
crontab -l
```

### Вариант 2: Домашний сервер

Если есть домашний ПК/Raspberry Pi, который работает 24/7:

1. Установите Linux (Ubuntu/Debian)
2. Следуйте инструкциям выше
3. Настройте автозапуск при перезагрузке

### Вариант 3: Гибридное решение

**Сервер** → скачивает данные → **загружает в S3/R2** → **Vercel** читает оттуда

```
VPS (cron каждые 3 часа)
    ↓
Скачивает CSV с RP5
    ↓
Загружает в Cloudflare R2 / AWS S3
    ↓
Vercel читает из R2/S3
```

## Оптимизация

### Скачивание только последних данных

Скрипт `rp5-realtime-updater.py` скачивает только последние 7 дней:

```python
def get_date_range():
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    return (start_date.strftime('%d.%m.%Y'), end_date.strftime('%d.%m.%Y'))
```

Это быстрее чем скачивать весь архив с 2016 года!

### Параллельное скачивание

Для ускорения можно скачивать несколько станций параллельно:

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=3) as executor:
    futures = [executor.submit(download_station_quick, sid, start, end) 
               for sid in stations]
```

### Кэширование

Не скачивать станцию если файл свежий (< 3 часов):

```python
csv_path = output_path / f"{station_id}.csv"
if csv_path.exists():
    age = time.time() - csv_path.stat().st_mtime
    if age < 3 * 3600:  # Младше 3 часов
        logger.info(f"Станция {station_id}: пропуск (свежий файл)")
        return True
```

## Мониторинг

### Проверка логов

```bash
# Последние 50 строк
tail -50 logs/rp5-update.log

# Поиск ошибок
grep ERROR logs/rp5-update.log

# Статистика успешных/неудачных
grep "ИТОГО" logs/rp5-update.log
```

### Email уведомления

Добавьте в cron для отправки email при ошибках:

```bash
MAILTO=your@email.com
0 19 * * * cd /opt/weather-website && python3 rp5-realtime-updater.py
```

### Мониторинг через Telegram

Создайте бота и отправляйте уведомления:

```python
import requests

def send_telegram(message):
    bot_token = "YOUR_BOT_TOKEN"
    chat_id = "YOUR_CHAT_ID"
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    requests.post(url, json={"chat_id": chat_id, "text": message})

# В конце main()
send_telegram(f"RP5 Update: Успешно={success}, Ошибок={failed}")
```

## Стоимость

### VPS
- **DigitalOcean**: $6/месяц ($72/год)
- **Hetzner**: €4/месяц (€48/год)
- **Contabo**: €5/месяц (€60/год)

### Альтернативы
- **Домашний сервер**: бесплатно (электричество ~$5/месяц)
- **Raspberry Pi 4**: $35 одноразово + $5/месяц электричество

## Рекомендация

Для вашей задачи лучше всего:

1. **Арендовать VPS** (Hetzner €4/месяц)
2. Настроить cron для запуска каждые 3 часа
3. Файлы загружать в Cloudflare R2 (бесплатно до 10GB)
4. Vercel читает из R2

Это надежно, дешево и масштабируемо!
