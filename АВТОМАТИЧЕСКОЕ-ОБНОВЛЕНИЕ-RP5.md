# Автоматическое обновление RP5 каждые 3 часа

## Проблема
GitHub Actions не может скачивать данные с RP5 (403 Forbidden), но твой компьютер может!

## Решение
Запусти сервис на своем компьютере, который будет:
1. Скачивать данные с RP5 каждые 3 часа
2. Автоматически пушить в GitHub
3. Render/Railway автоматически задеплоят обновления

## Быстрый старт

### Шаг 1: Установи зависимости
```bash
pip install schedule selenium requests
```

### Шаг 2: Запусти сервис
```bash
python rp5-auto-service.py
```

Готово! Сервис будет работать в фоне и обновлять данные каждые 3 часа.

---

## Автозапуск при включении компьютера

### Windows

#### Вариант 1: Task Scheduler (рекомендуется)

1. Открой Task Scheduler (Планировщик заданий)
2. Create Basic Task
3. Name: "RP5 Auto Update"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `python`
7. Arguments: `C:\path\to\your\project\rp5-auto-service.py`
8. Start in: `C:\path\to\your\project`
9. ✅ "Run whether user is logged on or not"
10. ✅ "Run with highest privileges"

#### Вариант 2: Startup folder

1. Создай файл `start-rp5-service.bat`:
```batch
@echo off
cd /d "C:\path\to\your\project"
python rp5-auto-service.py
```

2. Нажми `Win+R`, введи `shell:startup`
3. Скопируй `start-rp5-service.bat` в эту папку

### Linux/Mac

Создай systemd service (Linux) или launchd (Mac):

**Linux (systemd)**:
```bash
sudo nano /etc/systemd/system/rp5-updater.service
```

```ini
[Unit]
Description=RP5 Auto Updater
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/python3 /path/to/your/project/rp5-auto-service.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable rp5-updater
sudo systemctl start rp5-updater
sudo systemctl status rp5-updater
```

---

## Как это работает?

1. **Сервис запускается** на твоем компьютере
2. **Каждые 3 часа** (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00):
   - Открывает Chrome через Selenium
   - Заходит на RP5 для каждой станции
   - Скачивает последние 7 дней данных
   - Сохраняет в `data/rp5-realtime/`
3. **Автоматически коммитит** изменения в Git
4. **Пушит в GitHub**
5. **Render/Railway** видят новый коммит и деплоят обновления

---

## Преимущества

✅ Полностью автоматически  
✅ Работает 24/7 (если компьютер включен)  
✅ Реальные данные с RP5 каждые 3 часа  
✅ Не нужно ничего делать вручную  
✅ Сайт всегда с актуальными данными  

---

## Недостатки

⚠️ Требует, чтобы компьютер был включен  
⚠️ Использует ~100MB трафика в день  
⚠️ Занимает ~10 минут каждые 3 часа  

---

## Альтернатива: VPS/Cloud сервер

Если не хочешь держать компьютер включенным, можешь запустить сервис на:

- **VPS** (DigitalOcean, Linode, Vultr) - $5/месяц
- **AWS EC2 Free Tier** - бесплатно 12 месяцев
- **Google Cloud Free Tier** - бесплатно навсегда (с ограничениями)
- **Oracle Cloud Free Tier** - бесплатно навсегда

Установка на VPS:
```bash
# Подключись к VPS
ssh user@your-vps-ip

# Клонируй репозиторий
git clone https://github.com/your-username/weatherarchive.git
cd weatherarchive

# Установи зависимости
pip3 install schedule selenium requests

# Установи Chrome и ChromeDriver
sudo apt-get update
sudo apt-get install -y chromium-browser chromium-chromedriver

# Запусти сервис
nohup python3 rp5-auto-service.py > rp5-service.log 2>&1 &

# Проверь логи
tail -f rp5-service.log
```

---

## Мониторинг

### Проверить статус
```bash
# Посмотреть логи
tail -f rp5-service.log

# Проверить последнее обновление
ls -lh data/rp5-realtime/

# Проверить Git статус
git status
```

### Остановить сервис
Нажми `Ctrl+C` в окне где запущен сервис

### Перезапустить
```bash
python rp5-auto-service.py
```

---

## Troubleshooting

### Сервис не запускается
- Проверь, что установлены все зависимости: `pip install schedule selenium requests`
- Проверь, что Chrome установлен
- Проверь логи на ошибки

### Данные не обновляются
- Проверь, что компьютер включен в нужное время
- Проверь интернет-соединение
- Проверь, что Git настроен (может потребоваться авторизация)

### Git push не работает
- Настрой SSH ключи для GitHub
- Или используй Personal Access Token
- Проверь права доступа к репозиторию

---

## Итог

Теперь у тебя есть полностью автоматическая система обновления данных RP5!

Просто запусти сервис один раз, и он будет работать сам:
- Скачивает данные каждые 3 часа
- Пушит в GitHub автоматически
- Сайт обновляется автоматически

**Время настройки**: 5 минут  
**Время работы**: 24/7 автоматически  
**Результат**: Всегда актуальные данные на сайте
