# GitHub Actions - Инструкция

## Настроенные Workflows

### 1. RP5 Frequent Updates (rp5-frequent.yml)
**Статус**: ✅ Работает

**Что делает**: Обновляет данные о погоде каждые 3 часа из RP5

**Расписание**: Каждые 3 часа (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC)

**Файлы**:
- Workflow: `.github/workflows/rp5-frequent.yml`
- Скрипт: `rp5-github-updater.py`

**Последнее исправление**: Исправлен парсинг `data/wmo-mapping.js` (использует regex вместо JSON)

---

### 2. Download RP5 Weather Data (download-rp5.yml)
**Статус**: ⚠️ В разработке

**Что делает**: Скачивает архивные данные погоды с RP5

**Расписание**: 1-го числа каждого месяца в 03:00 UTC

**Файлы**:
- Workflow: `.github/workflows/download-rp5.yml`
- Скрипт: `rp5-github-action.py`

**Текущая проблема**: 
- Прямые ссылки на архивы RP5 возвращают 403 Forbidden
- RP5 блокирует автоматическое скачивание
- Требуется более сложный подход с cookies/сессиями

**Возможные решения**:
1. Использовать Selenium для полного процесса (включая скачивание через браузер)
2. Получить cookies через браузер и использовать их в requests
3. Скачивать данные вручную и загружать в репозиторий

**Статус**: Временно отключен, требует доработки

---

## Как запустить вручную

1. Перейдите на страницу Actions: https://github.com/ВАШ_USERNAME/weatherarchive/actions
2. Выберите нужный workflow слева
3. Нажмите "Run workflow" справа
4. Выберите ветку (обычно `main`)
5. Нажмите зеленую кнопку "Run workflow"

---

## Как проверить статус

### Через веб-интерфейс
https://github.com/ВАШ_USERNAME/weatherarchive/actions

### Через скрипты
```bash
# Проверить последние запуски
python check-github-actions.py

# Проверить логи конкретного запуска
python check-github-logs.py

# Проверить самый последний запуск
python check-latest-run.py
```

---

## Настройка станций для скачивания

Отредактируйте файл `rp5-github-downloader.js`:

```javascript
const STATIONS = [
  {
    wmoId: '28573',
    cityName: 'Ishim',
    startDate: '2005-01-01',
    endDate: '2026-04-02'
  },
  {
    wmoId: '26063',
    cityName: 'Moscow',
    startDate: '2020-01-01',
    endDate: '2026-04-02'
  },
  // Добавьте свои станции здесь
];
```

Формат: `{ wmoId, cityName, startDate, endDate }` (даты в формате YYYY-MM-DD)

---

## Troubleshooting

### Workflow падает с ошибкой "exit code 1"
- Проверьте логи скрипта в GitHub Actions
- Убедитесь, что WMO ID правильный
- Проверьте, что даты в формате YYYY-MM-DD

### Не скачиваются данные
- Проверьте, что WMO ID существует на RP5
- Убедитесь, что для станции есть архивные данные
- Проверьте логи workflow

### "Connection aborted" или "Remote end closed connection"
- Это нормально для старого Selenium метода
- Новый метод (прямое скачивание) решает эту проблему

### Изменения не коммитятся
- Убедитесь, что файлы действительно изменились
- Проверьте права доступа GitHub Action (Settings → Actions → General → Workflow permissions)

---

## История исправлений

**02.04.2026**
- ✅ Переход на прямое скачивание без Selenium (download-rp5.yml)
- ✅ Создан новый скрипт rp5-github-downloader.js
- ✅ Упрощен workflow - не требует Python, Chrome, ChromeDriver
- ✅ Исправлен workflow rp5-frequent.yml (парсинг wmo-mapping.js)
